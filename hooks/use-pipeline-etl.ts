"use client"

import { useCallback, useMemo, useRef, useState } from "react"

import {
  aRegistroCarga,
  crearLotes,
  procesarLotes,
  type EnviarLote,
  type Lote,
  type VerificarClaves,
} from "@/lib/etl/carga"
import { CIUDADES, buscarCiudad, type Ciudad } from "@/lib/etl/ciudades"
import { construirUrl, descargarCiudad, type ConfiguracionExtraccion } from "@/lib/etl/extraccion"
import {
  FILTROS_VACIOS,
  ORDEN_POR_DEFECTO,
  aplicarFiltros,
  conjuntoDeCarga,
  ordenar,
  type Filtros,
  type Orden,
} from "@/lib/etl/filtros"
import { limpiar } from "@/lib/etl/limpieza"
import type { RespuestaOpenMeteo } from "@/lib/etl/tipos"
import { transformar } from "@/lib/etl/transformacion"

export type DescargaCiudad = {
  ciudad: Ciudad
  url: string
  estado: "pendiente" | "descargando" | "ok" | "error"
  respuesta: RespuestaOpenMeteo | null
  /** Texto exacto recibido, para descargarlo sin reformatear. */
  textoOriginal: string | null
  error: string | null
  duracionMs: number | null
  intentos: number
}

export type Extraccion = {
  inicio: string
  fin: string
  descargas: DescargaCiudad[]
}

export type CargaCongelada = {
  congeladaEn: Date
  lotes: Lote[]
}

function medir<T>(fn: () => T): [T, number] {
  const t0 = performance.now()
  const resultado = fn()
  return [resultado, performance.now() - t0]
}

async function leerError(respuesta: Response) {
  try {
    const cuerpo = (await respuesta.json()) as { error?: string; detalles?: string[] }
    const detalles = cuerpo.detalles?.length ? ` ${cuerpo.detalles.slice(0, 3).join(" ")}` : ""
    return `${cuerpo.error ?? `HTTP ${respuesta.status}`}${detalles}`
  } catch {
    return `El servidor respondió HTTP ${respuesta.status}.`
  }
}

const enviarLote: EnviarLote = async (registros) => {
  const respuesta = await fetch("/api/carga", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ registros }),
  })
  if (!respuesta.ok) throw new Error(await leerError(respuesta))
  const cuerpo = (await respuesta.json()) as { procesados: number | null }
  return { procesados: cuerpo.procesados }
}

const verificarClaves: VerificarClaves = async (registros) => {
  const respuesta = await fetch("/api/verificar", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      claves: registros.map((r) => ({ ciudad: r.ciudad, fecha_hora: r.fecha_hora })),
    }),
  })
  if (!respuesta.ok) throw new Error(await leerError(respuesta))
  return (await respuesta.json()) as { faltantes: string[] }
}

export function usePipelineEtl() {
  const [extraccion, setExtraccion] = useState<Extraccion | null>(null)
  const [extrayendo, setExtrayendo] = useState(false)
  const [filtros, setFiltros] = useState<Filtros>(FILTROS_VACIOS)
  const [orden, setOrden] = useState<Orden>(ORDEN_POR_DEFECTO)
  const [seleccion, setSeleccion] = useState<ReadonlySet<string>>(new Set())
  const [carga, setCarga] = useState<CargaCongelada | null>(null)
  const [cargando, setCargando] = useState(false)
  // Candado síncrono: evita dos envíos aunque se pulse dos veces antes de re-renderizar.
  const cargaEnCurso = useRef(false)

  const actualizarDescarga = useCallback((id: string, cambios: Partial<DescargaCiudad>) => {
    setExtraccion((prev) =>
      prev && {
        ...prev,
        descargas: prev.descargas.map((d) => (d.ciudad.id === id ? { ...d, ...cambios } : d)),
      }
    )
  }, [])

  const descargar = useCallback(
    async (ciudad: Ciudad, inicio: string, fin: string, intentosPrevios: number) => {
      actualizarDescarga(ciudad.id, {
        estado: "descargando",
        error: null,
        intentos: intentosPrevios + 1,
      })
      const t0 = performance.now()
      try {
        let textoOriginal = ""
        const respuesta = await descargarCiudad(ciudad, inicio, fin, {
          // Guardamos también el texto exacto recibido.
          fetcher: async (url, init) => {
            const r = await fetch(url, init)
            textoOriginal = await r.clone().text()
            return r
          },
        })
        actualizarDescarga(ciudad.id, {
          estado: "ok",
          respuesta,
          textoOriginal,
          duracionMs: performance.now() - t0,
        })
      } catch (error) {
        // Si falla un reintento, se descartan los datos anteriores de esa
        // ciudad para no mezclar dos extracciones distintas.
        actualizarDescarga(ciudad.id, {
          estado: "error",
          respuesta: null,
          textoOriginal: null,
          error: error instanceof Error ? error.message : String(error),
          duracionMs: performance.now() - t0,
        })
      }
    },
    [actualizarDescarga]
  )

  /** Nueva extracción: descarta todo lo anterior y pide las ciudades una a una. */
  const extraer = useCallback(
    async (config: ConfiguracionExtraccion) => {
      if (extrayendo || cargaEnCurso.current) return
      const ciudades = CIUDADES.filter((c) => config.ciudades.includes(c.id))
      setExtrayendo(true)
      setSeleccion(new Set())
      setFiltros(FILTROS_VACIOS)
      setCarga(null)
      setExtraccion({
        inicio: config.inicio,
        fin: config.fin,
        descargas: ciudades.map((ciudad) => ({
          ciudad,
          url: construirUrl(ciudad, config.inicio, config.fin),
          estado: "pendiente",
          respuesta: null,
          textoOriginal: null,
          error: null,
          duracionMs: null,
          intentos: 0,
        })),
      })
      for (const ciudad of ciudades) {
        await descargar(ciudad, config.inicio, config.fin, 0)
      }
      setExtrayendo(false)
    },
    [descargar, extrayendo]
  )

  /** Reintenta solo una ciudad. Sus datos sustituyen a los anteriores: no se duplican. */
  const reintentarCiudad = useCallback(
    async (id: string) => {
      const ciudad = buscarCiudad(id)
      const descarga = extraccion?.descargas.find((d) => d.ciudad.id === id)
      if (!ciudad || !extraccion || !descarga || extrayendo || cargaEnCurso.current) return
      setExtrayendo(true)
      await descargar(ciudad, extraccion.inicio, extraccion.fin, descarga.intentos)
      setExtrayendo(false)
    },
    [descargar, extraccion, extrayendo]
  )

  // --- Fases derivadas: se recalculan a partir de las respuestas originales ---

  const transformacion = useMemo(() => {
    const entradas = (extraccion?.descargas ?? [])
      .filter((d) => d.estado === "ok" && d.respuesta)
      .map((d) => ({ ciudad: d.ciudad.nombre, respuesta: d.respuesta! }))
    const [resultado, duracionMs] = medir(() => transformar(entradas))
    return { ...resultado, entradas: entradas.length, duracionMs }
  }, [extraccion])

  const limpieza = useMemo(() => {
    const [resultado, duracionMs] = medir(() => limpiar(transformacion.registros))
    return { ...resultado, duracionMs }
  }, [transformacion])

  // Orden obligatorio: válidos → filtros → ordenación → selección → carga.
  const seleccionados = useMemo(() => {
    const [resultado, duracionMs] = medir(() => {
      const filtrados = aplicarFiltros(limpieza.validos, filtros)
      const ordenados = ordenar(filtrados, orden)
      return { ordenados, ...conjuntoDeCarga(ordenados, seleccion) }
    })
    return { ...resultado, duracionMs }
  }, [limpieza, filtros, orden, seleccion])

  const alternarSeleccion = useCallback((claves: string[], seleccionar: boolean) => {
    setSeleccion((prev) => {
      const nueva = new Set(prev)
      for (const clave of claves) {
        if (seleccionar) nueva.add(clave)
        else nueva.delete(clave)
      }
      return nueva
    })
  }, [])

  const seleccionarFiltrados = useCallback(() => {
    alternarSeleccion(
      seleccionados.ordenados.map((r) => r.clave),
      true
    )
  }, [alternarSeleccion, seleccionados.ordenados])

  const vaciarSeleccion = useCallback(() => setSeleccion(new Set()), [])

  /** Congela una copia del conjunto actual (con su orden) y la envía por lotes. */
  const subir = useCallback(async () => {
    if (cargaEnCurso.current || seleccionados.aSubir.length === 0) return
    cargaEnCurso.current = true
    setCargando(true)
    const lotes = crearLotes(seleccionados.aSubir.map(aRegistroCarga))
    const congeladaEn = new Date()
    setCarga({ congeladaEn, lotes })
    try {
      await procesarLotes(lotes, enviarLote, verificarClaves, (l) =>
        setCarga({ congeladaEn, lotes: l })
      )
    } finally {
      cargaEnCurso.current = false
      setCargando(false)
    }
  }, [seleccionados.aSubir])

  /** Reintenta los lotes fallidos (y verificaciones fallidas) de la carga congelada. */
  const reintentarCarga = useCallback(async () => {
    if (cargaEnCurso.current || !carga) return
    cargaEnCurso.current = true
    setCargando(true)
    try {
      await procesarLotes(carga.lotes, enviarLote, verificarClaves, (l) =>
        setCarga({ congeladaEn: carga.congeladaEn, lotes: l })
      )
    } finally {
      cargaEnCurso.current = false
      setCargando(false)
    }
  }, [carga])

  return {
    extraccion,
    extrayendo,
    extraer,
    reintentarCiudad,
    transformacion,
    limpieza,
    filtros,
    setFiltros,
    orden,
    setOrden,
    seleccion,
    seleccionados,
    alternarSeleccion,
    seleccionarFiltrados,
    vaciarSeleccion,
    carga,
    cargando,
    subir,
    reintentarCarga,
  }
}

export type PipelineEtl = ReturnType<typeof usePipelineEtl>

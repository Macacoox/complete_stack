"use client"

import "maplibre-gl/dist/maplibre-gl.css"

import maplibregl from "maplibre-gl"
import { useEffect, useRef } from "react"

import type { ResumenCiudad } from "@/hooks/use-resumen-ciudades"
import { CIUDADES } from "@/lib/etl/ciudades"
import { n } from "@/lib/etl/formato"

const CLAVE_MAPTILER = process.env.NEXT_PUBLIC_MAPTILER_KEY

/** Vista satélite con nombres de ciudades, carreteras y fronteras. */
const ESTILO = `https://api.maptiler.com/maps/hybrid/style.json?key=${CLAVE_MAPTILER}`

const LIMITES_CIUDADES = CIUDADES.reduce(
  (l, c) => l.extend([c.longitud, c.latitud]),
  new maplibregl.LngLatBounds()
)

/** Ancho aproximado de la etiqueta que va a la derecha de cada punto. */
const ANCHO_ETIQUETA = 170

const ESTILO_ETIQUETA =
  "position:absolute;white-space:nowrap;text-align:left;font:600 13px/1.3 system-ui,sans-serif;color:#fff;background:rgb(3 7 18 / 90%);padding:4px 8px;border-radius:6px;pointer-events:none"

/** Lados posibles de la etiqueta respecto al punto, en orden de preferencia. */
const LADOS = {
  derecha: "left:26px;top:50%;transform:translateY(-50%)",
  izquierda: "right:26px;top:50%;transform:translateY(-50%)",
  arriba: "left:50%;bottom:26px;transform:translateX(-50%)",
  abajo: "left:50%;top:26px;transform:translateX(-50%)",
} as const
type Lado = keyof typeof LADOS

const grados = (t: number) =>
  `${t.toLocaleString("es-ES", { maximumFractionDigits: 1 })} °C`

type Marcador = {
  caja: HTMLElement
  punto: HTMLElement
  etiqueta: HTMLElement
  cifra: HTMLElement
  clima: HTMLElement
  color: string
}

type Caja = { left: number; top: number; right: number; bottom: number }

const seSolapan = (a: Caja, b: Caja) =>
  a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom

/**
 * Coloca cada etiqueta en el primer lado donde no pisa otra etiqueta ni otro
 * punto, no queda bajo un panel y no se sale del mapa. Se repite cada vez que
 * el mapa se mueve o cambia de tamaño, así vale para cualquier encuadre.
 */
function colocarEtiquetas(
  mapa: maplibregl.Map,
  marcadores: Map<string, Marcador>
) {
  const lienzo = mapa.getContainer().getBoundingClientRect()
  const obstaculos = [
    ...document.querySelectorAll(
      "[data-panel], .maplibregl-ctrl-bottom-right > .maplibregl-ctrl"
    ),
  ]
    .filter((e) => getComputedStyle(e).visibility !== "hidden")
    .map((e) => e.getBoundingClientRect())
    .filter((r) => r.width > 0)
  const lista = [...marcadores.values()]
  const centros = lista.map((m) => {
    const r = m.caja.getBoundingClientRect()
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 }
  })
  const puntos: Caja[] = centros.map(({ x, y }) => ({
    left: x - 12,
    top: y - 12,
    right: x + 12,
    bottom: y + 12,
  }))
  const colocadas: Caja[] = []

  lista.forEach((m, i) => {
    const { x, y } = centros[i]
    const ancho = m.etiqueta.offsetWidth
    const alto = m.etiqueta.offsetHeight
    const caja = (lado: Lado): Caja => {
      const left =
        lado === "derecha"
          ? x + 14
          : lado === "izquierda"
            ? x - 14 - ancho
            : x - ancho / 2
      const top =
        lado === "arriba"
          ? y - 14 - alto
          : lado === "abajo"
            ? y + 14
            : y - alto / 2
      return { left, top, right: left + ancho, bottom: top + alto }
    }
    const libre = (c: Caja) =>
      c.left >= lienzo.left &&
      c.top >= lienzo.top &&
      c.right <= lienzo.right &&
      c.bottom <= lienzo.bottom &&
      !obstaculos.some((o) => seSolapan(c, o)) &&
      !colocadas.some((o) => seSolapan(c, o)) &&
      !puntos.some((p, j) => j !== i && seSolapan(c, p))
    const lado =
      (Object.keys(LADOS) as Lado[]).find((l) => libre(caja(l))) ?? "derecha"
    m.etiqueta.style.cssText = `${ESTILO_ETIQUETA};${LADOS[lado]}`
    colocadas.push(caja(lado))
  })
}

/** Color de la ciudad y más grande cuantos más registros; gris si no tiene datos. */
function pintarMarcadores(
  marcadores: Map<string, Marcador>,
  resumen: ResumenCiudad[] | null
) {
  const maximo = Math.max(1, ...(resumen ?? []).map((r) => r.registros))
  for (const [nombre, { punto, cifra, clima, color }] of marcadores) {
    const r = resumen?.find((x) => x.ciudad === nombre)
    const tamano = r?.registros
      ? 12 + Math.round((r.registros / maximo) * 8)
      : 10
    punto.style.width = punto.style.height = `${tamano}px`
    punto.style.background = r?.registros ? color : "#8e8e93"
    cifra.textContent = !r
      ? "…"
      : r.registros
        ? `${n(r.registros)} registros`
        : "sin datos"
    clima.textContent =
      r?.tempMedia !== undefined && r.tempMax !== undefined
        ? `media ${grados(r.tempMedia)} · máx. ${grados(r.tempMax)}`
        : ""
    clima.style.display = clima.textContent ? "block" : "none"
  }
}

/**
 * Margen para encuadrar las ciudades en el hueco que dejan libres los paneles.
 * Se mide su posición real, así vale con el panel izquierdo abierto o plegado.
 */
function margen(mapa: maplibregl.Map) {
  const contenedor = mapa.getContainer()
  const ancho = contenedor.clientWidth
  // La columna de datos o la ficha de ciudad, la que esté visible.
  const derecho = [...document.querySelectorAll("[data-panel=derecho]")]
    .map((e) => e.getBoundingClientRect())
    .find((r) => r.width > 0)
  if (ancho < 1024) {
    // En móvil el resumen va arriba a la derecha sobre el mapa: se deja libre esa franja.
    const arriba = contenedor.getBoundingClientRect().top
    const bajoResumen =
      derecho && derecho.top < arriba + contenedor.clientHeight / 2
    return {
      top: bajoResumen ? derecho.bottom - arriba + 12 : 40,
      bottom: 30,
      left: 30,
      right: 30 + ANCHO_ETIQUETA,
    }
  }
  const izquierdo = document
    .querySelector("[data-panel=izquierdo]")
    ?.getBoundingClientRect()
  return {
    top: 70,
    bottom: 70,
    left: (izquierdo?.right ?? 0) + 40,
    right: ancho - (derecho?.left ?? ancho) + 30 + ANCHO_ETIQUETA,
  }
}

const encuadrar = (mapa: maplibregl.Map, animar: boolean) =>
  mapa.fitBounds(LIMITES_CIUDADES, {
    padding: margen(mapa),
    maxZoom: 7,
    animate: animar,
  })

/**
 * Mapa satélite con un punto por ciudad. El tamaño del punto depende de
 * cuántos registros de esa ciudad hay realmente en Supabase. Al pulsar una
 * ciudad se avisa con `onSeleccionar`.
 */
export function MapaCiudades({
  resumen,
  reencuadre,
  onSeleccionar,
}: {
  resumen: ResumenCiudad[] | null
  /** Cambia cuando los paneles cambian de tamaño: el mapa se vuelve a encuadrar. */
  reencuadre: unknown
  onSeleccionar: (ciudad: string) => void
}) {
  const contenedor = useRef<HTMLDivElement>(null)
  const mapa = useRef<maplibregl.Map | null>(null)
  const marcadores = useRef(new Map<string, Marcador>())
  const alSeleccionar = useRef(onSeleccionar)

  useEffect(() => {
    alSeleccionar.current = onSeleccionar
  }, [onSeleccionar])

  useEffect(() => {
    if (!contenedor.current || !CLAVE_MAPTILER) return
    const nuevo = new maplibregl.Map({
      container: contenedor.current,
      style: ESTILO,
      bounds: LIMITES_CIUDADES,
      attributionControl: { compact: true },
    })
    encuadrar(nuevo, false)
    nuevo.addControl(new maplibregl.NavigationControl(), "bottom-right")

    const actuales = marcadores.current
    CIUDADES.forEach((c, i) => {
      const color = getComputedStyle(contenedor.current!)
        .getPropertyValue(`--ciudad-${i + 1}`)
        .trim()
      // Caja fija centrada en la coordenada; la etiqueta va fuera del flujo
      // para no desplazar el punto. Sin `position` propio: MapLibre la pone en
      // absolute, y un relative haría que los marcadores se apilaran uno bajo otro.
      const caja = document.createElement("button")
      caja.type = "button"
      caja.style.cssText =
        "width:24px;height:24px;display:grid;place-items:center;cursor:pointer;background:none;border:0;padding:0"
      caja.setAttribute(
        "aria-label",
        `${c.nombre}: ver su temperatura hora a hora`
      )
      const punto = document.createElement("span")
      punto.style.cssText = "border-radius:9999px;border:2px solid #fff"
      const etiqueta = document.createElement("span")
      etiqueta.style.cssText = `${ESTILO_ETIQUETA};${LADOS.derecha}`
      const nombre = document.createElement("span")
      nombre.textContent = c.nombre
      const cifra = document.createElement("span")
      cifra.style.cssText =
        "margin-left:6px;font-weight:400;font-size:12px;color:rgb(255 255 255 / 80%)"
      const clima = document.createElement("span")
      clima.style.cssText =
        "display:none;font-weight:400;font-size:12px;color:rgb(255 255 255 / 80%)"
      etiqueta.append(nombre, cifra, clima)
      caja.append(punto, etiqueta)
      caja.addEventListener("click", () => alSeleccionar.current(c.nombre))

      new maplibregl.Marker({ element: caja })
        .setLngLat([c.longitud, c.latitud])
        .addTo(nuevo)
      actuales.set(c.nombre, { caja, punto, etiqueta, cifra, clima, color })
    })
    pintarMarcadores(actuales, null)

    // Tras cada movimiento (y al empezar), cada etiqueta busca un lado libre.
    const recolocar = () => colocarEtiquetas(nuevo, actuales)
    nuevo.on("moveend", recolocar)
    requestAnimationFrame(recolocar)

    // Se reencuadra cada vez que cambia el tamaño del mapa (ventana, panel,
    // altura del móvil resuelta tarde…), no solo al redimensionar la ventana.
    const observador = new ResizeObserver(() => {
      nuevo.resize()
      encuadrar(nuevo, false)
    })
    observador.observe(contenedor.current)
    mapa.current = nuevo
    return () => {
      observador.disconnect()
      actuales.clear()
      nuevo.remove()
      mapa.current = null
    }
  }, [])

  // Al plegar o desplegar el panel, el hueco libre cambia: se vuelve a encuadrar.
  useEffect(() => {
    const m = mapa.current
    if (!m) return
    m.resize()
    encuadrar(m, true)
  }, [reencuadre])

  // Los datos cambian el tamaño de las etiquetas: se vuelven a colocar.
  useEffect(() => {
    pintarMarcadores(marcadores.current, resumen)
    if (mapa.current) colocarEtiquetas(mapa.current, marcadores.current)
  }, [resumen])

  if (!CLAVE_MAPTILER) {
    return (
      <div className="grid h-full w-full place-items-center p-10 text-center text-sm text-muted-foreground">
        Falta la clave de MapTiler. Define NEXT_PUBLIC_MAPTILER_KEY en
        .env.local (y en Vercel) y vuelve a compilar.
      </div>
    )
  }

  return (
    <div
      ref={contenedor}
      role="region"
      aria-label="Mapa satélite con las ciudades y los registros guardados en Supabase"
      className="h-full w-full"
    />
  )
}

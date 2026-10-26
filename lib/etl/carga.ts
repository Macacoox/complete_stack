import { NOMBRES_CIUDADES } from "./ciudades"
import { claveRegistro, motivosMedicion } from "./limpieza"
import type { RegistroCarga, RegistroValido } from "./tipos"

export const TAMANO_LOTE = 500
/** 500 registros ocupan ~60 KB en JSON; 256 KB deja margen sin aceptar abusos. */
export const MAX_BYTES_PETICION = 256 * 1024

const CAMPOS_CARGA = [
  "ciudad",
  "fecha_hora",
  "temperatura_c",
  "humedad_pct",
  "precipitacion_mm",
] as const

export function aRegistroCarga(r: RegistroValido): RegistroCarga {
  return {
    ciudad: r.ciudad,
    fecha_hora: r.fecha_hora,
    temperatura_c: r.temperatura_c,
    humedad_pct: r.humedad_pct,
    precipitacion_mm: r.precipitacion_mm,
  }
}

export function dividirEnLotes<T>(filas: T[], tamano = TAMANO_LOTE) {
  const lotes: T[][] = []
  for (let i = 0; i < filas.length; i += tamano) lotes.push(filas.slice(i, i + tamano))
  return lotes
}

// Fecha ISO 8601 con zona explícita (Z o ±HH:MM): sin zona sería ambigua.
const REGEX_ISO_CON_ZONA = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,6})?)?(Z|[+-]\d{2}:\d{2})$/

function normalizarFecha(valor: unknown) {
  if (typeof valor !== "string" || !REGEX_ISO_CON_ZONA.test(valor)) return null
  const ms = Date.parse(valor)
  return Number.isNaN(ms) ? null : new Date(ms).toISOString()
}

/**
 * Validación en servidor de un lote recibido. Repite las reglas de limpieza:
 * el servidor nunca confía en lo que envía el navegador.
 */
export function validarLoteCarga(
  cuerpo: unknown
): { ok: true; registros: RegistroCarga[] } | { ok: false; errores: string[] } {
  if (!cuerpo || typeof cuerpo !== "object" || !("registros" in cuerpo)) {
    return { ok: false, errores: ["El cuerpo debe ser un objeto con la propiedad «registros»."] }
  }
  const lista = (cuerpo as { registros: unknown }).registros
  if (!Array.isArray(lista)) {
    return { ok: false, errores: ["«registros» debe ser un array."] }
  }
  if (lista.length === 0 || lista.length > TAMANO_LOTE) {
    return { ok: false, errores: [`Cada lote debe tener entre 1 y ${TAMANO_LOTE} registros (recibidos ${lista.length}).`] }
  }

  const errores: string[] = []
  const registros: RegistroCarga[] = []
  const claves = new Set<string>()
  lista.forEach((item, i) => {
    const pos = `Registro ${i + 1}`
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      errores.push(`${pos}: no es un objeto.`)
      return
    }
    const r = item as Record<string, unknown>
    const extra = Object.keys(r).filter((k) => !(CAMPOS_CARGA as readonly string[]).includes(k))
    const motivos: string[] = []
    if (extra.length) motivos.push(`campos no permitidos (${extra.join(", ")})`)
    if (typeof r.ciudad !== "string" || !NOMBRES_CIUDADES.includes(r.ciudad)) {
      motivos.push("ciudad desconocida")
    }
    const fecha = normalizarFecha(r.fecha_hora)
    if (!fecha) motivos.push("fecha_hora no es ISO 8601 con zona horaria")
    motivos.push(
      ...motivosMedicion("temperatura_c", r.temperatura_c),
      ...motivosMedicion("humedad_pct", r.humedad_pct),
      ...motivosMedicion("precipitacion_mm", r.precipitacion_mm)
    )
    if (motivos.length) {
      errores.push(`${pos}: ${motivos.join("; ")}.`)
      return
    }
    const clave = claveRegistro(r.ciudad as string, fecha!)
    if (claves.has(clave)) {
      errores.push(`${pos}: duplicado dentro del lote (${clave}).`)
      return
    }
    claves.add(clave)
    registros.push({
      ciudad: r.ciudad as string,
      fecha_hora: fecha!,
      temperatura_c: r.temperatura_c as number,
      humedad_pct: r.humedad_pct as number,
      precipitacion_mm: r.precipitacion_mm as number,
    })
  })

  return errores.length ? { ok: false, errores } : { ok: true, registros }
}

export type EstadoLote = "pendiente" | "enviando" | "completado" | "error"

export type Lote = {
  numero: number
  registros: RegistroCarga[]
  estado: EstadoLote
  intentos: number
  /** Filas que Supabase confirma como procesadas (insertadas o actualizadas). */
  procesados: number | null
  error: string | null
  duracionMs: number | null
  verificacion:
    | { estado: "pendiente" }
    | { estado: "verificando" }
    | { estado: "ok"; encontrados: number; faltantes: string[] }
    | { estado: "error"; error: string }
}

export function crearLotes(registros: RegistroCarga[]): Lote[] {
  return dividirEnLotes(registros).map((registros, i) => ({
    numero: i + 1,
    registros,
    estado: "pendiente",
    intentos: 0,
    procesados: null,
    error: null,
    duracionMs: null,
    verificacion: { estado: "pendiente" },
  }))
}

/** `procesados` es null si Supabase no devuelve recuento: no se supone ninguno. */
export type EnviarLote = (registros: RegistroCarga[]) => Promise<{ procesados: number | null }>
export type VerificarClaves = (registros: RegistroCarga[]) => Promise<{ faltantes: string[] }>

/**
 * Envía en secuencia los lotes que no estén completados. Un fallo no detiene
 * el resto ni toca los lotes ya completados: reintentar = volver a llamar.
 * Después verifica en destino las claves de cada lote completado.
 */
export async function procesarLotes(
  inicial: Lote[],
  enviar: EnviarLote,
  verificar: VerificarClaves,
  notificar: (lotes: Lote[]) => void = () => {},
  ahora: () => number = () => performance.now()
) {
  let lotes = inicial
  const actualizar = (i: number, cambios: Partial<Lote>) => {
    lotes = lotes.map((l, j) => (j === i ? { ...l, ...cambios } : l))
    notificar(lotes)
  }

  for (let i = 0; i < lotes.length; i++) {
    if (lotes[i].estado === "completado") continue
    actualizar(i, { estado: "enviando", error: null, intentos: lotes[i].intentos + 1 })
    const t0 = ahora()
    try {
      const { procesados } = await enviar(lotes[i].registros)
      actualizar(i, {
        estado: "completado",
        procesados,
        duracionMs: ahora() - t0,
        verificacion: { estado: "pendiente" },
      })
    } catch (error) {
      actualizar(i, {
        estado: "error",
        procesados: null,
        error: error instanceof Error ? error.message : String(error),
        duracionMs: ahora() - t0,
      })
    }
  }

  for (let i = 0; i < lotes.length; i++) {
    const lote = lotes[i]
    if (lote.estado !== "completado" || lote.verificacion.estado === "ok") continue
    actualizar(i, { verificacion: { estado: "verificando" } })
    try {
      const { faltantes } = await verificar(lote.registros)
      actualizar(i, {
        verificacion: {
          estado: "ok",
          encontrados: lote.registros.length - faltantes.length,
          faltantes,
        },
      })
    } catch (error) {
      actualizar(i, {
        verificacion: {
          estado: "error",
          error: error instanceof Error ? error.message : String(error),
        },
      })
    }
  }

  return lotes
}

export function resumenLotes(lotes: Lote[]) {
  const completados = lotes.filter((l) => l.estado === "completado")
  const fallidos = lotes.filter((l) => l.estado === "error")
  return {
    total: lotes.reduce((s, l) => s + l.registros.length, 0),
    lotesCompletados: completados.length,
    lotesFallidos: fallidos.length,
    registrosCorrectos: completados.reduce((s, l) => s + l.registros.length, 0),
    registrosFallidos: fallidos.reduce((s, l) => s + l.registros.length, 0),
    procesadosSupabase: completados.reduce((s, l) => s + (l.procesados ?? 0), 0),
    lotesSinRecuento: completados.filter((l) => l.procesados === null).length,
    verificados: lotes.reduce(
      (s, l) => s + (l.verificacion.estado === "ok" ? l.verificacion.encontrados : 0),
      0
    ),
    faltantes: lotes.flatMap((l) => (l.verificacion.estado === "ok" ? l.verificacion.faltantes : [])),
    verificacionConError: lotes.filter((l) => l.verificacion.estado === "error").length,
  }
}

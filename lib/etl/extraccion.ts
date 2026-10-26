import type { Ciudad } from "./ciudades"
import type { RespuestaOpenMeteo } from "./tipos"

export const URL_ARCHIVO_OPEN_METEO =
  "https://archive-api.open-meteo.com/v1/archive"
export const VARIABLES_HORARIAS = [
  "temperature_2m",
  "relative_humidity_2m",
  "precipitation",
] as const
export const MAX_DIAS_EXTRACCION = 31
/** El archivo histórico de Open-Meteo empieza en 1940. */
export const FECHA_MINIMA = "1940-01-01"

const MS_DIA = 86_400_000
const REGEX_FECHA = /^\d{4}-\d{2}-\d{2}$/

function fechaUtc(fecha: string) {
  if (!REGEX_FECHA.test(fecha)) return null
  const ms = Date.parse(`${fecha}T00:00:00Z`)
  // Date.parse acepta 2026-02-30 desbordando al mes siguiente; lo detectamos.
  if (Number.isNaN(ms) || new Date(ms).toISOString().slice(0, 10) !== fecha) {
    return null
  }
  return ms
}

/** Días naturales entre dos fechas, ambos incluidos. */
export function diasIncluidos(inicio: string, fin: string) {
  const a = fechaUtc(inicio)
  const b = fechaUtc(fin)
  if (a === null || b === null || b < a) return 0
  return Math.round((b - a) / MS_DIA) + 1
}

export function hoyUtc() {
  return new Date().toISOString().slice(0, 10)
}

export type ConfiguracionExtraccion = {
  ciudades: string[]
  inicio: string
  fin: string
}

export function validarConfiguracion(
  config: ConfiguracionExtraccion,
  hoy = hoyUtc()
) {
  const errores: string[] = []
  if (config.ciudades.length === 0) {
    errores.push("Selecciona al menos una ciudad.")
  }
  const a = fechaUtc(config.inicio)
  const b = fechaUtc(config.fin)
  if (a === null) errores.push("La fecha inicial no es válida (AAAA-MM-DD).")
  if (b === null) errores.push("La fecha final no es válida (AAAA-MM-DD).")
  if (a !== null && b !== null) {
    if (b < a) {
      errores.push("La fecha final debe ser igual o posterior a la inicial.")
    } else if (diasIncluidos(config.inicio, config.fin) > MAX_DIAS_EXTRACCION) {
      errores.push(
        `El periodo no puede superar ${MAX_DIAS_EXTRACCION} días (has elegido ${diasIncluidos(config.inicio, config.fin)}).`
      )
    }
    if (config.inicio < FECHA_MINIMA) {
      errores.push("El archivo histórico empieza el 1 de enero de 1940.")
    }
    if (config.fin > hoy) {
      errores.push("La fecha final no puede ser posterior a hoy (UTC).")
    }
  }
  return errores
}

export function volumenPrevisto(config: ConfiguracionExtraccion) {
  const dias = diasIncluidos(config.inicio, config.fin)
  return {
    dias,
    peticiones: config.ciudades.length,
    registros: dias * 24 * config.ciudades.length,
  }
}

export function construirUrl(ciudad: Ciudad, inicio: string, fin: string) {
  const params = new URLSearchParams({
    latitude: String(ciudad.latitud),
    longitude: String(ciudad.longitud),
    start_date: inicio,
    end_date: fin,
    hourly: VARIABLES_HORARIAS.join(","),
    timezone: "UTC",
    temperature_unit: "celsius",
    precipitation_unit: "mm",
  })
  return `${URL_ARCHIVO_OPEN_METEO}?${params}`
}

/** Descarga la respuesta sin tocarla. Lanza un Error con mensaje en castellano. */
export async function descargarCiudad(
  ciudad: Ciudad,
  inicio: string,
  fin: string,
  { timeoutMs = 30_000, fetcher = fetch }: { timeoutMs?: number; fetcher?: typeof fetch } = {}
): Promise<RespuestaOpenMeteo> {
  const url = construirUrl(ciudad, inicio, fin)
  let respuesta: Response
  try {
    respuesta = await fetcher(url, { signal: AbortSignal.timeout(timeoutMs) })
  } catch (error) {
    if (error instanceof DOMException && error.name === "TimeoutError") {
      throw new Error(`Sin respuesta de Open-Meteo tras ${timeoutMs / 1000} s.`)
    }
    throw new Error("No se pudo conectar con Open-Meteo (¿hay conexión a internet?).")
  }
  let cuerpo: unknown
  try {
    cuerpo = await respuesta.json()
  } catch {
    throw new Error(`Open-Meteo respondió ${respuesta.status} con un cuerpo que no es JSON.`)
  }
  if (!respuesta.ok) {
    const motivo =
      cuerpo && typeof cuerpo === "object" && "reason" in cuerpo
        ? String((cuerpo as { reason: unknown }).reason)
        : respuesta.statusText
    throw new Error(`Open-Meteo respondió ${respuesta.status}: ${motivo}`)
  }
  if (!cuerpo || typeof cuerpo !== "object" || Array.isArray(cuerpo)) {
    throw new Error("La respuesta de Open-Meteo no es un objeto JSON.")
  }
  return cuerpo as RespuestaOpenMeteo
}

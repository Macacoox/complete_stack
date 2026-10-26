import type { RegistroTransformado, RespuestaOpenMeteo } from "./tipos"

/** Correspondencia entre arrays de la API y columnas normalizadas. */
export const MAPA_VARIABLES = {
  temperature_2m: "temperatura_c",
  relative_humidity_2m: "humedad_pct",
  precipitation: "precipitacion_mm",
} as const

type VariableApi = keyof typeof MAPA_VARIABLES

const REGEX_HORA_ISO = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/

/**
 * Open-Meteo devuelve horas sin zona ("2026-09-01T00:00"). Con timezone=UTC
 * el desfase es 0, pero no dejamos que el navegador las interprete como hora
 * local: añadimos la zona explícitamente y restamos el desfase indicado.
 */
export function interpretarFechaUtc(valor: unknown, desfaseSegundos: number) {
  if (typeof valor !== "string") return null
  const m = REGEX_HORA_ISO.exec(valor)
  if (!m) return null
  const [, anio, mes, dia, hora, minuto, segundo = "00"] = m
  const iso = `${anio}-${mes}-${dia}T${hora}:${minuto}:${segundo}.000Z`
  const ms = Date.parse(iso)
  // Detecta fechas imposibles como 2026-02-30T00:00.
  if (Number.isNaN(ms) || new Date(ms).toISOString() !== iso) return null
  return new Date(ms - desfaseSegundos * 1000).toISOString()
}

export type EntradaTransformacion = {
  ciudad: string
  respuesta: RespuestaOpenMeteo
}

export type ResultadoTransformacion = {
  registros: RegistroTransformado[]
  /** Problemas de estructura detectados por ciudad (no detienen el proceso). */
  avisos: { ciudad: string; mensaje: string }[]
}

/**
 * Convierte los arrays paralelos de cada respuesta en un registro por hora.
 * No valida ni corrige valores: eso es trabajo de la limpieza.
 */
export function transformar(entradas: EntradaTransformacion[]): ResultadoTransformacion {
  const registros: RegistroTransformado[] = []
  const avisos: ResultadoTransformacion["avisos"] = []

  for (const { ciudad, respuesta } of entradas) {
    const avisar = (mensaje: string) => avisos.push({ ciudad, mensaje })
    const horario = respuesta.hourly

    if (!horario || typeof horario !== "object") {
      avisar("La respuesta no contiene el bloque «hourly».")
      continue
    }
    const tiempos = horario.time
    if (!Array.isArray(tiempos)) {
      avisar("El bloque «hourly» no contiene el array «time».")
      continue
    }

    let desfase = 0
    if (typeof respuesta.utc_offset_seconds === "number") {
      desfase = respuesta.utc_offset_seconds
      if (desfase !== 0) {
        avisar(`La respuesta no está en UTC (desfase ${desfase} s); se ha convertido a UTC.`)
      }
    } else {
      avisar("La respuesta no indica «utc_offset_seconds»; se asume UTC porque se pidió timezone=UTC.")
    }

    const arrays = {} as Record<VariableApi, unknown[]>
    for (const variable of Object.keys(MAPA_VARIABLES) as VariableApi[]) {
      const valor = horario[variable]
      if (Array.isArray(valor)) {
        arrays[variable] = valor
      } else {
        arrays[variable] = []
        avisar(`Falta el array «${variable}»: sus valores quedan como ausentes.`)
      }
    }

    const longitudes = [tiempos.length, ...Object.values(arrays).map((a) => a.length)]
    const n = Math.max(...longitudes)
    if (longitudes.some((l) => l !== n)) {
      avisar(
        `Longitudes incoherentes: time=${tiempos.length}, ` +
          (Object.keys(arrays) as VariableApi[])
            .map((v) => `${v}=${arrays[v].length}`)
            .join(", ") +
          ". Las posiciones sin valor se marcan como ausentes."
      )
    }

    for (let i = 0; i < n; i++) {
      // `i in array` distingue una posición inexistente de un null explícito.
      const valorEn = (array: unknown[]) => (i in array ? array[i] : undefined)
      const fecha_original = valorEn(tiempos)
      registros.push({
        fila: registros.length + 1,
        ciudad,
        indice: i,
        fecha_original,
        fecha_hora: interpretarFechaUtc(fecha_original, desfase),
        temperatura_c: valorEn(arrays.temperature_2m),
        humedad_pct: valorEn(arrays.relative_humidity_2m),
        precipitacion_mm: valorEn(arrays.precipitation),
      })
    }
  }

  return { registros, avisos }
}

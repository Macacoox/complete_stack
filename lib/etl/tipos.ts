/** Respuesta de Open-Meteo tal como llega (se conserva sin modificar). */
export type RespuestaOpenMeteo = {
  latitude?: number
  longitude?: number
  timezone?: string
  utc_offset_seconds?: number
  hourly_units?: Record<string, string>
  hourly?: Record<string, unknown>
  [clave: string]: unknown
}

/**
 * Registro tras la transformación: un objeto por ciudad y hora.
 * Las mediciones conservan el valor original (puede ser null, cadena, ausente…)
 * para que la limpieza decida; aquí no se corrige nada.
 */
export type RegistroTransformado = {
  /** Posición global en la salida de la transformación (1, 2, 3…). */
  fila: number
  ciudad: string
  /** Índice dentro de los arrays de la respuesta de la ciudad. */
  indice: number
  fecha_original: unknown
  /** ISO 8601 en UTC, o null si la fecha original no es válida. */
  fecha_hora: string | null
  temperatura_c: unknown
  humedad_pct: unknown
  precipitacion_mm: unknown
}

/** Registro válido: estructura normalizada que se puede subir. */
export type RegistroValido = {
  /** `${ciudad}|${fecha_hora}`: identifica el registro en la selección y en destino. */
  clave: string
  fila: number
  ciudad: string
  fecha_hora: string
  temperatura_c: number
  humedad_pct: number
  precipitacion_mm: number
}

export type RegistroRechazado = {
  registro: RegistroTransformado
  motivos: string[]
}

/** Fila que se envía a Supabase (sin campos internos). */
export type RegistroCarga = {
  ciudad: string
  fecha_hora: string
  temperatura_c: number
  humedad_pct: number
  precipitacion_mm: number
}

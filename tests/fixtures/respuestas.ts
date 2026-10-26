/**
 * Fixtures CONTROLADOS para pruebas. No son datos reales de Open-Meteo y
 * nunca se usan en la aplicación: solo reproducen casos que la API real rara
 * vez devuelve (nulos, vacíos, duplicados, longitudes incoherentes…).
 */
import type { RespuestaOpenMeteo } from "@/lib/etl/tipos"

const base = {
  latitude: 41.4,
  longitude: 2.2,
  timezone: "GMT",
  utc_offset_seconds: 0,
  hourly_units: {
    time: "iso8601",
    temperature_2m: "°C",
    relative_humidity_2m: "%",
    precipitation: "mm",
  },
}

/** Tres horas correctas. */
export const correcta: RespuestaOpenMeteo = {
  ...base,
  hourly: {
    time: ["2026-09-01T00:00", "2026-09-01T01:00", "2026-09-01T02:00"],
    temperature_2m: [24.2, 23.6, 23.0],
    relative_humidity_2m: [77, 80, 81],
    precipitation: [0, 0.4, 0],
  },
}

/** Un problema distinto en cada hora. */
export const conProblemas: RespuestaOpenMeteo = {
  ...base,
  hourly: {
    time: [
      "2026-09-02T00:00", // 0: válida, temperatura extrema (se conserva)
      "2026-09-02T01:00", // 1: temperatura null
      "2026-09-02T02:00", // 2: humedad cadena vacía
      "2026-09-02T03:00", // 3: precipitación como texto "0.5"
      "2026-09-02T04:00", // 4: humedad 105
      "2026-09-02T05:00", // 5: precipitación negativa
      "no-es-fecha", //      6: fecha no válida
      "2026-09-02T00:00", // 7: duplicado de la fila 0
      "2026-09-02T08:00", // 8: varios problemas a la vez
      "2026-09-02T09:00", // 9: válida, temperatura negativa extrema
    ],
    temperature_2m: [55.3, null, 20, 20, 20, 20, 20, 99, null, -60.1],
    relative_humidity_2m: [10, 50, "", 50, 105, 50, 50, 50, -1, 100],
    precipitation: [0, 0, 0, "0.5", 0, -0.1, 0, 0, null, 0],
  },
}

/** time tiene 3 posiciones, temperature_2m solo 2 y falta precipitation. */
export const longitudesIncoherentes: RespuestaOpenMeteo = {
  ...base,
  hourly: {
    time: ["2026-09-03T00:00", "2026-09-03T01:00", "2026-09-03T02:00"],
    temperature_2m: [18, 19],
    relative_humidity_2m: [60, 61, 62],
  },
}

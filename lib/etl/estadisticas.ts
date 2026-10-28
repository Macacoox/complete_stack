import type { RegistroValido } from "@/lib/etl/tipos"

export type MediasDiarias = {
  /** Días (YYYY-MM-DD, UTC) ordenados. */
  dias: string[]
  /** Temperatura media de cada día, de todas las ciudades juntas. */
  global: number[]
  /** Temperatura media de cada día por ciudad; null si ese día no hay datos. */
  porCiudad: Map<string, (number | null)[]>
}

/** Agrupa los registros válidos por día (UTC) y calcula la temperatura media. */
export function mediasDiarias(
  validos: readonly RegistroValido[]
): MediasDiarias {
  const sumas = new Map<string, Map<string, { suma: number; cuenta: number }>>()
  for (const r of validos) {
    const dia = r.fecha_hora.slice(0, 10)
    const ciudades =
      sumas.get(dia) ?? new Map<string, { suma: number; cuenta: number }>()
    const acumulado = ciudades.get(r.ciudad) ?? { suma: 0, cuenta: 0 }
    acumulado.suma += r.temperatura_c
    acumulado.cuenta += 1
    ciudades.set(r.ciudad, acumulado)
    sumas.set(dia, ciudades)
  }

  const dias = [...sumas.keys()].sort()
  const nombres = [...new Set(validos.map((r) => r.ciudad))]
  const porCiudad = new Map(
    nombres.map((ciudad) => [
      ciudad,
      dias.map((dia) => {
        const a = sumas.get(dia)!.get(ciudad)
        return a ? a.suma / a.cuenta : null
      }),
    ])
  )
  const global = dias.map((dia) => {
    let suma = 0
    let cuenta = 0
    for (const a of sumas.get(dia)!.values()) {
      suma += a.suma
      cuenta += a.cuenta
    }
    return suma / cuenta
  })
  return { dias, global, porCiudad }
}

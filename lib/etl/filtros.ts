import type { RegistroValido } from "./tipos"

/** Los límites vacíos ("") no filtran. Las fechas son "AAAA-MM-DDTHH:mm" en UTC. */
export type Filtros = {
  ciudades: string[]
  desde: string
  hasta: string
  tempMin: string
  tempMax: string
  humMin: string
  humMax: string
  precMin: string
  precMax: string
  soloLluvia: boolean
}

export const FILTROS_VACIOS: Filtros = {
  ciudades: [],
  desde: "",
  hasta: "",
  tempMin: "",
  tempMax: "",
  humMin: "",
  humMax: "",
  precMin: "",
  precMax: "",
  soloLluvia: false,
}

export type CampoOrden =
  | "ciudad"
  | "fecha_hora"
  | "temperatura_c"
  | "humedad_pct"
  | "precipitacion_mm"

export type Orden = { campo: CampoOrden; direccion: "asc" | "desc" }

export const ORDEN_POR_DEFECTO: Orden = { campo: "fecha_hora", direccion: "asc" }

function numero(texto: string) {
  if (texto.trim() === "") return null
  const n = Number(texto)
  return Number.isFinite(n) ? n : null
}

/** "2026-09-01T10:00" (UTC) → milisegundos, o null si está vacío o mal formado. */
export function instanteUtc(texto: string) {
  if (!texto) return null
  const ms = Date.parse(`${texto.length === 16 ? `${texto}:00` : texto}Z`)
  return Number.isNaN(ms) ? null : ms
}

/** Errores de los filtros (límites mal escritos o invertidos). */
export function erroresFiltros(f: Filtros) {
  const errores: string[] = []
  const pares: [string, string, string][] = [
    ["temperatura", f.tempMin, f.tempMax],
    ["humedad", f.humMin, f.humMax],
    ["precipitación", f.precMin, f.precMax],
  ]
  for (const [nombre, min, max] of pares) {
    if (min.trim() && numero(min) === null) errores.push(`El mínimo de ${nombre} no es un número.`)
    if (max.trim() && numero(max) === null) errores.push(`El máximo de ${nombre} no es un número.`)
    const a = numero(min)
    const b = numero(max)
    if (a !== null && b !== null && a > b) {
      errores.push(`El mínimo de ${nombre} es mayor que el máximo.`)
    }
  }
  const d = instanteUtc(f.desde)
  const h = instanteUtc(f.hasta)
  if (d !== null && h !== null && d > h) {
    errores.push("La fecha «desde» es posterior a «hasta».")
  }
  return errores
}

export function filtrosActivos(f: Filtros) {
  return JSON.stringify(f) !== JSON.stringify(FILTROS_VACIOS)
}

export function aplicarFiltros(registros: RegistroValido[], f: Filtros) {
  const ciudades = f.ciudades.length ? new Set(f.ciudades) : null
  const desde = instanteUtc(f.desde)
  const hasta = instanteUtc(f.hasta)
  const rangos: [keyof RegistroValido, number | null, number | null][] = [
    ["temperatura_c", numero(f.tempMin), numero(f.tempMax)],
    ["humedad_pct", numero(f.humMin), numero(f.humMax)],
    ["precipitacion_mm", numero(f.precMin), numero(f.precMax)],
  ]

  return registros.filter((r) => {
    if (ciudades && !ciudades.has(r.ciudad)) return false
    const t = Date.parse(r.fecha_hora)
    if (desde !== null && t < desde) return false
    if (hasta !== null && t > hasta) return false
    for (const [campo, min, max] of rangos) {
      const v = r[campo] as number
      if (min !== null && v < min) return false
      if (max !== null && v > max) return false
    }
    if (f.soloLluvia && !(r.precipitacion_mm > 0)) return false
    return true
  })
}

/** Ordenación estable; en empate desempata por ciudad y fecha para que sea determinista. */
export function ordenar(registros: RegistroValido[], orden: Orden) {
  const signo = orden.direccion === "asc" ? 1 : -1
  const comparar = (a: RegistroValido, b: RegistroValido, campo: CampoOrden) => {
    const x = a[campo]
    const y = b[campo]
    if (typeof x === "number" && typeof y === "number") return x - y
    return String(x).localeCompare(String(y), "es")
  }
  return [...registros].sort(
    (a, b) =>
      signo * comparar(a, b, orden.campo) ||
      comparar(a, b, "ciudad") ||
      comparar(a, b, "fecha_hora")
  )
}

export function paginar<T>(filas: T[], pagina: number, tamano: number) {
  const totalPaginas = Math.max(1, Math.ceil(filas.length / tamano))
  const actual = Math.min(Math.max(1, pagina), totalPaginas)
  return {
    filas: filas.slice((actual - 1) * tamano, actual * tamano),
    pagina: actual,
    totalPaginas,
  }
}

/**
 * Conjunto que se subiría: registros que cumplen los filtros, en el orden
 * elegido, y que están seleccionados. La selección puede contener claves que
 * ya no cumplen los filtros; esas se cuentan aparte y NO se suben.
 */
export function conjuntoDeCarga(ordenados: RegistroValido[], seleccion: ReadonlySet<string>) {
  const aSubir = ordenados.filter((r) => seleccion.has(r.clave))
  return { aSubir, fueraDeFiltros: seleccion.size - aSubir.length }
}

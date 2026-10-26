const numero = new Intl.NumberFormat("es-ES")

export function n(valor: number) {
  return numero.format(valor)
}

/** "2026-09-01T00:00:00.000Z" → "2026-09-01 00:00 UTC" */
export function fechaUtc(iso: string) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return `${d.toISOString().slice(0, 16).replace("T", " ")} UTC`
}

export function duracion(ms: number | null | undefined) {
  if (ms === null || ms === undefined) return "—"
  if (ms < 1) return "< 1 ms"
  if (ms < 1000) return `${Math.round(ms)} ms`
  return `${(ms / 1000).toFixed(2)} s`
}

export function bytes(cantidad: number) {
  if (cantidad < 1024) return `${cantidad} B`
  if (cantidad < 1024 * 1024) return `${(cantidad / 1024).toFixed(1)} KB`
  return `${(cantidad / 1024 / 1024).toFixed(2)} MB`
}

/** Muestra un valor original sin disfrazarlo: null, vacío y ausente se ven distintos. */
export function valorBruto(valor: unknown) {
  if (valor === undefined) return "(ausente)"
  if (valor === null) return "null"
  if (typeof valor === "string") return JSON.stringify(valor)
  if (typeof valor === "number") return String(valor)
  return JSON.stringify(valor) ?? String(valor)
}

export function esNumeroFinito(valor: unknown): valor is number {
  return typeof valor === "number" && Number.isFinite(valor)
}

/** JSON con sangría pero con los arrays de valores simples en una sola línea. */
export function jsonCompacto(valor: unknown) {
  return JSON.stringify(valor, null, 2).replace(
    /\[\s*\n([^[\]{}]*?)\n\s*\]/g,
    (_, contenido: string) =>
      `[${contenido
        .split("\n")
        .map((linea) => linea.trim())
        .join(" ")}]`
  )
}

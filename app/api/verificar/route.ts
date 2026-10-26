import { NOMBRES_CIUDADES } from "@/lib/etl/ciudades"
import { MAX_BYTES_PETICION, TAMANO_LOTE, dividirEnLotes } from "@/lib/etl/carga"
import { claveRegistro } from "@/lib/etl/limpieza"
import {
  TABLA_MEDICIONES,
  clienteSupabaseServidor,
  manejarExcepcion,
  mensajeErrorSupabase,
  respuestaError,
} from "@/lib/supabase/servidor"

/** Valores por consulta: mantiene la URL de PostgREST en un tamaño razonable. */
const CLAVES_POR_CONSULTA = 100

/**
 * Comprueba qué claves (ciudad, fecha_hora) existen en destino.
 * Cuerpo: { claves: [{ ciudad, fecha_hora }] } con un máximo de 500 claves.
 */
export async function POST(request: Request) {
  const texto = await request.text()
  if (texto.length > MAX_BYTES_PETICION) {
    return respuestaError(413, `La petición supera ${MAX_BYTES_PETICION / 1024} KB.`)
  }
  let claves: unknown
  try {
    claves = (JSON.parse(texto) as { claves?: unknown }).claves
  } catch {
    return respuestaError(400, "El cuerpo no es JSON válido.")
  }
  if (!Array.isArray(claves) || claves.length === 0 || claves.length > TAMANO_LOTE) {
    return respuestaError(400, `«claves» debe ser un array de 1 a ${TAMANO_LOTE} elementos.`)
  }

  const porCiudad = new Map<string, Set<string>>()
  for (const c of claves) {
    const ciudad = (c as { ciudad?: unknown })?.ciudad
    const fecha = (c as { fecha_hora?: unknown })?.fecha_hora
    const ms = typeof fecha === "string" ? Date.parse(fecha) : NaN
    if (typeof ciudad !== "string" || !NOMBRES_CIUDADES.includes(ciudad) || Number.isNaN(ms)) {
      return respuestaError(400, "Hay claves con ciudad o fecha_hora no válidas.")
    }
    if (!porCiudad.has(ciudad)) porCiudad.set(ciudad, new Set())
    porCiudad.get(ciudad)!.add(new Date(ms).toISOString())
  }

  try {
    const supabase = clienteSupabaseServidor()
    const faltantes: string[] = []
    let encontrados = 0
    for (const [ciudad, fechas] of porCiudad) {
      for (const grupo of dividirEnLotes([...fechas], CLAVES_POR_CONSULTA)) {
        const { data, error } = await supabase
          .from(TABLA_MEDICIONES)
          .select("fecha_hora")
          .eq("ciudad", ciudad)
          .in("fecha_hora", grupo)
        if (error) return respuestaError(502, mensajeErrorSupabase(error))
        const existentes = new Set(data.map((f) => new Date(f.fecha_hora).toISOString()))
        for (const fecha of grupo) {
          if (existentes.has(fecha)) encontrados++
          else faltantes.push(claveRegistro(ciudad, fecha))
        }
      }
    }
    return Response.json({ encontrados, faltantes })
  } catch (error) {
    return manejarExcepcion(error)
  }
}

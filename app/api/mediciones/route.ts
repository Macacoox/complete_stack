import type { NextRequest } from "next/server"

import { NOMBRES_CIUDADES } from "@/lib/etl/ciudades"
import { instanteUtc } from "@/lib/etl/filtros"
import {
  TABLA_MEDICIONES,
  clienteSupabaseServidor,
  manejarExcepcion,
  mensajeErrorSupabase,
  respuestaError,
} from "@/lib/supabase/servidor"

const CAMPOS_ORDEN = [
  "ciudad",
  "fecha_hora",
  "temperatura_c",
  "humedad_pct",
  "precipitacion_mm",
  "importado_en",
]
const MAX_TAMANO_PAGINA = 100

/**
 * Lectura paginada de lo que realmente está persistido en Supabase.
 * ?ciudad=Madrid&ciudad=Bilbao&desde=2026-09-01T00:00&hasta=…&orden=fecha_hora&dir=asc&pagina=1&tamano=25
 */
export async function GET(request: NextRequest) {
  const p = request.nextUrl.searchParams
  const ciudades = p.getAll("ciudad").filter((c) => NOMBRES_CIUDADES.includes(c))
  const desde = instanteUtc(p.get("desde") ?? "")
  const hasta = instanteUtc(p.get("hasta") ?? "")
  const orden = CAMPOS_ORDEN.includes(p.get("orden") ?? "") ? p.get("orden")! : "fecha_hora"
  const ascendente = p.get("dir") !== "desc"
  const tamano = Math.min(MAX_TAMANO_PAGINA, Math.max(1, Number(p.get("tamano")) || 25))
  const pagina = Math.max(1, Math.floor(Number(p.get("pagina")) || 1))

  try {
    let consulta = clienteSupabaseServidor()
      .from(TABLA_MEDICIONES)
      .select("id, ciudad, fecha_hora, temperatura_c, humedad_pct, precipitacion_mm, importado_en", {
        count: "exact",
      })
    if (ciudades.length) consulta = consulta.in("ciudad", ciudades)
    if (desde !== null) consulta = consulta.gte("fecha_hora", new Date(desde).toISOString())
    if (hasta !== null) consulta = consulta.lte("fecha_hora", new Date(hasta).toISOString())

    // La tabla no guarda un orden: cada consulta debe pedirlo (ORDER BY).
    // Se añaden desempates para que la paginación sea estable.
    consulta = consulta.order(orden, { ascending: ascendente })
    if (orden !== "ciudad") consulta = consulta.order("ciudad", { ascending: true })
    if (orden !== "fecha_hora") consulta = consulta.order("fecha_hora", { ascending: true })

    const inicio = (pagina - 1) * tamano
    const { data, error, count } = await consulta.range(inicio, inicio + tamano - 1)
    if (error) {
      // PGRST103: página fuera de rango (por ejemplo, tras borrar filas).
      if (error.code === "PGRST103") return Response.json({ filas: [], total: count ?? 0 })
      return respuestaError(502, mensajeErrorSupabase(error))
    }
    return Response.json({ filas: data, total: count ?? 0 })
  } catch (error) {
    return manejarExcepcion(error)
  }
}

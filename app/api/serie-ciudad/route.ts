import type { NextRequest } from "next/server"

import { NOMBRES_CIUDADES } from "@/lib/etl/ciudades"
import {
  TABLA_MEDICIONES,
  clienteSupabaseServidor,
  manejarExcepcion,
  mensajeErrorSupabase,
  respuestaError,
} from "@/lib/supabase/servidor"

/** Últimas horas que se devuelven: 31 días, el máximo de una extracción. */
const MAX_HORAS = 31 * 24

/**
 * Temperatura hora a hora de una ciudad, tal como está guardada en Supabase.
 * ?ciudad=Madrid → las últimas MAX_HORAS mediciones, de la más antigua a la más reciente.
 */
export async function GET(request: NextRequest) {
  const ciudad = request.nextUrl.searchParams.get("ciudad") ?? ""
  if (!NOMBRES_CIUDADES.includes(ciudad))
    return respuestaError(400, "Ciudad desconocida.")

  try {
    const { data, error } = await clienteSupabaseServidor()
      .from(TABLA_MEDICIONES)
      .select("fecha_hora, temperatura_c")
      .eq("ciudad", ciudad)
      .order("fecha_hora", { ascending: false })
      .limit(MAX_HORAS)
    if (error) return respuestaError(502, mensajeErrorSupabase(error))
    return Response.json({ ciudad, puntos: data.reverse() })
  } catch (error) {
    return manejarExcepcion(error)
  }
}

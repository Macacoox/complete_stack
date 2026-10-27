import {
  TABLA_MEDICIONES,
  clienteSupabaseServidor,
  manejarExcepcion,
  mensajeErrorSupabase,
  respuestaError,
} from "@/lib/supabase/servidor"

/** Comprueba que el servidor llega a Supabase y que la tabla existe. */
export async function GET() {
  try {
    const { error, count } = await clienteSupabaseServidor()
      .from(TABLA_MEDICIONES)
      .select("id", { count: "exact", head: true })
    if (error) return respuestaError(502, mensajeErrorSupabase(error))
    return Response.json({ conectado: true, filas: count ?? 0 })
  } catch (error) {
    return manejarExcepcion(error)
  }
}

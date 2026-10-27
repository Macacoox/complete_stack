import { NOMBRES_CIUDADES } from "@/lib/etl/ciudades"
import {
  TABLA_MEDICIONES,
  clienteSupabaseServidor,
  manejarExcepcion,
  mensajeErrorSupabase,
  respuestaError,
} from "@/lib/supabase/servidor"

type Extremo = "fecha_hora" | "temperatura_c"

/**
 * Resumen por ciudad de lo guardado en Supabase: número de registros, rango
 * de fechas y temperaturas extremas. Cada extremo es un ORDER BY … LIMIT 1.
 */
export async function GET() {
  try {
    const supabase = clienteSupabaseServidor()

    const extremo = async (
      ciudad: string,
      campo: Extremo,
      ascendente: boolean
    ) => {
      const { data, error } = await supabase
        .from(TABLA_MEDICIONES)
        .select(campo)
        .eq("ciudad", ciudad)
        .order(campo, { ascending: ascendente })
        .limit(1)
      if (error) throw error
      return (
        (data[0] as Record<Extremo, string | number> | undefined)?.[campo] ??
        null
      )
    }

    const ciudades = await Promise.all(
      NOMBRES_CIUDADES.map(async (ciudad) => {
        const { count, error } = await supabase
          .from(TABLA_MEDICIONES)
          .select("id", { count: "exact", head: true })
          .eq("ciudad", ciudad)
        if (error) throw error
        if (!count) return { ciudad, registros: 0 }
        const [desde, hasta, tempMin, tempMax] = await Promise.all([
          extremo(ciudad, "fecha_hora", true),
          extremo(ciudad, "fecha_hora", false),
          extremo(ciudad, "temperatura_c", true),
          extremo(ciudad, "temperatura_c", false),
        ])
        return { ciudad, registros: count, desde, hasta, tempMin, tempMax }
      })
    )
    return Response.json({ ciudades })
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      !(error instanceof Error)
    ) {
      return respuestaError(
        502,
        mensajeErrorSupabase(error as { code?: string; message?: string })
      )
    }
    return manejarExcepcion(error)
  }
}

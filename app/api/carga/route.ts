import { MAX_BYTES_PETICION, validarLoteCarga } from "@/lib/etl/carga"
import {
  TABLA_MEDICIONES,
  clienteSupabaseServidor,
  manejarExcepcion,
  mensajeErrorSupabase,
  motivoEscrituraBloqueada,
  respuestaError,
} from "@/lib/supabase/servidor"

/** Recibe un lote (≤ 500 registros), lo valida de nuevo y hace upsert. */
export async function POST(request: Request) {
  const bloqueo = motivoEscrituraBloqueada()
  if (bloqueo) return respuestaError(403, bloqueo)

  const declarado = Number(request.headers.get("content-length") ?? 0)
  if (declarado > MAX_BYTES_PETICION) {
    return respuestaError(413, `La petición supera ${MAX_BYTES_PETICION / 1024} KB.`)
  }
  const texto = await request.text()
  if (new TextEncoder().encode(texto).length > MAX_BYTES_PETICION) {
    return respuestaError(413, `La petición supera ${MAX_BYTES_PETICION / 1024} KB.`)
  }

  let cuerpo: unknown
  try {
    cuerpo = JSON.parse(texto)
  } catch {
    return respuestaError(400, "El cuerpo no es JSON válido.")
  }

  const validacion = validarLoteCarga(cuerpo)
  if (!validacion.ok) {
    return respuestaError(
      400,
      `El servidor ha rechazado el lote: ${validacion.errores.length} registro(s) no válidos.`,
      validacion.errores.slice(0, 20)
    )
  }

  try {
    const { error, count } = await clienteSupabaseServidor()
      .from(TABLA_MEDICIONES)
      .upsert(validacion.registros, { onConflict: "ciudad,fecha_hora", count: "exact" })
    if (error) return respuestaError(502, mensajeErrorSupabase(error))
    // PostgREST devuelve el total de filas afectadas por el upsert, sin
    // distinguir insertadas de actualizadas; no inventamos ese desglose.
    return Response.json({ procesados: count ?? null, recibidos: validacion.registros.length })
  } catch (error) {
    return manejarExcepcion(error)
  }
}

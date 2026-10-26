import "server-only"

import { createClient, type SupabaseClient } from "@supabase/supabase-js"

export const TABLA_MEDICIONES = "mediciones_meteorologicas"

export class ErrorConfiguracion extends Error {}

let cliente: SupabaseClient | null = null

/**
 * Cliente con la clave secreta: salta RLS, así que solo puede existir en el
 * servidor. Las variables sin NEXT_PUBLIC_ nunca llegan al navegador.
 */
export function clienteSupabaseServidor() {
  if (cliente) return cliente
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
  const clave = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY
  const faltan = [
    !url && "SUPABASE_URL (o NEXT_PUBLIC_SUPABASE_URL)",
    !clave && "SUPABASE_SECRET_KEY",
  ].filter(Boolean)
  if (faltan.length) {
    throw new ErrorConfiguracion(
      `Faltan variables de entorno en el servidor: ${faltan.join(", ")}. Consulta .env.example.`
    )
  }
  cliente = createClient(url!, clave!, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
  return cliente
}

/**
 * La app no tiene autenticación. En desarrollo la escritura está abierta; en
 * producción se bloquea salvo que se active expresamente (y debería añadirse
 * autenticación antes de publicar).
 */
export function motivoEscrituraBloqueada() {
  if (process.env.NODE_ENV !== "production") return null
  if (process.env.ETL_PERMITIR_ESCRITURA_SIN_AUTH === "true") return null
  return "La carga está deshabilitada en producción porque la aplicación no tiene autenticación. Protege los endpoints o define ETL_PERMITIR_ESCRITURA_SIN_AUTH=true bajo tu responsabilidad."
}

/** Traduce errores de PostgREST/Supabase a mensajes útiles sin filtrar credenciales. */
export function mensajeErrorSupabase(error: { code?: string; message?: string }) {
  if (error.code === "PGRST205" || error.code === "42P01") {
    return `La tabla ${TABLA_MEDICIONES} no existe. Ejecuta la migración de supabase/migrations en el SQL Editor de Supabase.`
  }
  if (error.code === "23514") return `Restricción de la tabla incumplida: ${error.message}`
  return `Error de Supabase${error.code ? ` (${error.code})` : ""}: ${error.message ?? "desconocido"}`
}

export function respuestaError(estado: number, error: string, detalles?: string[]) {
  return Response.json({ error, ...(detalles ? { detalles } : {}) }, { status: estado })
}

export function manejarExcepcion(error: unknown) {
  if (error instanceof ErrorConfiguracion) return respuestaError(503, error.message)
  console.error("[etl] Error inesperado:", error instanceof Error ? error.message : "desconocido")
  return respuestaError(500, "Error interno del servidor.")
}

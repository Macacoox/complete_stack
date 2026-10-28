"use client"

import { useEffect, useState } from "react"

import { Badge } from "@/components/ui/badge"

type Estado =
  | { tipo: "comprobando" }
  | { tipo: "conectado"; filas: number }
  | { tipo: "error"; mensaje: string }

/**
 * Indicador de la conexión con Supabase, consultado a través de /api/estado.
 * En modo compacto solo se ve el punto; el texto queda en el título y para lectores de pantalla.
 */
export function EstadoSupabase({ compacto = false }: { compacto?: boolean }) {
  const [estado, setEstado] = useState<Estado>({ tipo: "comprobando" })

  useEffect(() => {
    let activo = true
    fetch("/api/estado", { cache: "no-store" })
      .then(async (res) => {
        const cuerpo = (await res.json()) as { filas?: number; error?: string }
        if (!activo) return
        setEstado(
          res.ok
            ? { tipo: "conectado", filas: cuerpo.filas ?? 0 }
            : { tipo: "error", mensaje: cuerpo.error ?? `Error ${res.status}` }
        )
      })
      .catch(
        () =>
          activo &&
          setEstado({
            tipo: "error",
            mensaje: "No se pudo contactar con el servidor.",
          })
      )
    return () => {
      activo = false
    }
  }, [])

  const punto =
    estado.tipo === "conectado"
      ? "bg-emerald-500"
      : estado.tipo === "error"
        ? "bg-destructive"
        : "animate-pulse bg-muted-foreground"

  const texto =
    estado.tipo === "comprobando"
      ? "Comprobando Supabase…"
      : estado.tipo === "conectado"
        ? "Conectado a Supabase"
        : "Sin conexión con Supabase"

  if (compacto) {
    return (
      <span
        className="grid size-9 place-items-center rounded-xl"
        title={estado.tipo === "error" ? `${texto}: ${estado.mensaje}` : texto}
        aria-live="polite"
      >
        <span
          className={`size-2.5 rounded-full shadow-[0_0_10px_currentColor] ${punto}`}
          aria-hidden
        />
        <span className="sr-only">{texto}</span>
      </span>
    )
  }

  return (
    <Badge
      variant={estado.tipo === "error" ? "destructive" : "outline"}
      title={estado.tipo === "error" ? estado.mensaje : undefined}
      aria-live="polite"
    >
      <span className={`size-2 rounded-full ${punto}`} aria-hidden />
      {texto}
    </Badge>
  )
}

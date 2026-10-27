"use client"

import { useEffect, useState } from "react"

import { Badge } from "@/components/ui/badge"
import { n } from "@/lib/etl/formato"

type Estado =
  | { tipo: "comprobando" }
  | { tipo: "conectado"; filas: number }
  | { tipo: "error"; mensaje: string }

/** Indicador de la conexión con Supabase, consultado a través de /api/estado. */
export function EstadoSupabase() {
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

  return (
    <Badge
      variant={estado.tipo === "error" ? "destructive" : "outline"}
      title={estado.tipo === "error" ? estado.mensaje : undefined}
      aria-live="polite"
    >
      <span className={`size-2 rounded-full ${punto}`} aria-hidden />
      {estado.tipo === "comprobando" && "Comprobando Supabase…"}
      {estado.tipo === "conectado" &&
        `Conectado a Supabase · ${n(estado.filas)} filas`}
      {estado.tipo === "error" && "Sin conexión con Supabase"}
    </Badge>
  )
}

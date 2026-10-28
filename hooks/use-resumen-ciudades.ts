"use client"

import { useCallback, useEffect, useState } from "react"

export type ResumenCiudad = {
  ciudad: string
  registros: number
  desde?: string
  hasta?: string
  tempMin?: number
  tempMax?: number
  tempMedia?: number
}

/**
 * Resumen por ciudad de lo que hay guardado en Supabase. Se consulta al abrir
 * la página y cada vez que termina una carga (`actualizarTras` pasa a false).
 */
export function useResumenCiudades(actualizarTras: boolean) {
  const [resumen, setResumen] = useState<ResumenCiudad[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [cargando, setCargando] = useState(false)

  const recargar = useCallback(async () => {
    setCargando(true)
    setError(null)
    try {
      const res = await fetch("/api/resumen-ciudades", { cache: "no-store" })
      const cuerpo = (await res.json()) as {
        ciudades?: ResumenCiudad[]
        error?: string
      }
      if (!res.ok) throw new Error(cuerpo.error ?? `HTTP ${res.status}`)
      setResumen(cuerpo.ciudades ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error desconocido")
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!actualizarTras) void recargar()
  }, [actualizarTras, recargar])

  return { resumen, error, cargando, recargar }
}

export type ResumenCiudades = ReturnType<typeof useResumenCiudades>

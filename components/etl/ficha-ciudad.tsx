"use client"

import { X } from "lucide-react"
import { useEffect, useState } from "react"

import type { ResumenCiudad } from "@/hooks/use-resumen-ciudades"
import { CIUDADES } from "@/lib/etl/ciudades"
import { n } from "@/lib/etl/formato"
import { cn } from "@/lib/utils"

type Punto = { fecha_hora: string; temperatura_c: number }

/** Sin la unidad, para las cifras pequeñas de la ficha (el subtítulo ya dice °C). */
const gradosCorto = (t: number) =>
  `${t.toLocaleString("es-ES", { maximumFractionDigits: 1 })}°`

const grados = (t: number) =>
  `${t.toLocaleString("es-ES", { maximumFractionDigits: 1 })} °C`

const fechaHora = (iso: string) =>
  new Date(iso).toLocaleString("es-ES", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  }) + " UTC"

const fechaCorta = (iso: string) =>
  new Date(iso).toLocaleDateString("es-ES", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  })

/**
 * Ficha de una ciudad: sus cifras guardadas y la temperatura hora a hora,
 * leída de Supabase. Se monta con `key={ciudad}` para empezar limpia en cada ciudad.
 */
export function FichaCiudad({
  ciudad,
  resumen,
  onCerrar,
  className,
}: {
  ciudad: string
  resumen: ResumenCiudad | undefined
  onCerrar: () => void
  className?: string
}) {
  const [puntos, setPuntos] = useState<Punto[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [activo, setActivo] = useState<number | null>(null)
  const color = `var(--ciudad-${CIUDADES.findIndex((c) => c.nombre === ciudad) + 1})`

  useEffect(() => {
    const control = new AbortController()
    fetch(`/api/serie-ciudad?ciudad=${encodeURIComponent(ciudad)}`, {
      cache: "no-store",
      signal: control.signal,
    })
      .then(async (res) => {
        const cuerpo = (await res.json()) as {
          puntos?: Punto[]
          error?: string
        }
        if (!res.ok) throw new Error(cuerpo.error ?? `HTTP ${res.status}`)
        setPuntos(cuerpo.puntos ?? [])
      })
      .catch((e: unknown) => {
        if (!control.signal.aborted)
          setError(e instanceof Error ? e.message : "Error desconocido")
      })
    return () => control.abort()
  }, [ciudad])

  useEffect(() => {
    const alPulsar = (e: KeyboardEvent) => e.key === "Escape" && onCerrar()
    window.addEventListener("keydown", alPulsar)
    return () => window.removeEventListener("keydown", alPulsar)
  }, [onCerrar])

  const valores = puntos?.map((p) => p.temperatura_c) ?? []
  const minimo = Math.min(...valores)
  const maximo = Math.max(...valores)
  const x = (i: number) =>
    valores.length > 1 ? (i / (valores.length - 1)) * 100 : 50
  const y = (t: number) => 100 - ((t - minimo) / (maximo - minimo || 1)) * 100
  const linea = valores.map((t, i) => `${x(i)},${y(t)}`).join(" ")

  return (
    <section
      aria-label={`Ficha de ${ciudad}`}
      data-panel="derecho"
      className={cn(
        "grid content-start gap-3 rounded-2xl border border-white/20 bg-slate-950/60 p-4 text-sm shadow-lg shadow-black/30 backdrop-blur-md",
        className
      )}
    >
      <header className="flex items-start gap-2">
        <span
          aria-hidden
          className="mt-1.5 size-2.5 shrink-0 rounded-full"
          style={{ background: color }}
        />
        <div className="min-w-0">
          <h2 className="font-heading text-base font-semibold">{ciudad}</h2>
          <p className="text-xs text-muted-foreground">
            Temperatura (°C) hora a hora guardada en Supabase
          </p>
        </div>
        <button
          type="button"
          onClick={onCerrar}
          aria-label="Cerrar ficha"
          className="ml-auto grid size-7 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-white/10 hover:text-white"
        >
          <X aria-hidden className="size-4" />
        </button>
      </header>

      {resumen && resumen.registros > 0 && (
        <dl className="grid grid-cols-4 gap-2 text-xs">
          {[
            ["Registros", n(resumen.registros)],
            [
              "Media",
              resumen.tempMedia !== undefined
                ? gradosCorto(resumen.tempMedia)
                : "—",
            ],
            [
              "Mín.",
              resumen.tempMin !== undefined
                ? gradosCorto(resumen.tempMin)
                : "—",
            ],
            [
              "Máx.",
              resumen.tempMax !== undefined
                ? gradosCorto(resumen.tempMax)
                : "—",
            ],
          ].map(([etiqueta, valor]) => (
            <div key={etiqueta} className="rounded-lg bg-white/5 px-2 py-1.5">
              <dt className="text-muted-foreground">{etiqueta}</dt>
              <dd className="font-semibold tabular-nums">{valor}</dd>
            </div>
          ))}
        </dl>
      )}

      {error ? (
        <p className="text-xs text-destructive">
          No se pudo leer la serie: {error}
        </p>
      ) : !puntos ? (
        <p className="py-8 text-center text-xs text-muted-foreground">
          Leyendo Supabase…
        </p>
      ) : puntos.length < 2 ? (
        <p className="py-8 text-center text-xs text-muted-foreground">
          Aún no hay datos de {ciudad} en Supabase. Extráelos y cárgalos para
          verlos aquí.
        </p>
      ) : (
        <figure className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-1">
          {/* Escala vertical: máximo arriba y mínimo abajo del periodo mostrado. */}
          <div className="flex flex-col justify-between py-0.5 text-right text-xs text-muted-foreground tabular-nums">
            <span>{grados(maximo)}</span>
            <span>{grados(minimo)}</span>
          </div>
          <div className="relative h-28">
            <svg
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
              className="absolute inset-0 h-full w-full overflow-visible"
              role="img"
              aria-label={`Temperatura de ${ciudad} hora a hora, de ${grados(minimo)} a ${grados(maximo)}`}
              onPointerMove={(e) => {
                const caja = e.currentTarget.getBoundingClientRect()
                const i = Math.round(
                  ((e.clientX - caja.left) / caja.width) * (valores.length - 1)
                )
                setActivo(Math.min(valores.length - 1, Math.max(0, i)))
              }}
              onPointerLeave={() => setActivo(null)}
            >
              <line
                x1="0"
                x2="100"
                y1="0"
                y2="0"
                className="stroke-white/10"
                vectorEffect="non-scaling-stroke"
              />
              <line
                x1="0"
                x2="100"
                y1="100"
                y2="100"
                className="stroke-white/10"
                vectorEffect="non-scaling-stroke"
              />
              <polygon
                points={`0,100 ${linea} 100,100`}
                fill={color}
                fillOpacity={0.15}
              />
              <polyline
                points={linea}
                fill="none"
                stroke={color}
                strokeWidth={2}
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
              />
              {activo !== null && (
                <line
                  x1={x(activo)}
                  x2={x(activo)}
                  y1="0"
                  y2="100"
                  className="stroke-white/50"
                  vectorEffect="non-scaling-stroke"
                />
              )}
            </svg>
            {activo !== null && (
              <>
                <span
                  aria-hidden
                  className="pointer-events-none absolute size-2.5 -translate-1/2 rounded-full border-2 border-white"
                  style={{
                    left: `${x(activo)}%`,
                    top: `${y(valores[activo])}%`,
                    background: color,
                  }}
                />
                <span
                  className="pointer-events-none absolute -top-9 z-10 -translate-x-1/2 rounded-md bg-black/90 px-2 py-1 text-xs whitespace-nowrap"
                  style={{ left: `${Math.min(80, Math.max(20, x(activo)))}%` }}
                >
                  {fechaHora(puntos[activo].fecha_hora)} ·{" "}
                  <strong className="tabular-nums">
                    {grados(valores[activo])}
                  </strong>
                </span>
              </>
            )}
          </div>
          <span aria-hidden />
          <figcaption className="flex justify-between text-xs text-muted-foreground">
            <span>{fechaCorta(puntos[0].fecha_hora)}</span>
            <span>{n(puntos.length)} horas</span>
            <span>{fechaCorta(puntos.at(-1)!.fecha_hora)}</span>
          </figcaption>
        </figure>
      )}
    </section>
  )
}

"use client"

import "maplibre-gl/dist/maplibre-gl.css"

import { Map as MapaIcono, RefreshCw } from "lucide-react"
import maplibregl from "maplibre-gl"
import { useCallback, useEffect, useRef, useState } from "react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { CIUDADES } from "@/lib/etl/ciudades"
import { fechaUtc, n } from "@/lib/etl/formato"

type ResumenCiudad = {
  ciudad: string
  registros: number
  desde?: string
  hasta?: string
  tempMin?: number
  tempMax?: number
}

const CLAVE_MAPTILER = process.env.NEXT_PUBLIC_MAPTILER_KEY

/** Contenido del popup creado con nodos DOM (no innerHTML). */
function contenidoPopup(nombre: string, r: ResumenCiudad | undefined) {
  const raiz = document.createElement("div")
  raiz.style.cssText =
    "font: 12px/1.5 system-ui, sans-serif; color: #111; min-width: 180px"
  const titulo = document.createElement("strong")
  titulo.textContent = nombre
  titulo.style.fontSize = "14px"
  raiz.append(titulo)
  const lineas = !r
    ? ["Cargando…"]
    : r.registros === 0
      ? [
          "Sin datos en Supabase todavía.",
          "Extrae y carga esta ciudad para verla aquí.",
        ]
      : [
          `${n(r.registros)} registros horarios guardados`,
          `Desde ${fechaUtc(r.desde!)}`,
          `Hasta ${fechaUtc(r.hasta!)}`,
          `Temperatura: ${r.tempMin} °C a ${r.tempMax} °C`,
        ]
  for (const texto of lineas) {
    const p = document.createElement("div")
    p.textContent = texto
    raiz.append(p)
  }
  return raiz
}

type Marcadores = Map<
  string,
  { marcador: maplibregl.Marker; punto: HTMLElement }
>

/** Azul y más grande cuantos más registros; gris si la ciudad no tiene datos. */
function pintarMarcadores(marcadores: Marcadores, resumen: ResumenCiudad[]) {
  const maximo = Math.max(1, ...resumen.map((r) => r.registros))
  for (const [nombre, { marcador, punto }] of marcadores) {
    const r = resumen.find((x) => x.ciudad === nombre)
    const tamano = r?.registros
      ? 16 + Math.round((r.registros / maximo) * 16)
      : 14
    punto.style.width = punto.style.height = `${tamano}px`
    punto.style.background = r?.registros ? "#2563eb" : "#9ca3af"
    marcador.getPopup()?.setDOMContent(contenidoPopup(nombre, r))
  }
}

/**
 * Mapa con un marcador por ciudad. El tamaño y el color del marcador dependen
 * de cuántos registros de esa ciudad hay realmente en Supabase.
 */
export function MapaCiudades({ actualizarTras }: { actualizarTras: boolean }) {
  const contenedor = useRef<HTMLDivElement>(null)
  const marcadores = useRef<Marcadores>(new Map())
  const [resumen, setResumen] = useState<ResumenCiudad[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [cargando, setCargando] = useState(false)

  const cargarResumen = useCallback(async () => {
    setCargando(true)
    setError(null)
    try {
      const res = await fetch("/api/resumen-ciudades", { cache: "no-store" })
      const cuerpo = (await res.json()) as {
        ciudades?: ResumenCiudad[]
        error?: string
      }
      if (!res.ok) throw new Error(cuerpo.error ?? `HTTP ${res.status}`)
      const ciudades = cuerpo.ciudades ?? []
      setResumen(ciudades)
      pintarMarcadores(marcadores.current, ciudades)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error desconocido")
    } finally {
      setCargando(false)
    }
  }, [])

  // Crear el mapa una sola vez.
  useEffect(() => {
    if (!contenedor.current || !CLAVE_MAPTILER) return
    const mapa = new maplibregl.Map({
      container: contenedor.current,
      style: `https://api.maptiler.com/maps/outdoor-v4/style.json?key=${CLAVE_MAPTILER}`,
      center: [-2.5, 40.2],
      zoom: 4.6,
      cooperativeGestures: true,
    })
    mapa.addControl(
      new maplibregl.NavigationControl({ showCompass: false }),
      "top-right"
    )
    const actuales = marcadores.current
    for (const c of CIUDADES) {
      const punto = document.createElement("div")
      punto.style.cssText =
        "width:16px;height:16px;border-radius:9999px;border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,.4);background:#9ca3af;cursor:pointer"
      punto.setAttribute("aria-label", c.nombre)
      const marcador = new maplibregl.Marker({ element: punto })
        .setLngLat([c.longitud, c.latitud])
        .setPopup(
          new maplibregl.Popup({ offset: 14 }).setDOMContent(
            contenidoPopup(c.nombre, undefined)
          )
        )
        .addTo(mapa)
      actuales.set(c.nombre, { marcador, punto })
    }
    return () => {
      actuales.clear()
      mapa.remove()
    }
  }, [])

  // Volver a consultar Supabase al abrir la página y cada vez que termina una carga.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!actualizarTras) void cargarResumen()
  }, [actualizarTras, cargarResumen])

  const conDatos = resumen?.filter((r) => r.registros > 0).length ?? 0

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MapaIcono aria-hidden className="size-4" />
          4. Mapa: qué hay guardado en Supabase
        </CardTitle>
        <CardDescription>
          Cada punto es una ciudad.{" "}
          <strong className="text-foreground">Azul</strong> = tiene datos
          guardados (cuanto más grande, más registros);{" "}
          <strong className="text-foreground">gris</strong> = todavía sin datos.
          Pulsa un punto para ver su resumen. Los datos se leen de la base de
          datos, no del navegador.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        {!CLAVE_MAPTILER ? (
          <Alert>
            <AlertTitle>Falta la clave de MapTiler</AlertTitle>
            <AlertDescription>
              Define NEXT_PUBLIC_MAPTILER_KEY en .env.local (y en Vercel) y
              vuelve a compilar.
            </AlertDescription>
          </Alert>
        ) : (
          <div
            ref={contenedor}
            className="h-96 w-full overflow-hidden rounded-lg border"
          />
        )}
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <p className="text-muted-foreground" aria-live="polite">
            {resumen
              ? `${conDatos} de ${CIUDADES.length} ciudades con datos · ${n(
                  resumen.reduce((s, r) => s + r.registros, 0)
                )} registros en total`
              : "Consultando Supabase…"}
          </p>
          <Button
            size="sm"
            variant="outline"
            disabled={cargando}
            onClick={() => void cargarResumen()}
          >
            <RefreshCw
              aria-hidden
              className={cargando ? "animate-spin" : undefined}
            />
            Actualizar
          </Button>
        </div>
        {error && (
          <Alert variant="destructive">
            <AlertTitle>No se pudo leer el resumen</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  )
}

"use client"

import { Database, RefreshCw } from "lucide-react"
import { useCallback, useEffect, useState } from "react"

import {
  Paginacion,
  TablaDatos,
  type Columna,
} from "@/components/etl/tabla-datos"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { NOMBRES_CIUDADES } from "@/lib/etl/ciudades"
import { fechaUtc, n } from "@/lib/etl/formato"

type FilaPersistida = {
  id: number
  ciudad: string
  fecha_hora: string
  temperatura_c: number
  humedad_pct: number
  precipitacion_mm: number
  importado_en: string
}

const CAMPOS_ORDEN = {
  fecha_hora: "Fecha y hora",
  ciudad: "Ciudad",
  temperatura_c: "Temperatura",
  humedad_pct: "Humedad",
  precipitacion_mm: "Precipitación",
  importado_en: "Importado en",
}

const COLUMNAS: Columna<FilaPersistida>[] = [
  { id: "id", titulo: "id", numerica: true, celda: (r) => r.id },
  { id: "ciudad", titulo: "Ciudad", celda: (r) => r.ciudad },
  {
    id: "fecha",
    titulo: "Fecha y hora",
    unidad: "UTC",
    celda: (r) => fechaUtc(r.fecha_hora),
  },
  {
    id: "t",
    titulo: "Temperatura",
    unidad: "°C",
    numerica: true,
    celda: (r) => r.temperatura_c,
  },
  {
    id: "h",
    titulo: "Humedad",
    unidad: "%",
    numerica: true,
    celda: (r) => r.humedad_pct,
  },
  {
    id: "p",
    titulo: "Precipitación",
    unidad: "mm",
    numerica: true,
    celda: (r) => r.precipitacion_mm,
  },
  {
    id: "imp",
    titulo: "Importado en",
    unidad: "UTC",
    celda: (r) => fechaUtc(r.importado_en),
  },
]

export function PestanaSupabase() {
  const [ciudades, setCiudades] = useState<string[]>([])
  const [desde, setDesde] = useState("")
  const [hasta, setHasta] = useState("")
  const [orden, setOrden] = useState("fecha_hora")
  const [dir, setDir] = useState<"asc" | "desc">("asc")
  const [pagina, setPagina] = useState(1)
  const [tamano, setTamano] = useState(25)
  const [estado, setEstado] = useState<
    | { tipo: "cargando" }
    | { tipo: "ok"; filas: FilaPersistida[]; total: number; leidoEn: Date }
    | { tipo: "error"; mensaje: string }
  >({ tipo: "cargando" })

  const consultar = useCallback(async () => {
    setEstado({ tipo: "cargando" })
    const params = new URLSearchParams({
      orden,
      dir,
      pagina: String(pagina),
      tamano: String(tamano),
    })
    ciudades.forEach((c) => params.append("ciudad", c))
    if (desde) params.set("desde", desde)
    if (hasta) params.set("hasta", hasta)
    try {
      const r = await fetch(`/api/mediciones?${params}`, { cache: "no-store" })
      const cuerpo = (await r.json()) as {
        filas?: FilaPersistida[]
        total?: number
        error?: string
      }
      if (!r.ok) throw new Error(cuerpo.error ?? `HTTP ${r.status}`)
      setEstado({
        tipo: "ok",
        filas: cuerpo.filas ?? [],
        total: cuerpo.total ?? 0,
        leidoEn: new Date(),
      })
    } catch (error) {
      setEstado({
        tipo: "error",
        mensaje: error instanceof Error ? error.message : String(error),
      })
    }
  }, [ciudades, desde, hasta, orden, dir, pagina, tamano])

  useEffect(() => {
    // Lectura real del destino cada vez que cambian filtros, orden o página.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void consultar()
  }, [consultar])

  const reiniciarPagina =
    <T,>(set: (v: T) => void) =>
    (v: T) => {
      set(v)
      setPagina(1)
    }
  const total = estado.tipo === "ok" ? estado.total : 0
  const totalPaginas = Math.max(1, Math.ceil(total / tamano))

  return (
    <div className="grid gap-3">
      <p className="flex items-start gap-2 rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
        <Database aria-hidden className="mt-0.5 size-4 shrink-0" />
        <span>
          <strong className="font-medium">Datos persistidos:</strong> lectura
          real de la tabla <code>mediciones_meteorologicas</code> en Supabase,
          hecha desde el servidor. No incluye datos locales pendientes de subir.
          La consulta usa <code>ORDER BY</code> explícito.
        </span>
      </p>

      <section
        aria-label="Filtros de la consulta"
        className="grid gap-3 rounded-lg border p-3 @xl:grid-cols-2 @5xl:grid-cols-4"
      >
        <fieldset className="grid gap-1">
          <legend className="mb-1 text-xs font-medium">
            Ciudades (ninguna = todas)
          </legend>
          <div className="flex flex-wrap gap-x-3 gap-y-1">
            {NOMBRES_CIUDADES.map((c) => (
              <Label key={c} className="cursor-pointer text-sm font-normal">
                <Checkbox
                  checked={ciudades.includes(c)}
                  onCheckedChange={(v) =>
                    reiniciarPagina(setCiudades)(
                      v ? [...ciudades, c] : ciudades.filter((x) => x !== c)
                    )
                  }
                />
                {c}
              </Label>
            ))}
          </div>
        </fieldset>
        <div className="grid gap-1">
          <Label htmlFor="sb-desde" className="text-xs">
            Desde (UTC)
          </Label>
          <Input
            id="sb-desde"
            type="datetime-local"
            value={desde}
            onChange={(e) => reiniciarPagina(setDesde)(e.target.value)}
          />
          <Label htmlFor="sb-hasta" className="text-xs">
            Hasta (UTC, incluida)
          </Label>
          <Input
            id="sb-hasta"
            type="datetime-local"
            value={hasta}
            onChange={(e) => reiniciarPagina(setHasta)(e.target.value)}
          />
        </div>
        <div className="grid content-start gap-1">
          <Label htmlFor="sb-orden" className="text-xs">
            Ordenar por
          </Label>
          <select
            id="sb-orden"
            className="h-8 rounded-lg border bg-background px-2 text-sm"
            value={orden}
            onChange={(e) => reiniciarPagina(setOrden)(e.target.value)}
          >
            {Object.entries(CAMPOS_ORDEN).map(([v, e]) => (
              <option key={v} value={v}>
                {e}
              </option>
            ))}
          </select>
          <select
            aria-label="Dirección de la ordenación"
            className="h-8 rounded-lg border bg-background px-2 text-sm"
            value={dir}
            onChange={(e) =>
              reiniciarPagina(setDir)(e.target.value as "asc" | "desc")
            }
          >
            <option value="asc">Ascendente</option>
            <option value="desc">Descendente</option>
          </select>
        </div>
        <div className="grid content-start gap-2">
          <Button
            variant="outline"
            onClick={() => void consultar()}
            disabled={estado.tipo === "cargando"}
          >
            <RefreshCw
              aria-hidden
              className={
                estado.tipo === "cargando" ? "animate-spin" : undefined
              }
            />
            Actualizar
          </Button>
          <p className="text-xs text-muted-foreground" aria-live="polite">
            {estado.tipo === "cargando"
              ? "Consultando Supabase…"
              : estado.tipo === "ok"
                ? `${n(estado.total)} filas en destino con estos filtros · leído a las ${estado.leidoEn.toLocaleTimeString("es-ES")}`
                : "La consulta ha fallado."}
          </p>
        </div>
      </section>

      {estado.tipo === "error" && (
        <Alert variant="destructive">
          <AlertTitle>No se pudo leer Supabase</AlertTitle>
          <AlertDescription>{estado.mensaje}</AlertDescription>
        </Alert>
      )}

      <TablaDatos
        columnas={COLUMNAS}
        filas={estado.tipo === "ok" ? estado.filas : []}
        claveFila={(r) => String(r.id)}
        vacio={
          estado.tipo === "cargando"
            ? "Cargando…"
            : "No hay filas persistidas con estos filtros."
        }
      />
      <Paginacion
        pagina={Math.min(pagina, totalPaginas)}
        totalPaginas={totalPaginas}
        total={total}
        tamano={tamano}
        onPagina={setPagina}
        onTamano={reiniciarPagina(setTamano)}
        etiqueta="filas persistidas"
      />
    </div>
  )
}

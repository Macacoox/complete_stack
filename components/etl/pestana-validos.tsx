"use client"

import { Eraser, Filter } from "lucide-react"
import { useState, type ReactNode } from "react"

import { AvisoLocal } from "@/components/etl/pestanas-inspeccion"
import { Paginacion, TablaDatos, type Columna } from "@/components/etl/tabla-datos"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { PipelineEtl } from "@/hooks/use-pipeline-etl"
import {
  FILTROS_VACIOS,
  ORDEN_POR_DEFECTO,
  erroresFiltros,
  filtrosActivos,
  paginar,
  type CampoOrden,
  type Filtros,
} from "@/lib/etl/filtros"
import { fechaUtc, n } from "@/lib/etl/formato"
import type { RegistroValido } from "@/lib/etl/tipos"

export const ETIQUETAS_ORDEN: Record<CampoOrden, string> = {
  ciudad: "Ciudad",
  fecha_hora: "Fecha y hora",
  temperatura_c: "Temperatura",
  humedad_pct: "Humedad",
  precipitacion_mm: "Precipitación",
}

/** Columnas de medición compartidas por las tablas de registros válidos. */
export const COLUMNAS_MEDICION: Columna<RegistroValido>[] = [
  { id: "ciudad", titulo: "Ciudad", celda: (r) => r.ciudad },
  { id: "fecha", titulo: "Fecha y hora", unidad: "UTC", celda: (r) => fechaUtc(r.fecha_hora) },
  { id: "t", titulo: "Temperatura", unidad: "°C", numerica: true, celda: (r) => r.temperatura_c },
  { id: "h", titulo: "Humedad", unidad: "%", numerica: true, celda: (r) => r.humedad_pct },
  { id: "p", titulo: "Precipitación", unidad: "mm", numerica: true, celda: (r) => r.precipitacion_mm },
]

function Rango({
  titulo,
  unidad,
  min,
  max,
  onMin,
  onMax,
}: {
  titulo: string
  unidad: string
  min: string
  max: string
  onMin: (v: string) => void
  onMax: (v: string) => void
}) {
  const id = titulo.toLowerCase().replace(/\W/g, "")
  return (
    <fieldset className="grid gap-1">
      <legend className="mb-1 text-xs font-medium">
        {titulo} ({unidad})
      </legend>
      <div className="flex gap-2">
        <Label htmlFor={`${id}-min`} className="sr-only">
          {titulo} mínima
        </Label>
        <Input id={`${id}-min`} inputMode="decimal" placeholder="mín." value={min} onChange={(e) => onMin(e.target.value)} />
        <Label htmlFor={`${id}-max`} className="sr-only">
          {titulo} máxima
        </Label>
        <Input id={`${id}-max`} inputMode="decimal" placeholder="máx." value={max} onChange={(e) => onMax(e.target.value)} />
      </div>
    </fieldset>
  )
}

function PanelFiltros({ pipeline, ciudades }: { pipeline: PipelineEtl; ciudades: string[] }) {
  const { filtros, setFiltros, orden, setOrden } = pipeline
  const cambiar = (cambios: Partial<Filtros>) => setFiltros((f) => ({ ...f, ...cambios }))
  const errores = erroresFiltros(filtros)

  return (
    <section aria-label="Filtros y ordenación" className="grid gap-4 rounded-lg border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-1.5 text-sm font-medium">
          <Filter aria-hidden className="size-4" /> Filtros y ordenación
        </h3>
        <Button
          size="sm"
          variant="outline"
          disabled={!filtrosActivos(filtros) && orden === ORDEN_POR_DEFECTO}
          onClick={() => {
            setFiltros(FILTROS_VACIOS)
            setOrden(ORDEN_POR_DEFECTO)
          }}
        >
          <Eraser aria-hidden /> Restablecer filtros
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <fieldset className="grid gap-1 sm:col-span-2 lg:col-span-1">
          <legend className="mb-1 text-xs font-medium">Ciudades (ninguna marcada = todas)</legend>
          <div className="flex flex-wrap gap-x-3 gap-y-1">
            {ciudades.map((c) => (
              <Label key={c} className="cursor-pointer text-sm font-normal">
                <Checkbox
                  checked={filtros.ciudades.includes(c)}
                  onCheckedChange={(v) =>
                    cambiar({
                      ciudades: v ? [...filtros.ciudades, c] : filtros.ciudades.filter((x) => x !== c),
                    })
                  }
                />
                {c}
              </Label>
            ))}
          </div>
        </fieldset>

        <fieldset className="grid gap-1 sm:col-span-2 lg:col-span-1">
          <legend className="mb-1 text-xs font-medium">Intervalo de fecha y hora (UTC)</legend>
          <Label htmlFor="filtro-desde" className="text-xs font-normal text-muted-foreground">
            Desde
          </Label>
          <Input
            id="filtro-desde"
            type="datetime-local"
            value={filtros.desde}
            onChange={(e) => cambiar({ desde: e.target.value })}
          />
          <Label htmlFor="filtro-hasta" className="text-xs font-normal text-muted-foreground">
            Hasta (incluida)
          </Label>
          <Input
            id="filtro-hasta"
            type="datetime-local"
            value={filtros.hasta}
            onChange={(e) => cambiar({ hasta: e.target.value })}
          />
        </fieldset>

        <div className="grid content-start gap-3">
          <Rango
            titulo="Temperatura"
            unidad="°C"
            min={filtros.tempMin}
            max={filtros.tempMax}
            onMin={(v) => cambiar({ tempMin: v })}
            onMax={(v) => cambiar({ tempMax: v })}
          />
          <Rango
            titulo="Humedad"
            unidad="%"
            min={filtros.humMin}
            max={filtros.humMax}
            onMin={(v) => cambiar({ humMin: v })}
            onMax={(v) => cambiar({ humMax: v })}
          />
        </div>

        <div className="grid content-start gap-3">
          <Rango
            titulo="Precipitación"
            unidad="mm"
            min={filtros.precMin}
            max={filtros.precMax}
            onMin={(v) => cambiar({ precMin: v })}
            onMax={(v) => cambiar({ precMax: v })}
          />
          <Label className="cursor-pointer text-sm font-normal">
            <Checkbox checked={filtros.soloLluvia} onCheckedChange={(v) => cambiar({ soloLluvia: v })} />
            Solo registros con lluvia (precipitación &gt; 0 mm)
          </Label>
          <div className="grid gap-1">
            <Label htmlFor="orden-campo" className="text-xs">
              Ordenar por
            </Label>
            <div className="flex gap-2">
              <select
                id="orden-campo"
                className="h-8 flex-1 rounded-lg border bg-background px-2 text-sm"
                value={orden.campo}
                onChange={(e) => setOrden({ ...orden, campo: e.target.value as CampoOrden })}
              >
                {Object.entries(ETIQUETAS_ORDEN).map(([valor, etiqueta]) => (
                  <option key={valor} value={valor}>
                    {etiqueta}
                  </option>
                ))}
              </select>
              <select
                aria-label="Dirección de la ordenación"
                className="h-8 rounded-lg border bg-background px-2 text-sm"
                value={orden.direccion}
                onChange={(e) => setOrden({ ...orden, direccion: e.target.value as "asc" | "desc" })}
              >
                <option value="asc">Ascendente</option>
                <option value="desc">Descendente</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {errores.length > 0 && (
        <Alert variant="destructive">
          <AlertDescription>
            <ul className="list-disc pl-4">
              {errores.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}
    </section>
  )
}

export function PestanaValidos({ pipeline }: { pipeline: PipelineEtl }) {
  const { limpieza, seleccionados, seleccion, alternarSeleccion } = pipeline
  const [pagina, setPagina] = useState(1)
  const [tamano, setTamano] = useState(25)
  const ciudades = [...new Set(limpieza.validos.map((r) => r.ciudad))]

  // La paginación se aplica DESPUÉS de filtrar y ordenar: solo afecta a la vista.
  const vista = paginar(seleccionados.ordenados, pagina, tamano)
  const clavesPagina = vista.filas.map((r) => r.clave)
  const marcadasPagina = clavesPagina.filter((c) => seleccion.has(c)).length

  const columnas: Columna<RegistroValido>[] = [
    {
      id: "sel",
      titulo: (
        <Checkbox
          aria-label="Seleccionar todas las filas de esta página"
          checked={clavesPagina.length > 0 && marcadasPagina === clavesPagina.length}
          indeterminate={marcadasPagina > 0 && marcadasPagina < clavesPagina.length}
          disabled={clavesPagina.length === 0}
          onCheckedChange={(v) => alternarSeleccion(clavesPagina, v)}
        />
      ),
      celda: (r) => (
        <Checkbox
          aria-label={`Seleccionar ${r.ciudad} ${fechaUtc(r.fecha_hora)}`}
          checked={seleccion.has(r.clave)}
          onCheckedChange={(v) => alternarSeleccion([r.clave], v)}
        />
      ),
    },
    { id: "fila", titulo: "Fila", numerica: true, celda: (r) => r.fila },
    ...COLUMNAS_MEDICION,
  ]

  return (
    <div className="grid gap-3">
      <AvisoLocal />
      <p className="text-sm text-muted-foreground">
        Orden de operaciones: <strong>válidos → filtros → ordenación → selección → carga</strong>. Cambiar
        los filtros no selecciona filas nuevas automáticamente; solo se suben las filas seleccionadas que
        cumplen los filtros actuales.
      </p>
      <PanelFiltros
        pipeline={{
          ...pipeline,
          setFiltros: (f) => {
            pipeline.setFiltros(f)
            setPagina(1)
          },
          setOrden: (o) => {
            pipeline.setOrden(o)
            setPagina(1)
          },
        }}
        ciudades={ciudades}
      />

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="mr-auto">
          <strong className="tabular-nums">{n(seleccionados.ordenados.length)}</strong> de{" "}
          {n(limpieza.validos.length)} válidos cumplen los filtros ·{" "}
          <strong className="tabular-nums">{n(seleccionados.aSubir.length)}</strong> seleccionados para
          cargar
        </span>
        <Button
          size="sm"
          variant="secondary"
          disabled={seleccionados.ordenados.length === 0}
          onClick={pipeline.seleccionarFiltrados}
        >
          Seleccionar las {n(seleccionados.ordenados.length)} filas filtradas
        </Button>
        <Button size="sm" variant="outline" disabled={seleccion.size === 0} onClick={pipeline.vaciarSeleccion}>
          Vaciar selección ({n(seleccion.size)})
        </Button>
      </div>

      <TablaDatos
        columnas={columnas}
        filas={vista.filas}
        claveFila={(r) => r.clave}
        claseFila={(r) => (seleccion.has(r.clave) ? "bg-primary/5" : undefined)}
        vacio={
          limpieza.validos.length
            ? "Ningún registro cumple los filtros actuales."
            : "Sin registros válidos. Extrae datos primero."
        }
      />
      <Paginacion
        pagina={vista.pagina}
        totalPaginas={vista.totalPaginas}
        total={seleccionados.ordenados.length}
        tamano={tamano}
        onPagina={setPagina}
        onTamano={(t) => {
          setTamano(t)
          setPagina(1)
        }}
        etiqueta="registros filtrados"
      />
    </div>
  )
}

export function Nota({ children }: { children: ReactNode }) {
  return <p className="rounded-md bg-muted/60 px-3 py-2 text-xs text-muted-foreground">{children}</p>
}

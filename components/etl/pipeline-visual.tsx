"use client"

import { ArrowDown, ArrowRight } from "lucide-react"
import { Fragment } from "react"

import { EtiquetaEstado, type Estado } from "@/components/etl/estado"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import type { PipelineEtl } from "@/hooks/use-pipeline-etl"
import { resumenLotes } from "@/lib/etl/carga"
import { duracion, n } from "@/lib/etl/formato"
import { cn } from "@/lib/utils"

export type PestanaId = "json" | "transformados" | "validos" | "rechazados" | "carga" | "supabase"

type Fase = {
  id: string
  titulo: string
  explicacion: string
  estado: Estado
  textoEstado: string
  entrada: string
  salida: string
  extra?: string
  duracionMs: number | null
  pestana: PestanaId
}

const TEXTO_ESTADO: Record<Estado, string> = {
  pendiente: "Pendiente",
  en_curso: "En curso",
  completada: "Completada",
  aviso: "Completada con avisos",
  error: "Con errores",
}

function calcularFases(p: PipelineEtl): Fase[] {
  const descargas = p.extraccion?.descargas ?? []
  const ok = descargas.filter((d) => d.estado === "ok")
  const conError = descargas.filter((d) => d.estado === "error")
  const brutos = p.transformacion.registros.length
  const hayDatos = !p.extrayendo && ok.length > 0

  const estadoExtraccion: Estado =
    descargas.length === 0
      ? "pendiente"
      : descargas.some((d) => d.estado === "descargando" || d.estado === "pendiente")
        ? "en_curso"
        : conError.length
          ? "error"
          : "completada"

  const lotes = p.carga?.lotes ?? []
  const r = resumenLotes(lotes)
  const estadoCarga: Estado = !p.carga
    ? "pendiente"
    : p.cargando
      ? "en_curso"
      : r.lotesFallidos || r.faltantes.length || r.verificacionConError
        ? "error"
        : "completada"

  const conAvisos = (estado: Estado, avisos: number): Estado =>
    estado === "completada" && avisos > 0 ? "aviso" : estado

  const fases: Omit<Fase, "textoEstado">[] = [
    {
      id: "extraccion",
      titulo: "Extracción",
      explicacion: "Una petición HTTP por ciudad a la API histórica. Se guarda el JSON tal cual llega.",
      estado: estadoExtraccion,
      entrada: `${n(descargas.length)} ciudades`,
      salida: `${n(ok.length)} JSON · ${n(brutos)} horas`,
      extra: conError.length ? `${conError.length} ciudad(es) con error` : undefined,
      duracionMs: descargas.length
        ? descargas.reduce((s, d) => s + (d.duracionMs ?? 0), 0)
        : null,
      pestana: "json",
    },
    {
      id: "transformacion",
      titulo: "Transformación",
      explicacion: "Los arrays paralelos (time, temperatura…) se convierten en un registro por ciudad y hora.",
      estado: conAvisos(hayDatos ? "completada" : "pendiente", p.transformacion.avisos.length),
      entrada: `${n(p.transformacion.entradas)} JSON`,
      salida: `${n(brutos)} registros`,
      extra: p.transformacion.avisos.length
        ? `${p.transformacion.avisos.length} aviso(s) de estructura`
        : undefined,
      duracionMs: hayDatos ? p.transformacion.duracionMs : null,
      pestana: "transformados",
    },
    {
      id: "limpieza",
      titulo: "Limpieza",
      explicacion: "Se validan fecha, tipos y rangos, y se eliminan duplicados. Cada rechazo guarda su motivo.",
      estado: conAvisos(hayDatos ? "completada" : "pendiente", p.limpieza.rechazados.length),
      entrada: `${n(brutos)} registros`,
      salida: `${n(p.limpieza.validos.length)} válidos`,
      extra: `${n(p.limpieza.rechazados.length)} rechazados (${n(p.limpieza.duplicados)} duplicados)`,
      duracionMs: hayDatos ? p.limpieza.duracionMs : null,
      pestana: "validos",
    },
    {
      id: "filtrado",
      titulo: "Filtrado y selección",
      explicacion: "Tú decides qué subir: filtros → ordenación → selección de filas.",
      estado: !hayDatos
        ? "pendiente"
        : p.seleccionados.aSubir.length > 0
          ? "completada"
          : "pendiente",
      entrada: `${n(p.limpieza.validos.length)} válidos`,
      salida: `${n(p.seleccionados.aSubir.length)} para cargar`,
      extra: `${n(p.seleccionados.ordenados.length)} cumplen los filtros`,
      duracionMs: hayDatos ? p.seleccionados.duracionMs : null,
      pestana: "validos",
    },
    {
      id: "carga",
      titulo: "Carga",
      explicacion: "Upsert por lotes de 500 en Supabase y verificación de las claves en destino.",
      estado: estadoCarga,
      entrada: p.carga ? `${n(r.total)} congelados` : "—",
      salida: p.carga ? `${n(r.verificados)} verificados` : "—",
      extra: p.carga
        ? `${r.lotesCompletados}/${lotes.length} lotes · ${r.lotesFallidos} fallidos`
        : undefined,
      duracionMs: lotes.some((l) => l.duracionMs !== null)
        ? lotes.reduce((s, l) => s + (l.duracionMs ?? 0), 0)
        : null,
      pestana: "carga",
    },
  ]
  return fases.map((f) => ({ ...f, textoEstado: TEXTO_ESTADO[f.estado] }))
}

export function PipelineVisual({
  pipeline,
  onInspeccionar,
}: {
  pipeline: PipelineEtl
  onInspeccionar: (pestana: PestanaId) => void
}) {
  const fases = calcularFases(pipeline)
  const descargas = pipeline.extraccion?.descargas ?? []

  return (
    <Card>
      <CardHeader>
        <CardTitle>2. Pipeline ETL</CardTitle>
        <CardDescription>
          Estados y contadores reales de cada fase. Pulsa una fase para inspeccionar su resultado.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <ol className="grid gap-2 lg:grid-cols-[repeat(9,auto)] lg:items-stretch">
          {fases.map((f, i) => (
            <Fragment key={f.id}>
              <li className="lg:min-w-0">
                <button
                  type="button"
                  onClick={() => onInspeccionar(f.pestana)}
                  className={cn(
                    "grid h-full w-full gap-2 rounded-lg border p-3 text-left text-sm transition-colors hover:bg-muted/60 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                    f.estado === "error" && "border-destructive/50",
                    f.estado === "en_curso" && "border-sky-400"
                  )}
                  aria-label={`Fase ${i + 1}, ${f.titulo}: ${f.textoEstado}. Inspeccionar resultados`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-1">
                    <span className="font-medium">
                      {i + 1}. {f.titulo}
                    </span>
                    <EtiquetaEstado estado={f.estado} texto={f.textoEstado} />
                  </div>
                  <p className="text-xs text-muted-foreground">{f.explicacion}</p>
                  <dl className="grid grid-cols-[auto_1fr] gap-x-2 text-xs">
                    <dt className="text-muted-foreground">Entrada</dt>
                    <dd className="text-right tabular-nums">{f.entrada}</dd>
                    <dt className="text-muted-foreground">Salida</dt>
                    <dd className="text-right font-medium tabular-nums">{f.salida}</dd>
                    <dt className="text-muted-foreground">Duración</dt>
                    <dd className="text-right tabular-nums">{duracion(f.duracionMs)}</dd>
                  </dl>
                  {f.extra && <p className="text-xs text-muted-foreground">{f.extra}</p>}
                </button>
              </li>
              {i < fases.length - 1 && (
                <li aria-hidden className="flex items-center justify-center text-muted-foreground">
                  <ArrowDown className="size-4 lg:hidden" />
                  <ArrowRight className="hidden size-4 lg:block" />
                </li>
              )}
            </Fragment>
          ))}
        </ol>

        {descargas.length > 0 && (
          <section aria-label="Progreso de la extracción por ciudad" className="text-sm">
            <p className="mb-2 font-medium" aria-live="polite">
              Ciudades procesadas: {descargas.filter((d) => d.estado === "ok" || d.estado === "error").length}{" "}
              de {descargas.length}
              {pipeline.extrayendo &&
                ` · pendientes: ${
                  descargas
                    .filter((d) => d.estado === "pendiente" || d.estado === "descargando")
                    .map((d) => d.ciudad.nombre)
                    .join(", ") || "ninguna"
                }`}
            </p>
            <ul className="flex flex-wrap gap-2">
              {descargas.map((d) => (
                <li key={d.ciudad.id}>
                  <EtiquetaEstado
                    estado={
                      d.estado === "ok"
                        ? "completada"
                        : d.estado === "error"
                          ? "error"
                          : d.estado === "descargando"
                            ? "en_curso"
                            : "pendiente"
                    }
                    texto={`${d.ciudad.nombre}: ${
                      { ok: "descargada", error: "error", descargando: "descargando…", pendiente: "pendiente" }[
                        d.estado
                      ]
                    }${d.duracionMs !== null && d.estado !== "descargando" ? ` (${duracion(d.duracionMs)})` : ""}`}
                  />
                </li>
              ))}
            </ul>
          </section>
        )}
      </CardContent>
    </Card>
  )
}

export function Contadores({ pipeline }: { pipeline: PipelineEtl }) {
  const { transformacion, limpieza, seleccionados } = pipeline
  const items = [
    { etiqueta: "Total extraído", valor: transformacion.registros.length, ayuda: "registros horarios recibidos" },
    { etiqueta: "Válidos", valor: limpieza.validos.length, ayuda: "superan la limpieza" },
    { etiqueta: "Rechazados", valor: limpieza.rechazados.length, ayuda: "por calidad o duplicado" },
    { etiqueta: "Coinciden con los filtros", valor: seleccionados.ordenados.length, ayuda: "de los válidos" },
    {
      etiqueta: "Seleccionados para cargar",
      valor: seleccionados.aSubir.length,
      ayuda: "seleccionados y dentro de los filtros",
      destacado: true,
    },
  ]
  return (
    <section aria-label="Contadores" className="grid gap-2">
      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        {items.map((it) => (
          <div
            key={it.etiqueta}
            className={cn(
              "rounded-lg border bg-card p-3",
              it.destacado && "border-primary/60 ring-1 ring-primary/20"
            )}
          >
            <dt className="text-xs text-muted-foreground">{it.etiqueta}</dt>
            <dd className="text-2xl font-semibold tabular-nums">{n(it.valor)}</dd>
            <dd className="text-xs text-muted-foreground">{it.ayuda}</dd>
          </div>
        ))}
      </dl>
      {seleccionados.fueraDeFiltros > 0 && (
        <p className="text-sm text-amber-800 dark:text-amber-300" role="status">
          ⚠ {n(seleccionados.fueraDeFiltros)} fila(s) seleccionadas no cumplen los filtros actuales y no
          se subirán (siguen seleccionadas por si cambias los filtros).
        </p>
      )}
    </section>
  )
}

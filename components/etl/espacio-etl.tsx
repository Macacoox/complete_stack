"use client"

import {
  ArrowRight,
  CircleCheck,
  PanelLeftClose,
  PanelLeftOpen,
  Workflow,
} from "lucide-react"
import dynamic from "next/dynamic"
import { useCallback, useState } from "react"

import { ConfiguracionExtraccionPanel } from "@/components/etl/configuracion-extraccion"
import { EstadoSupabase } from "@/components/etl/estado-supabase"
import { FichaCiudad } from "@/components/etl/ficha-ciudad"
import {
  ComoFunciona,
  Glosario,
  SiguientePaso,
} from "@/components/etl/guia-estudiante"
import {
  ResultadosEjecucion,
  ColumnaDatos,
} from "@/components/etl/panel-general"
import { PestanaCarga } from "@/components/etl/pestana-carga"
import { PestanaSupabase } from "@/components/etl/pestana-supabase"
import { PestanaValidos } from "@/components/etl/pestana-validos"
import {
  PestanaJson,
  PestanaRechazados,
  PestanaTransformados,
} from "@/components/etl/pestanas-inspeccion"
import {
  PipelineVisual,
  type PestanaId,
} from "@/components/etl/pipeline-visual"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { usePipelineEtl } from "@/hooks/use-pipeline-etl"
import { useResumenCiudades } from "@/hooks/use-resumen-ciudades"
import { resumenLotes } from "@/lib/etl/carga"
import { n } from "@/lib/etl/formato"
import { cn } from "@/lib/utils"

// MapLibre necesita el navegador (WebGL): no se renderiza en el servidor.
const MapaCiudades = dynamic(
  () => import("@/components/etl/mapa-ciudades").then((m) => m.MapaCiudades),
  { ssr: false, loading: () => <div className="h-full w-full bg-black" /> }
)

type Vista =
  "inicio" | "configurar" | "pipeline" | "datos" | "resultados" | "glosario"

/** Pestañas del panel: todos los pasos están disponibles desde el principio. */
const VISTAS: { id: Vista; texto: string; paso?: number }[] = [
  { id: "inicio", texto: "¿Qué es?" },
  { id: "configurar", texto: "Configurar", paso: 1 },
  { id: "pipeline", texto: "Pipeline", paso: 2 },
  { id: "datos", texto: "Datos", paso: 3 },
  { id: "resultados", texto: "Resultados" },
  { id: "glosario", texto: "Glosario" },
]

/**
 * Pantalla única sin desplazamiento: el mapa ocupa el fondo y el panel de
 * trabajo, semitransparente, flota encima con cada paso en una pestaña.
 */
export function EspacioEtl() {
  const pipeline = usePipelineEtl()
  const resumen = useResumenCiudades(pipeline.cargando)
  const [vista, setVista] = useState<Vista>("inicio")
  const [pestana, setPestana] = useState<PestanaId>("json")
  const [plegado, setPlegado] = useState(false)
  const [ciudad, setCiudad] = useState<string | null>(null)
  const cerrarFicha = useCallback(() => setCiudad(null), [])

  // Pasos terminados: se marcan con ✓ en las pestañas.
  const extraido = pipeline.transformacion.entradas > 0
  const lotes = pipeline.carga ? resumenLotes(pipeline.carga.lotes) : null
  const cargado =
    !!lotes &&
    !pipeline.cargando &&
    lotes.lotesFallidos === 0 &&
    lotes.faltantes.length === 0 &&
    !lotes.verificacionConError
  const hecho: Partial<Record<Vista, boolean>> = {
    configurar: extraido,
    pipeline: extraido,
    datos: cargado,
  }

  const inspeccionar = (id: PestanaId) => {
    setPestana(id)
    setVista("datos")
  }

  const pestanas: { id: PestanaId; titulo: string; cantidad?: number }[] = [
    {
      id: "json",
      titulo: "JSON original",
      cantidad: pipeline.transformacion.entradas,
    },
    {
      id: "transformados",
      titulo: "Transformados",
      cantidad: pipeline.transformacion.registros.length,
    },
    {
      id: "validos",
      titulo: "Válidos · filtrar y seleccionar",
      cantidad: pipeline.limpieza.validos.length,
    },
    {
      id: "rechazados",
      titulo: "Rechazados",
      cantidad: pipeline.limpieza.rechazados.length,
    },
    {
      id: "carga",
      titulo: "Vista previa de la carga",
      cantidad: pipeline.seleccionados.aSubir.length,
    },
    { id: "supabase", titulo: "Datos en Supabase" },
  ]

  return (
    <div className="relative flex h-dvh flex-col overflow-hidden bg-black lg:block">
      <div
        className={cn(
          "mapa-fondo relative shrink-0 lg:absolute lg:inset-0 lg:h-auto",
          plegado && !ciudad ? "flex-1" : "h-[38dvh]"
        )}
      >
        <MapaCiudades
          resumen={resumen.resumen}
          reencuadre={plegado && !ciudad}
          onSeleccionar={setCiudad}
        />
        <ColumnaDatos
          resumen={resumen}
          pipeline={pipeline}
          oculta={!!ciudad}
          className="absolute top-3 right-3 w-56 lg:top-4 lg:right-4 lg:bottom-[5.75rem] lg:w-72 lg:[scrollbar-width:none] lg:overflow-y-auto"
        />
        {/* Ficha de la ciudad pulsada: ocupa el sitio de la columna de datos. */}
        {ciudad && (
          <FichaCiudad
            key={ciudad}
            ciudad={ciudad}
            resumen={resumen.resumen?.find((r) => r.ciudad === ciudad)}
            onCerrar={cerrarFicha}
            className="fixed inset-x-0 top-[38dvh] bottom-0 z-30 overflow-y-auto rounded-none border-x-0 border-b-0 lg:absolute lg:inset-x-auto lg:top-4 lg:right-4 lg:bottom-auto lg:w-72 lg:overflow-visible lg:rounded-2xl lg:border"
          />
        )}
      </div>

      <aside
        aria-label="Panel de trabajo"
        data-panel="izquierdo"
        className={cn(
          "panel-trabajo relative z-10 flex min-h-0 flex-col border-t border-white/20 bg-slate-950/60 backdrop-blur-md lg:absolute lg:top-4 lg:left-4 lg:overflow-hidden lg:rounded-2xl lg:border lg:shadow-2xl lg:shadow-black/50",
          plegado ? "flex-none" : "flex-1 lg:bottom-4 lg:w-[min(46rem,48vw)]",
          // En móvil la ficha de ciudad ocupa el sitio del panel mientras está abierta.
          ciudad && "max-lg:invisible"
        )}
      >
        <header
          className={cn(
            "px-5 pt-4",
            plegado ? "pb-4" : "border-b border-white/10"
          )}
        >
          <div className="flex items-center gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary text-white">
              <Workflow aria-hidden className="size-5" />
            </span>
            <div className="min-w-0">
              <h1 className="font-heading text-lg leading-tight font-semibold">
                Pipeline ETL
              </h1>
              <p className="truncate text-xs text-muted-foreground">
                Tiempo de Open-Meteo → base de datos Supabase
              </p>
            </div>
            <div className="ml-auto hidden shrink-0 sm:block">
              <EstadoSupabase />
            </div>
            <div className="ml-auto shrink-0 sm:hidden">
              <EstadoSupabase compacto />
            </div>
            <button
              type="button"
              onClick={() => setPlegado((p) => !p)}
              aria-expanded={!plegado}
              aria-label={plegado ? "Desplegar el panel" : "Plegar el panel"}
              title={plegado ? "Desplegar el panel" : "Plegar el panel"}
              className="grid size-8 shrink-0 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-white/10 hover:text-white"
            >
              {plegado ? (
                <PanelLeftOpen aria-hidden className="size-4" />
              ) : (
                <PanelLeftClose aria-hidden className="size-4" />
              )}
            </button>
          </div>
          <nav
            aria-label="Pasos"
            hidden={plegado}
            className="-mx-2 mt-3 [scrollbar-width:none] overflow-x-auto"
          >
            <ul className="flex px-2">
              {VISTAS.map((v) => {
                const activa = vista === v.id
                return (
                  <li key={v.id} className="shrink-0">
                    <button
                      type="button"
                      aria-current={activa ? "page" : undefined}
                      onClick={() => setVista(v.id)}
                      className={cn(
                        "flex items-center gap-1.5 border-b-2 px-3 pt-1.5 pb-2.5 text-sm font-medium transition-colors",
                        activa
                          ? "border-white text-white"
                          : "border-transparent text-muted-foreground hover:text-white"
                      )}
                    >
                      {v.paso &&
                        (hecho[v.id] ? (
                          <CircleCheck
                            aria-label="hecho"
                            className="size-[1.125rem] text-emerald-400"
                          />
                        ) : (
                          <span
                            className={cn(
                              "grid size-[1.125rem] place-items-center rounded-full text-xs font-semibold",
                              activa
                                ? "bg-white text-slate-950"
                                : "bg-white/15 text-white"
                            )}
                          >
                            {v.paso}
                          </span>
                        ))}
                      {v.texto}
                    </button>
                  </li>
                )
              })}
            </ul>
          </nav>
        </header>

        {/* Solo esta zona se desplaza si el contenido no cabe; la página no. */}
        <div
          hidden={plegado}
          className="@container min-h-0 flex-1 overflow-y-auto px-5 py-5"
        >
          <div className="grid gap-4">
            <div hidden={vista !== "inicio"} className="grid gap-4">
              <section className="grid gap-3">
                <p className="text-base leading-relaxed text-muted-foreground">
                  El mapa muestra lo que ya está guardado en{" "}
                  <strong className="text-white">Supabase</strong>, nuestra base
                  de datos. <strong className="text-white">Tu misión:</strong>{" "}
                  descargar datos meteorológicos reales de una API, limpiarlos y
                  guardarlos. Cuando termines, los puntos del mapa crecerán.
                </p>
                <button
                  type="button"
                  onClick={() => setVista("configurar")}
                  className="inline-flex w-fit items-center gap-2 rounded-full bg-[#2563eb] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#1d4ed8]"
                >
                  Empezar: paso 1
                  <ArrowRight aria-hidden className="size-4" />
                </button>
              </section>
              <ComoFunciona />
            </div>

            <div hidden={vista !== "configurar"} className="grid gap-4">
              {" "}
              <ConfiguracionExtraccionPanel
                bloqueado={pipeline.extrayendo || pipeline.cargando}
                motivoBloqueo={
                  pipeline.extrayendo
                    ? "Extracción en curso…"
                    : pipeline.cargando
                      ? "Espera a que termine la carga en Supabase."
                      : undefined
                }
                onExtraer={(config) => {
                  setPestana("json")
                  setVista("pipeline")
                  void pipeline.extraer(config)
                }}
              />
            </div>

            <div hidden={vista !== "pipeline"} className="grid gap-4">
              {" "}
              <PipelineVisual
                pipeline={pipeline}
                onInspeccionar={inspeccionar}
              />
            </div>

            <div hidden={vista !== "datos"} className="grid gap-4">
              {" "}
              <Card>
                <CardHeader>
                  <CardTitle>3. Inspección de datos</CardTitle>
                  <CardDescription>
                    Resultado de cada fase. Las tablas se paginan solo para la
                    visualización.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Tabs
                    value={pestana}
                    onValueChange={(v) => setPestana(v as PestanaId)}
                  >
                    <div className="overflow-x-auto pb-1">
                      <TabsList className="w-max">
                        {pestanas.map((p) => (
                          <TabsTrigger key={p.id} value={p.id}>
                            {p.titulo}
                            {p.cantidad !== undefined && (
                              <span className="rounded-full bg-foreground/10 px-1.5 text-xs tabular-nums">
                                {n(p.cantidad)}
                              </span>
                            )}
                          </TabsTrigger>
                        ))}
                      </TabsList>
                    </div>
                    <TabsContent value="json" className="pt-3">
                      <PestanaJson pipeline={pipeline} />
                    </TabsContent>
                    <TabsContent value="transformados" className="pt-3">
                      <PestanaTransformados pipeline={pipeline} />
                    </TabsContent>
                    <TabsContent value="validos" className="pt-3">
                      <PestanaValidos pipeline={pipeline} />
                    </TabsContent>
                    <TabsContent value="rechazados" className="pt-3">
                      <PestanaRechazados pipeline={pipeline} />
                    </TabsContent>
                    <TabsContent value="carga" className="pt-3">
                      <PestanaCarga pipeline={pipeline} />
                    </TabsContent>
                    <TabsContent value="supabase" className="pt-3">
                      <PestanaSupabase />
                    </TabsContent>
                  </Tabs>
                </CardContent>
              </Card>
            </div>

            <div hidden={vista !== "resultados"}>
              <ResultadosEjecucion pipeline={pipeline} />
            </div>

            <div hidden={vista !== "glosario"}>
              <Glosario />
            </div>
          </div>
        </div>

        {/* Guía siempre visible: dice qué hacer ahora según el estado real. */}
        <div hidden={plegado}>
          <SiguientePaso pipeline={pipeline} onIr={inspeccionar} />
        </div>
      </aside>
    </div>
  )
}

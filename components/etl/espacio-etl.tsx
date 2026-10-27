"use client"

import dynamic from "next/dynamic"
import { useState } from "react"

import { ConfiguracionExtraccionPanel } from "@/components/etl/configuracion-extraccion"
import { EstadoSupabase } from "@/components/etl/estado-supabase"
import { Glosario, IntroEtl, SiguientePaso } from "@/components/etl/guia-estudiante"
import { PestanaCarga } from "@/components/etl/pestana-carga"
import { PestanaSupabase } from "@/components/etl/pestana-supabase"
import { PestanaValidos } from "@/components/etl/pestana-validos"
import {
  PestanaJson,
  PestanaRechazados,
  PestanaTransformados,
} from "@/components/etl/pestanas-inspeccion"
import { Contadores, PipelineVisual, type PestanaId } from "@/components/etl/pipeline-visual"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { usePipelineEtl } from "@/hooks/use-pipeline-etl"
import { n } from "@/lib/etl/formato"

// MapLibre necesita el navegador (WebGL): no se renderiza en el servidor.
const MapaCiudades = dynamic(
  () => import("@/components/etl/mapa-ciudades").then((m) => m.MapaCiudades),
  { ssr: false }
)

const SECCIONES = [
  ["configuracion", "1 · Configurar"],
  ["pipeline", "2 · Pipeline"],
  ["inspeccion", "3 · Datos"],
  ["mapa", "4 · Mapa"],
  ["glosario", "Glosario"],
] as const

export function EspacioEtl() {
  const pipeline = usePipelineEtl()
  const [pestana, setPestana] = useState<PestanaId>("json")

  const inspeccionar = (id: PestanaId) => {
    setPestana(id)
    document.getElementById("inspeccion")?.scrollIntoView({ behavior: "smooth", block: "start" })
  }

  const pestanas: { id: PestanaId; titulo: string; cantidad?: number }[] = [
    { id: "json", titulo: "JSON original", cantidad: pipeline.transformacion.entradas },
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
    { id: "rechazados", titulo: "Rechazados", cantidad: pipeline.limpieza.rechazados.length },
    {
      id: "carga",
      titulo: "Vista previa de la carga",
      cantidad: pipeline.seleccionados.aSubir.length,
    },
    { id: "supabase", titulo: "Datos en Supabase" },
  ]

  return (
    <>
      {/* Barra superior translúcida, al estilo de las apps de Apple. */}
      <nav className="sticky top-0 z-20 border-b border-border/60 bg-background/75 backdrop-blur-xl backdrop-saturate-150">
        <div className="mx-auto flex h-12 w-full max-w-6xl items-center gap-6 px-4 sm:px-6">
          <span className="text-[0.9375rem] font-semibold tracking-tight">Pipeline ETL</span>
          <ul className="hidden items-center gap-5 text-xs text-muted-foreground md:flex">
            {SECCIONES.map(([id, texto]) => (
              <li key={id}>
                <a href={`#${id}`} className="transition-colors hover:text-foreground">
                  {texto}
                </a>
              </li>
            ))}
          </ul>
          <div className="ml-auto">
            <EstadoSupabase />
          </div>
        </div>
      </nav>

      <main className="mx-auto grid w-full max-w-6xl gap-6 px-4 pt-10 pb-16 sm:gap-8 sm:px-6 sm:pt-14">
        <header className="grid gap-3">
          <p className="text-sm font-semibold text-primary">
            Práctica de Big Data · Open-Meteo → Supabase
          </p>
          <h1 className="max-w-3xl text-4xl leading-[1.08] font-semibold tracking-tight sm:text-5xl">
            De la API a la base de datos, paso a paso.
          </h1>
          <p className="max-w-2xl text-lg leading-relaxed text-muted-foreground">
            Descarga datos meteorológicos reales, mira cómo se transforman y limpian, decide qué
            registros guardar y comprueba lo que queda en la base de datos. Sigue los pasos de
            arriba abajo.
          </p>
        </header>

        <IntroEtl />

        <SiguientePaso pipeline={pipeline} onIr={inspeccionar} />

        <section id="configuracion" className="scroll-mt-16">
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
              void pipeline.extraer(config)
            }}
          />
        </section>

        <section id="pipeline" className="scroll-mt-16">
          <PipelineVisual pipeline={pipeline} onInspeccionar={inspeccionar} />
        </section>

        <Contadores pipeline={pipeline} />

        <Card id="inspeccion" className="scroll-mt-16">
          <CardHeader>
            <CardTitle>3. Inspección de datos</CardTitle>
            <CardDescription>
              Resultado de cada fase. Las tablas se paginan solo para la visualización.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={pestana} onValueChange={(v) => setPestana(v as PestanaId)}>
              <div className="overflow-x-auto pb-1">
                <TabsList className="w-max">
                  {pestanas.map((p) => (
                    <TabsTrigger key={p.id} value={p.id}>
                      {p.titulo}
                      {p.cantidad !== undefined && (
                        <span className="rounded-full bg-foreground/5 px-1.5 text-xs text-muted-foreground tabular-nums">
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

        <section id="mapa" className="scroll-mt-16">
          <MapaCiudades actualizarTras={pipeline.cargando} />
        </section>

        <section id="glosario" className="scroll-mt-16">
          <Glosario />
        </section>
      </main>
    </>
  )
}

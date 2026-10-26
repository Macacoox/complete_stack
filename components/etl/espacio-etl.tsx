"use client"

import { useState } from "react"

import { ConfiguracionExtraccionPanel } from "@/components/etl/configuracion-extraccion"
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

export function EspacioEtl() {
  const pipeline = usePipelineEtl()
  const [pestana, setPestana] = useState<PestanaId>("json")

  const inspeccionar = (id: PestanaId) => {
    setPestana(id)
    document.getElementById("inspeccion")?.scrollIntoView({ behavior: "smooth", block: "start" })
  }

  const pestanas: { id: PestanaId; titulo: string; cantidad?: number }[] = [
    { id: "json", titulo: "JSON original", cantidad: pipeline.transformacion.entradas },
    { id: "transformados", titulo: "Transformados", cantidad: pipeline.transformacion.registros.length },
    { id: "validos", titulo: "Válidos · filtrar y seleccionar", cantidad: pipeline.limpieza.validos.length },
    { id: "rechazados", titulo: "Rechazados", cantidad: pipeline.limpieza.rechazados.length },
    { id: "carga", titulo: "Vista previa de la carga", cantidad: pipeline.seleccionados.aSubir.length },
    { id: "supabase", titulo: "Datos en Supabase" },
  ]

  return (
    <main className="mx-auto grid w-full max-w-7xl gap-4 px-4 py-6 sm:px-6">
      <header className="grid gap-1">
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          Práctica de Big Data · primer pipeline ETL
        </p>
        <h1 className="text-2xl font-semibold">Open-Meteo → Supabase</h1>
        <p className="max-w-3xl text-sm text-muted-foreground">
          Extrae mediciones horarias históricas, observa cómo se transforman y limpian, decide qué
          registros subir y comprueba lo que queda guardado en la base de datos.
        </p>
      </header>

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

      <PipelineVisual pipeline={pipeline} onInspeccionar={inspeccionar} />

      <Contadores pipeline={pipeline} />

      <Card id="inspeccion" className="scroll-mt-4">
        <CardHeader>
          <CardTitle>3. Inspección de datos</CardTitle>
          <CardDescription>
            Resultado de cada fase. Las tablas se paginan solo para la visualización.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={pestana} onValueChange={(v) => setPestana(v as PestanaId)}>
            <div className="overflow-x-auto pb-1">
              <TabsList variant="line" className="w-max">
                {pestanas.map((p) => (
                  <TabsTrigger key={p.id} value={p.id}>
                    {p.titulo}
                    {p.cantidad !== undefined && (
                      <span className="rounded-full bg-muted px-1.5 text-xs tabular-nums">
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
    </main>
  )
}

"use client"

import {
  BookOpen,
  ChevronDown,
  Compass,
  Database,
  Filter,
  Sparkles,
} from "lucide-react"

import type { PestanaId } from "@/components/etl/pipeline-visual"
import type { PipelineEtl } from "@/hooks/use-pipeline-etl"
import { resumenLotes } from "@/lib/etl/carga"
import { n } from "@/lib/etl/formato"

const LETRAS = [
  {
    letra: "E",
    titulo: "Extract · Extraer",
    icono: Database,
    que: "Leer los datos de su origen sin tocarlos.",
    aqui: "Pedimos a la API de Open-Meteo el tiempo hora a hora de varias ciudades. Llega un JSON por ciudad.",
  },
  {
    letra: "T",
    titulo: "Transform · Transformar",
    icono: Sparkles,
    que: "Dar a los datos la forma y la calidad que necesita el destino.",
    aqui: "Convertimos el JSON en filas (ciudad + hora + medidas), validamos rangos y quitamos duplicados.",
  },
  {
    letra: "L",
    titulo: "Load · Cargar",
    icono: Filter,
    que: "Guardar el resultado en el sistema donde se analizará.",
    aqui: "Subimos las filas elegidas a una tabla de Supabase (PostgreSQL) y comprobamos que han llegado.",
  },
]

/** Introducción al concepto ETL en lenguaje sencillo. Plegable para quien ya lo conoce. */
export function IntroEtl() {
  return (
    <details open className="group rounded-3xl bg-card shadow-card">
      <summary className="flex cursor-pointer list-none items-center gap-2.5 px-6 py-5 text-[1.0625rem] font-semibold tracking-tight [&::-webkit-details-marker]:hidden">
        <BookOpen aria-hidden className="size-4 text-muted-foreground" />
        ¿Qué es un pipeline ETL? (léelo antes de empezar)
        <ChevronDown
          aria-hidden
          className="ml-auto size-4 text-muted-foreground transition-transform group-open:rotate-180"
        />
      </summary>
      <div className="grid gap-5 px-6 pb-6">
        <p className="max-w-3xl text-sm text-muted-foreground">
          En Big Data los datos casi nunca llegan listos para analizar: vienen
          de fuentes externas, con formatos raros, huecos y errores. Un{" "}
          <strong className="text-foreground">pipeline ETL</strong> es la cadena
          de pasos que los lleva del origen a una base de datos limpia. Esta
          página te deja ejecutar cada paso y ver qué les pasa a los datos en
          cada uno.
        </p>
        <ol className="grid gap-3 md:grid-cols-3">
          {LETRAS.map(({ letra, titulo, icono: Icono, que, aqui }) => (
            <li
              key={letra}
              className="grid content-start gap-2 rounded-2xl bg-muted p-4 text-sm"
            >
              <div className="flex items-center gap-2">
                <span className="grid size-9 place-items-center rounded-xl bg-primary text-base font-semibold text-primary-foreground">
                  {letra}
                </span>
                <span className="font-medium">{titulo}</span>
                <Icono
                  aria-hidden
                  className="ml-auto size-4 text-muted-foreground"
                />
              </div>
              <p>{que}</p>
              <p className="text-xs text-muted-foreground">
                <span className="font-medium text-foreground">
                  En esta práctica:{" "}
                </span>
                {aqui}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </details>
  )
}

type Paso = {
  numero: number
  titulo: string
  detalle: string
  accion?: { texto: string; pestana: PestanaId }
}

function calcularPaso(p: PipelineEtl): Paso {
  const descargas = p.extraccion?.descargas ?? []
  if (p.extrayendo) {
    return {
      numero: 1,
      titulo: "Descargando datos…",
      detalle: "Espera a que terminen todas las ciudades.",
    }
  }
  if (!descargas.some((d) => d.estado === "ok")) {
    return {
      numero: 1,
      titulo: "Elige ciudades y fechas y pulsa «Extraer datos»",
      detalle:
        "Empieza con pocas ciudades y un mes: así las tablas son fáciles de revisar.",
    }
  }
  if (p.cargando) {
    return {
      numero: 4,
      titulo: "Cargando en Supabase…",
      detalle: "Se envían los lotes uno a uno y se verifica cada uno.",
    }
  }
  if (p.carga) {
    const r = resumenLotes(p.carga.lotes)
    if (r.lotesFallidos || r.faltantes.length || r.verificacionConError) {
      return {
        numero: 4,
        titulo: "La carga ha tenido problemas",
        detalle:
          "Revisa el informe final: puedes reintentar los lotes fallidos.",
        accion: { texto: "Ver la carga", pestana: "carga" },
      }
    }
    return {
      numero: 5,
      titulo: `¡Hecho! ${n(r.verificados)} registros verificados en Supabase`,
      detalle:
        "Comprueba en la base de datos lo que se ha guardado. Prueba a cargar lo mismo otra vez: no se duplica (upsert).",
      accion: { texto: "Ver datos en Supabase", pestana: "supabase" },
    }
  }
  if (p.seleccionados.aSubir.length === 0) {
    return {
      numero: 2,
      titulo: "Revisa los datos y elige qué filas subir",
      detalle: `Mira qué se ha rechazado y por qué (${n(p.limpieza.rechazados.length)} rechazados). Después, filtra y marca filas en «Válidos».`,
      accion: { texto: "Ir a Válidos", pestana: "validos" },
    }
  }
  return {
    numero: 3,
    titulo: `Tienes ${n(p.seleccionados.aSubir.length)} filas listas: revisa la vista previa y carga`,
    detalle:
      "La vista previa muestra exactamente lo que se enviará y en cuántos lotes.",
    accion: { texto: "Ir a la carga", pestana: "carga" },
  }
}

const TOTAL_PASOS = 5

/** Indica al estudiante qué hacer a continuación según el estado real del pipeline. */
export function SiguientePaso({
  pipeline,
  onIr,
}: {
  pipeline: PipelineEtl
  onIr: (pestana: PestanaId) => void
}) {
  const paso = calcularPaso(pipeline)
  return (
    <section
      aria-live="polite"
      aria-label="Siguiente paso"
      className="flex flex-wrap items-center gap-4 rounded-3xl bg-card p-5 shadow-card sm:p-6"
    >
      <span className="grid size-11 shrink-0 place-items-center rounded-full bg-primary/10">
        <Compass aria-hidden className="size-5 text-primary" />
      </span>
      <div className="grid min-w-0 flex-1 gap-0.5">
        <p className="text-xs font-medium text-muted-foreground">
          Siguiente paso · {paso.numero} de {TOTAL_PASOS}
        </p>
        <p className="text-[1.0625rem] font-semibold tracking-tight">{paso.titulo}</p>
        <p className="text-sm text-muted-foreground">{paso.detalle}</p>
      </div>
      <div className="flex gap-1" aria-hidden>
        {Array.from({ length: TOTAL_PASOS }, (_, i) => (
          <span
            key={i}
            className={`h-1.5 w-6 rounded-full ${i < paso.numero ? "bg-primary" : "bg-muted"}`}
          />
        ))}
      </div>
      {paso.accion && (
        <button
          type="button"
          onClick={() => onIr(paso.accion!.pestana)}
          className="rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-foreground transition-all hover:bg-primary/90 active:scale-[0.98]"
        >
          {paso.accion.texto}
        </button>
      )}
    </section>
  )
}

const TERMINOS: [string, string][] = [
  [
    "API",
    "Servicio web al que se le piden datos por HTTP. Aquí, Open-Meteo devuelve el tiempo histórico.",
  ],
  [
    "JSON",
    "Formato de texto para intercambiar datos. Open-Meteo lo envía como arrays paralelos: uno de horas, otro de temperaturas…",
  ],
  [
    "UTC",
    "Hora universal sin cambios de horario de verano. Se usa para que todas las ciudades compartan el mismo reloj.",
  ],
  [
    "Registro (fila)",
    "Una medición concreta: una ciudad en una hora con su temperatura, humedad y precipitación.",
  ],
  [
    "Esquema",
    "La estructura que deben tener los datos: qué columnas hay y de qué tipo es cada una.",
  ],
  [
    "Calidad de datos",
    "Comprobar que los valores son posibles (p. ej., humedad entre 0 y 100 %). Lo que no cumple se rechaza con su motivo.",
  ],
  [
    "Clave natural",
    "Lo que identifica una fila de forma única por su significado: aquí, ciudad + fecha_hora.",
  ],
  ["Duplicado", "Dos filas con la misma clave natural. Solo se queda una."],
  [
    "Lote (batch)",
    "Grupo de filas que se envía de una vez (500 aquí). Es más eficiente que fila a fila y permite reintentar solo lo que falla.",
  ],
  [
    "Upsert",
    "Insertar si no existe, actualizar si ya existe. Mezcla de update + insert.",
  ],
  [
    "Idempotencia",
    "Repetir la misma operación da el mismo resultado. Gracias al upsert, cargar dos veces no duplica datos.",
  ],
  [
    "Verificación",
    "Volver a leer el destino para confirmar que cada fila enviada está guardada de verdad.",
  ],
]

export function Glosario() {
  return (
    <details className="group rounded-3xl bg-card shadow-card">
      <summary className="flex cursor-pointer list-none items-center gap-2.5 px-6 py-5 text-[1.0625rem] font-semibold tracking-tight [&::-webkit-details-marker]:hidden">
        <BookOpen aria-hidden className="size-4 text-muted-foreground" />
        Glosario de términos
        <ChevronDown
          aria-hidden
          className="ml-auto size-4 text-muted-foreground transition-transform group-open:rotate-180"
        />
      </summary>
      <dl className="grid gap-x-8 gap-y-4 px-6 pb-6 text-sm sm:grid-cols-2">
        {TERMINOS.map(([termino, definicion]) => (
          <div key={termino}>
            <dt className="font-medium">{termino}</dt>
            <dd className="text-muted-foreground">{definicion}</dd>
          </div>
        ))}
      </dl>
    </details>
  )
}

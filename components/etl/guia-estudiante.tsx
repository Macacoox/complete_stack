"use client"

import {
  BookOpen,
  ChevronDown,
  CloudDownload,
  Compass,
  ListChecks,
  ShieldCheck,
  Shuffle,
  Upload,
} from "lucide-react"

import type { PestanaId } from "@/components/etl/pipeline-visual"
import type { PipelineEtl } from "@/hooks/use-pipeline-etl"
import { resumenLotes } from "@/lib/etl/carga"
import { n } from "@/lib/etl/formato"

/** Los pasos del pipeline. La letra indica la fase ETL a la que pertenecen. */
const RECORRIDO = [
  {
    icono: CloudDownload,
    titulo: "Extraer",
    letra: "E",
    texto: "Pedimos los datos por HTTP. Llega un JSON por ciudad, sin tocarlo.",
  },
  {
    icono: Shuffle,
    titulo: "Transformar",
    letra: "T",
    texto: "Pasamos el JSON a filas: una por ciudad y hora.",
  },
  {
    icono: ShieldCheck,
    titulo: "Limpiar",
    letra: "T",
    texto:
      "Validamos fechas y rangos y quitamos duplicados. Cada rechazo dice por qué.",
  },
  {
    icono: ListChecks,
    titulo: "Seleccionar",
    letra: "T",
    texto: "Tú eliges qué filas válidas merece la pena guardar.",
  },
  {
    icono: Upload,
    titulo: "Cargar",
    letra: "L",
    texto: "Subimos las filas por lotes y comprobamos que han llegado.",
  },
] as const

/** Explica, de un vistazo y en lenguaje sencillo, qué hace la página. */
export function ComoFunciona() {
  return (
    <section
      id="como-funciona"
      aria-labelledby="titulo-como-funciona"
      className="grid gap-4"
    >
      <h2
        id="titulo-como-funciona"
        className="text-xs font-semibold tracking-wider text-muted-foreground uppercase"
      >
        Los 5 pasos del pipeline
      </h2>

      <ol className="grid gap-3">
        {RECORRIDO.map(({ icono: Icono, titulo, letra, texto }, i) => (
          <li
            key={titulo}
            className="grid grid-cols-[auto_1fr] items-start gap-x-3 gap-y-0.5 text-sm"
          >
            <span className="row-span-2 grid size-10 place-items-center rounded-xl border border-white/25 bg-white/10 text-white">
              <Icono aria-hidden className="size-5" />
            </span>
            <span className="flex items-center gap-2 font-semibold">
              {i + 1}. {titulo}
              <span
                className="rounded-full bg-white/15 px-2 py-0.5 text-xs font-semibold text-white"
                title={
                  letra === "E"
                    ? "Extract"
                    : letra === "T"
                      ? "Transform"
                      : "Load"
                }
              >
                {letra}
              </span>
            </span>
            <span className="text-[0.8125rem] leading-relaxed text-muted-foreground">
              {texto}
            </span>
          </li>
        ))}
      </ol>
    </section>
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
      className="border-t border-white/10"
    >
      <div aria-hidden className="h-0.5 bg-white/10">
        <div
          className="h-full bg-primary transition-[width] duration-500"
          style={{
            width: `${(Math.min(paso.numero, TOTAL_PASOS) / TOTAL_PASOS) * 100}%`,
          }}
        />
      </div>
      <div className="flex items-center gap-3 px-5 py-3">
        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-white/10">
          <Compass aria-hidden className="size-4 text-white" />
        </span>
        <div className="grid min-w-0 flex-1">
          <p className="text-xs font-medium tracking-wider text-muted-foreground uppercase">
            Siguiente paso · {paso.numero} de {TOTAL_PASOS}
          </p>
          <p className="text-sm font-semibold">{paso.titulo}</p>
          <p className="text-xs text-muted-foreground">{paso.detalle}</p>
        </div>
        {paso.accion && (
          <button
            type="button"
            onClick={() => onIr(paso.accion!.pestana)}
            className="shrink-0 rounded-full bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-500"
          >
            {paso.accion.texto}
          </button>
        )}
      </div>
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
    <details open className="group rounded-3xl bg-card shadow-card">
      <summary className="flex cursor-pointer list-none items-center gap-2.5 px-6 py-5 text-[1.0625rem] font-semibold tracking-tight [&::-webkit-details-marker]:hidden">
        <BookOpen aria-hidden className="size-4 text-muted-foreground" />
        Glosario de términos
        <ChevronDown
          aria-hidden
          className="ml-auto size-4 text-muted-foreground transition-transform group-open:rotate-180"
        />
      </summary>
      <dl className="grid gap-x-8 gap-y-4 px-6 pb-6 text-sm @xl:grid-cols-2">
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

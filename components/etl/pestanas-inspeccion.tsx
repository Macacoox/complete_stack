"use client"

import { Download, RotateCcw } from "lucide-react"
import { useMemo, useState } from "react"

import { EtiquetaEstado } from "@/components/etl/estado"
import { Paginacion, TablaDatos, type Columna } from "@/components/etl/tabla-datos"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import type { PipelineEtl } from "@/hooks/use-pipeline-etl"
import { bytes, duracion, esNumeroFinito, fechaUtc, jsonCompacto, n, valorBruto } from "@/lib/etl/formato"
import { paginar } from "@/lib/etl/filtros"
import type { RegistroRechazado, RegistroTransformado } from "@/lib/etl/tipos"
import { cn } from "@/lib/utils"

export function descargarArchivo(nombre: string, contenido: string) {
  const url = URL.createObjectURL(new Blob([contenido], { type: "application/json" }))
  const a = document.createElement("a")
  a.href = url
  a.download = nombre
  a.click()
  URL.revokeObjectURL(url)
}

export function AvisoLocal() {
  return (
    <p className="rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground">
      <strong className="font-medium text-foreground">Datos locales:</strong> existen solo en este
      navegador durante la sesión. Nada de esto está en Supabase hasta que lo subas.
    </p>
  )
}

function usePaginacion(total: number) {
  const [pagina, setPagina] = useState(1)
  const [tamano, setTamano] = useState(25)
  return {
    pagina,
    tamano,
    setPagina,
    setTamano: (t: number) => {
      setTamano(t)
      setPagina(1)
    },
    total,
  }
}

// --- JSON original ---------------------------------------------------------

export function PestanaJson({ pipeline }: { pipeline: PipelineEtl }) {
  const descargas = pipeline.extraccion?.descargas ?? []
  const [abierta, setAbierta] = useState<string | null>(null)
  const actual = descargas.find((d) => d.ciudad.id === abierta) ?? descargas.find((d) => d.respuesta)

  if (!pipeline.extraccion) {
    return <p className="py-8 text-center text-muted-foreground">Aún no hay extracciones.</p>
  }

  const { inicio, fin } = pipeline.extraccion
  const descargarTodo = () =>
    descargarArchivo(
      `open-meteo_${inicio}_${fin}.json`,
      JSON.stringify(
        Object.fromEntries(descargas.filter((d) => d.respuesta).map((d) => [d.ciudad.nombre, d.respuesta])),
        null,
        2
      )
    )

  return (
    <div className="grid gap-4">
      <AvisoLocal />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          Respuesta original de cada petición ({inicio} → {fin}), sin modificar.
        </p>
        <Button
          size="sm"
          variant="outline"
          onClick={descargarTodo}
          disabled={!descargas.some((d) => d.respuesta)}
        >
          <Download aria-hidden /> Descargar todos (JSON)
        </Button>
      </div>
      <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {descargas.map((d) => (
          <li
            key={d.ciudad.id}
            className={cn(
              "grid gap-2 rounded-lg border p-3 text-sm",
              actual?.ciudad.id === d.ciudad.id && d.respuesta && "border-primary/60"
            )}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-medium">{d.ciudad.nombre}</span>
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
                texto={{ ok: "Descargado", error: "Error", descargando: "Descargando…", pendiente: "Pendiente" }[d.estado]}
              />
            </div>
            <p className="text-xs break-all text-muted-foreground">
              <span className="font-medium">GET</span> {d.url}
            </p>
            <p className="text-xs text-muted-foreground">
              Intentos: {d.intentos} · Duración: {duracion(d.duracionMs)}
              {d.textoOriginal && ` · ${bytes(d.textoOriginal.length)}`}
            </p>
            {d.error && (
              <p className="text-xs text-destructive" role="alert">
                {d.error}
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              {d.respuesta && (
                <>
                  <Button size="sm" variant="secondary" onClick={() => setAbierta(d.ciudad.id)}>
                    Ver JSON
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      descargarArchivo(
                        `open-meteo_${d.ciudad.id}_${inicio}_${fin}.json`,
                        d.textoOriginal ?? JSON.stringify(d.respuesta)
                      )
                    }
                  >
                    <Download aria-hidden /> Descargar
                  </Button>
                </>
              )}
              {d.estado === "error" && (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={pipeline.extrayendo || pipeline.cargando}
                  onClick={() => pipeline.reintentarCiudad(d.ciudad.id)}
                >
                  <RotateCcw aria-hidden /> Reintentar solo {d.ciudad.nombre}
                </Button>
              )}
            </div>
          </li>
        ))}
      </ul>
      {actual?.respuesta && (
        <section aria-label={`JSON original de ${actual.ciudad.nombre}`} className="grid gap-2">
          <h3 className="text-sm font-medium">JSON original · {actual.ciudad.nombre}</h3>
          <pre className="max-h-[28rem] overflow-auto rounded-lg border bg-muted/40 p-3 font-mono text-xs leading-relaxed whitespace-pre-wrap break-all">
            {jsonCompacto(actual.respuesta)}
          </pre>
        </section>
      )}
    </div>
  )
}

// --- Transformados ---------------------------------------------------------

function CeldaBruta({ valor }: { valor: unknown }) {
  const ok = esNumeroFinito(valor)
  return <span className={cn(!ok && "font-semibold text-destructive")}>{valorBruto(valor)}</span>
}

const COLUMNAS_TRANSFORMADOS: Columna<RegistroTransformado>[] = [
  { id: "fila", titulo: "Fila", numerica: true, celda: (r) => r.fila },
  { id: "ciudad", titulo: "ciudad", celda: (r) => r.ciudad },
  { id: "indice", titulo: "Índice en arrays", numerica: true, celda: (r) => r.indice },
  {
    id: "fecha_original",
    titulo: "time (original)",
    celda: (r) => <span className="font-mono text-xs">{valorBruto(r.fecha_original)}</span>,
  },
  {
    id: "fecha_hora",
    titulo: "fecha_hora",
    unidad: "UTC",
    celda: (r) =>
      r.fecha_hora ? (
        <span className="font-mono text-xs">{r.fecha_hora}</span>
      ) : (
        <span className="font-semibold text-destructive">no válida</span>
      ),
  },
  { id: "t", titulo: "temperatura_c", unidad: "°C", numerica: true, celda: (r) => <CeldaBruta valor={r.temperatura_c} /> },
  { id: "h", titulo: "humedad_pct", unidad: "%", numerica: true, celda: (r) => <CeldaBruta valor={r.humedad_pct} /> },
  { id: "p", titulo: "precipitacion_mm", unidad: "mm", numerica: true, celda: (r) => <CeldaBruta valor={r.precipitacion_mm} /> },
]

export function PestanaTransformados({ pipeline }: { pipeline: PipelineEtl }) {
  const { registros, avisos } = pipeline.transformacion
  const pag = usePaginacion(registros.length)
  const pagina = paginar(registros, pag.pagina, pag.tamano)

  return (
    <div className="grid gap-3">
      <AvisoLocal />
      <p className="text-sm text-muted-foreground">
        Cada posición <code>i</code> de los arrays <code>hourly.time</code>, <code>temperature_2m</code>,{" "}
        <code>relative_humidity_2m</code> y <code>precipitation</code> se convierte en un registro. Las
        horas se interpretan explícitamente como UTC (se añade la zona «Z»). Los valores se muestran tal
        como llegaron: <code>null</code>, cadenas y ausentes no se convierten en 0.
      </p>
      {avisos.length > 0 && (
        <Alert>
          <AlertTitle>Avisos de estructura</AlertTitle>
          <AlertDescription>
            <ul className="list-disc pl-4">
              {avisos.map((a, i) => (
                <li key={i}>
                  <strong>{a.ciudad}:</strong> {a.mensaje}
                </li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}
      <TablaDatos
        columnas={COLUMNAS_TRANSFORMADOS}
        filas={pagina.filas}
        claveFila={(r) => String(r.fila)}
        vacio="Sin registros transformados. Extrae datos primero."
      />
      <Paginacion
        pagina={pagina.pagina}
        totalPaginas={pagina.totalPaginas}
        total={registros.length}
        tamano={pag.tamano}
        onPagina={pag.setPagina}
        onTamano={pag.setTamano}
      />
    </div>
  )
}

// --- Rechazados ------------------------------------------------------------

const COLUMNAS_RECHAZADOS: Columna<RegistroRechazado>[] = [
  { id: "fila", titulo: "Fila", numerica: true, celda: (r) => r.registro.fila },
  { id: "ciudad", titulo: "ciudad", celda: (r) => r.registro.ciudad || "—" },
  {
    id: "fecha",
    titulo: "fecha_hora",
    unidad: "UTC",
    celda: (r) =>
      r.registro.fecha_hora ? fechaUtc(r.registro.fecha_hora) : valorBruto(r.registro.fecha_original),
  },
  { id: "t", titulo: "temperatura_c", unidad: "°C", numerica: true, celda: (r) => <CeldaBruta valor={r.registro.temperatura_c} /> },
  { id: "h", titulo: "humedad_pct", unidad: "%", numerica: true, celda: (r) => <CeldaBruta valor={r.registro.humedad_pct} /> },
  { id: "p", titulo: "precipitacion_mm", unidad: "mm", numerica: true, celda: (r) => <CeldaBruta valor={r.registro.precipitacion_mm} /> },
  {
    id: "motivos",
    titulo: "Motivo del rechazo",
    celda: (r) => (
      <ul className="list-disc pl-4 text-xs whitespace-normal">
        {r.motivos.map((m) => (
          <li key={m}>{m}</li>
        ))}
      </ul>
    ),
  },
]

export function PestanaRechazados({ pipeline }: { pipeline: PipelineEtl }) {
  const { rechazados, duplicados } = pipeline.limpieza
  const pag = usePaginacion(rechazados.length)
  const pagina = paginar(rechazados, pag.pagina, pag.tamano)
  const porMotivo = useMemo(() => {
    const conteo = new Map<string, number>()
    for (const r of rechazados) {
      for (const m of r.motivos) {
        // Agrupa por tipo de motivo (sin el valor concreto ni la fila).
        const tipo = m.replace(/\s*\(.*\)$/, "").replace(/: se conserva la fila \d+$/, "")
        conteo.set(tipo, (conteo.get(tipo) ?? 0) + 1)
      }
    }
    return [...conteo].sort((a, b) => b[1] - a[1])
  }, [rechazados])

  return (
    <div className="grid gap-3">
      <AvisoLocal />
      <p className="text-sm text-muted-foreground">
        Descartes por <strong>calidad</strong>: falta ciudad o fecha válida, alguna medición es nula, vacía,
        ausente o no numérica, humedad fuera de 0–100 %, precipitación negativa, o{" "}
        <strong>duplicado</strong> por (ciudad, fecha_hora): se conserva la primera aparición válida en el
        orden de extracción. La temperatura no se descarta por umbrales. Los registros excluidos por los
        filtros <em>no</em> aparecen aquí: siguen siendo válidos.
      </p>
      {porMotivo.length > 0 && (
        <ul className="flex flex-wrap gap-2 text-xs">
          {porMotivo.map(([motivo, cantidad]) => (
            <li key={motivo} className="rounded-md border px-2 py-1">
              {motivo}: <strong className="tabular-nums">{n(cantidad)}</strong>
            </li>
          ))}
          <li className="rounded-md border px-2 py-1">
            Duplicados eliminados: <strong className="tabular-nums">{n(duplicados)}</strong>
          </li>
        </ul>
      )}
      <TablaDatos
        columnas={COLUMNAS_RECHAZADOS}
        filas={pagina.filas}
        claveFila={(r) => String(r.registro.fila)}
        vacio={
          pipeline.transformacion.registros.length
            ? "Ningún registro rechazado: todos superan la limpieza."
            : "Sin datos. Extrae datos primero."
        }
      />
      <Paginacion
        pagina={pagina.pagina}
        totalPaginas={pagina.totalPaginas}
        total={rechazados.length}
        tamano={pag.tamano}
        onPagina={pag.setPagina}
        onTamano={pag.setTamano}
      />
    </div>
  )
}

"use client"

import { RotateCcw, Upload } from "lucide-react"
import { useState } from "react"

import { EtiquetaEstado, type Estado } from "@/components/etl/estado"
import {
  COLUMNAS_MEDICION,
  ETIQUETAS_ORDEN,
  Nota,
} from "@/components/etl/pestana-validos"
import { AvisoLocal } from "@/components/etl/pestanas-inspeccion"
import {
  Paginacion,
  TablaDatos,
  type Columna,
} from "@/components/etl/tabla-datos"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import type { PipelineEtl } from "@/hooks/use-pipeline-etl"
import { TAMANO_LOTE, resumenLotes, type Lote } from "@/lib/etl/carga"
import { paginar } from "@/lib/etl/filtros"
import { duracion, fechaUtc, n } from "@/lib/etl/formato"
import type { RegistroValido } from "@/lib/etl/tipos"

type FilaVista = RegistroValido & { posicion: number }

const ESTADO_LOTE: Record<Lote["estado"], [Estado, string]> = {
  pendiente: ["pendiente", "Pendiente"],
  enviando: ["en_curso", "Enviando…"],
  completado: ["completada", "Completado"],
  error: ["error", "Error"],
}

function Verificacion({ lote }: { lote: Lote }) {
  const v = lote.verificacion
  if (lote.estado !== "completado")
    return <span className="text-muted-foreground">—</span>
  if (v.estado === "pendiente")
    return <EtiquetaEstado estado="pendiente" texto="Pendiente" />
  if (v.estado === "verificando")
    return <EtiquetaEstado estado="en_curso" texto="Verificando…" />
  if (v.estado === "error")
    return <EtiquetaEstado estado="error" texto={`Error: ${v.error}`} />
  return v.faltantes.length === 0 ? (
    <EtiquetaEstado
      estado="completada"
      texto={`${n(v.encontrados)}/${n(lote.registros.length)} en destino`}
    />
  ) : (
    <EtiquetaEstado
      estado="error"
      texto={`Faltan ${n(v.faltantes.length)} claves`}
    />
  )
}

function InformeCarga({ pipeline }: { pipeline: PipelineEtl }) {
  const carga = pipeline.carga
  if (!carga) return null
  const r = resumenLotes(carga.lotes)
  const primera = (l: Lote) => l.registros[0]
  const ultima = (l: Lote) => l.registros[l.registros.length - 1]
  const hayReintentables =
    r.lotesFallidos > 0 ||
    carga.lotes.some((l) => l.verificacion.estado === "error")

  return (
    <section
      aria-label="Estado de la carga"
      className="grid gap-3 rounded-lg border p-3"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-medium">
          Carga congelada a las {carga.congeladaEn.toLocaleTimeString("es-ES")}:{" "}
          {n(r.total)} registros en {carga.lotes.length} lote(s) de hasta{" "}
          {TAMANO_LOTE}
        </h3>
        {hayReintentables && (
          <Button
            size="sm"
            variant="outline"
            disabled={pipeline.cargando}
            onClick={pipeline.reintentarCarga}
          >
            <RotateCcw aria-hidden /> Reintentar lotes fallidos
          </Button>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        Esta copia no cambia aunque modifiques filtros, orden o selección: es
        exactamente lo que se envía.
      </p>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left">
            <tr>
              <th scope="col" className="p-2 font-medium">
                Lote
              </th>
              <th scope="col" className="p-2 text-right font-medium">
                Registros
              </th>
              <th scope="col" className="p-2 font-medium">
                Primero → último
              </th>
              <th scope="col" className="p-2 font-medium">
                Envío
              </th>
              <th scope="col" className="p-2 text-right font-medium">
                Intentos
              </th>
              <th scope="col" className="p-2 text-right font-medium">
                Duración
              </th>
              <th scope="col" className="p-2 font-medium">
                Verificación en destino
              </th>
            </tr>
          </thead>
          <tbody>
            {carga.lotes.map((l) => {
              const [estado, texto] = ESTADO_LOTE[l.estado]
              return (
                <tr key={l.numero} className="border-t align-top">
                  <td className="p-2">{l.numero}</td>
                  <td className="p-2 text-right tabular-nums">
                    {n(l.registros.length)}
                  </td>
                  <td className="p-2 text-xs">
                    {primera(l).ciudad} {fechaUtc(primera(l).fecha_hora)} →{" "}
                    {ultima(l).ciudad} {fechaUtc(ultima(l).fecha_hora)}
                  </td>
                  <td className="p-2">
                    <EtiquetaEstado estado={estado} texto={texto} />
                    {l.error && (
                      <p className="mt-1 max-w-md text-xs text-destructive">
                        {l.error}
                      </p>
                    )}
                  </td>
                  <td className="p-2 text-right tabular-nums">{l.intentos}</td>
                  <td className="p-2 text-right tabular-nums">
                    {duracion(l.duracionMs)}
                  </td>
                  <td className="p-2">
                    <Verificacion lote={l} />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {!pipeline.cargando && (
        <Alert
          variant={
            hayReintentables || r.faltantes.length ? "destructive" : "default"
          }
          aria-live="polite"
        >
          <AlertTitle>Informe final</AlertTitle>
          <AlertDescription>
            <ul className="list-disc pl-4">
              <li>
                Enviados correctamente:{" "}
                <strong>{n(r.registrosCorrectos)}</strong> registros (
                {r.lotesCompletados} lote(s)).
              </li>
              <li>
                Fallidos: <strong>{n(r.registrosFallidos)}</strong> registros (
                {r.lotesFallidos} lote(s)).
              </li>
              <li>
                Filas procesadas según Supabase:{" "}
                <strong>{n(r.procesadosSupabase)}</strong>
                {r.lotesSinRecuento > 0 &&
                  ` (${r.lotesSinRecuento} lote(s) sin recuento)`}
                . Supabase no distingue insertadas de actualizadas en un upsert,
                así que no se muestra ese desglose.
              </li>
              <li>
                Verificados en destino: <strong>{n(r.verificados)}</strong>
                {r.faltantes.length > 0 && (
                  <>
                    {" "}
                    · no encontrados: <strong>
                      {n(r.faltantes.length)}
                    </strong>{" "}
                    (p. ej. {r.faltantes.slice(0, 3).join(", ")})
                  </>
                )}
                {r.verificacionConError > 0 &&
                  ` · ${r.verificacionConError} lote(s) sin poder verificar`}
              </li>
            </ul>
          </AlertDescription>
        </Alert>
      )}
    </section>
  )
}

export function PestanaCarga({ pipeline }: { pipeline: PipelineEtl }) {
  const { seleccionados, orden } = pipeline
  const [pagina, setPagina] = useState(1)
  const [tamano, setTamano] = useState(25)
  const filas: FilaVista[] = seleccionados.aSubir.map((r, i) => ({
    ...r,
    posicion: i + 1,
  }))
  const vista = paginar(filas, pagina, tamano)
  const total = filas.length

  const columnas: Columna<FilaVista>[] = [
    {
      id: "pos",
      titulo: "Orden de envío",
      numerica: true,
      celda: (r) => r.posicion,
    },
    {
      id: "lote",
      titulo: "Lote",
      numerica: true,
      celda: (r) => Math.ceil(r.posicion / TAMANO_LOTE),
    },
    ...(COLUMNAS_MEDICION as Columna<FilaVista>[]),
  ]

  return (
    <div className="grid gap-3">
      <AvisoLocal />
      <p className="text-sm text-muted-foreground">
        Vista previa del conjunto <strong>exacto</strong> que se enviará: filas
        seleccionadas que cumplen los filtros, ordenadas por{" "}
        <strong>{ETIQUETAS_ORDEN[orden.campo].toLowerCase()}</strong> (
        {orden.direccion === "asc" ? "ascendente" : "descendente"}). Se envía en
        lotes de {TAMANO_LOTE} con upsert por (ciudad, fecha_hora): repetir la
        carga actualiza las filas en lugar de duplicarlas.
      </p>
      <Nota>
        Una base de datos no conserva el orden de inserción: las filas de una
        tabla no tienen un orden garantizado. El orden elegido aquí solo
        determina el orden de envío; para leerlas ordenadas, cada consulta
        posterior necesita <code>ORDER BY</code> (por ejemplo,{" "}
        <code>ORDER BY ciudad, fecha_hora</code>).
      </Nota>
      {seleccionados.fueraDeFiltros > 0 && (
        <p className="text-sm text-amber-800 dark:text-amber-300" role="status">
          ⚠ {n(seleccionados.fueraDeFiltros)} fila(s) seleccionadas quedan fuera
          de los filtros y no se incluyen.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Button
          size="lg"
          disabled={pipeline.cargando || total === 0}
          onClick={pipeline.subir}
        >
          <Upload aria-hidden />
          {pipeline.cargando
            ? "Carga en curso…"
            : `Subir ${n(total)} registros a Supabase`}
        </Button>
        <span className="text-sm text-muted-foreground">
          {total === 0
            ? "Selecciona filas en la pestaña «Válidos» para poder subirlas."
            : `${Math.ceil(total / TAMANO_LOTE)} lote(s). La escritura se hace en el servidor.`}
        </span>
      </div>

      <InformeCarga pipeline={pipeline} />

      <TablaDatos
        columnas={columnas}
        filas={vista.filas}
        claveFila={(r) => r.clave}
        vacio="No hay filas seleccionadas que cumplan los filtros."
      />
      <Paginacion
        pagina={vista.pagina}
        totalPaginas={vista.totalPaginas}
        total={total}
        tamano={tamano}
        onPagina={setPagina}
        onTamano={(t) => {
          setTamano(t)
          setPagina(1)
        }}
        etiqueta="registros a subir"
      />
    </div>
  )
}

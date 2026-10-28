"use client"

import type { ReactNode } from "react"

import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { n } from "@/lib/etl/formato"
import { cn } from "@/lib/utils"

export type Columna<T> = {
  id: string
  titulo: ReactNode
  /** Unidad mostrada bajo el encabezado, p. ej. "°C". */
  unidad?: string
  numerica?: boolean
  celda: (fila: T) => ReactNode
}

export const TAMANOS_PAGINA = [25, 50, 100]

/** Tabla de la página actual. Recibe filas ya filtradas, ordenadas y recortadas. */
export function TablaDatos<T>({
  columnas,
  filas,
  claveFila,
  vacio,
  claseFila,
}: {
  columnas: Columna<T>[]
  filas: T[]
  claveFila: (fila: T) => string
  vacio: ReactNode
  claseFila?: (fila: T) => string | undefined
}) {
  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader className="bg-muted/50">
          <TableRow>
            {columnas.map((c) => (
              <TableHead
                key={c.id}
                scope="col"
                className={cn(
                  "h-auto py-2 align-bottom",
                  c.numerica && "text-right"
                )}
              >
                <span className="block">{c.titulo}</span>
                {c.unidad && (
                  <span className="block text-xs font-normal text-muted-foreground">
                    {c.unidad}
                  </span>
                )}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {filas.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={columnas.length}
                className="py-8 text-center text-muted-foreground"
              >
                {vacio}
              </TableCell>
            </TableRow>
          ) : (
            filas.map((fila) => (
              <TableRow key={claveFila(fila)} className={claseFila?.(fila)}>
                {columnas.map((c) => (
                  <TableCell
                    key={c.id}
                    className={cn(
                      c.numerica && "text-right font-mono tabular-nums"
                    )}
                  >
                    {c.celda(fila)}
                  </TableCell>
                ))}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  )
}

export function Paginacion({
  pagina,
  totalPaginas,
  total,
  tamano,
  onPagina,
  onTamano,
  etiqueta = "registros",
}: {
  pagina: number
  totalPaginas: number
  total: number
  tamano: number
  onPagina: (pagina: number) => void
  onTamano: (tamano: number) => void
  etiqueta?: string
}) {
  const desde = total === 0 ? 0 : (pagina - 1) * tamano + 1
  const hasta = Math.min(total, pagina * tamano)
  return (
    <nav
      aria-label="Paginación"
      className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground"
    >
      <p aria-live="polite">
        {n(desde)}–{n(hasta)} de {n(total)} {etiqueta} · página {n(pagina)} de{" "}
        {n(totalPaginas)}
      </p>
      <div className="flex flex-wrap items-center gap-1">
        <label className="mr-2 flex items-center gap-1">
          Filas por página
          <select
            className="h-7 rounded-md border bg-background px-1 text-foreground"
            value={tamano}
            onChange={(e) => onTamano(Number(e.target.value))}
          >
            {TAMANOS_PAGINA.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <Button
          size="sm"
          variant="outline"
          disabled={pagina <= 1}
          onClick={() => onPagina(1)}
        >
          Primera
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={pagina <= 1}
          onClick={() => onPagina(pagina - 1)}
        >
          Anterior
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={pagina >= totalPaginas}
          onClick={() => onPagina(pagina + 1)}
        >
          Siguiente
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={pagina >= totalPaginas}
          onClick={() => onPagina(totalPaginas)}
        >
          Última
        </Button>
      </div>
    </nav>
  )
}

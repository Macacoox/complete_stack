"use client"

import { CloudDownload } from "lucide-react"
import { useState } from "react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { CIUDADES } from "@/lib/etl/ciudades"
import {
  FECHA_MINIMA,
  MAX_DIAS_EXTRACCION,
  hoyUtc,
  validarConfiguracion,
  volumenPrevisto,
  type ConfiguracionExtraccion,
} from "@/lib/etl/extraccion"
import { n } from "@/lib/etl/formato"

const CONFIG_INICIAL: ConfiguracionExtraccion = {
  ciudades: CIUDADES.map((c) => c.id),
  inicio: "2026-09-01",
  fin: "2026-09-30",
}

export function ConfiguracionExtraccionPanel({
  bloqueado,
  motivoBloqueo,
  onExtraer,
}: {
  bloqueado: boolean
  motivoBloqueo?: string
  onExtraer: (config: ConfiguracionExtraccion) => void
}) {
  const [config, setConfig] = useState(CONFIG_INICIAL)
  const errores = validarConfiguracion(config)
  const volumen = volumenPrevisto(config)

  const alternarCiudad = (id: string, marcada: boolean) =>
    setConfig((c) => ({
      ...c,
      // Se conserva el orden de la lista original de ciudades.
      ciudades: CIUDADES.map((x) => x.id).filter((x) =>
        x === id ? marcada : c.ciudades.includes(x)
      ),
    }))

  return (
    <Card>
      <CardHeader>
        <CardTitle>1. Configuración de extracción</CardTitle>
        <CardDescription>
          API histórica de Open-Meteo · horas en UTC · temperatura en °C · precipitación en mm.
          Máximo {MAX_DIAS_EXTRACCION} días por extracción.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="grid gap-5 md:grid-cols-[1fr_auto_auto]"
          onSubmit={(e) => {
            e.preventDefault()
            if (errores.length === 0 && !bloqueado) onExtraer(config)
          }}
        >
          <fieldset className="grid gap-2">
            <legend className="mb-2 text-sm font-medium">Ciudades</legend>
            <div className="flex flex-wrap gap-x-4 gap-y-2">
              {CIUDADES.map((c) => (
                <Label key={c.id} className="cursor-pointer font-normal">
                  <Checkbox
                    checked={config.ciudades.includes(c.id)}
                    onCheckedChange={(v) => alternarCiudad(c.id, v)}
                  />
                  {c.nombre}
                  <span className="text-xs text-muted-foreground">
                    ({c.latitud}, {c.longitud})
                  </span>
                </Label>
              ))}
            </div>
            <div className="flex gap-2 text-xs">
              <button
                type="button"
                className="underline underline-offset-2"
                onClick={() => setConfig((c) => ({ ...c, ciudades: CIUDADES.map((x) => x.id) }))}
              >
                Todas
              </button>
              <button
                type="button"
                className="underline underline-offset-2"
                onClick={() => setConfig((c) => ({ ...c, ciudades: [] }))}
              >
                Ninguna
              </button>
            </div>
          </fieldset>

          <div className="grid content-start gap-3 sm:grid-cols-2 md:grid-cols-1">
            <div className="grid gap-1.5">
              <Label htmlFor="fecha-inicio">Fecha inicial (UTC)</Label>
              <Input
                id="fecha-inicio"
                type="date"
                min={FECHA_MINIMA}
                max={hoyUtc()}
                value={config.inicio}
                onChange={(e) => setConfig((c) => ({ ...c, inicio: e.target.value }))}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="fecha-fin">Fecha final (UTC, incluida)</Label>
              <Input
                id="fecha-fin"
                type="date"
                min={FECHA_MINIMA}
                max={hoyUtc()}
                value={config.fin}
                onChange={(e) => setConfig((c) => ({ ...c, fin: e.target.value }))}
              />
            </div>
          </div>

          <div className="grid content-start gap-3 rounded-2xl bg-muted p-4 text-sm md:w-64">
            <p className="font-medium">Volumen previsto</p>
            <dl className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1">
              <dt className="text-muted-foreground">Ciudades / peticiones</dt>
              <dd className="text-right tabular-nums">{n(volumen.peticiones)}</dd>
              <dt className="text-muted-foreground">Días</dt>
              <dd className="text-right tabular-nums">{n(volumen.dias)}</dd>
              <dt className="text-muted-foreground">Registros horarios</dt>
              <dd className="text-right font-medium tabular-nums">{n(volumen.registros)}</dd>
            </dl>
            <p className="text-xs text-muted-foreground">
              Ciudades × días × 24 horas. El número real se comprobará al extraer.
            </p>
            <Button type="submit" disabled={bloqueado} aria-describedby="errores-config">
              <CloudDownload aria-hidden />
              Extraer datos
            </Button>
            {bloqueado && motivoBloqueo && (
              <p className="text-xs text-muted-foreground">{motivoBloqueo}</p>
            )}
          </div>

          <div id="errores-config" className="md:col-span-3" aria-live="polite">
            {errores.length > 0 && (
              <Alert variant="destructive">
                <AlertTitle>Revisa la configuración</AlertTitle>
                <AlertDescription>
                  <ul className="list-disc pl-4">
                    {errores.map((e) => (
                      <li key={e}>{e}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

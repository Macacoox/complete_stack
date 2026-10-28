"use client"

import {
  Activity,
  CalendarRange,
  ChevronRight,
  Database,
  RefreshCw,
  Thermometer,
  Timer,
  type LucideIcon,
} from "lucide-react"
import { Fragment, useMemo, useState, type ReactNode } from "react"

import type { PipelineEtl } from "@/hooks/use-pipeline-etl"
import type {
  ResumenCiudad,
  ResumenCiudades,
} from "@/hooks/use-resumen-ciudades"
import { CIUDADES } from "@/lib/etl/ciudades"
import { mediasDiarias } from "@/lib/etl/estadisticas"
import { duracion, n } from "@/lib/etl/formato"
import { cn } from "@/lib/utils"

/** Color fijo de cada ciudad: sigue a la ciudad, no a su posición en una lista. */
const colorCiudad = (nombre: string) =>
  `var(--ciudad-${CIUDADES.findIndex((c) => c.nombre === nombre) + 1})`

const formatoPorcentaje = new Intl.NumberFormat("es-ES", {
  style: "percent",
  maximumFractionDigits: 1,
})
const porcentaje = (parte: number, total: number) =>
  formatoPorcentaje.format(total ? parte / total : 0)
const grados = (t: number) =>
  `${t.toLocaleString("es-ES", { maximumFractionDigits: 1 })} °C`

function Tarjeta({
  className,
  children,
}: {
  className?: string
  children: ReactNode
}) {
  return (
    <div className={cn("rounded-2xl bg-card p-5 shadow-card", className)}>
      {children}
    </div>
  )
}

function SinDatos({ children }: { children: ReactNode }) {
  return (
    <p className="py-6 text-center text-xs text-muted-foreground">{children}</p>
  )
}

const fechaCorta = (iso: string) =>
  new Date(iso).toLocaleDateString("es-ES", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  })

/** Tarjeta pequeña de la columna derecha, sobre el mapa. */
function CartaMapa({
  titulo,
  icono: Icono,
  accion,
  children,
  className,
}: {
  titulo: string
  icono: LucideIcon
  accion?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section
      aria-label={titulo}
      className={cn(
        "grid gap-2 rounded-2xl border border-white/20 bg-slate-950/60 p-3.5 text-sm shadow-lg shadow-black/30 backdrop-blur-md",
        className
      )}
    >
      <div className="flex items-center gap-2">
        <Icono aria-hidden className="size-3.5 text-muted-foreground" />
        <h2 className="text-xs font-semibold tracking-wide text-white/80 uppercase">
          {titulo}
        </h2>
        {accion && <div className="ml-auto">{accion}</div>}
      </div>
      {children}
    </section>
  )
}

/**
 * Columna de datos sobre el mapa: qué hay guardado en Supabase (total,
 * temperaturas, periodo y completitud), qué ha pasado en esta ejecución y
 * cómo leer el mapa. En móvil solo se muestra el total.
 */
export function ColumnaDatos({
  resumen: { resumen, error, cargando, recargar },
  pipeline,
  oculta = false,
  className,
}: {
  resumen: ResumenCiudades
  pipeline: PipelineEtl
  /** Mientras se ve la ficha de una ciudad, la columna deja su sitio libre. */
  oculta?: boolean
  className?: string
}) {
  const filas =
    resumen ?? CIUDADES.map((c) => ({ ciudad: c.nombre, registros: 0 }))
  const total = filas.reduce((s, r) => s + r.registros, 0)
  const conDatos = (resumen ?? []).filter(
    (r) => r.registros > 0 && r.desde && r.hasta
  )

  // Escala de temperaturas común, redondeada a decenas para marcar 10, 20, 30… °C.
  const minimo = Math.min(...conDatos.map((r) => r.tempMin ?? Infinity))
  const maximo = Math.max(...conDatos.map((r) => r.tempMax ?? -Infinity))
  const escalaMin = Math.floor(minimo / 10) * 10
  const escalaMax = Math.max(escalaMin + 10, Math.ceil(maximo / 10) * 10)
  const marcas = Array.from(
    { length: (escalaMax - escalaMin) / 10 + 1 },
    (_, i) => escalaMin + i * 10
  )
  const posicion = (t: number) =>
    ((t - escalaMin) / (escalaMax - escalaMin)) * 100

  // Completitud: horas guardadas frente a las que caben entre la primera y la
  // última fecha de cada ciudad. Por debajo del 100 % hay huecos.
  const horasEsperadas = (r: ResumenCiudad) =>
    r.desde && r.hasta
      ? (Date.parse(r.hasta) - Date.parse(r.desde)) / 3_600_000 + 1
      : 0
  const completitud = (r: ResumenCiudad) => {
    const esperadas = horasEsperadas(r)
    return esperadas ? r.registros / esperadas : 0
  }
  const desde = conDatos.map((r) => r.desde!).sort()[0]
  const hasta = conDatos
    .map((r) => r.hasta!)
    .sort()
    .at(-1)
  const totalEsperadas = conDatos.reduce((s, r) => s + horasEsperadas(r), 0)
  const guardadoConDatos = conDatos.reduce((s, r) => s + r.registros, 0)

  const { transformacion, limpieza, seleccionados } = pipeline
  const ejecucion = [
    { etiqueta: "Extraídos", valor: transformacion.registros.length },
    { etiqueta: "Válidos", valor: limpieza.validos.length },
    { etiqueta: "Rechazados", valor: limpieza.rechazados.length },
    { etiqueta: "Listos para cargar", valor: seleccionados.aSubir.length },
  ]
  const sinEjecutar = ejecucion.every((e) => e.valor === 0)

  const botonActualizar = (
    <button
      type="button"
      onClick={() => void recargar()}
      disabled={cargando}
      aria-label="Actualizar datos de Supabase"
      title="Actualizar"
      className="text-muted-foreground hover:text-white disabled:opacity-60"
    >
      <RefreshCw
        aria-hidden
        className={cn("size-3.5", cargando && "animate-spin")}
      />
    </button>
  )

  return (
    <div
      data-panel="derecho"
      hidden={oculta}
      className={cn("grid content-start gap-3", className)}
    >
      <CartaMapa
        titulo="Guardado en Supabase"
        icono={Database}
        accion={botonActualizar}
      >
        <p aria-live="polite" className="flex items-baseline gap-1.5">
          <span className="font-heading text-3xl font-semibold tabular-nums">
            {resumen ? n(total) : "—"}
          </span>
          <span className="text-xs text-muted-foreground">
            registros horarios
          </span>
        </p>
        {resumen && total === 0 && (
          <p className="text-xs text-white">
            Vacía: sigue los pasos para llenarla.
          </p>
        )}
        {error && (
          <p className="text-xs text-destructive">No se pudo leer: {error}</p>
        )}
        {/* La barra es la completitud de cada ciudad: llena = no falta ninguna hora. */}
        <ul className="hidden gap-1.5 text-xs lg:grid">
          {filas.map((r) => {
            const c = completitud(r)
            return (
              <li
                key={r.ciudad}
                className="grid grid-cols-[5.5rem_1fr_auto] items-center gap-2"
                title={`${r.ciudad}: ${n(r.registros)} registros, ${porcentaje(r.registros, horasEsperadas(r))} de las horas de su periodo`}
              >
                <span className="flex items-center gap-1.5">
                  <span
                    aria-hidden
                    className="size-2 rounded-full"
                    style={{ background: colorCiudad(r.ciudad) }}
                  />
                  {r.ciudad}
                </span>
                <span className="h-1.5 overflow-hidden rounded-full bg-white/10">
                  <span
                    className="block h-full rounded-full"
                    style={{
                      width: `${c * 100}%`,
                      background: colorCiudad(r.ciudad),
                    }}
                  />
                </span>
                <span className="text-right text-muted-foreground tabular-nums">
                  {n(r.registros)} · {r.registros ? porcentaje(c, 1) : "—"}
                </span>
              </li>
            )
          })}
        </ul>
        <p className="hidden text-xs text-muted-foreground lg:block">
          Barra = horas guardadas sobre las de su periodo. Pulsa una ciudad en
          el mapa para ver su temperatura.
        </p>
      </CartaMapa>

      <CartaMapa
        titulo="Temperaturas guardadas"
        icono={Thermometer}
        className="hidden lg:grid"
      >
        {conDatos.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            Aparecerán al cargar datos en Supabase.
          </p>
        ) : (
          <div className="grid grid-cols-[4.5rem_2.5rem_1fr_2.5rem] items-center gap-x-1.5 gap-y-1 text-xs">
            {conDatos.map((r) => (
              <Fragment key={r.ciudad}>
                <span>{r.ciudad}</span>
                <span className="text-right text-muted-foreground tabular-nums">
                  {r.tempMin!.toLocaleString("es-ES", {
                    maximumFractionDigits: 1,
                  })}
                  °
                </span>
                <span className="relative h-3.5" aria-hidden>
                  {marcas.map((m) => (
                    <span
                      key={m}
                      className="absolute inset-y-0 w-px bg-white/10"
                      style={{ left: `${posicion(m)}%` }}
                    />
                  ))}
                  <span
                    className="absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full"
                    style={{
                      left: `${posicion(r.tempMin!)}%`,
                      width: `${Math.max(2, posicion(r.tempMax!) - posicion(r.tempMin!))}%`,
                      background: colorCiudad(r.ciudad),
                    }}
                  />
                </span>
                <span className="tabular-nums">
                  {r.tempMax!.toLocaleString("es-ES", {
                    maximumFractionDigits: 1,
                  })}
                  °
                </span>
              </Fragment>
            ))}
            {/* Marcas de escala bajo las barras. */}
            <span className="relative col-start-3 mt-0.5 h-4 text-muted-foreground tabular-nums">
              {marcas.map((m) => (
                <span
                  key={m}
                  className="absolute -translate-x-1/2"
                  style={{ left: `${posicion(m)}%` }}
                >
                  {m}
                </span>
              ))}
            </span>
          </div>
        )}
      </CartaMapa>

      <CartaMapa
        titulo="Periodo y completitud"
        icono={CalendarRange}
        className="hidden lg:grid"
      >
        {!desde || !hasta ? (
          <p className="text-xs text-muted-foreground">
            Sin datos guardados todavía.
          </p>
        ) : (
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
            <dt className="text-muted-foreground">Desde</dt>
            <dd className="text-right tabular-nums">{fechaCorta(desde)}</dd>
            <dt className="text-muted-foreground">Hasta</dt>
            <dd className="text-right tabular-nums">{fechaCorta(hasta)}</dd>
            <dt className="text-muted-foreground">Completitud total</dt>
            <dd className="text-right font-semibold tabular-nums">
              {porcentaje(guardadoConDatos, totalEsperadas)}
            </dd>
          </dl>
        )}
      </CartaMapa>

      <CartaMapa
        titulo="Esta ejecución"
        icono={Activity}
        className="hidden lg:grid"
      >
        {sinEjecutar ? (
          <p className="text-xs text-muted-foreground">
            Aún no has ejecutado el pipeline. Empieza en el paso 1.
          </p>
        ) : (
          <>
            <dl className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 text-xs">
              {ejecucion.map((e) => (
                <Fragment key={e.etiqueta}>
                  <dt className="text-muted-foreground">{e.etiqueta}</dt>
                  <dd className="text-right font-semibold tabular-nums">
                    {n(e.valor)}
                  </dd>
                </Fragment>
              ))}
            </dl>
            <p className="text-xs text-muted-foreground">
              Datos del navegador: no están en Supabase hasta que los cargues.
            </p>
          </>
        )}
      </CartaMapa>
    </div>
  )
}

/** Embudo y gráficos de la ejecución actual (lo que hay en el navegador). */
export function ResultadosEjecucion({ pipeline }: { pipeline: PipelineEtl }) {
  const { transformacion, limpieza, seleccionados } = pipeline
  const medias = useMemo(
    () => mediasDiarias(limpieza.validos),
    [limpieza.validos]
  )
  const extraidos = transformacion.registros.length
  const embudo = [
    {
      etiqueta: "Extraídos",
      valor: extraidos,
      ayuda: "horas descargadas de la API",
    },
    {
      etiqueta: "Válidos",
      valor: limpieza.validos.length,
      ayuda: "superan la limpieza",
    },
    {
      etiqueta: "Coinciden con los filtros",
      valor: seleccionados.ordenados.length,
      ayuda: "de los válidos",
    },
    {
      etiqueta: "Listos para cargar",
      valor: seleccionados.aSubir.length,
      ayuda: "seleccionados por ti",
    },
  ]

  return (
    <section
      id="resultados"
      aria-labelledby="titulo-resultados"
      className="grid scroll-mt-20 gap-5"
    >
      <header className="grid gap-1">
        <h2 id="titulo-resultados" className="text-2xl font-semibold">
          Resultados de tu ejecución
        </h2>
        <p className="max-w-3xl text-sm text-muted-foreground">
          Embudo de datos: cada número sale del anterior. Fíjate en cuántos
          registros se pierden en cada paso y por qué.
          {extraidos === 0 &&
            " Se rellena en cuanto extraes datos en el paso 1."}
        </p>
      </header>

      <ol className="grid grid-cols-2 gap-3 @5xl:grid-cols-[1fr_auto_1fr_auto_1fr_auto_1fr]">
        {embudo.map((e, i) => (
          <Fragment key={e.etiqueta}>
            <li
              className={cn(
                "grid gap-1 rounded-2xl bg-card p-5 shadow-card",
                i === embudo.length - 1 && "ring-1 ring-primary"
              )}
            >
              <span className="text-sm text-muted-foreground">
                {e.etiqueta}
              </span>
              <span className="font-heading text-3xl font-semibold tracking-tight tabular-nums">
                {n(e.valor)}
              </span>
              <span className="text-xs text-muted-foreground">
                {e.ayuda}
                {i > 0 && extraidos > 0 && (
                  <span className="ml-1 font-medium text-(--subida)">
                    · {porcentaje(e.valor, extraidos)} del total
                  </span>
                )}
              </span>
            </li>
            {i < embudo.length - 1 && (
              <li
                aria-hidden
                className="hidden items-center text-primary @5xl:flex"
              >
                <ChevronRight className="size-5" />
              </li>
            )}
          </Fragment>
        ))}
      </ol>
      {seleccionados.fueraDeFiltros > 0 && (
        <p className="text-xs text-amber-300" role="status">
          ⚠ {n(seleccionados.fueraDeFiltros)} fila(s) seleccionadas no cumplen
          los filtros actuales y no se subirán.
        </p>
      )}

      <div className="grid gap-4 @3xl:grid-cols-2 @7xl:grid-cols-4">
        <TarjetaTemperatura dias={medias.dias} valores={medias.global} />
        <TarjetaTendencia dias={medias.dias} porCiudad={medias.porCiudad} />
        <TarjetaCalidad
          validos={limpieza.validos.length}
          total={extraidos}
          rechazados={limpieza.rechazados.length}
        />
        <TarjetaTiempos pipeline={pipeline} />
      </div>
    </section>
  )
}

/** Barras finas: temperatura media de cada día, todas las ciudades juntas. */
function TarjetaTemperatura({
  dias,
  valores,
}: {
  dias: string[]
  valores: number[]
}) {
  const media = valores.length
    ? valores.reduce((s, v) => s + v, 0) / valores.length
    : null
  const minimo = Math.min(0, ...valores)
  const maximo = Math.max(1, ...valores)
  return (
    <Tarjeta className="grid gap-4">
      <div
        className="flex h-24 items-end gap-0.5"
        role="img"
        aria-label="Temperatura media diaria"
      >
        {valores.length === 0 ? (
          <SinDatos>Extrae datos para ver la temperatura diaria.</SinDatos>
        ) : (
          valores.map((v, i) => (
            <div
              key={dias[i]}
              title={`${dias[i]}: ${grados(v)}`}
              className="group flex h-full flex-1 items-end"
            >
              <div
                className="mx-auto w-full max-w-1.5 rounded-t-[4px] bg-linear-to-t from-blue-600 to-cyan-400 opacity-90 transition-opacity group-hover:opacity-100 group-hover:brightness-125"
                style={{
                  height: `${Math.max(4, ((v - minimo) / (maximo - minimo)) * 100)}%`,
                }}
              />
            </div>
          ))
        )}
      </div>
      <div className="grid gap-0.5">
        <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Thermometer aria-hidden className="size-3.5" /> Temperatura media
        </p>
        <p className="font-heading text-2xl font-semibold tabular-nums">
          {media === null ? "—" : grados(media)}
        </p>
        {valores.length > 0 && (
          <p className="text-xs text-muted-foreground">
            {n(dias.length)} días · de {grados(Math.min(...valores))} a{" "}
            {grados(Math.max(...valores))}
          </p>
        )}
      </div>
    </Tarjeta>
  )
}

/** Líneas por ciudad con cursor y tooltip al pasar el ratón. */
function TarjetaTendencia({
  dias,
  porCiudad,
}: {
  dias: string[]
  porCiudad: Map<string, (number | null)[]>
}) {
  const [activo, setActivo] = useState<number | null>(null)
  const series = [...porCiudad]
  const todos = series.flatMap(([, v]) =>
    v.filter((x): x is number => x !== null)
  )
  const minimo = Math.min(...todos)
  const maximo = Math.max(...todos)
  const x = (i: number) =>
    dias.length > 1 ? (i / (dias.length - 1)) * 100 : 50
  const y = (v: number) => 90 - ((v - minimo) / (maximo - minimo || 1)) * 80

  return (
    <Tarjeta className="grid content-start gap-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-medium">Tendencia</p>
          <p className="text-xs text-muted-foreground">
            Temperatura media diaria por ciudad
          </p>
        </div>
      </div>
      {dias.length < 2 ? (
        <SinDatos>Hacen falta al menos dos días de datos.</SinDatos>
      ) : (
        <div className="relative">
          <svg
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            className="h-24 w-full overflow-visible"
            role="img"
            aria-label="Temperatura media diaria por ciudad"
            onPointerMove={(e) => {
              const caja = e.currentTarget.getBoundingClientRect()
              setActivo(
                Math.round(
                  ((e.clientX - caja.left) / caja.width) * (dias.length - 1)
                )
              )
            }}
            onPointerLeave={() => setActivo(null)}
          >
            {activo !== null && (
              <line
                x1={x(activo)}
                x2={x(activo)}
                y1={0}
                y2={100}
                className="stroke-muted-foreground/50"
                strokeWidth={1}
                vectorEffect="non-scaling-stroke"
              />
            )}
            {series.map(([ciudad, valores]) => (
              <polyline
                key={ciudad}
                fill="none"
                stroke={colorCiudad(ciudad)}
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
                points={valores
                  .map((v, i) => (v === null ? null : `${x(i)},${y(v)}`))
                  .filter(Boolean)
                  .join(" ")}
              />
            ))}
          </svg>
          {activo !== null && (
            <div
              className="pointer-events-none absolute bottom-full z-20 mb-2 grid min-w-36 -translate-x-1/2 gap-0.5 rounded-lg bg-popover px-3 py-2 text-xs text-popover-foreground shadow-card"
              style={{ left: `${Math.min(80, Math.max(20, x(activo)))}%` }}
            >
              <span className="font-medium">{dias[activo]}</span>
              {series.map(([ciudad, valores]) => (
                <span key={ciudad} className="flex items-center gap-1.5">
                  <span
                    className="size-2 rounded-full"
                    style={{ background: colorCiudad(ciudad) }}
                  />
                  {ciudad}
                  <span className="ml-auto tabular-nums">
                    {valores[activo] === null ? "—" : grados(valores[activo]!)}
                  </span>
                </span>
              ))}
            </div>
          )}
        </div>
      )}
      {series.length > 1 && (
        <ul className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
          {series.map(([ciudad]) => (
            <li key={ciudad} className="flex items-center gap-1.5">
              <span
                className="h-0.5 w-3 rounded-full"
                style={{ background: colorCiudad(ciudad) }}
              />
              {ciudad}
            </li>
          ))}
        </ul>
      )}
    </Tarjeta>
  )
}

/** Anillo con el porcentaje de registros que superan la limpieza. */
function TarjetaCalidad({
  validos,
  total,
  rechazados,
}: {
  validos: number
  total: number
  rechazados: number
}) {
  const fraccion = total ? validos / total : 0
  const circunferencia = 2 * Math.PI * 40
  return (
    <Tarjeta className="flex items-center gap-4">
      <div className="relative size-20 shrink-0">
        <svg viewBox="0 0 100 100" className="size-full -rotate-90" aria-hidden>
          <circle
            cx="50"
            cy="50"
            r="40"
            fill="none"
            strokeWidth="8"
            className="stroke-muted"
          />
          {fraccion > 0 && (
            <circle
              cx="50"
              cy="50"
              r="40"
              fill="none"
              strokeWidth="8"
              strokeLinecap="round"
              className="stroke-primary transition-[stroke-dasharray] duration-700"
              strokeDasharray={`${fraccion * circunferencia} ${circunferencia}`}
            />
          )}
        </svg>
        <span className="absolute inset-0 grid place-items-center font-heading text-lg font-semibold tabular-nums">
          {total ? porcentaje(validos, total) : "—"}
        </span>
      </div>
      <div className="grid gap-0.5">
        <p className="text-sm text-muted-foreground">Calidad de datos</p>
        <p className="font-heading text-xl font-semibold tabular-nums">
          {n(validos)} válidos
        </p>
        <p className="text-xs text-muted-foreground">
          {n(rechazados)} rechazados con su motivo
        </p>
      </div>
    </Tarjeta>
  )
}

/** Barras horizontales de un solo tono: cuánto ha tardado cada fase. */
function TarjetaTiempos({ pipeline }: { pipeline: PipelineEtl }) {
  const { extraccion, transformacion, limpieza, seleccionados, carga } =
    pipeline
  const hayDatos = transformacion.entradas > 0
  const fases = [
    {
      nombre: "Extracción",
      ms: extraccion?.descargas.length
        ? extraccion.descargas.reduce((s, d) => s + (d.duracionMs ?? 0), 0)
        : null,
    },
    {
      nombre: "Transformación",
      ms: hayDatos ? transformacion.duracionMs : null,
    },
    { nombre: "Limpieza", ms: hayDatos ? limpieza.duracionMs : null },
    { nombre: "Selección", ms: hayDatos ? seleccionados.duracionMs : null },
    {
      nombre: "Carga",
      ms: carga
        ? carga.lotes.reduce((s, l) => s + (l.duracionMs ?? 0), 0)
        : null,
    },
  ]
  const total = fases.reduce((s, f) => s + (f.ms ?? 0), 0)
  const maximo = Math.max(1, ...fases.map((f) => f.ms ?? 0))

  return (
    <Tarjeta className="grid gap-4">
      <div className="grid gap-0.5">
        <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Timer aria-hidden className="size-3.5" /> Tiempo por fase
        </p>
        <p className="font-heading text-2xl font-semibold tabular-nums">
          {total ? duracion(total) : "—"}
        </p>
        <p className="text-xs text-muted-foreground">
          tiempo total de la ejecución actual
        </p>
      </div>
      <ul className="grid gap-3 text-xs">
        {fases.map((f) => (
          <li
            key={f.nombre}
            className="grid gap-1.5"
            title={`${f.nombre}: ${duracion(f.ms)}`}
          >
            <span className="flex justify-between">
              <span>{f.nombre}</span>
              <span className="text-muted-foreground tabular-nums">
                {duracion(f.ms)}
              </span>
            </span>
            <span className="h-1.5 rounded-full bg-muted">
              <span
                className="block h-full rounded-full bg-linear-to-r from-blue-600 to-cyan-400 transition-[width] duration-500"
                style={{
                  width: `${f.ms ? Math.max(3, (f.ms / maximo) * 100) : 0}%`,
                }}
              />
            </span>
          </li>
        ))}
      </ul>
    </Tarjeta>
  )
}

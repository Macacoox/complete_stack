-- Tabla destino del pipeline ETL Open-Meteo → Supabase.
-- Una fila por ciudad y hora (UTC). La clave natural (ciudad, fecha_hora)
-- permite hacer upsert sin duplicar registros al repetir una carga.

create table if not exists public.mediciones_meteorologicas (
  id bigint generated always as identity primary key,
  ciudad text not null,
  fecha_hora timestamptz not null,
  temperatura_c double precision not null,
  humedad_pct double precision not null,
  precipitacion_mm double precision not null,
  importado_en timestamptz not null default now(),

  constraint mediciones_meteorologicas_ciudad_fecha_hora_key
    unique (ciudad, fecha_hora),
  constraint mediciones_meteorologicas_ciudad_no_vacia
    check (length(btrim(ciudad)) > 0),
  constraint mediciones_meteorologicas_humedad_rango
    check (humedad_pct >= 0 and humedad_pct <= 100),
  constraint mediciones_meteorologicas_precipitacion_no_negativa
    check (precipitacion_mm >= 0)
);

comment on table public.mediciones_meteorologicas is
  'Mediciones horarias (UTC) de Open-Meteo cargadas por el pipeline ETL de prácticas.';

-- Consultas habituales: por fecha (todas las ciudades) y ordenadas por fecha.
-- La consulta por ciudad + fecha ya usa el índice de la restricción única.
create index if not exists mediciones_meteorologicas_fecha_hora_idx
  on public.mediciones_meteorologicas (fecha_hora);

-- RLS activado y sin políticas: los roles anon y authenticated no pueden leer
-- ni escribir. Solo el servidor, con la clave secreta, accede a la tabla.
alter table public.mediciones_meteorologicas enable row level security;

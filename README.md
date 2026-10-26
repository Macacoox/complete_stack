# Pipeline ETL: Open-Meteo → Supabase

Práctica de Big Data. Una aplicación Next.js para ejecutar y **ver** un primer pipeline ETL:
extraer mediciones horarias históricas de Open-Meteo, transformarlas, limpiarlas, filtrar y
seleccionar qué registros subir, y cargarlos en Supabase.

```
Extracción → Transformación → Limpieza → Filtrado y selección → Carga
```

Stack: Next.js 16 (App Router), TypeScript, Tailwind CSS 4, shadcn/ui (Base UI), supabase-js, Vitest.

## Instalación

```bash
npm install
cp .env.example .env.local   # y rellena los valores
```

### Variables de entorno

| Variable | Dónde se usa | Secreta |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` (o `SUPABASE_URL`) | Servidor | No |
| `SUPABASE_SECRET_KEY` (`sb_secret_…`; también vale `SUPABASE_SERVICE_ROLE_KEY`) | Solo servidor | **Sí** |
| `ETL_PERMITIR_ESCRITURA_SIN_AUTH` | Permite cargar con `next start` | — |

La clave secreta salta RLS: nunca le pongas el prefijo `NEXT_PUBLIC_` ni la uses en el navegador.

### Base de datos

Ejecuta la migración [supabase/migrations/20261026000000_crear_mediciones_meteorologicas.sql](supabase/migrations/20261026000000_crear_mediciones_meteorologicas.sql)
en el **SQL Editor** de Supabase (o con `supabase db push` si usas la CLI). Crea la tabla
`mediciones_meteorologicas` con:

- `id` identidad como clave primaria, `importado_en` con `now()` por defecto.
- Restricción única `(ciudad, fecha_hora)`: permite el upsert sin duplicados.
- `humedad_pct` entre 0 y 100, `precipitacion_mm ≥ 0`.
- RLS activado **sin políticas**: los roles públicos no pueden leer ni escribir.

## Ejecución

```bash
npm run dev               # http://localhost:3000
npm test                  # pruebas unitarias (fixtures controlados)
npm run test:integracion  # Open-Meteo y Supabase reales (requiere .env.local y la migración)
npm run typecheck && npm run build
```

## Cómo funciona el pipeline

1. **Extracción.** Una petición por ciudad a `https://archive-api.open-meteo.com/v1/archive` con
   `hourly=temperature_2m,relative_humidity_2m,precipitation`, `timezone=UTC`, °C y mm. Máximo
   31 días por extracción. Las ciudades se piden una a una y se muestra cuáles faltan. El JSON se
   guarda tal cual durante la sesión y se puede descargar. Si una ciudad falla se puede reintentar
   solo esa: su respuesta sustituye a la anterior, así que no se duplican datos.
2. **Transformación.** La API devuelve arrays paralelos (`time[i]`, `temperature_2m[i]`…). Cada
   posición `i` pasa a ser un registro `{ciudad, fecha_hora, temperatura_c, humedad_pct,
   precipitacion_mm}`. Las horas llegan sin zona (`2026-09-01T00:00`), así que se interpretan
   explícitamente como UTC. Si las longitudes de los arrays no coinciden se avisa y las posiciones
   que faltan se marcan como ausentes. Aquí no se corrige ningún valor.
3. **Limpieza.** Se rechaza un registro si le falta la ciudad o una fecha válida, o si alguna
   medición es nula, vacía, ausente, texto o un número no finito (**nunca se convierten en 0**).
   También si la humedad está fuera de 0–100 % o la precipitación es negativa. Cada fila guarda
   todos sus motivos. La temperatura no tiene umbrales. Los **duplicados** por (ciudad, fecha_hora)
   se resuelven conservando la **primera aparición válida** en el orden de extracción.
4. **Filtrado y selección.** Orden fijo: válidos → filtros → ordenación → selección → carga.
   Los filtros son ciudad, fecha y hora en UTC, rangos de temperatura, humedad y precipitación, y
   «solo lluvia» (> 0 mm). La paginación solo afecta a la vista. Cambiar los filtros no selecciona
   filas nuevas, y solo se suben las seleccionadas que siguen cumpliendo los filtros. Se indica
   cuántas seleccionadas quedan fuera. Los descartes por calidad (pestaña «Rechazados») son
   distintos de los excluidos por filtros, que siguen siendo válidos.
5. **Carga.** Al pulsar «Subir N registros» se congela una copia del conjunto con su orden. Se
   envía en lotes de ≤ 500 a `POST /api/carga`, que vuelve a validar cada registro y el tamaño de
   la petición y hace `upsert` con `onConflict: ciudad,fecha_hora`. Cada lote tiene su estado. Si
   uno falla, los demás se conservan y se puede reintentar solo el fallido. Al terminar, se
   comprueba en destino que las claves enviadas existen (`POST /api/verificar`, consultas por
   lotes). Supabase no indica cuántas filas de un upsert eran nuevas y cuántas actualizadas, así
   que la app no muestra ese desglose.

La pestaña **Datos en Supabase** lee la tabla real (`GET /api/mediciones`) con paginación,
filtros, `ORDER BY` explícito y botón de actualizar. Una tabla no conserva el orden de
inserción, así que cualquier consulta que necesite un orden debe pedirlo.

## Seguridad

- Toda escritura y lectura de Supabase se hace en route handlers del servidor
  (`lib/supabase/servidor.ts` importa `server-only`).
- El servidor no confía en el navegador. Revalida cada registro (ciudad conocida, fecha ISO con
  zona, números finitos, rangos y sin duplicados en el lote), limita los lotes a 500 registros y
  las peticiones a 256 KB.
- **La app no tiene autenticación.** En desarrollo (`npm run dev`) la carga está abierta. Con
  `next start` queda bloqueada salvo que se defina `ETL_PERMITIR_ESCRITURA_SIN_AUTH=true`.
  **Antes de publicarla hay que proteger `/api/carga`, `/api/verificar` y `/api/mediciones`.**
- Los logs no incluyen credenciales.

## Estructura

```
app/page.tsx                  pantalla de trabajo
app/api/carga|verificar|mediciones/route.ts
components/etl/               interfaz (pipeline, tablas, pestañas)
hooks/use-pipeline-etl.ts     estado del pipeline en el navegador
lib/etl/                      lógica pura: extracción, transformación, limpieza, filtros, carga
lib/supabase/servidor.ts      cliente con clave secreta (solo servidor)
supabase/migrations/          SQL de la tabla
tests/unit, tests/integracion, tests/fixtures (solo para pruebas)
```

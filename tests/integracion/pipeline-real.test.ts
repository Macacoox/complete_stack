/**
 * Pruebas de integración contra servicios REALES (Open-Meteo y Supabase).
 * Usan datos reales extraídos en el momento; nunca los fixtures.
 * Requieren conexión a internet y, para Supabase, .env.local y la migración aplicada.
 */
import { existsSync } from "node:fs"

import { NextRequest } from "next/server"
import { beforeAll, describe, expect, it } from "vitest"

import { aRegistroCarga, crearLotes, procesarLotes, resumenLotes } from "@/lib/etl/carga"
import { buscarCiudad } from "@/lib/etl/ciudades"
import { descargarCiudad } from "@/lib/etl/extraccion"
import { limpiar } from "@/lib/etl/limpieza"
import type { RegistroCarga, RegistroValido } from "@/lib/etl/tipos"
import { transformar } from "@/lib/etl/transformacion"

// Next no carga .env.local con NODE_ENV=test; lo leemos con el parser de Node.
if (existsSync(".env.local")) process.loadEnvFile(".env.local")

const DIA = "2026-09-01"
const hayCredenciales = Boolean(
  (process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL) && process.env.SUPABASE_SECRET_KEY
)

let validos: RegistroValido[] = []

describe("Open-Meteo real", () => {
  beforeAll(async () => {
    const respuesta = await descargarCiudad(buscarCiudad("barcelona")!, DIA, DIA)
    const { registros } = transformar([{ ciudad: "Barcelona", respuesta }])
    validos = limpiar(registros).validos
  })

  it("una ciudad durante un día devuelve 24 registros horarios en UTC", () => {
    expect(validos).toHaveLength(24)
    expect(validos[0].fecha_hora).toBe(`${DIA}T00:00:00.000Z`)
    expect(validos[23].fecha_hora).toBe(`${DIA}T23:00:00.000Z`)
    expect(new Set(validos.map((v) => v.fecha_hora)).size).toBe(24)
  })
})

describe.skipIf(!hayCredenciales)("Supabase real (a través de las rutas API)", () => {
  async function importarRutas() {
    return {
      carga: await import("@/app/api/carga/route"),
      verificar: await import("@/app/api/verificar/route"),
      mediciones: await import("@/app/api/mediciones/route"),
    }
  }

  const enviarPorRuta = async (registros: RegistroCarga[]) => {
    const { carga } = await importarRutas()
    const r = await carga.POST(
      new Request("http://localhost/api/carga", { method: "POST", body: JSON.stringify({ registros }) })
    )
    const cuerpo = await r.json()
    if (!r.ok) throw new Error(cuerpo.error)
    return { procesados: cuerpo.procesados as number | null }
  }

  const verificarPorRuta = async (registros: RegistroCarga[]) => {
    const { verificar } = await importarRutas()
    const r = await verificar.POST(
      new Request("http://localhost/api/verificar", {
        method: "POST",
        body: JSON.stringify({ claves: registros.map(({ ciudad, fecha_hora }) => ({ ciudad, fecha_hora })) }),
      })
    )
    const cuerpo = await r.json()
    if (!r.ok) throw new Error(cuerpo.error)
    return { faltantes: cuerpo.faltantes as string[] }
  }

  const contarEnDestino = async () => {
    const { mediciones } = await importarRutas()
    const url = `http://localhost/api/mediciones?ciudad=Barcelona&desde=${DIA}T00:00&hasta=${DIA}T23:00&tamano=100`
    const r = await mediciones.GET(new NextRequest(url))
    const cuerpo = await r.json()
    if (!r.ok) throw new Error(cuerpo.error)
    return cuerpo as { total: number; filas: { fecha_hora: string }[] }
  }

  it("carga, verifica, y una segunda carga no duplica filas", async () => {
    const aSubir = validos.map(aRegistroCarga)
    const primera = await procesarLotes(crearLotes(aSubir), enviarPorRuta, verificarPorRuta)
    expect(resumenLotes(primera)).toMatchObject({ lotesFallidos: 0, verificados: 24, faltantes: [] })
    const tras1 = await contarEnDestino()
    expect(tras1.total).toBe(24)

    const segunda = await procesarLotes(crearLotes(aSubir), enviarPorRuta, verificarPorRuta)
    expect(resumenLotes(segunda)).toMatchObject({ lotesFallidos: 0, verificados: 24, procesadosSupabase: 24 })
    expect((await contarEnDestino()).total).toBe(24)
  })

  it("la lectura del destino respeta el ORDER BY pedido", async () => {
    const { filas } = await contarEnDestino()
    const fechas = filas.map((f) => Date.parse(f.fecha_hora))
    expect(fechas).toEqual([...fechas].sort((a, b) => a - b))
  })

  it("fallo parcial: el lote rechazado no afecta a los lotes correctos y se puede reintentar", async () => {
    // Lote 1 real y correcto; lote 2 con un registro alterado que el servidor rechaza.
    const reales = validos.map(aRegistroCarga)
    const lotes = crearLotes(reales)
    const alterado = { ...lotes[0], numero: 2, registros: [{ ...reales[0], humedad_pct: 150 }] }
    const resultado = await procesarLotes([lotes[0], alterado], enviarPorRuta, verificarPorRuta)
    expect(resultado.map((l) => l.estado)).toEqual(["completado", "error"])
    expect(resultado[1].error).toMatch(/rechazado el lote/)
    expect(resultado[0].verificacion).toMatchObject({ estado: "ok", encontrados: 24 })

    // El reintento solo reenvía el lote fallido; el correcto conserva su estado.
    const reintento = await procesarLotes(resultado, enviarPorRuta, verificarPorRuta)
    expect(reintento[0]).toEqual(resultado[0])
    expect(reintento[1].intentos).toBe(2)
    expect((await contarEnDestino()).total).toBe(24)
  })
})

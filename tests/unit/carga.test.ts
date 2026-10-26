import { describe, expect, it, vi } from "vitest"

import { POST as postCarga } from "@/app/api/carga/route"
import {
  TAMANO_LOTE,
  crearLotes,
  procesarLotes,
  resumenLotes,
  validarLoteCarga,
} from "@/lib/etl/carga"
import { construirUrl, validarConfiguracion, volumenPrevisto } from "@/lib/etl/extraccion"
import { CIUDADES } from "@/lib/etl/ciudades"
import type { RegistroCarga } from "@/lib/etl/tipos"

function filas(cantidad: number): RegistroCarga[] {
  return Array.from({ length: cantidad }, (_, i) => ({
    ciudad: "Valencia",
    fecha_hora: new Date(Date.UTC(2026, 8, 1) + i * 3_600_000).toISOString(),
    temperatura_c: 20,
    humedad_pct: 50,
    precipitacion_mm: 0,
  }))
}

describe("configuración de extracción", () => {
  it("limita a 31 días y valida fechas", () => {
    const base = { ciudades: ["madrid"], inicio: "2026-09-01", fin: "2026-09-30" }
    expect(validarConfiguracion(base, "2026-10-26")).toEqual([])
    expect(validarConfiguracion({ ...base, fin: "2026-10-01" }, "2026-10-26")).toEqual([])
    expect(validarConfiguracion({ ...base, fin: "2026-10-02" }, "2026-10-26")[0]).toMatch(/31 días/)
    expect(validarConfiguracion({ ...base, fin: "2026-08-01" }, "2026-10-26")[0]).toMatch(/posterior/)
    expect(validarConfiguracion({ ...base, ciudades: [] }, "2026-10-26")).toContain(
      "Selecciona al menos una ciudad."
    )
    expect(volumenPrevisto({ ...base, ciudades: ["a", "b"] })).toEqual({ dias: 30, peticiones: 2, registros: 1440 })
  })

  it("pide UTC, °C, mm y las tres variables horarias", () => {
    const url = new URL(construirUrl(CIUDADES[0], "2026-09-01", "2026-09-01"))
    expect(url.origin + url.pathname).toBe("https://archive-api.open-meteo.com/v1/archive")
    expect(Object.fromEntries(url.searchParams)).toMatchObject({
      latitude: "41.3874",
      longitude: "2.1686",
      timezone: "UTC",
      temperature_unit: "celsius",
      precipitation_unit: "mm",
      hourly: "temperature_2m,relative_humidity_2m,precipitation",
    })
  })
})

describe("validación en servidor", () => {
  it("acepta un lote correcto y normaliza la fecha", () => {
    const r = validarLoteCarga({ registros: [{ ...filas(1)[0], fecha_hora: "2026-09-01T02:00:00+02:00" }] })
    expect(r).toEqual({ ok: true, registros: [{ ...filas(1)[0], fecha_hora: "2026-09-01T00:00:00.000Z" }] })
  })

  it("rechaza lotes de más de 500, vacíos, nulos, campos extra, ciudades desconocidas y duplicados", () => {
    expect(validarLoteCarga({ registros: filas(TAMANO_LOTE + 1) }).ok).toBe(false)
    expect(validarLoteCarga({ registros: [] }).ok).toBe(false)
    const [a] = filas(1)
    const r = validarLoteCarga({
      registros: [
        { ...a, temperatura_c: null },
        { ...a, extra: 1 },
        { ...a, ciudad: "Atlantis" },
        { ...a, fecha_hora: "2026-09-01T00:00" },
        a,
        a,
      ],
    })
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.errores).toEqual([
        "Registro 1: Temperatura: valor nulo.",
        "Registro 2: campos no permitidos (extra).",
        "Registro 3: ciudad desconocida.",
        "Registro 4: fecha_hora no es ISO 8601 con zona horaria.",
        "Registro 6: duplicado dentro del lote (Valencia|2026-09-01T00:00:00.000Z).",
      ])
    }
  })

  it("el endpoint rechaza JSON inválido, lotes no válidos y peticiones demasiado grandes sin tocar Supabase", async () => {
    const pedir = (body: string) =>
      postCarga(new Request("http://localhost/api/carga", { method: "POST", body }))
    expect((await pedir("{no json")).status).toBe(400)
    const r = await pedir(JSON.stringify({ registros: [{ ...filas(1)[0], humedad_pct: 150 }] }))
    expect(r.status).toBe(400)
    expect((await r.json()).detalles).toEqual(["Registro 1: Humedad fuera de 0–100 % (150)."])
    expect((await pedir("x".repeat(300 * 1024))).status).toBe(413)
  })
})

describe("carga por lotes", () => {
  it("la concatenación de los lotes es exactamente la vista previa, en el mismo orden", () => {
    const vistaPrevia = filas(1201)
    const lotes = crearLotes(vistaPrevia)
    expect(lotes.map((l) => l.registros.length)).toEqual([500, 500, 201])
    expect(lotes.flatMap((l) => l.registros)).toEqual(vistaPrevia)
  })

  it("un fallo parcial conserva los lotes correctos y el reintento solo envía los fallidos", async () => {
    const lotes = crearLotes(filas(1201))
    let fallar = true
    const enviar = vi.fn(async (registros: RegistroCarga[]) => {
      if (registros === lotes[1].registros && fallar) throw new Error("HTTP 502")
      return { procesados: registros.length }
    })
    const verificar = vi.fn(async () => ({ faltantes: [] as string[] }))

    const tras1 = await procesarLotes(lotes, enviar, verificar)
    expect(tras1.map((l) => l.estado)).toEqual(["completado", "error", "completado"])
    expect(tras1[1].error).toBe("HTTP 502")
    expect(resumenLotes(tras1)).toMatchObject({
      registrosCorrectos: 701,
      registrosFallidos: 500,
      verificados: 701,
    })
    expect(verificar).toHaveBeenCalledTimes(2)

    fallar = false
    enviar.mockClear()
    verificar.mockClear()
    const tras2 = await procesarLotes(tras1, enviar, verificar)
    expect(enviar).toHaveBeenCalledTimes(1)
    expect(enviar.mock.calls[0][0]).toBe(lotes[1].registros)
    expect(verificar).toHaveBeenCalledTimes(1)
    expect(tras2.map((l) => l.estado)).toEqual(["completado", "completado", "completado"])
    expect(tras2[1].intentos).toBe(2)
    expect(resumenLotes(tras2)).toMatchObject({ registrosFallidos: 0, verificados: 1201 })
  })

  it("no inventa recuentos si Supabase no los devuelve", async () => {
    const r = await procesarLotes(
      crearLotes(filas(3)),
      async () => ({ procesados: null }),
      async () => ({ faltantes: [] })
    )
    expect(resumenLotes(r)).toMatchObject({ procesadosSupabase: 0, lotesSinRecuento: 1 })
  })
})

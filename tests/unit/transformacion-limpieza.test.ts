import { describe, expect, it } from "vitest"

import { limpiar } from "@/lib/etl/limpieza"
import { interpretarFechaUtc, transformar } from "@/lib/etl/transformacion"

import { conProblemas, correcta, longitudesIncoherentes } from "../fixtures/respuestas"

describe("transformación: arrays paralelos → registros", () => {
  it("crea un registro por posición con la estructura normalizada", () => {
    const { registros, avisos } = transformar([{ ciudad: "Barcelona", respuesta: correcta }])
    expect(avisos).toEqual([])
    expect(registros).toHaveLength(3)
    expect(registros[1]).toMatchObject({
      fila: 2,
      ciudad: "Barcelona",
      indice: 1,
      fecha_original: "2026-09-01T01:00",
      fecha_hora: "2026-09-01T01:00:00.000Z",
      temperatura_c: 23.6,
      humedad_pct: 80,
      precipitacion_mm: 0.4,
    })
  })

  it("interpreta las horas como UTC explícitamente, sin depender de la zona local", () => {
    expect(interpretarFechaUtc("2026-09-01T00:00", 0)).toBe("2026-09-01T00:00:00.000Z")
    expect(interpretarFechaUtc("2026-09-01T02:00", 7200)).toBe("2026-09-01T00:00:00.000Z")
    expect(interpretarFechaUtc("2026-02-30T00:00", 0)).toBeNull()
    expect(interpretarFechaUtc("2026-09-01", 0)).toBeNull()
    expect(interpretarFechaUtc(null, 0)).toBeNull()
  })

  it("detecta longitudes incoherentes y marca las posiciones como ausentes", () => {
    const { registros, avisos } = transformar([{ ciudad: "Madrid", respuesta: longitudesIncoherentes }])
    expect(registros).toHaveLength(3)
    expect(registros[2].temperatura_c).toBeUndefined()
    expect(registros[0].precipitacion_mm).toBeUndefined()
    expect(avisos.map((a) => a.mensaje).join(" ")).toMatch(/Falta el array «precipitation»/)
    expect(avisos.map((a) => a.mensaje).join(" ")).toMatch(/Longitudes incoherentes: time=3/)
  })

  it("avisa si falta el bloque hourly sin generar registros", () => {
    const { registros, avisos } = transformar([{ ciudad: "Bilbao", respuesta: { latitude: 1 } }])
    expect(registros).toHaveLength(0)
    expect(avisos[0].mensaje).toMatch(/hourly/)
  })
})

describe("limpieza", () => {
  const { registros } = transformar([{ ciudad: "Sevilla", respuesta: conProblemas }])
  const { validos, rechazados, duplicados } = limpiar(registros)
  const motivosDe = (indice: number) =>
    rechazados.find((r) => r.registro.indice === indice)?.motivos ?? []

  it("no convierte null, vacíos ni texto en cero: los rechaza con su motivo", () => {
    expect(registros[1].temperatura_c).toBeNull()
    expect(motivosDe(1)).toEqual(["Temperatura: valor nulo"])
    expect(motivosDe(2)).toEqual(["Humedad: cadena vacía"])
    expect(motivosDe(3)).toEqual(["Precipitación: texto «0.5» en lugar de número"])
    expect(validos.some((v) => v.temperatura_c === 0)).toBe(false)
  })

  it("valida rangos de humedad y precipitación", () => {
    expect(motivosDe(4)).toEqual(["Humedad fuera de 0–100 % (105)"])
    expect(motivosDe(5)).toEqual(["Precipitación negativa (-0.1 mm)"])
  })

  it("rechaza fechas no válidas y acumula todos los motivos de una fila", () => {
    expect(motivosDe(6)).toEqual(['Fecha no válida ("no-es-fecha")'])
    expect(motivosDe(8)).toEqual([
      "Temperatura: valor nulo",
      "Humedad fuera de 0–100 % (-1)",
      "Precipitación: valor nulo",
    ])
  })

  it("elimina duplicados por (ciudad, fecha_hora) conservando la primera aparición", () => {
    expect(duplicados).toBe(1)
    expect(motivosDe(7)).toEqual(["Duplicado de ciudad y fecha_hora: se conserva la fila 1"])
    const conservado = validos.find((v) => v.fecha_hora === "2026-09-02T00:00:00.000Z")
    expect(conservado?.temperatura_c).toBe(55.3)
  })

  it("no descarta temperaturas extremas", () => {
    expect(validos.map((v) => v.temperatura_c)).toEqual([55.3, -60.1])
    expect(validos.length + rechazados.length).toBe(registros.length)
  })

  it("el duplicado entre ciudades distintas no es duplicado", () => {
    const r = transformar([
      { ciudad: "Barcelona", respuesta: correcta },
      { ciudad: "Madrid", respuesta: correcta },
    ])
    expect(limpiar(r.registros).validos).toHaveLength(6)
  })
})

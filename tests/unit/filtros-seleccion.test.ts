import { describe, expect, it } from "vitest"

import {
  FILTROS_VACIOS,
  aplicarFiltros,
  conjuntoDeCarga,
  erroresFiltros,
  ordenar,
  paginar,
} from "@/lib/etl/filtros"
import type { RegistroValido } from "@/lib/etl/tipos"

/** 60 registros sintéticos: 2 ciudades × 30 horas. */
function registros(): RegistroValido[] {
  const filas: RegistroValido[] = []
  for (const ciudad of ["Bilbao", "Madrid"]) {
    for (let h = 0; h < 30; h++) {
      const fecha_hora = new Date(Date.UTC(2026, 8, 1, h)).toISOString()
      filas.push({
        clave: `${ciudad}|${fecha_hora}`,
        fila: filas.length + 1,
        ciudad,
        fecha_hora,
        temperatura_c: ciudad === "Madrid" ? 10 + h : 5 + h / 2,
        humedad_pct: 40 + h,
        precipitacion_mm: h % 5 === 0 ? 0 : h % 3 === 0 ? 1.2 : 0,
      })
    }
  }
  return filas
}

describe("filtros y ordenación antes de paginar", () => {
  const todos = registros()

  it("la primera página del orden descendente contiene el máximo global", () => {
    const ordenados = ordenar(todos, { campo: "temperatura_c", direccion: "desc" })
    const pagina1 = paginar(ordenados, 1, 25).filas
    // El máximo (Madrid, hora 29 → 39 °C) está al final de los datos originales.
    expect(todos.findIndex((r) => r.temperatura_c === 39)).toBe(59)
    expect(pagina1[0].temperatura_c).toBe(39)
    expect(pagina1).toHaveLength(25)
  })

  it("filtra por ciudad, fecha (UTC, extremos incluidos), rangos y lluvia", () => {
    const f = {
      ...FILTROS_VACIOS,
      ciudades: ["Madrid"],
      desde: "2026-09-01T03:00",
      hasta: "2026-09-01T20:00",
      tempMin: "15",
      humMax: "55",
      soloLluvia: true,
    }
    const r = aplicarFiltros(todos, f)
    expect(r.every((x) => x.ciudad === "Madrid" && x.precipitacion_mm > 0)).toBe(true)
    expect(r.map((x) => new Date(x.fecha_hora).getUTCHours())).toEqual([6, 9, 12])
  })

  it("«solo lluvia» excluye precipitación 0", () => {
    const r = aplicarFiltros(todos, { ...FILTROS_VACIOS, soloLluvia: true })
    expect(r.length).toBeGreaterThan(0)
    expect(r.some((x) => x.precipitacion_mm === 0)).toBe(false)
  })

  it("informa de límites invertidos o no numéricos", () => {
    expect(erroresFiltros({ ...FILTROS_VACIOS, tempMin: "30", tempMax: "10" })).toEqual([
      "El mínimo de temperatura es mayor que el máximo.",
    ])
    expect(erroresFiltros({ ...FILTROS_VACIOS, humMin: "abc" })).toEqual([
      "El mínimo de humedad no es un número.",
    ])
  })
})

describe("selección entre páginas", () => {
  const todos = registros()

  it("«seleccionar todas las filtradas» incluye filas de todas las páginas", () => {
    const filtrados = ordenar(aplicarFiltros(todos, { ...FILTROS_VACIOS, ciudades: ["Madrid"] }), {
      campo: "fecha_hora",
      direccion: "desc",
    })
    const seleccion = new Set(filtrados.map((r) => r.clave))
    const { aSubir, fueraDeFiltros } = conjuntoDeCarga(filtrados, seleccion)
    expect(paginar(filtrados, 1, 25).filas).toHaveLength(25)
    expect(aSubir).toHaveLength(30)
    expect(aSubir).toEqual(filtrados) // mismo orden que la vista
    expect(fueraDeFiltros).toBe(0)
  })

  it("selección manual en páginas 1 y 2 se conserva al paginar", () => {
    const ordenados = ordenar(todos, { campo: "fecha_hora", direccion: "asc" })
    const p1 = paginar(ordenados, 1, 25).filas
    const p2 = paginar(ordenados, 2, 25).filas
    const seleccion = new Set([p1[0].clave, p2[3].clave])
    const { aSubir } = conjuntoDeCarga(ordenados, seleccion)
    expect(aSubir.map((r) => r.clave)).toEqual([p1[0].clave, p2[3].clave])
  })

  it("al cambiar filtros no se seleccionan filas nuevas y se cuentan las que quedan fuera", () => {
    const madrid = aplicarFiltros(todos, { ...FILTROS_VACIOS, ciudades: ["Madrid"] })
    const seleccion = new Set(madrid.slice(0, 10).map((r) => r.clave))
    // Se amplía el filtro a todas las ciudades: siguen siendo 10, no 60.
    expect(conjuntoDeCarga(todos, seleccion).aSubir).toHaveLength(10)
    // Se restringe a Bilbao: ninguna seleccionada cumple, 10 quedan fuera.
    const bilbao = aplicarFiltros(todos, { ...FILTROS_VACIOS, ciudades: ["Bilbao"] })
    expect(conjuntoDeCarga(bilbao, seleccion)).toEqual({ aSubir: [], fueraDeFiltros: 10 })
  })
})

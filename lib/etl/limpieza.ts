import type {
  RegistroRechazado,
  RegistroTransformado,
  RegistroValido,
} from "./tipos"

export const ETIQUETAS_MEDICION = {
  temperatura_c: "Temperatura",
  humedad_pct: "Humedad",
  precipitacion_mm: "Precipitación",
} as const

type CampoMedicion = keyof typeof ETIQUETAS_MEDICION

/** Describe por qué un valor no es un número utilizable (o null si lo es). */
export function problemaNumero(valor: unknown): string | null {
  if (valor === undefined) return "valor ausente"
  if (valor === null) return "valor nulo"
  if (typeof valor === "string") {
    return valor.trim() === "" ? "cadena vacía" : `texto «${valor}» en lugar de número`
  }
  if (typeof valor !== "number") return `tipo ${typeof valor} en lugar de número`
  if (!Number.isFinite(valor)) return `número no finito (${valor})`
  return null
}

/**
 * Reglas de calidad de una medición. Se comparten con la validación del
 * servidor para que cliente y API apliquen exactamente los mismos criterios.
 * La temperatura no tiene umbrales: un valor extremo no es un error de calidad.
 */
export function motivosMedicion(campo: CampoMedicion, valor: unknown): string[] {
  const etiqueta = ETIQUETAS_MEDICION[campo]
  const problema = problemaNumero(valor)
  if (problema) return [`${etiqueta}: ${problema}`]
  const n = valor as number
  if (campo === "humedad_pct" && (n < 0 || n > 100)) {
    return [`Humedad fuera de 0–100 % (${n})`]
  }
  if (campo === "precipitacion_mm" && n < 0) {
    return [`Precipitación negativa (${n} mm)`]
  }
  return []
}

export function claveRegistro(ciudad: string, fecha_hora: string) {
  return `${ciudad}|${fecha_hora}`
}

export type ResultadoLimpieza = {
  validos: RegistroValido[]
  rechazados: RegistroRechazado[]
  duplicados: number
}

/**
 * Separa registros válidos y rechazados, guardando todos los motivos de cada
 * rechazo. Duplicados por (ciudad, fecha_hora): se conserva la PRIMERA
 * aparición válida en el orden de extracción y se rechazan las siguientes.
 */
export function limpiar(registros: RegistroTransformado[]): ResultadoLimpieza {
  const validos: RegistroValido[] = []
  const rechazados: RegistroRechazado[] = []
  const primeraFila = new Map<string, number>()
  let duplicados = 0

  for (const registro of registros) {
    const motivos: string[] = []
    const ciudad = typeof registro.ciudad === "string" ? registro.ciudad.trim() : ""
    if (!ciudad) motivos.push("Sin ciudad")
    if (registro.fecha_hora === null) {
      motivos.push(
        registro.fecha_original === undefined
          ? "Fecha ausente"
          : `Fecha no válida (${JSON.stringify(registro.fecha_original)})`
      )
    }
    for (const campo of Object.keys(ETIQUETAS_MEDICION) as CampoMedicion[]) {
      motivos.push(...motivosMedicion(campo, registro[campo]))
    }

    if (motivos.length === 0) {
      const clave = claveRegistro(ciudad, registro.fecha_hora!)
      const anterior = primeraFila.get(clave)
      if (anterior !== undefined) {
        duplicados++
        motivos.push(`Duplicado de ciudad y fecha_hora: se conserva la fila ${anterior}`)
      } else {
        primeraFila.set(clave, registro.fila)
        validos.push({
          clave,
          fila: registro.fila,
          ciudad,
          fecha_hora: registro.fecha_hora!,
          temperatura_c: registro.temperatura_c as number,
          humedad_pct: registro.humedad_pct as number,
          precipitacion_mm: registro.precipitacion_mm as number,
        })
        continue
      }
    }
    rechazados.push({ registro, motivos })
  }

  return { validos, rechazados, duplicados }
}

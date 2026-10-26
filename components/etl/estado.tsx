import {
  CircleCheck,
  CircleDashed,
  CircleX,
  LoaderCircle,
  TriangleAlert,
} from "lucide-react"
import { cn } from "@/lib/utils"

export type Estado = "pendiente" | "en_curso" | "completada" | "aviso" | "error"

const ESTILOS: Record<Estado, { icono: typeof CircleCheck; clase: string }> = {
  pendiente: { icono: CircleDashed, clase: "text-muted-foreground border-border" },
  en_curso: {
    icono: LoaderCircle,
    clase: "text-sky-700 border-sky-300 bg-sky-50 dark:text-sky-300 dark:border-sky-800 dark:bg-sky-950",
  },
  completada: {
    icono: CircleCheck,
    clase:
      "text-emerald-700 border-emerald-300 bg-emerald-50 dark:text-emerald-300 dark:border-emerald-800 dark:bg-emerald-950",
  },
  aviso: {
    icono: TriangleAlert,
    clase:
      "text-amber-800 border-amber-300 bg-amber-50 dark:text-amber-300 dark:border-amber-800 dark:bg-amber-950",
  },
  error: {
    icono: CircleX,
    clase: "text-destructive border-destructive/40 bg-destructive/10",
  },
}

/** Estado con icono y texto: nunca depende solo del color. */
export function EtiquetaEstado({
  estado,
  texto,
  className,
}: {
  estado: Estado
  texto: string
  className?: string
}) {
  const { icono: Icono, clase } = ESTILOS[estado]
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap",
        clase,
        className
      )}
    >
      <Icono aria-hidden className={cn("size-3.5", estado === "en_curso" && "animate-spin")} />
      {texto}
    </span>
  )
}

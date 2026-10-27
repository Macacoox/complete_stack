import {
  CircleCheck,
  CircleDashed,
  CircleX,
  Hand,
  LoaderCircle,
  TriangleAlert,
} from "lucide-react"
import { cn } from "@/lib/utils"

export type Estado = "pendiente" | "accion" | "en_curso" | "completada" | "aviso" | "error"

const ESTILOS: Record<Estado, { icono: typeof CircleCheck; clase: string }> = {
  pendiente: { icono: CircleDashed, clase: "text-muted-foreground bg-foreground/5" },
  accion: { icono: Hand, clase: "text-primary bg-primary/10" },
  en_curso: { icono: LoaderCircle, clase: "text-sky-700 bg-sky-500/10 dark:text-sky-300" },
  completada: { icono: CircleCheck, clase: "text-emerald-700 bg-emerald-500/12 dark:text-emerald-300" },
  aviso: { icono: TriangleAlert, clase: "text-amber-800 bg-amber-500/15 dark:text-amber-300" },
  error: { icono: CircleX, clase: "text-destructive bg-destructive/10" },
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
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap",
        clase,
        className
      )}
    >
      <Icono aria-hidden className={cn("size-3.5", estado === "en_curso" && "animate-spin")} />
      {texto}
    </span>
  )
}

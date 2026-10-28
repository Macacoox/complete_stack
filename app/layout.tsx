import { Geist_Mono, Inter, Poppins } from "next/font/google"

import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { cn } from "@/lib/utils"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Pipeline ETL · Open-Meteo → Supabase",
  description:
    "Práctica de Big Data: extracción, transformación, limpieza, selección y carga.",
  // La app tiene modo oscuro propio: evita que Dark Reader altere el HTML
  // antes de la hidratación (provoca errores de hydration mismatch).
  other: { "darkreader-lock": "true" },
}

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" })

// Títulos y cifras grandes con una fuente geométrica, como en los paneles de analítica.
const fontDisplay = Poppins({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-display",
})

const fontMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
})

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="es"
      suppressHydrationWarning
      className={cn(
        "antialiased",
        fontMono.variable,
        fontDisplay.variable,
        "font-sans",
        inter.variable
      )}
    >
      <body>
        {/* Diseño fijo: fondo negro con texto blanco y azul. */}
        <ThemeProvider forcedTheme="dark">{children}</ThemeProvider>
      </body>
    </html>
  )
}

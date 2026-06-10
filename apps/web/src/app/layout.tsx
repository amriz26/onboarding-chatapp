import type { Metadata } from "next"
import { Inter } from "next/font/google"
import { ThemeProvider } from "@/components/providers/theme-provider"
import "./globals.css"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "Effect MCP Chat",
  description:
    "A production-quality AI chat app built with Effect TS, Next.js, and a Rust MCP server. Demonstrates Effect Schema, Layers, typed errors, and MCP tool integration.",
  keywords: ["Effect TS", "MCP", "AI", "Next.js", "Rust", "Claude"],
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}

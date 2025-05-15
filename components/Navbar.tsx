"use client"

import Link from "next/link"
import { CodeIcon } from "lucide-react"
import { ThemeToggle } from "@/components/theme-toggle"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"

export default function Navbar() {
  const pathname = usePathname()
  
  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/80 backdrop-blur-sm">
      <div className="container flex h-16 items-center justify-between">
        <div className="flex items-center gap-2">
          <Link href="/" className="flex items-center gap-2">
            <div className="rounded-md bg-primary p-1.5">
              <CodeIcon className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="font-semibold text-lg">
              <span className="text-primary">Code</span>Sense
            </span>
          </Link>
        </div>

        <nav className="flex items-center gap-4 sm:gap-6">
          <Link 
            href="/" 
            className={cn(
              "text-sm font-medium transition-colors hover:text-primary",
              pathname === "/" ? "text-primary" : "text-muted-foreground"
            )}
          >
            Home
          </Link>
          <Link 
            href="/dashboard" 
            className={cn(
              "text-sm font-medium transition-colors hover:text-primary",
              pathname === "/dashboard" || pathname.startsWith("/dashboard/") 
                ? "text-primary" 
                : "text-muted-foreground"
            )}
          >
            Dashboard
          </Link>
          <ThemeToggle />
        </nav>
      </div>
    </header>
  )
}
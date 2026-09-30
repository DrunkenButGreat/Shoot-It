import { Scan } from "lucide-react"
import Link from "next/link"

export function BrandMark({ inverse = false }: { inverse?: boolean }) {
  return (
    <Link href="/" className={`inline-flex items-center gap-2.5 font-bold tracking-tight ${inverse ? "text-white" : "text-slate-950"}`}>
      <Scan className="h-7 w-7" strokeWidth={1.8} />
      <span className="text-xl">Shoot-It</span>
    </Link>
  )
}

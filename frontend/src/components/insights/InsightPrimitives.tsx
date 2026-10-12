import type { ReactNode } from 'react'
import { mono } from '../../lib/trading'

// ── Card ─────────────────────────────────────────────────────────────────────

interface CardProps { children: ReactNode; className?: string }

export function Card({ children, className = '' }: CardProps) {
  return (
    <div className={`border border-[#B8943C]/10 rounded-xl bg-[#020810]/60 px-6 py-5 ${className}`}>
      {children}
    </div>
  )
}

// ── SectionLabel ─────────────────────────────────────────────────────────────

interface SectionLabelProps { children: ReactNode }

export function SectionLabel({ children }: SectionLabelProps) {
  return (
    <p className="text-[10px] tracking-[0.22em] text-[#8BA4BE] uppercase mb-3" style={mono}>
      {children}
    </p>
  )
}
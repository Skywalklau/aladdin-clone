import { mono } from '../../lib/dcf'

export function StageBadge({ label, sub }: { label: string; sub: string }) {
  return (
    <div className="flex items-center gap-3 mb-5">
      <div className="flex items-center gap-2">
        <div className="w-1.5 h-1.5 rounded-full bg-[#C9A84C]" />
        <p className="text-[10px] tracking-[0.15em] uppercase text-[#C9A84C]" style={mono}>{label}</p>
      </div>
      <div className="flex-1 h-px bg-[#1A2840]" />
      <p className="text-[10px] text-[#4A6070]" style={mono}>{sub}</p>
    </div>
  )
}
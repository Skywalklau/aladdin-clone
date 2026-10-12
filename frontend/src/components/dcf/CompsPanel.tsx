import { useState, useEffect, useRef } from 'react'
import { mono, fmt } from '../../lib/dcf'
import { fmtBigCap } from '../../lib/formatters'
import type { Financials, CompsData, Summary } from '../../lib/dcf'

// ─────────────────────────────────────────────────────────────────────────────
// CompsPanel — Comparable Company Analysis
//
// Props
//   comps            CompsData   subject + peer Comp objects (multiples from API)
//   financials       Financials  underlying subject financials for bridge arithmetic
//   summary          Summary?    TTM income/cash data; enables P/E, EV/EBITDA, P/S implied prices
//   intrinsic        number      DCF output price — shown in the valuation bridge
//   onPeersChange    fn          callback when user edits peer list (triggers re-fetch in parent)
// ─────────────────────────────────────────────────────────────────────────────

// ── Pure helpers ──────────────────────────────────────────────────────────────

/** Returns only positive, finite values below a plausible cap (filters outliers/errors). */
function validNums(vals: (number | null | undefined)[], cap = 500): number[] {
  return vals.filter((v): v is number => v != null && isFinite(v) && v > 0 && v < cap)
}

/** Population median; returns null for empty arrays. */
function medianOf(nums: number[]): number | null {
  if (!nums.length) return null
  const s   = [...nums].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}

/** Premium of subject vs peer median as a signed percentage string. */
function premiumStr(subject: number, median: number): string {
  const p = ((subject - median) / median) * 100
  return `${p > 0 ? '+' : ''}${p.toFixed(0)}%`
}

/**
 * Derive implied equity price from an EV multiple.
 *   impliedEV = peerMultiple × underlyingMetric
 *   impliedEquity = impliedEV − totalNetDebt
 *   impliedPrice = impliedEquity / shares
 */
function impliedFromEV(
  peerMultiple:     number,
  underlyingMetric: number,
  totalNetDebt:     number,
  shares:           number,
): number | null {
  if (shares <= 0) return null
  const impliedEV     = peerMultiple * underlyingMetric
  const impliedEquity = impliedEV - totalNetDebt
  if (impliedEquity <= 0) return null
  return impliedEquity / shares
}

// ── Sub-components ────────────────────────────────────────────────────────────

function RangeBar({
  peerVals,
  subjectVal,
  median,
}: {
  peerVals:   number[]
  subjectVal: number | null
  median:     number | null
}) {
  const allVals = validNums([...peerVals, subjectVal])
  if (!allVals.length) {
    return <div className="h-4 rounded" style={{ background: '#1A2840', opacity: 0.4 }} />
  }

  const lo   = Math.min(...allVals) * 0.82
  const hi   = Math.max(...allVals) * 1.18
  const span = hi - lo || 1
  const pos  = (v: number) => Math.max(2, Math.min(98, ((v - lo) / span) * 100))

  return (
    <div className="relative select-none" style={{ height: 20 }}>
      <div
        className="absolute rounded-full"
        style={{
          top: '50%', left: '2%', right: '2%', height: 1,
          background: '#1A2840', transform: 'translateY(-50%)',
        }}
      />
      {validNums(peerVals).map((v, i) => (
        <div
          key={i}
          className="absolute rounded-full"
          style={{
            width: 5, height: 5,
            left: `${pos(v)}%`, top: '50%',
            transform: 'translate(-50%, -50%)',
            background: '#3D5570',
            border: '1px solid #506888',
          }}
        />
      ))}
      {median != null && (
        <div
          className="absolute rounded-sm"
          style={{
            width: 2, height: 11,
            left: `${pos(median)}%`, top: '50%',
            transform: 'translate(-50%, -50%)',
            background: '#7EB8E8',
          }}
        />
      )}
      {subjectVal != null && subjectVal > 0 && (
        <div
          className="absolute"
          style={{
            width: 9, height: 9,
            left: `${pos(subjectVal)}%`, top: '50%',
            transform: 'translate(-50%, -50%) rotate(45deg)',
            background: '#C9A84C',
            border: '2px solid #020810',
            zIndex: 10,
          }}
        />
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────

function MultipleCard({
  label,
  desc,
  subjectVal,
  peerVals,
  impliedPrice,
  currentPrice,
}: {
  label:        string
  desc:         string
  subjectVal:   number | null
  peerVals:     (number | null)[]
  impliedPrice: number | null
  currentPrice: number | null
}) {
  const validPeers = validNums(peerVals)
  const med        = medianOf(validPeers)

  const premium =
    subjectVal != null && med != null
      ? ((subjectVal - med) / med) * 100
      : null

  const premiumColor = premium == null ? '#6A8AAA' : premium > 0 ? '#E05252' : '#4CAF85'

  const upside =
    impliedPrice != null && currentPrice != null && currentPrice > 0
      ? ((impliedPrice - currentPrice) / currentPrice) * 100
      : null

  return (
    <div
      className="rounded-xl border border-[#1A2840] flex flex-col gap-3 overflow-hidden"
      style={{ background: 'rgba(10,22,40,0.6)' }}
    >
      <div
        className="h-[1.5px]"
        style={{ background: 'linear-gradient(90deg, rgba(201,168,76,0.4), transparent)' }}
      />

      <div className="px-4 pb-4 flex flex-col gap-3">
        <div>
          <p className="text-[9px] tracking-[0.18em] uppercase text-[#6A8AAA] leading-relaxed" style={mono}>
            {desc}
          </p>
          <p
            className="text-[13px] tracking-[0.08em] uppercase font-semibold"
            style={{ ...mono, color: '#EDE8DF' }}
          >
            {label}
          </p>
        </div>

        {validPeers.length === 0 ? (
          <p className="text-[10px] text-[#6A8AAA]" style={mono}>No peer data available</p>
        ) : (
          <>
            <div className="flex items-end justify-between gap-2">
              <div>
                <p className="text-[8px] tracking-[0.10em] uppercase text-[#6A8AAA] mb-0.5" style={mono}>
                  Subject
                </p>
                <p
                  className="text-[22px] font-semibold leading-none"
                  style={{ ...mono, color: subjectVal != null ? '#EDE8DF' : '#6A8AAA' }}
                >
                  {subjectVal != null ? `${subjectVal.toFixed(1)}×` : 'N/A'}
                </p>
              </div>

              <div className="text-right">
                <p className="text-[8px] tracking-[0.10em] uppercase text-[#6A8AAA] mb-0.5" style={mono}>
                  Peer Median
                </p>
                <p className="text-[14px] font-medium text-[#8BA4BE]" style={mono}>
                  {med != null ? `${med.toFixed(1)}×` : '—'}
                </p>
              </div>

              {premium != null && (
                <div
                  className="px-2 py-1 rounded-lg text-center flex-shrink-0"
                  style={{
                    background: `${premiumColor}20`,
                    border:     `1px solid ${premiumColor}45`,
                  }}
                >
                  <p className="text-[12px] font-semibold" style={{ ...mono, color: premiumColor }}>
                    {premiumStr(subjectVal!, med!)}
                  </p>
                  <p className="text-[8px] text-[#6A8AAA]" style={mono}>
                    {premium > 0 ? 'premium' : 'discount'}
                  </p>
                </div>
              )}
            </div>

            <div>
              <RangeBar peerVals={validPeers} subjectVal={subjectVal} median={med} />
              <div className="flex justify-between mt-1">
                <span className="text-[8px] text-[#6A8AAA]" style={mono}>
                  {`${Math.min(...validPeers).toFixed(1)}×`}
                </span>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1">
                    <div style={{ width: 7, height: 7, background: '#C9A84C', border: '1.5px solid #020810', transform: 'rotate(45deg)', flexShrink: 0 }} />
                    <span className="text-[8px] text-[#6A8AAA]" style={mono}>subject</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div style={{ width: 2, height: 10, background: '#7EB8E8', borderRadius: 1, flexShrink: 0 }} />
                    <span className="text-[8px] text-[#6A8AAA]" style={mono}>median</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div style={{ width: 5, height: 5, background: '#3D5570', border: '1px solid #506888', borderRadius: '50%', flexShrink: 0 }} />
                    <span className="text-[8px] text-[#6A8AAA]" style={mono}>peers</span>
                  </div>
                </div>
                <span className="text-[8px] text-[#6A8AAA]" style={mono}>
                  {`${Math.max(...validPeers).toFixed(1)}×`}
                </span>
              </div>
            </div>

            <div
              className="flex items-center justify-between pt-3"
              style={{ borderTop: '1px solid #1A2840' }}
            >
              <p className="text-[9px] tracking-[0.10em] uppercase text-[#6A8AAA]" style={mono}>
                Implied price
              </p>
              {impliedPrice != null && impliedPrice > 0 ? (
                <div className="flex items-center gap-2">
                  <p className="text-[14px] font-semibold text-[#C9A84C]" style={mono}>
                    {fmt(impliedPrice)}
                  </p>
                  {upside != null && (
                    <span
                      className="text-[10px]"
                      style={{ ...mono, color: upside > 0 ? '#4CAF85' : '#E05252' }}
                    >
                      {upside > 0 ? '▲' : '▼'}{Math.abs(upside).toFixed(1)}%
                    </span>
                  )}
                </div>
              ) : (
                <p className="text-[11px] text-[#6A8AAA]" style={mono}>
                  — needs TTM data
                </p>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────

function ValuationBridge({
  dcfIntrinsic,
  impliedPrices,
  currentPrice,
}: {
  dcfIntrinsic:  number
  impliedPrices: (number | null)[]
  currentPrice:  number | null
}) {
  const validImplied = impliedPrices.filter((v): v is number => v != null && v > 0 && isFinite(v))
  const compsLow     = validImplied.length ? Math.min(...validImplied) : null
  const compsHigh    = validImplied.length ? Math.max(...validImplied) : null
  const compsBlended = validImplied.length
    ? validImplied.reduce((s, v) => s + v, 0) / validImplied.length
    : null

  const rows: { label: string; val: number | null; color: string; dim?: boolean }[] = [
    { label: 'DCF Intrinsic',  val: dcfIntrinsic > 0 ? dcfIntrinsic : null, color: '#C9A84C' },
    { label: 'Comps High',     val: compsHigh,                               color: '#4CAF85' },
    { label: 'Comps Blended',  val: compsBlended,                            color: '#C9A84C' },
    { label: 'Comps Low',      val: compsLow,                                color: '#E8925A' },
    { label: 'Market Price',   val: currentPrice,                            color: '#8BA4BE' },
  ].filter(r => r.val != null && r.val > 0)

  if (rows.length < 2) return null

  const allVals = rows.map(r => r.val!)
  const lo      = Math.min(...allVals) * 0.88
  const hi      = Math.max(...allVals) * 1.12
  const span    = hi - lo || 1
  const pos     = (v: number) => Math.max(2, Math.min(97, ((v - lo) / span) * 100))

  return (
    <div
      className="border border-[#1A2840] rounded-xl overflow-hidden"
      style={{ background: 'rgba(10,22,40,0.4)' }}
    >
      <div className="px-5 py-3.5" style={{ borderBottom: '1px solid #1A2840' }}>
        <p className="text-[11px] tracking-[0.15em] uppercase text-[#8BA4BE]" style={mono}>
          Valuation Bridge · DCF vs Comps
        </p>
        <p className="text-[10px] text-[#6A8AAA] mt-0.5" style={mono}>
          Price targets derived from peer multiples vs DCF assumptions
        </p>
      </div>

      <div className="px-5 py-4 space-y-3">
        {rows.map(r => (
          <div key={r.label} className="flex items-center gap-3">
            <span
              className="text-[10px] w-28 flex-shrink-0"
              style={{ ...mono, color: r.dim ? `${r.color}80` : r.color }}
            >
              {r.label}
            </span>
            <div className="flex-1 relative" style={{ height: 6 }}>
              <div
                className="absolute top-0 left-0 h-full rounded-full"
                style={{ width: `${pos(r.val!)}%`, background: `${r.color}28` }}
              />
              <div
                className="absolute rounded-full"
                style={{
                  width: 8, height: 8,
                  left: `${pos(r.val!)}%`, top: '50%',
                  transform: 'translate(-50%, -50%)',
                  background: r.dim ? `${r.color}60` : r.color,
                  border: '2px solid #020810',
                }}
              />
            </div>
            <span
              className="text-[12px] font-semibold w-20 text-right flex-shrink-0"
              style={{ ...mono, color: r.dim ? `${r.color}80` : r.color }}
            >
              {fmt(r.val!)}
            </span>
          </div>
        ))}

        <div
          className="flex items-center gap-4 pt-2 flex-wrap"
          style={{ borderTop: '1px solid #1A2840' }}
        >
          {[
            { color: '#C9A84C', label: 'DCF intrinsic' },
            { color: '#4CAF85', label: 'Comps high'    },
            { color: '#C9A84C', label: 'Comps blended' },
            { color: '#E8925A', label: 'Comps low'     },
            { color: '#8BA4BE', label: 'Market price'  },
          ].map(l => (
            <div key={l.label} className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full" style={{ background: l.color }} />
              <span className="text-[9px] text-[#6A8AAA]" style={mono}>{l.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────

function PeerTable({
  comps,
  symbol,
  activePeerSymbols,
  onActivePeersChange,
  onPeersChange,
}: {
  comps:                CompsData
  symbol:               string
  activePeerSymbols:    string[]
  onActivePeersChange:  (peers: string[]) => void
  onPeersChange?:       (peers: string[]) => Promise<void> | void
}) {
  const [editing, setEditing]       = useState(false)
  const [snapshot, setSnapshot]     = useState<string[]>([])
  const [fetching, setFetching]     = useState(false)
  const [input, setInput]           = useState('')
  const [suggestion, setSuggestion] = useState<{ symbol: string; name: string } | null>(null)
  const [searching, setSearching]   = useState(false)
  const debounceRef                 = useRef<ReturnType<typeof setTimeout> | null>(null)

  // peers is now the lifted state from the parent — no local copy needed
  const peers = activePeerSymbols

  const handleInputChange = (val: string) => {
    setInput(val)
    setSuggestion(null)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!val.trim()) { setSearching(false); return }

    setSearching(true)
    debounceRef.current = setTimeout(async () => {
      try {
        const res  = await fetch(`/api/stocks/search?q=${encodeURIComponent(val.trim())}`)
        const data = await res.json()
        const hit  = data?.result?.find(
          (r: { symbol: string; type: string; description: string }) =>
            r.type === 'Common Stock' &&
            !peers.includes(r.symbol.toUpperCase()) &&
            r.symbol.toUpperCase() !== symbol.toUpperCase()
        )
        setSuggestion(hit ? { symbol: hit.symbol, name: hit.description } : null)
      } catch {
        setSuggestion(null)
      } finally {
        setSearching(false)
      }
    }, 350)
  }

  const addPeer = (sym: string) => {
    const upper = sym.toUpperCase()
    if (!peers.includes(upper)) onActivePeersChange([...peers, upper])
    setInput('')
    setSuggestion(null)
  }

  const removePeer = (sym: string) => onActivePeersChange(peers.filter(p => p !== sym))

  const handleApply = async () => {
    setEditing(false)
    setInput('')
    setSuggestion(null)
    if (onPeersChange) {
      setFetching(true)
      await onPeersChange(peers)
      setFetching(false)
    }
  }

  const handleCancel = () => {
    onActivePeersChange(snapshot)
    setInput('')
    setSuggestion(null)
    setEditing(false)
  }

  const handleReset = () => {
    onActivePeersChange(comps.peers.map(p => p.symbol))
    setInput('')
    setSuggestion(null)
  }

  // Peers added in this edit session but not yet fetched from the API
  const pendingPeers = peers.filter(p => !comps.peers.find(c => c.symbol === p))

  const rows = [
    comps.subject,
    ...comps.peers.filter(p => activePeerSymbols.includes(p.symbol)),
    // Show pending peers immediately as placeholder rows (multiples filled once Apply is hit)
    ...pendingPeers.map(sym => ({
      symbol:     sym,
      name:       'Pending…',
      market_cap: null as number | null,
      ev_ebitda:  null as number | null,
      pe:         null as number | null,
      ev_fcf:     null as number | null,
      ps:         null as number | null,
    })),
  ].sort((a, b) => (b.market_cap ?? 0) - (a.market_cap ?? 0))

  const fmtX   = (v: number | null) =>
    v != null && isFinite(v) && v > 0 ? `${v.toFixed(1)}×` : '—'
  const fmtCap = (v: number | null) =>
    v != null ? fmtBigCap(v) : '—'

  return (
    <div
      className="border border-[#1A2840] rounded-xl overflow-hidden"
      style={{ background: 'rgba(10,22,40,0.6)' }}
    >
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      {/* Header */}
      <div
        className="px-5 py-3.5 flex items-center justify-between"
        style={{ borderBottom: '1px solid #1E3050' }}
      >
        <div>
          <p className="text-[11px] tracking-[0.15em] uppercase text-[#8BA4BE]" style={mono}>
            Peer Set · {peers.length} companies
          </p>
          <p className="text-[10px] text-[#6A8AAA] mt-0.5" style={mono}>
            Sorted by market cap · multiples are trailing twelve months
          </p>
        </div>

        <div className="flex items-center gap-2">
          {editing ? (
            <>
              <button
                onClick={handleCancel}
                className="text-[9px] tracking-[0.12em] uppercase px-2.5 py-1 rounded-lg border"
                style={{ ...mono, color: '#6A8AAA', borderColor: '#1A2840' }}
              >
                Cancel
              </button>
              <button
                onClick={handleReset}
                className="text-[9px] tracking-[0.12em] uppercase px-2.5 py-1 rounded-lg border"
                style={{ ...mono, color: '#6A8AAA', borderColor: '#1A2840' }}
              >
                Reset
              </button>
              <button
                onClick={() => onActivePeersChange([])}
                className="text-[9px] tracking-[0.12em] uppercase px-2.5 py-1 rounded-lg border"
                style={{ ...mono, color: '#E05252', borderColor: 'rgba(224,82,82,0.25)', background: 'rgba(224,82,82,0.06)' }}
              >
                Clear All
              </button>
              <button
                onClick={handleApply}
                disabled={fetching}
                className="text-[9px] tracking-[0.12em] uppercase px-2.5 py-1 rounded-lg border flex items-center gap-1.5"
                style={{
                  ...mono,
                  color:      fetching ? 'rgba(201,168,76,0.5)' : '#C9A84C',
                  borderColor:'rgba(201,168,76,0.3)',
                  background: 'rgba(201,168,76,0.08)',
                  cursor:     fetching ? 'not-allowed' : 'pointer',
                }}
              >
                {fetching && (
                  <span
                    style={{
                      display: 'inline-block', width: 8, height: 8,
                      border: '1.5px solid rgba(201,168,76,0.3)',
                      borderTopColor: '#C9A84C',
                      borderRadius: '50%',
                      animation: 'spin 0.7s linear infinite',
                    }}
                  />
                )}
                {fetching ? 'Fetching…' : 'Apply'}
              </button>
            </>
          ) : (
            <button
              onClick={() => { setSnapshot(peers); setEditing(true) }}
              className="text-[9px] tracking-[0.12em] uppercase px-2.5 py-1 rounded-lg border transition-colors"
              style={{ ...mono, color: '#6A8AAA', borderColor: '#1A2840' }}
            >
              Edit Peers
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-[11px]" style={mono}>
          <thead>
            <tr style={{ borderBottom: '1px solid #1E3050', background: 'rgba(255,255,255,0.02)' }}>
              {['Company', 'Mkt Cap', 'EV/EBITDA', 'P/E', 'EV/FCF', 'P/S'].map((h, i) => (
                <th
                  key={h}
                  className={`py-2.5 font-normal text-[9px] tracking-[0.12em] uppercase whitespace-nowrap ${i === 0 ? 'text-left pl-5 pr-3' : 'text-right px-3'}`}
                  style={{ color: '#6A8AAA' }}
                >
                  {h}
                </th>
              ))}
              {/* Extra column for remove button */}
              {editing && <th className="w-8" />}
            </tr>
          </thead>
          <tbody>
            {/* Add row — only in edit mode, shown at the top */}
            {editing && (
              <tr style={{ borderBottom: '1px solid #1E3050', background: 'rgba(201,168,76,0.02)' }}>
                <td colSpan={7} className="px-5 py-3">
                  <div className="flex items-center gap-3">

                    <div className="relative flex-1">
                      <input
                        value={input}
                        onChange={e => handleInputChange(e.target.value.toUpperCase())}
                        onKeyDown={e => {
                          if (e.key === 'Enter' && suggestion) addPeer(suggestion.symbol)
                          if (e.key === 'Escape') { setInput(''); setSuggestion(null) }
                        }}
                        placeholder="Search ticker or company name…"
                        className="w-full bg-transparent text-[11px] outline-none border-b pb-1"
                        style={{ ...mono, color: '#EDE8DF', borderColor: '#1A2840' }}
                        autoFocus
                      />

                      {/* Dropdown */}
                      {(searching || suggestion) && (
                        <div
                          className="absolute top-full left-0 right-0 mt-1 rounded-lg border z-20 overflow-hidden"
                          style={{ background: '#0A1628', borderColor: '#1A2840' }}
                        >
                          {searching && !suggestion && (
                            <div className="px-3 py-2.5 text-[10px] text-[#4A6070]" style={mono}>
                              Searching…
                            </div>
                          )}
                          {suggestion && (
                            <button
                              onMouseDown={e => { e.preventDefault(); addPeer(suggestion.symbol) }}
                              className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-white/5 transition-colors"
                            >
                              <span className="text-[11px] font-semibold text-[#C9A84C]" style={mono}>
                                {suggestion.symbol}
                              </span>
                              <span className="text-[10px] text-[#6A8AAA]" style={mono}>
                                {suggestion.name}
                              </span>
                              <span className="ml-auto text-[9px] text-[#4A6070] flex-shrink-0" style={mono}>
                                Enter to add
                              </span>
                            </button>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Add button */}
                    <button
                      onMouseDown={e => { e.preventDefault(); if (suggestion) addPeer(suggestion.symbol) }}
                      disabled={!suggestion}
                      className="flex-shrink-0 text-[9px] tracking-[0.12em] uppercase px-2.5 py-1 rounded-lg border transition-colors"
                      style={{
                        ...mono,
                        color:       suggestion ? '#C9A84C' : '#4A6070',
                        borderColor: suggestion ? 'rgba(201,168,76,0.3)' : '#1A2840',
                        background:  suggestion ? 'rgba(201,168,76,0.08)' : 'transparent',
                        cursor:      suggestion ? 'pointer' : 'not-allowed',
                      }}
                    >
                      Add
                    </button>
                  </div>

                  {/* Hint */}
                  <p className="text-[9px] text-[#4A6070] mt-1.5 pl-8" style={mono}>
                    Type a ticker or name · press Enter or click Add
                  </p>
                </td>
              </tr>
            )}

            {rows.map((comp, idx) => {
              const isSubject = comp.symbol === comps.subject.symbol
              return (
                <tr
                  key={comp.symbol}
                  style={{
                    borderBottom: '1px solid rgba(30,48,80,0.7)',
                    background:   isSubject
                      ? 'rgba(201,168,76,0.06)'
                      : idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.015)',
                  }}
                >
                  <td className="pl-5 pr-3 py-2.5">
                    <div className="flex items-center gap-2">
                      {isSubject && (
                        <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: '#C9A84C' }} />
                      )}
                      <div>
                        <span className="font-semibold" style={{ color: isSubject ? '#C9A84C' : '#B0C8E0' }}>
                          {comp.symbol}
                        </span>
                        <span className="text-[10px] ml-2" style={{ color: '#6A8AAA' }}>
                          {comp.name.length > 22 ? `${comp.name.slice(0, 22)}…` : comp.name}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td className="text-right px-3 py-2.5" style={{ color: '#6A8AAA' }}>
                    {fmtCap(comp.market_cap)}
                  </td>
                  {(['ev_ebitda', 'pe', 'ev_fcf', 'ps'] as const).map(k => (
                    <td
                      key={k}
                      className="text-right px-3 py-2.5 font-medium"
                      style={{ color: isSubject ? '#C9A84C' : '#A8C4DC' }}
                    >
                      {fmtX(comp[k])}
                    </td>
                  ))}
                  {editing && (
                    <td className="pr-3 py-2.5 text-right">
                      {!isSubject && (
                        <button
                          onClick={() => removePeer(comp.symbol)}
                          className="transition-opacity text-[10px] leading-none"
                          style={{ color: '#E05252', opacity: 0.5 }}
                          onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
                          onMouseLeave={e => (e.currentTarget.style.opacity = '0.5')}
                        >
                          ✕
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main export
// ─────────────────────────────────────────────────────────────────────────────

export function CompsPanel({
  comps,
  financials,
  summary = null,
  intrinsic,
  onPeersChange,
}: {
  comps:           CompsData
  financials:      Financials
  summary?:        Summary | null
  intrinsic:       number
  onPeersChange?:  (peers: string[]) => Promise<void> | void
}) {
  const { subject } = comps

  // Lifted state — shared by MultipleCards and PeerTable so edits update both
  const [activePeerSymbols, setActivePeerSymbols] = useState<string[]>(
    () => comps.peers.map(p => p.symbol)
  )

  // Only reset the active peer list when the subject stock itself changes
  // (e.g. user navigates to a different company). This prevents any parent
  // re-render — triggered by add/remove edits — from wiping local changes mid-session.
  useEffect(() => {
    setActivePeerSymbols(comps.peers.map(p => p.symbol))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [comps.subject.symbol])

  // Only include peers that are currently active (respects live removals)
  const activePeers = comps.peers.filter(p => activePeerSymbols.includes(p.symbol))

  const netDebt     = (financials.total_debt ?? 0) - (financials.cash_and_equivalents ?? 0)
  const totalBridge = netDebt + (financials.minority_interest ?? 0) + (financials.preferred_stock ?? 0)
  const shares      = financials.shares_outstanding ?? 0
  const fcf         = financials.free_cash_flow
  const price       = financials.current_price

  const peerEvEbitda = activePeers.map(p => p.ev_ebitda)
  const peerPE       = activePeers.map(p => p.pe)
  const peerEvFCF    = activePeers.map(p => p.ev_fcf)
  const peerPS       = activePeers.map(p => p.ps)

  const medEvEbitda = medianOf(validNums(peerEvEbitda))
  const medPE       = medianOf(validNums(peerPE))
  const medEvFCF    = medianOf(validNums(peerEvFCF))
  const medPS       = medianOf(validNums(peerPS))

  const implEvFCF = medEvFCF != null && fcf != null && shares > 0
    ? impliedFromEV(medEvFCF, fcf, totalBridge, shares)
    : null

  const implEvEbitda = medEvEbitda != null && summary?.ebitda_ttm && shares > 0
    ? impliedFromEV(medEvEbitda, summary.ebitda_ttm, totalBridge, shares)
    : null

  const implPE = medPE != null && summary?.eps_ttm
    ? medPE * summary.eps_ttm
    : null

  const implPS = medPS != null && summary?.revenue_ttm && shares > 0
    ? (medPS * summary.revenue_ttm) / shares
    : null

  const allImplied   = [implEvFCF, implEvEbitda, implPE, implPS]
  const validImplied = allImplied.filter((v): v is number => v != null && v > 0)
  const compsBlended = validImplied.length
    ? validImplied.reduce((s, v) => s + v, 0) / validImplied.length
    : null

  const metrics = [
    {
      key:          'ev_fcf',
      label:        'EV / FCF',
      desc:         'Enterprise value to free cash flow — strongest cash-quality signal',
      subjectVal:   subject.ev_fcf,
      peerVals:     peerEvFCF,
      impliedPrice: implEvFCF,
    },
    {
      key:          'ev_ebitda',
      label:        'EV / EBITDA',
      desc:         'Enterprise value to EBITDA — capital-structure-neutral earnings',
      subjectVal:   subject.ev_ebitda,
      peerVals:     peerEvEbitda,
      impliedPrice: implEvEbitda,
    },
    {
      key:          'pe',
      label:        'P / E',
      desc:         'Price to trailing 12-month diluted earnings per share',
      subjectVal:   subject.pe,
      peerVals:     peerPE,
      impliedPrice: implPE,
    },
    {
      key:          'ps',
      label:        'P / S',
      desc:         'Price to sales — useful for early-stage or low-margin peers',
      subjectVal:   subject.ps,
      peerVals:     peerPS,
      impliedPrice: implPS,
    },
  ]

  return (
    <div className="space-y-5">
      {/* Panel header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <p
            className="text-[11px] tracking-[0.15em] uppercase text-[#8BA4BE]"
            style={mono}
          >
            Comparable Company Analysis
          </p>
          <p className="text-[10px] text-[#6A8AAA] mt-0.5" style={mono}>
            {activePeers.length} peer{activePeers.length !== 1 ? 's' : ''} · EV multiples vs sector ·
            {!summary
              ? ' pass summary prop to unlock P/E, EV/EBITDA & P/S implied prices'
              : ' all four implied prices active'}
          </p>
        </div>

        {compsBlended != null && (
          <div className="text-right flex-shrink-0">
            <p
              className="text-[9px] tracking-[0.12em] uppercase text-[#6A8AAA]"
              style={mono}
            >
              Comps Blended
            </p>
            <p className="text-[22px] font-semibold text-[#4CAF85] leading-none mt-0.5" style={mono}>
              {fmt(compsBlended)}
            </p>
            <p className="text-[9px] text-[#6A8AAA] mt-0.5" style={mono}>
              avg of {validImplied.length} implied
            </p>
          </div>
        )}
      </div>

      {/* 2 × 2 multiple grid */}
      <div className="grid grid-cols-2 gap-3">
        {metrics.map(m => (
          <MultipleCard
            key={m.key}
            label={m.label}
            desc={m.desc}
            subjectVal={m.subjectVal}
            peerVals={m.peerVals}
            impliedPrice={m.impliedPrice}
            currentPrice={price}
          />
        ))}
      </div>

      {/* Valuation bridge */}
      <ValuationBridge
        dcfIntrinsic={intrinsic}
        impliedPrices={allImplied}
        currentPrice={price}
      />

      {/* Peer table */}
      <PeerTable
        comps={comps}
        symbol={subject.symbol}
        activePeerSymbols={activePeerSymbols}
        onActivePeersChange={setActivePeerSymbols}
        onPeersChange={onPeersChange}
      />
    </div>
  )
}
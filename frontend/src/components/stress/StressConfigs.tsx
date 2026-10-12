import { useState, useEffect } from 'react'
import {
  getMarketCrash, getSectorShock, getMultiSectorShock, getInterestRate,
  getHistoricalScenario, getHistoricalScenarios, runCustomScenario,
  getReverseStress, getComprehensive,
} from '../../api/stress'
import type { HistoricalScenarioMeta } from '../../types'
import { mono, sans, fmtPct, ALL_SECTORS } from '../../lib/stress'
import type { ConfigProps } from '../../lib/stress'
import { SectionLabel } from './shared'

// ─── Local primitives (only used by configs) ───────────────────────────────────
const inputCls  = "w-full bg-[#0A1628]/80 border border-[#B8943C]/15 text-[#EDE8DF] rounded-md px-3.5 py-2.5 text-[12px] outline-none focus:border-[#C9A84C]/50 focus:ring-2 focus:ring-[#C9A84C]/[0.07] transition-all placeholder:text-[#1A2C42]"
const selectCls = "w-full bg-[#0A1628]/80 border border-[#B8943C]/15 text-[#EDE8DF] rounded-md px-3.5 py-2.5 text-[12px] outline-none focus:border-[#C9A84C]/50 transition-all appearance-none cursor-pointer"

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-3 cursor-pointer group" onClick={() => onChange(!checked)}>
      <div className="relative w-9 h-5 rounded-full transition-all flex-shrink-0"
        style={{ background: checked ? 'linear-gradient(135deg,#C9A84C,#A8892E)' : 'rgba(30,50,70,0.8)', border: '1px solid rgba(184,148,60,0.2)' }}>
        <div className={`absolute top-0.5 w-3.5 h-3.5 bg-[#EDE8DF] rounded-full shadow transition-transform duration-200 ${checked ? 'translate-x-4' : 'translate-x-0.5'}`} />
      </div>
      <span className="text-[11px] text-[#8BA4BE] group-hover:text-[#EDE8DF] transition-colors" style={sans}>{label}</span>
    </label>
  )
}

function SliderInput({ label, value, onChange, min, max, step = 1, format }: {
  label: string; value: number; onChange: (v: number) => void
  min: number; max: number; step?: number; format?: (v: number) => string
}) {
  const pct = ((value - min) / (max - min)) * 100
  return (
    <div>
      <div className="flex justify-between mb-2">
        <label className="text-[10px] tracking-[0.12em] uppercase text-[#8BA4BE]" style={mono}>{label}</label>
        <span className="text-[11px] font-medium text-[#C9A84C]" style={mono}>{format ? format(value) : value}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full h-1 rounded-full appearance-none cursor-pointer"
        style={{ background: `linear-gradient(to right, #C9A84C ${pct}%, rgba(10,22,40,0.9) 0%)` }} />
    </div>
  )
}

export function RunButton({ onClick, loading, disabled, label = 'Run Stress Test' }: {
  onClick: () => void; loading: boolean; disabled?: boolean; label?: string
}) {
  return (
    <button onClick={onClick} disabled={loading || disabled}
      className="w-full py-2.5 rounded-md text-[11px] font-medium tracking-[0.2em] uppercase text-[#020810] hover:opacity-90 hover:-translate-y-px active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer flex items-center justify-center gap-2"
      style={{ ...mono, background: 'linear-gradient(135deg,#C9A84C 0%,#A8892E 100%)' }}>
      {loading
        ? <><span className="w-3.5 h-3.5 border border-[#020810]/30 border-t-[#020810] rounded-full animate-spin" />Computing…</>
        : label}
    </button>
  )
}

// ─── Config components ─────────────────────────────────────────────────────────
export function MarketCrashConfig({ portfolioId, onResult, loading, setLoading, setError }: ConfigProps) {
  const [severity, setSeverity] = useState<'mild' | 'moderate' | 'severe'>('moderate')
  const opts = [
    { val: 'mild'     as const, label: 'Mild',     desc: '~10%', color: '#C9A84C' },
    { val: 'moderate' as const, label: 'Moderate', desc: '~20%', color: '#E07B52' },
    { val: 'severe'   as const, label: 'Severe',   desc: '~35%', color: '#E05252' },
  ]
  const run = async () => {
    setLoading(true); setError('')
    try { onResult({ type: 'stress', data: (await getMarketCrash(portfolioId, severity)).data }) }
    catch (e: any) { setError(e.response?.data?.detail || 'Request failed') }
    finally { setLoading(false) }
  }
  return (
    <div className="space-y-5">
      <p className="text-[11px] text-[#A8BDD0]" style={sans}>Beta-adjusted decline across all positions.</p>
      <div>
        <SectionLabel>Severity</SectionLabel>
        <div className="grid grid-cols-3 gap-2">
          {opts.map(o => (
            <button key={o.val} onClick={() => setSeverity(o.val)}
              className="p-3 rounded-lg border text-left transition-all cursor-pointer"
              style={{ borderColor: severity === o.val ? o.color : 'rgba(184,148,60,0.12)', background: severity === o.val ? `${o.color}0D` : 'rgba(2,8,16,0.4)' }}>
              <p className="text-[11px] font-medium text-[#EDE8DF] mb-0.5" style={mono}>{o.label}</p>
              <p className="text-[9px] text-[#8BA4BE]" style={mono}>{o.desc}</p>
            </button>
          ))}
        </div>
      </div>
      <RunButton onClick={run} loading={loading} />
    </div>
  )
}

export function SectorShockConfig({ portfolioId, onResult, loading, setLoading, setError, sectors }: ConfigProps) {
  const [sector, setSector]       = useState('Technology')
  const [shock, setShock]         = useState(-30)
  const [useBeta, setUseBeta]     = useState(true)
  const [useCorr, setUseCorr]     = useState(true)
  const [spillover, setSpillover] = useState(0.4)
  const run = async () => {
    setLoading(true); setError('')
    try { onResult({ type: 'stress', data: (await getSectorShock(portfolioId, { sector, shock_pct: shock / 100, use_sector_beta: useBeta, use_correlations: useCorr, correlation_spillover: spillover })).data }) }
    catch (e: any) { setError(e.response?.data?.detail || 'Request failed') }
    finally { setLoading(false) }
  }
  return (
    <div className="space-y-5">
      <p className="text-[11px] text-[#A8BDD0]" style={sans}>Shock one sector, observe spillover effects.</p>
      <div>
        <SectionLabel>Target Sector</SectionLabel>
        <div className="relative">
          <select value={sector} onChange={e => setSector(e.target.value)} className={selectCls} style={mono}>
            {(sectors.length ? sectors : ALL_SECTORS).map(s => <option key={s}>{s}</option>)}
          </select>
          <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#8BA4BE] pointer-events-none text-[10px]" style={mono}>▾</span>
        </div>
      </div>
      <SliderInput label="Sector Shock"          value={shock}          onChange={setShock}              min={-80} max={50}  format={v => `${v > 0 ? '+' : ''}${v}%`} />
      <SliderInput label="Correlation Spillover" value={spillover * 100} onChange={v => setSpillover(v / 100)} min={0}   max={100} step={5} format={v => `${v}%`} />
      <div className="space-y-3">
        <Toggle label="Sector beta adjustment" checked={useBeta} onChange={setUseBeta} />
        <Toggle label="Correlation spillover"  checked={useCorr} onChange={setUseCorr} />
      </div>
      <RunButton onClick={run} loading={loading} />
    </div>
  )
}

export function MultiSectorConfig({ portfolioId, onResult, loading, setLoading, setError, sectors }: ConfigProps) {
  const [rows, setRows] = useState([
    { sector: 'Technology',        shockStr: '-30', invalid: false },
    { sector: 'Financial Services', shockStr: '-40', invalid: false },
  ])
  const [useBeta, setUseBeta]     = useState(true)
  const [useCorr, setUseCorr]     = useState(true)
  const [spillover, setSpillover] = useState(0.4)

  const addRow    = () => setRows(r => [...r, { sector: 'Energy', shockStr: '-20', invalid: false }])
  const removeRow = (i: number) => setRows(r => r.filter((_, idx) => idx !== i))
  const updateShock = (i: number, val: string) => {
    const num     = parseFloat(val)
    const invalid = val !== '' && val !== '-' && (isNaN(num) || num < -100 || num > 100)
    setRows(r => r.map((x, idx) => idx === i ? { ...x, shockStr: val, invalid } : x))
  }
  const run = async () => {
    const validated = rows.map(r => ({ ...r, invalid: isNaN(parseFloat(r.shockStr)) }))
    if (validated.some(r => r.invalid)) { setRows(validated); return }
    const sectorsStr = rows.map(r => `${r.sector}:${(parseFloat(r.shockStr) / 100).toFixed(2)}`).join(',')
    setLoading(true); setError('')
    try { onResult({ type: 'stress', data: (await getMultiSectorShock(portfolioId, { sectors: sectorsStr, use_sector_beta: useBeta, use_correlations: useCorr, correlation_spillover: spillover })).data }) }
    catch (e: any) { setError(e.response?.data?.detail || 'Request failed') }
    finally { setLoading(false) }
  }
  return (
    <div className="space-y-5">
      <p className="text-[11px] text-[#A8BDD0]" style={sans}>Simultaneous shocks to model contagion.</p>
      <div>
        <SectionLabel>Sectors &amp; Shocks</SectionLabel>
        <div className="space-y-2">
          {rows.map((row, i) => (
            <div key={i} className="flex gap-2 items-center">
              <div className="flex-1 relative">
                <select value={row.sector} onChange={e => setRows(r => r.map((x, idx) => idx === i ? { ...x, sector: e.target.value } : x))} className={selectCls} style={mono}>
                  {(sectors.length ? sectors : ALL_SECTORS).map(s => <option key={s}>{s}</option>)}
                </select>
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8BA4BE] pointer-events-none text-[10px]" style={mono}>▾</span>
              </div>
              <input type="text" inputMode="numeric" value={row.shockStr} onChange={e => updateShock(i, e.target.value)} placeholder="-30"
                className="w-16 bg-[#0A1628]/80 rounded-md px-2.5 py-2.5 text-[11px] text-center outline-none transition-all"
                style={{ ...mono, color: row.invalid ? '#E05252' : '#EDE8DF', border: `1px solid ${row.invalid ? 'rgba(224,82,82,0.4)' : 'rgba(184,148,60,0.15)'}` }} />
              <span className="text-[10px] text-[#8BA4BE]" style={mono}>%</span>
              <button onClick={() => removeRow(i)} className="text-[#8BA4BE] hover:text-[#E05252] transition-colors text-[16px] leading-none px-1">×</button>
            </div>
          ))}
        </div>
        <button onClick={addRow} className="text-[10px] tracking-[0.1em] uppercase text-[#C9A84C] hover:opacity-80 transition-opacity mt-2.5" style={mono}>+ Add sector</button>
      </div>
      <SliderInput label="Correlation Spillover" value={spillover * 100} onChange={v => setSpillover(v / 100)} min={0} max={100} step={5} format={v => `${v}%`} />
      <div className="space-y-3">
        <Toggle label="Sector beta adjustment" checked={useBeta} onChange={setUseBeta} />
        <Toggle label="Correlation spillover"  checked={useCorr} onChange={setUseCorr} />
      </div>
      <RunButton onClick={run} loading={loading} />
    </div>
  )
}

export function InterestRateConfig({ portfolioId, onResult, loading, setLoading, setError }: ConfigProps) {
  const [bps, setBps]           = useState(200)
  const [duration, setDuration] = useState(17)
  const presets = [-200, -100, 100, 200, 300]
  const run = async () => {
    setLoading(true); setError('')
    try { onResult({ type: 'stress', data: (await getInterestRate(portfolioId, { rate_change_bps: bps, bond_duration: duration, max_shock: 0.8, min_shock: -0.8 })).data }) }
    catch (e: any) { setError(e.response?.data?.detail || 'Request failed') }
    finally { setLoading(false) }
  }
  return (
    <div className="space-y-5">
      <p className="text-[11px] text-[#A8BDD0]" style={sans}>Duration-based sensitivity. Financials benefit; growth stocks suffer.</p>
      <div>
        <SectionLabel>Presets</SectionLabel>
        <div className="flex flex-wrap gap-1.5">
          {presets.map(p => (
            <button key={p} onClick={() => setBps(p)}
              className="px-3 py-1.5 rounded-md text-[10px] font-medium border transition-all cursor-pointer"
              style={{ ...mono, borderColor: bps === p ? (p < 0 ? 'rgba(76,175,133,0.5)' : 'rgba(224,82,82,0.5)') : 'rgba(184,148,60,0.15)', color: bps === p ? (p < 0 ? '#4CAF85' : '#E05252') : '#8BA4BE', background: bps === p ? (p < 0 ? 'rgba(76,175,133,0.08)' : 'rgba(224,82,82,0.08)') : 'transparent' }}>
              {p > 0 ? '+' : ''}{p} bps
            </button>
          ))}
        </div>
      </div>
      <SliderInput label="Rate Change"   value={bps}      onChange={setBps}      min={-400} max={400} step={25} format={v => `${v > 0 ? '+' : ''}${v} bps`} />
      <SliderInput label="Bond Duration" value={duration} onChange={setDuration} min={1}    max={30}            format={v => `${v} yrs`} />
      <RunButton onClick={run} loading={loading} />
    </div>
  )
}

export function HistoricalConfig({ portfolioId, onResult, loading, setLoading, setError }: ConfigProps) {
  const [scenarios, setScenarios] = useState<HistoricalScenarioMeta[]>([])
  const [selected, setSelected]   = useState('')

  useEffect(() => {
    getHistoricalScenarios().then(r => {
      setScenarios(r.data)
      if (r.data.length) setSelected(r.data[0].scenario_id)
    })
  }, [])

  const run = async () => {
    if (!selected) return
    setLoading(true); setError('')
    try { onResult({ type: 'stress', data: (await getHistoricalScenario(portfolioId, selected)).data }) }
    catch (e: any) { setError(e.response?.data?.detail || 'Request failed') }
    finally { setLoading(false) }
  }
  return (
    <div className="space-y-4">
      <p className="text-[11px] text-[#A8BDD0]" style={sans}>Replay actual market crises against your portfolio.</p>
      <SectionLabel>Select Crisis</SectionLabel>
      <div className="space-y-1.5">
        {scenarios.map(s => (
          <button key={s.scenario_id} onClick={() => setSelected(s.scenario_id)}
            className="w-full p-3.5 rounded-lg border text-left transition-all cursor-pointer"
            style={{ borderColor: selected === s.scenario_id ? 'rgba(201,168,76,0.4)' : 'rgba(184,148,60,0.1)', background: selected === s.scenario_id ? 'rgba(201,168,76,0.06)' : 'rgba(2,8,16,0.4)' }}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] font-medium text-[#EDE8DF]" style={mono}>{s.name}</p>
                <p className="text-[9px] text-[#8BA4BE] mt-0.5" style={mono}>{s.start_date} → {s.end_date}</p>
              </div>
              <div className="text-right ml-3 flex-shrink-0">
                <p className="text-[12px] font-bold text-[#E05252]" style={mono}>{fmtPct(s.sp500_decline * 100)}</p>
                <p className="text-[9px] text-[#8BA4BE]" style={mono}>S&P 500</p>
              </div>
            </div>
          </button>
        ))}
      </div>
      <RunButton onClick={run} loading={loading} disabled={!selected} />
    </div>
  )
}

export function CustomConfig({ portfolioId, onResult, loading, setLoading, setError }: ConfigProps) {
  const [name, setName]               = useState('My Custom Scenario')
  const [rows, setRows]               = useState([{ ticker: 'GOOGL', shock: -35 }])
  const [marketShock, setMarketShock] = useState(0)
  const [applyCorr, setApplyCorr]     = useState(true)
  const [spillover, setSpillover]     = useState(0.5)

  const addRow    = () => setRows(r => [...r, { ticker: '', shock: -20 }])
  const removeRow = (i: number) => setRows(r => r.filter((_, idx) => idx !== i))

  const run = async () => {
    const shocks: Record<string, number> = {}
    rows.filter(r => r.ticker).forEach(r => { shocks[r.ticker.toUpperCase()] = r.shock / 100 })
    setLoading(true); setError('')
    try { onResult({ type: 'stress', data: (await runCustomScenario(portfolioId, { scenario_name: name, shocks, market_shock: marketShock / 100, apply_correlations: applyCorr, correlation_spillover: spillover })).data }) }
    catch (e: any) { setError(e.response?.data?.detail || 'Request failed') }
    finally { setLoading(false) }
  }
  return (
    <div className="space-y-5">
      <p className="text-[11px] text-[#A8BDD0]" style={sans}>Per-ticker shocks with optional market-wide component.</p>
      <div>
        <SectionLabel>Scenario Name</SectionLabel>
        <input value={name} onChange={e => setName(e.target.value)} className={inputCls} style={mono} />
      </div>
      <div>
        <SectionLabel>Per-Ticker Shocks</SectionLabel>
        <div className="space-y-2">
          {rows.map((row, i) => (
            <div key={i} className="flex gap-2 items-center">
              <input value={row.ticker} onChange={e => setRows(r => r.map((x, idx) => idx === i ? { ...x, ticker: e.target.value } : x))} placeholder="TICKER"
                className="w-20 bg-[#0A1628]/80 border border-[#B8943C]/15 text-[#C9A84C] rounded-md px-2.5 py-2.5 text-[11px] outline-none focus:border-[#C9A84C]/50 uppercase tracking-widest" style={mono} />
              <input type="number" value={row.shock} min={-100} max={100}
                onChange={e => setRows(r => r.map((x, idx) => idx === i ? { ...x, shock: Number(e.target.value) } : x))}
                className="flex-1 bg-[#0A1628]/80 border border-[#B8943C]/15 text-[#EDE8DF] rounded-md px-2.5 py-2.5 text-[11px] outline-none focus:border-[#C9A84C]/50" style={mono} />
              <span className="text-[10px] text-[#8BA4BE] flex-shrink-0" style={mono}>%</span>
              <button onClick={() => removeRow(i)} className="text-[#8BA4BE] hover:text-[#E05252] transition-colors text-[16px] px-1">×</button>
            </div>
          ))}
        </div>
        <button onClick={addRow} className="text-[10px] tracking-[0.1em] uppercase text-[#C9A84C] hover:opacity-80 transition-opacity mt-2.5" style={mono}>+ Add ticker</button>
      </div>
      <SliderInput label="Market-Wide Shock"     value={marketShock}    onChange={setMarketShock}        min={-50} max={20}  format={v => `${v > 0 ? '+' : ''}${v}%`} />
      <SliderInput label="Correlation Spillover"  value={spillover * 100} onChange={v => setSpillover(v / 100)} min={0}   max={100} step={5} format={v => `${v}%`} />
      <Toggle label="Apply correlation spillover" checked={applyCorr} onChange={setApplyCorr} />
      <RunButton onClick={run} loading={loading} />
    </div>
  )
}

export function ReverseConfig({ portfolioId, onResult, loading, setLoading, setError }: ConfigProps) {
  const [target, setTarget] = useState(20)
  const presets = [10, 15, 20, 25, 30, 40, 50]
  const run = async () => {
    setLoading(true); setError('')
    try { onResult({ type: 'reverse', data: (await getReverseStress(portfolioId, target / 100)).data }) }
    catch (e: any) { setError(e.response?.data?.detail || 'Request failed') }
    finally { setLoading(false) }
  }
  return (
    <div className="space-y-5">
      <p className="text-[11px] text-[#A8BDD0]" style={sans}>Find what market shock causes a specific loss level.</p>
      <div>
        <SectionLabel>Loss Target Presets</SectionLabel>
        <div className="flex flex-wrap gap-1.5">
          {presets.map(p => (
            <button key={p} onClick={() => setTarget(p)}
              className="px-3 py-1.5 rounded-md text-[10px] font-medium border transition-all cursor-pointer"
              style={{ ...mono, borderColor: target === p ? 'rgba(224,82,82,0.5)' : 'rgba(184,148,60,0.15)', color: target === p ? '#E05252' : '#8BA4BE', background: target === p ? 'rgba(224,82,82,0.08)' : 'transparent' }}>
              −{p}%
            </button>
          ))}
        </div>
      </div>
      <SliderInput label="Target Portfolio Loss" value={target} onChange={setTarget} min={5} max={70} format={v => `−${v}%`} />
      <div className="rounded-lg px-4 py-3 text-[11px] text-[#8BA4BE] font-light" style={{ background: 'rgba(10,22,40,0.6)', border: '1px solid rgba(184,148,60,0.1)' }}>
        Find required decline to lose <span className="font-medium" style={{ ...mono, color: '#E05252' }}>{target}%</span> of portfolio value.
      </div>
      <RunButton onClick={run} loading={loading} />
    </div>
  )
}

export function ComprehensiveConfig({ portfolioId, onResult, loading, setLoading, setError }: ConfigProps) {
  const [useCorr, setUseCorr] = useState(true)
  const run = async () => {
    setLoading(true); setError('')
    try { onResult({ type: 'comprehensive', data: (await getComprehensive(portfolioId, useCorr)).data }) }
    catch (e: any) { setError(e.response?.data?.detail || 'Request failed') }
    finally { setLoading(false) }
  }
  return (
    <div className="space-y-5">
      <p className="text-[11px] text-[#A8BDD0]" style={sans}>All stress scenarios simultaneously.</p>
      <div className="rounded-lg px-4 py-4 space-y-2.5" style={{ background: 'rgba(10,22,40,0.6)', border: '1px solid rgba(184,148,60,0.1)' }}>
        {['3 market crash severities', '5+ historical crises', '6+ sector shocks', '2 interest rate scenarios', 'Summary statistics'].map(item => (
          <div key={item} className="flex items-center gap-2.5">
            <span className="text-[10px]" style={{ color: '#4CAF85' }}>✓</span>
            <span className="text-[11px] text-[#8BA4BE]" style={sans}>{item}</span>
          </div>
        ))}
      </div>
      <Toggle label="Apply correlation spillover" checked={useCorr} onChange={setUseCorr} />
      <div className="rounded-lg px-3.5 py-2.5 text-[10px] text-[#C9A84C]" style={{ ...mono, background: 'rgba(201,168,76,0.05)', border: '1px solid rgba(201,168,76,0.15)' }}>
        ⚠ Multiple API calls · 5–15 seconds
      </div>
      <RunButton onClick={run} loading={loading} label="Run All Scenarios" />
    </div>
  )
}
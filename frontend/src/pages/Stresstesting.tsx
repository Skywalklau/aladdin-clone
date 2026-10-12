import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getPortfolioSectors } from '../api/stress'
import { mono, serif, sans, fmtPct, lossClr, getHeadline, SCENARIOS, ALL_SECTORS } from '../lib/stress'
import type { ResultPayload, ScenarioId, ConfigProps } from '../lib/stress'
import ScoreCard from '../components/stress/ScoreCard'
import StressResultView        from '../components/stress/StressResultView'
import ReverseResultView       from '../components/stress/ReverseResultView'
import ComprehensiveResultView from '../components/stress/ComprehensiveResultView'
import MarketIndices from '../components/MarketIndices'
import {
  MarketCrashConfig, SectorShockConfig, MultiSectorConfig, InterestRateConfig,
  HistoricalConfig, CustomConfig, ReverseConfig, ComprehensiveConfig,
} from '../components/stress/StressConfigs'

// ─── Config map (fix: components, not JSX — prevents all 8 mounting at once) ──
const CONFIG_MAP: Record<ScenarioId, React.ComponentType<ConfigProps>> = {
  market:        MarketCrashConfig,
  sector:        SectorShockConfig,
  multisector:   MultiSectorConfig,
  rate:          InterestRateConfig,
  historical:    HistoricalConfig,
  custom:        CustomConfig,
  reverse:       ReverseConfig,
  comprehensive: ComprehensiveConfig,
}

export default function StressTesting() {
  const { id }      = useParams<{ id: string }>()
  const navigate    = useNavigate()
  const portfolioId = Number(id)

  const [activeScenario, setActiveScenario] = useState<ScenarioId>('market')
  const [sectors, setSectors]               = useState<string[]>([])
  const [results,  setResults]  = useState<Partial<Record<ScenarioId, ResultPayload>>>({})
  const [loadings, setLoadings] = useState<Partial<Record<ScenarioId, boolean>>>({})
  const [errors,   setErrors]   = useState<Partial<Record<ScenarioId, string>>>({})

  useEffect(() => {
    getPortfolioSectors(portfolioId)
      .then(r => setSectors(Object.keys(r.data)))
      .catch(() => setSectors(ALL_SECTORS))
  }, [portfolioId])

  const handleResult  = useCallback((sid: ScenarioId) => (r: ResultPayload) => {
    setResults(p => ({ ...p, [sid]: r  }))
    setErrors(p  => ({ ...p, [sid]: '' }))
  }, [])
  const handleLoading = useCallback((sid: ScenarioId) => (v: boolean) => setLoadings(p => ({ ...p, [sid]: v })), [])
  const handleError   = useCallback((sid: ScenarioId) => (v: string)  => setErrors(p  => ({ ...p, [sid]: v })), [])

  const switchScenario = (sid: ScenarioId) => {
    if (sid === activeScenario) return
    window.history.pushState({ scenarioId: sid }, '', window.location.href)
    setActiveScenario(sid)
  }

  useEffect(() => {
    const onPop = (e: PopStateEvent) => {
      const sid = e.state?.scenarioId as ScenarioId | undefined
      if (sid && SCENARIOS.some(s => s.id === sid)) setActiveScenario(sid)
    }
    window.history.replaceState({ scenarioId: activeScenario }, '', window.location.href)
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const activeRes = results[activeScenario]
  const activeLd  = loadings[activeScenario] ?? false
  const activeErr = errors[activeScenario]   ?? ''
  const runCount  = Object.values(results).filter(Boolean).length
  const ldCount   = Object.values(loadings).filter(Boolean).length
  const active    = SCENARIOS.find(s => s.id === activeScenario)!

  const configProps: ConfigProps = {
    portfolioId,
    onResult:   handleResult(activeScenario),
    loading:    activeLd,
    setLoading: handleLoading(activeScenario),
    setError:   handleError(activeScenario),
    sectors,
  }

  const ConfigComponent = CONFIG_MAP[activeScenario]

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;600;700&family=IBM+Plex+Mono:wght@300;400;500&family=Sora:wght@300;400;500&display=swap');
        @keyframes fadeUp      { to { opacity: 1; transform: translateY(0); } }
        @keyframes fadeSlideIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes barGrow     { from { width: 0%; } }
        @keyframes pulse       { 0%,100% { opacity:1; } 50% { opacity:0.35; } }
        input[type=range]::-webkit-slider-thumb { -webkit-appearance:none; width:14px; height:14px; border-radius:50%; background:#C9A84C; cursor:pointer; border:2px solid #020810; box-shadow:0 0 6px rgba(201,168,76,0.4); }
        input[type=range]::-moz-range-thumb     { width:14px; height:14px; border-radius:50%; background:#C9A84C; cursor:pointer; border:2px solid #020810; }
        select option { background:#0A1628; color:#EDE8DF; }
        ::-webkit-scrollbar       { width:4px; height:4px; }
        ::-webkit-scrollbar-track { background:transparent; }
        ::-webkit-scrollbar-thumb { background:rgba(184,148,60,0.2); border-radius:2px; }
        ::-webkit-scrollbar-thumb:hover { background:rgba(184,148,60,0.35); }
      `}</style>

      <div className="h-screen flex flex-col bg-[#020810] text-[#EDE8DF] overflow-hidden" style={sans}>

        {/* ── NAVBAR ── */}
        <nav className="border-b border-[#B8943C]/10 px-8 py-4 flex items-center justify-between flex-shrink-0 z-50"
          style={{ background: 'rgba(2,8,16,0.97)' }}>
          <div className="flex items-center gap-6">
            <button onClick={() => navigate(`/portfolio/${id}`)}
              className="text-[11px] tracking-[0.12em] uppercase text-[#8BA4BE] hover:text-[#EDE8DF] transition-colors" style={mono}>
              ← Back
            </button>
            <div className="w-px h-4 bg-[#B8943C]/20" />
            <button onClick={() => navigate('/')} className="text-[22px] font-bold hover:opacity-80 transition-opacity" style={serif}>Ala<span className="text-[#C9A84C]">ddin</span></button>
          </div>
          <div className="flex items-center gap-5">
            <MarketIndices />
            <div className="w-px h-4 bg-[#B8943C]/20" />
            {ldCount > 0 && (
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#C9A84C]" style={{ animation: 'pulse 1s ease-in-out infinite' }} />
                <span className="text-[10px] text-[#C9A84C]" style={mono}>{ldCount} running</span>
              </div>
            )}
            {runCount > 0 && (
              <span className="text-[10px] text-[#8BA4BE]" style={mono}>{runCount} / 8 scenarios run</span>
            )}
            <p className="text-[10px] tracking-[0.2em] uppercase text-[#8BA4BE]" style={mono}>Stress Testing</p>
          </div>
        </nav>

        {/* ── SCOREBOARD ── */}
        <div className="flex-shrink-0 border-b border-[#B8943C]/10 px-6 py-4" style={{ background: 'rgba(2,8,16,0.6)' }}>
          <div className="flex items-center justify-between mb-3">
            <p className="text-[8px] tracking-[0.3em] uppercase text-[#C9A84C]" style={mono}>Scenario Scoreboard</p>
            {runCount > 0 && (
              <button onClick={() => { setResults({}); setErrors({}); setLoadings({}) }}
                className="text-[9px] tracking-[0.12em] uppercase text-[#8BA4BE] hover:text-[#E05252] transition-colors" style={mono}>
                Clear all
              </button>
            )}
          </div>
          <div className="grid grid-cols-8 gap-2">
            {SCENARIOS.map(s => (
              <ScoreCard
                key={s.id}
                scenario={s}
                result={results[s.id as ScenarioId]}
                loading={loadings[s.id as ScenarioId] ?? false}
                isActive={activeScenario === s.id}
                onClick={() => switchScenario(s.id as ScenarioId)}
              />
            ))}
          </div>
        </div>

        {/* ── DETAIL AREA ── */}
        <div className="flex flex-1 overflow-hidden">

          {/* Config panel */}
          <div className="w-72 flex-shrink-0 overflow-y-auto border-r border-[#B8943C]/10" style={{ background: 'rgba(2,8,16,0.35)' }}>
            <div className="px-5 pt-5 pb-3.5 border-b border-[#B8943C]/8">
              <div className="flex items-center gap-2.5 mb-0.5">
                <span className="text-[12px] text-[#C9A84C]" style={mono}>{active.icon}</span>
                <h2 className="text-[17px] font-semibold text-[#EDE8DF] leading-tight" style={serif}>{active.label}</h2>
              </div>
              <p className="text-[11px] text-[#A8BDD0]" style={sans}>{active.desc}</p>
            </div>
            <div className="p-5">
              <ConfigComponent {...configProps} />
              {activeErr && (
                <div className="mt-4 rounded-lg px-3.5 py-3 text-[10px] text-[#E05252]"
                  style={{ ...mono, background: 'rgba(224,82,82,0.06)', border: '1px solid rgba(224,82,82,0.2)' }}>
                  ⚠ {activeErr}
                </div>
              )}
            </div>
          </div>

          {/* Results panel */}
          <div className="flex-1 overflow-y-auto min-w-0">
            {activeLd ? (
              <div className="h-full flex flex-col items-center justify-center gap-4">
                <div className="w-7 h-7 border border-[#C9A84C]/30 border-t-[#C9A84C] rounded-full animate-spin" />
                <p className="text-[10px] tracking-[0.2em] uppercase text-[#8BA4BE]" style={mono}>Computing…</p>
              </div>
            ) : activeRes ? (
              <div key={`${activeScenario}-${JSON.stringify(activeRes).length}`}
                className="p-8" style={{ animation: 'fadeSlideIn 0.3s cubic-bezier(0.16,1,0.3,1) forwards' }}>
                {activeRes.type === 'stress'        ? <StressResultView        result={activeRes.data} /> :
                 activeRes.type === 'reverse'       ? <ReverseResultView       result={activeRes.data} /> :
                                                      <ComprehensiveResultView result={activeRes.data} />}
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center px-10 opacity-0 animate-[fadeUp_0.4s_0.1s_forwards]">
                <span className="text-[48px] mb-5 block" style={{ ...mono, color: 'rgba(184,148,60,0.25)' }}>{active.icon}</span>
                <p className="text-[20px] font-semibold mb-2" style={{ ...serif, color: 'rgba(237,232,223,0.5)' }}>{active.label}</p>
                <p className="text-[11px] font-light leading-relaxed max-w-xs mb-8" style={{ ...sans, color: '#8BA4BE' }}>{active.desc}</p>
                {runCount > 0 && (
                  <div className="flex flex-wrap justify-center gap-2">
                    {SCENARIOS.filter(s => results[s.id as ScenarioId]).map(s => {
                      const r = results[s.id as ScenarioId]!
                      const h = getHeadline(r)
                      if (!h) return null
                      const c = lossClr(h.pct)
                      return (
                        <button key={s.id} onClick={() => switchScenario(s.id as ScenarioId)}
                          className="flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all hover:border-[#B8943C]/25"
                          style={{ borderColor: 'rgba(184,148,60,0.12)', background: 'rgba(2,8,16,0.5)' }}>
                          <span className="text-[9px]"  style={{ ...mono, color: '#8BA4BE' }}>{s.icon}</span>
                          <span className="text-[9px] text-[#8BA4BE]" style={mono}>{s.label}</span>
                          <span className="text-[10px] font-bold" style={{ ...mono, color: c }}>{fmtPct(h.pct)}</span>
                        </button>
                      )
                    })}
                  </div>
                )}
                <p className="text-[9px] tracking-[0.2em] uppercase mt-8" style={{ ...mono, color: '#8BA4BE' }}>
                  Configure parameters · click run
                </p>
              </div>
            )}
          </div>

        </div>
      </div>
    </>
  )
}
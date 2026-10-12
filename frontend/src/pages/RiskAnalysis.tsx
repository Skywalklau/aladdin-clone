import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useDebounce } from 'use-debounce'
import { getPortfolioRisk } from '../api/risk'
import type { PortfolioRiskSummary } from '../types/index'
import MarketIndices from '../components/MarketIndices'
import { mono, serif, sans } from '../lib/trading'
import { formatCurrency, formatPercent, triggerShake, getCorrelationStyle } from '../lib/formatters'

const GOOGLE_FONTS = `@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;600;700&family=IBM+Plex+Mono:wght@300;400;500&family=Sora:wght@300;400;500&display=swap');`

export default function RiskAnalysis() {
  const { id }   = useParams()
  const navigate = useNavigate()

  const [risk,    setRisk]    = useState<PortfolioRiskSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState('')
  const [inputError, setInputError] = useState('')

  // Applied values — only update when Recalculate is hit
  const [appliedConfidence, setAppliedConfidence] = useState(0.95)

  // Confidence level
  const [confidenceLevel, setConfidenceLevel] = useState(0.95)
  const [confidenceInput, setConfidenceInput] = useState('0.95')
  const [debouncedConfidence]                 = useDebounce(confidenceInput, 800)
  const [shakeConfidence, setShakeConfidence] = useState(false)

  // Risk-free rate
  const [riskFreeRate,  setRiskFreeRate]  = useState(0.04)
  const [riskFreeInput, setRiskFreeInput] = useState('0.04')
  const [debouncedRiskFree]               = useDebounce(riskFreeInput, 800)
  const [shakeRiskFree, setShakeRiskFree] = useState(false)

  const fetchRisk = async (portfolioId: number, confidence: number, riskFree: number) => {
    setLoading(true)
    setError('')
    try {
      const data = await getPortfolioRisk(portfolioId, confidence, riskFree)
      setRisk(data)
    } catch {
      setError('Failed to load risk analysis')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (id) fetchRisk(parseInt(id), confidenceLevel, riskFreeRate)
  }, [id])

  useEffect(() => {
    const val = parseFloat(debouncedConfidence)
    if (!isNaN(val) && val >= 0.01 && val <= 0.99) {
      setConfidenceLevel(val); setInputError('')
    } else if (debouncedConfidence !== '' && debouncedConfidence !== '0' && debouncedConfidence !== '0.') {
      triggerShake(setShakeConfidence)
    }
  }, [debouncedConfidence])

  useEffect(() => {
    const val = parseFloat(debouncedRiskFree)
    if (!isNaN(val) && val >= 0 && val <= 1) {
      setRiskFreeRate(val); setInputError('')
    } else if (debouncedRiskFree !== '' && debouncedRiskFree !== '0' && debouncedRiskFree !== '0.') {
      triggerShake(setShakeRiskFree)
    }
  }, [debouncedRiskFree])

  const handleRecalculate = () => {
    const confidence = parseFloat(confidenceInput)
    const riskFree   = parseFloat(riskFreeInput)
    if (isNaN(confidence) || confidence < 0.01 || confidence > 0.99) {
      triggerShake(setShakeConfidence)
      setInputError('Confidence level must be between 0.01 and 0.99')
      return
    }
    if (isNaN(riskFree) || riskFree < 0 || riskFree > 1) {
      triggerShake(setShakeRiskFree)
      setInputError('Risk-free rate must be between 0.00 and 1.00')
      return
    }
    setConfidenceLevel(confidence)
    setRiskFreeRate(riskFree)
    setAppliedConfidence(confidence)
    setInputError('')
    if (id) fetchRisk(parseInt(id), confidence, riskFree)
  }

  const handleConfidencePreset = (v: number) => {
    setConfidenceLevel(v); setConfidenceInput(String(v)); setInputError('')
  }
  const handleRiskFreePreset = (v: number) => {
    setRiskFreeRate(v); setRiskFreeInput(String(v)); setInputError('')
  }

  // ── Shared class builders ─────────────────────────────────────────────────
  const inputCls = (shake: boolean) =>
    `w-16 bg-[#0A1628]/80 border text-[#EDE8DF] text-center rounded-md px-2 py-1.5 text-[11px] outline-none transition-all ${
      shake
        ? 'border-[#E05252] animate-[shake_0.5s_ease]'
        : 'border-[#B8943C]/20 focus:border-[#C9A84C]/50'
    }`

  const presetBtn = (active: boolean) =>
    `px-3 py-1.5 rounded-md text-[10px] tracking-[0.1em] uppercase transition-all cursor-pointer ${
      active
        ? 'bg-[#C9A84C] text-[#020810] font-medium'
        : 'border border-[#B8943C]/20 text-[#8BA4BE] hover:border-[#B8943C]/40 hover:text-[#EDE8DF]'
    }`

  // ── Loading ───────────────────────────────────────────────────────────────
  if (loading) return (
    <>
      <style>{GOOGLE_FONTS}</style>
      <div className="min-h-screen bg-[#020810] flex items-center justify-center" style={sans}>
        <div className="flex flex-col items-center gap-4">
          <div className="w-7 h-7 border border-[#C9A84C]/30 border-t-[#C9A84C] rounded-full animate-spin" />
          <p className="text-[10px] tracking-[0.2em] uppercase text-[#8BA4BE]" style={mono}>
            Computing risk metrics...
          </p>
        </div>
      </div>
    </>
  )

  // ── Error ─────────────────────────────────────────────────────────────────
  if (error || !risk) return (
    <>
      <style>{GOOGLE_FONTS}</style>
      <div className="min-h-screen bg-[#020810] flex items-center justify-center" style={sans}>
        <div className="text-center">
          <p className="text-[#E05252] text-[11px] tracking-[0.15em] uppercase mb-4" style={mono}>
            ⚠ {error || 'Failed to load risk data'}
          </p>
          <button
            onClick={() => navigate(`/portfolio/${id}`)}
            className="text-[11px] tracking-[0.15em] uppercase text-[#8BA4BE] hover:text-[#C9A84C] transition-colors"
            style={mono}>
            ← Back to portfolio
          </button>
        </div>
      </div>
    </>
  )

  const symbols = Object.keys(risk.correlations)

  const METRICS = [
    {
      label:  'Annualised Volatility',
      value:  formatPercent(risk.portfolio_volatility),
      sub:    'Standard deviation of returns',
      accent: risk.portfolio_volatility > 0.2 ? '#E05252' : risk.portfolio_volatility > 0.12 ? '#C9A84C' : '#4CAF85',
    },
    {
      label:  'Portfolio Beta',
      value:  risk.portfolio_beta.toFixed(2),
      sub:    'Sensitivity vs S&P 500',
      accent: risk.portfolio_beta > 1.2 ? '#E05252' : risk.portfolio_beta < 0.8 ? '#4CAF85' : '#C9A84C',
    },
    {
      label:  'Sharpe Ratio',
      value:  risk.sharpe_ratio.toFixed(2),
      sub:    'Risk-adjusted return',
      accent: risk.sharpe_ratio >= 1 ? '#4CAF85' : risk.sharpe_ratio >= 0 ? '#C9A84C' : '#E05252',
    },
    {
      label:  `Historical VaR · ${(appliedConfidence * 100).toFixed(0)}%`,
      value:  formatCurrency(risk.historical_var),
      sub:    'Max daily loss (simulation)',
      accent: '#E05252',
    },
    {
      label:  `Parametric VaR · ${(appliedConfidence * 100).toFixed(0)}%`,
      value:  formatCurrency(risk.parametric_var),
      sub:    'Max daily loss (normal dist.)',
      accent: '#E07B52',
    },
    {
      label:  'Portfolio Value',
      value:  formatCurrency(risk.total_value),
      sub:    'Current market value',
      accent: '#8BA4BE',
    },
  ]

  return (
    <>
      <style>{`
        ${GOOGLE_FONTS}
        @keyframes fadeUp { to { opacity: 1; transform: translateY(0); } }
        @keyframes shake {
          0%,100% { transform: translateX(0);   }
          20%     { transform: translateX(-5px); }
          40%     { transform: translateX(5px);  }
          60%     { transform: translateX(-3px); }
          80%     { transform: translateX(3px);  }
        }
      `}</style>

      <div className="min-h-screen bg-[#020810] text-[#EDE8DF]" style={sans}>

        {/* ── NAVBAR ── */}
        <nav className="border-b border-[#B8943C]/10 px-10 py-4 flex items-center justify-between sticky top-0 z-50 bg-[#020810]/95 backdrop-blur-md">
          <div className="flex items-center gap-6">
            <button
              onClick={() => navigate(`/portfolio/${id}`)}
              className="text-[11px] tracking-[0.12em] uppercase text-[#8BA4BE] hover:text-[#EDE8DF] transition-colors"
              style={mono}>
              ← Back
            </button>
            <div className="w-px h-4 bg-[#B8943C]/20" />
            <button onClick={() => navigate('/')} className="text-[22px] font-bold hover:opacity-80 transition-opacity" style={serif}>
              Ala<span className="text-[#C9A84C]">ddin</span>
            </button>
          </div>
          <div className="flex items-center gap-5">
            <MarketIndices />
            <div className="w-px h-4 bg-[#B8943C]/20" />
            <p className="text-[10px] tracking-[0.2em] uppercase text-[#8BA4BE]" style={mono}>
              Risk Analysis
            </p>
          </div>
        </nav>

        <div className="max-w-7xl mx-auto px-8 py-10 space-y-10">

          {/* ── HEADER ── */}
          <div className="opacity-0 translate-y-3 animate-[fadeUp_0.6s_0.05s_forwards]">
            <p className="text-[10px] tracking-[0.24em] text-[#B8943C] uppercase mb-2" style={mono}>
              Portfolio Risk
            </p>
            <h1 className="text-[36px] font-semibold leading-tight" style={serif}>
              Risk Analysis
            </h1>
            <p className="text-[12px] text-[#8BA4BE] mt-1.5 font-light">
              252-day lookback · S&P 500 benchmark
            </p>
          </div>

          {/* ── PARAMETERS ── */}
          <div className="opacity-0 translate-y-3 animate-[fadeUp_0.6s_0.12s_forwards]">
            <p className="text-[10px] tracking-[0.22em] text-[#8BA4BE] uppercase mb-3" style={mono}>
              Parameters
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">

              {/* Confidence level */}
              <div className="border border-[#B8943C]/10 rounded-xl bg-[#020810]/60 px-5 py-4">
                <p className="text-[9px] tracking-[0.18em] uppercase text-[#8BA4BE] mb-3" style={mono}>
                  Confidence Level
                </p>
                <div className="flex items-center gap-2 flex-wrap mb-2">
                  {[0.90, 0.95, 0.99].map(v => (
                    <button key={v} onClick={() => handleConfidencePreset(v)}
                      className={presetBtn(confidenceLevel === v)} style={mono}>
                      {(v * 100).toFixed(0)}%
                    </button>
                  ))}
                  <span className="text-[#8BA4BE] text-[10px]" style={mono}>or</span>
                  <input
                    type="text" value={confidenceInput}
                    onChange={e => setConfidenceInput(e.target.value)}
                    placeholder="0.97"
                    className={inputCls(shakeConfidence)} style={mono} />
                </div>
                <p className="text-[9px] text-[#8BA4BE]" style={mono}>Range: 0.01 – 0.99</p>
              </div>

              {/* Risk-free rate */}
              <div className="border border-[#B8943C]/10 rounded-xl bg-[#020810]/60 px-5 py-4">
                <p className="text-[9px] tracking-[0.18em] uppercase text-[#8BA4BE] mb-3" style={mono}>
                  Risk-Free Rate
                </p>
                <div className="flex items-center gap-2 flex-wrap mb-2">
                  {[0.02, 0.04, 0.05].map(v => (
                    <button key={v} onClick={() => handleRiskFreePreset(v)}
                      className={presetBtn(riskFreeRate === v)} style={mono}>
                      {(v * 100).toFixed(0)}%
                    </button>
                  ))}
                  <span className="text-[#8BA4BE] text-[10px]" style={mono}>or</span>
                  <input
                    type="text" value={riskFreeInput}
                    onChange={e => setRiskFreeInput(e.target.value)}
                    placeholder="0.03"
                    className={inputCls(shakeRiskFree)} style={mono} />
                </div>
                <p className="text-[9px] text-[#8BA4BE]" style={mono}>Range: 0.00 – 1.00</p>
              </div>

              {/* Recalculate */}
              <div className="border border-[#B8943C]/10 rounded-xl bg-[#020810]/60 px-5 py-4 flex flex-col justify-between">
                {inputError && (
                  <p className="text-[#E05252] text-[10px] mb-2" style={mono}>⚠ {inputError}</p>
                )}
                <div className="flex-1 flex items-center justify-center">
                  <p className="text-[10px] text-[#8BA4BE] text-center leading-relaxed font-light">
                    Adjust parameters then recalculate to update all metrics
                  </p>
                </div>
                <button
                  onClick={handleRecalculate}
                  disabled={loading}
                  className="w-full py-2.5 rounded-md text-[11px] font-medium tracking-[0.18em] uppercase text-[#020810] hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all mt-3 cursor-pointer"
                  style={{ ...mono, background: 'linear-gradient(135deg, #C9A84C 0%, #A8892E 100%)' }}>
                  {loading ? 'Computing...' : 'Recalculate'}
                </button>
              </div>
            </div>
          </div>

          {/* ── KEY METRICS ── */}
          <div className="opacity-0 translate-y-3 animate-[fadeUp_0.6s_0.2s_forwards]">
            <p className="text-[10px] tracking-[0.22em] text-[#8BA4BE] uppercase mb-3" style={mono}>
              Key Risk Metrics
            </p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {METRICS.map(({ label, value, sub, accent }, i) => (
                <div key={label}
                  className="border border-[#B8943C]/10 rounded-xl bg-[#020810]/60 px-5 py-4 hover:border-[#B8943C]/20 transition-colors opacity-0 translate-y-2"
                  style={{ animation: `fadeUp 0.4s ${0.22 + i * 0.05}s forwards` }}>
                  <div className="w-6 h-0.5 rounded-full mb-3" style={{ background: accent }} />
                  <p className="text-[9px] tracking-[0.15em] uppercase text-[#8BA4BE] mb-2" style={mono}>
                    {label}
                  </p>
                  <p className="text-[22px] font-semibold tracking-tight" style={{ ...sans, color: accent }}>
                    {value}
                  </p>
                  <p className="text-[10px] text-[#8BA4BE] mt-1.5 font-light">{sub}</p>
                </div>
              ))}
            </div>
          </div>

          {/* ── CORRELATION MATRIX ── */}
          <div className="opacity-0 translate-y-3 animate-[fadeUp_0.6s_0.35s_forwards]">
            <div className="flex items-end justify-between mb-3">
              <p className="text-[10px] tracking-[0.22em] text-[#8BA4BE] uppercase" style={mono}>
                Correlation Matrix
              </p>
              <div className="flex items-center gap-4">
                {[
                  { color: '#E05252', label: '≥ 0.7  High'     },
                  { color: '#C9A84C', label: '≥ 0.4  Moderate' },
                  { color: '#4CAF85', label: '< 0.4  Low'      },
                  { color: '#7A9AB8', label: 'Negative'         },
                ].map(({ color, label }) => (
                  <div key={label} className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full" style={{ background: color }} />
                    <span className="text-[9px] text-[#8BA4BE]" style={mono}>{label}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="border border-[#B8943C]/10 rounded-xl overflow-auto bg-[#020810]/60">
              <table className="w-full text-[11px]">
                <thead>
                  <tr className="border-b border-[#B8943C]/8">
                    <th className="px-4 py-3 text-left sticky left-0 bg-[#020810]/95 text-[9px] tracking-[0.12em] uppercase text-[#8BA4BE] font-normal min-w-[80px]"
                      style={mono}>
                      Symbol
                    </th>
                    {symbols.map(s => (
                      <th key={s}
                        className="px-3 py-3 text-center text-[9px] tracking-[0.1em] uppercase text-[#8BA4BE] font-normal min-w-[64px]"
                        style={mono}>
                        {s}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {symbols.map((row, ri) => (
                    <tr key={row}
                      className="border-b border-[#B8943C]/5 hover:bg-[#0A1628]/30 transition-colors opacity-0 translate-y-1"
                      style={{ animation: `fadeUp 0.3s ${0.4 + ri * 0.03}s forwards` }}>
                      <td className="px-4 py-2.5 font-medium text-[#EDE8DF] sticky left-0 bg-[#020810]/95 text-[11px]"
                        style={mono}>
                        {row}
                      </td>
                      {symbols.map(col => {
                        const val    = risk.correlations[row][col]
                        const isDiag = row === col
                        const { bg, text } = getCorrelationStyle(val, isDiag)
                        return (
                          <td key={col} className="px-3 py-2.5 text-center">
                            <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-medium ${bg} ${text}`}
                              style={mono}>
                              {isDiag ? '—' : val.toFixed(2)}
                            </span>
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      </div>
    </>
  )
}
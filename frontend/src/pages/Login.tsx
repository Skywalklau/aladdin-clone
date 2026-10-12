import { useState, useEffect, useRef } from 'react'
import type { BaseSyntheticEvent } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { login } from '../api/auth'
import { mono, serif, sans } from '../lib/trading'

const FEATURES = [
  { label: 'Risk Analytics',       desc: 'VaR · Volatility · Beta · Sharpe · Correlations',              icon: '▲' },
  { label: 'Stress Testing',       desc: 'Market crash · Sector shock · Rate shock · Historical crises',  icon: '◈' },
  { label: 'AI Insights',          desc: 'News sentiment · Per-stock & portfolio-level analysis',          icon: '◎' },
  { label: 'Portfolio Management', desc: 'CSV import · Live P&L · Multi-portfolio support',               icon: '▣' },
]

export default function Login() {
  const navigate = useNavigate()
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [error,    setError]    = useState('')
  const [loading,  setLoading]  = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [tickers, setTickers]   = useState<{ sym: string; val: string; chg: string; pos: boolean }[]>([])

  useEffect(() => {
    fetch('/api/market/tickers')
      .then(r => r.json())
      .then(data => setTickers(data))
      .catch(() => {})
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    canvas.width  = canvas.offsetWidth
    canvas.height = canvas.offsetHeight

    const pts = Array.from({ length: 55 }, () => ({
      x:  Math.random() * canvas.width,
      y:  Math.random() * canvas.height,
      vx: (Math.random() - 0.5) * 0.28,
      vy: (Math.random() - 0.5) * 0.28,
    }))

    let raf: number
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      pts.forEach(p => {
        p.x += p.vx; p.y += p.vy
        if (p.x < 0 || p.x > canvas.width)  p.vx *= -1
        if (p.y < 0 || p.y > canvas.height) p.vy *= -1
      })
      pts.forEach((a, i) => {
        pts.slice(i + 1).forEach(b => {
          const d = Math.hypot(a.x - b.x, a.y - b.y)
          if (d < 110) {
            ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y)
            ctx.strokeStyle = `rgba(180,140,60,${0.13 * (1 - d / 110)})`
            ctx.lineWidth   = 0.5; ctx.stroke()
          }
        })
        ctx.beginPath(); ctx.arc(a.x, a.y, 1.4, 0, Math.PI * 2)
        ctx.fillStyle = 'rgba(180,140,60,0.45)'; ctx.fill()
      })
      raf = requestAnimationFrame(draw)
    }
    draw()
    return () => cancelAnimationFrame(raf)
  }, [])

  const handleSubmit = async (e: BaseSyntheticEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(email, password)
      navigate('/')
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Invalid email or password')
    } finally {
      setLoading(false)
    }
  }

  const inputCls = "w-full bg-[#0A1628]/80 border border-[#B8943C]/15 text-[#EDE8DF] rounded-md px-4 py-3 text-[13px] outline-none focus:border-[#C9A84C]/50 focus:ring-2 focus:ring-[#C9A84C]/[0.07] transition-all placeholder:text-[#1A2C42]"

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;600;700&family=IBM+Plex+Mono:wght@300;400;500&family=Sora:wght@300;400;500&display=swap');
        @keyframes fadeUp { to { opacity: 1; transform: translateY(0); } }
      `}</style>

      <div className="min-h-screen flex bg-[#020810] overflow-hidden" style={sans}>

        {/* ── LEFT: VISUAL ── */}
        <div className="flex-1 relative flex flex-col p-12 border-r border-[#B8943C]/10 overflow-hidden">
          <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none" />
          <div className="absolute inset-0 pointer-events-none"
            style={{ background: 'radial-gradient(ellipse 75% 60% at 25% 50%, rgba(180,140,60,0.06) 0%, transparent 70%)' }} />

          {/* Brand */}
          <div className="relative z-10 opacity-0 translate-y-4 animate-[fadeUp_0.7s_0.05s_forwards]">
            <p className="text-[10px] tracking-[0.26em] text-[#B8943C] uppercase mb-2.5" style={mono}>
              Risk Intelligence Platform
            </p>
            <h1 className="text-[44px] font-bold leading-none text-[#EDE8DF]" style={serif}>
              Ala<span className="text-[#C9A84C]">ddin</span>
            </h1>
            <p className="text-[12px] text-[#8BA4BE] mt-3 font-light max-w-[320px] leading-relaxed">
              Institutional-grade portfolio risk management. Built for serious investors.
            </p>
          </div>

          {/* Feature cards */}
          <div className="relative z-10 mt-auto mb-6 grid grid-cols-2 gap-2.5 opacity-0 translate-y-3 animate-[fadeUp_0.8s_0.35s_forwards]">
            {FEATURES.map(({ label, desc, icon }) => (
              <div key={label}
                className="bg-[#020810]/80 border border-[#B8943C]/10 rounded-lg px-4 py-3.5 backdrop-blur-sm hover:border-[#B8943C]/20 transition-colors">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-[#C9A84C] text-[11px]" style={mono}>{icon}</span>
                  <span className="text-[11px] font-medium text-[#EDE8DF]" style={mono}>{label}</span>
                </div>
                <p className="text-[10px] text-[#8BA4BE] leading-relaxed font-light">{desc}</p>
              </div>
            ))}
          </div>

          {/* Tickers */}
          <div className="relative z-10 flex gap-6 flex-wrap opacity-0 translate-y-3 animate-[fadeUp_0.7s_0.55s_forwards]">
            {tickers.map(t => (
              <div key={t.sym} className="flex items-center gap-2">
                <span className="text-[10px] tracking-[0.1em] text-[#8BA4BE]" style={mono}>{t.sym}</span>
                <span className="text-[10px] text-[#EDE8DF]" style={mono}>{t.val}</span>
                <span className={`text-[9px] ${t.pos ? 'text-[#4CAF85]' : 'text-[#E05252]'}`} style={mono}>{t.chg}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── RIGHT: FORM ── */}
        <div className="w-[440px] flex-shrink-0 flex flex-col justify-center px-14 py-16">
          <div className="mb-9 opacity-0 translate-y-3 animate-[fadeUp_0.7s_0.1s_forwards]">
            <p className="text-[10px] tracking-[0.22em] text-[#B8943C] uppercase mb-2.5" style={mono}>
              Secure access
            </p>
            <h2 className="text-[32px] font-semibold text-[#EDE8DF] leading-tight" style={serif}>
              Sign in to your<br />workspace
            </h2>
            <p className="text-[11px] text-[#8BA4BE] mt-2 font-light">Authorised personnel only</p>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="flex flex-col gap-4 opacity-0 translate-y-3 animate-[fadeUp_0.7s_0.22s_forwards]">
              {error && (
                <div className="bg-red-500/[0.06] border border-red-500/20 text-red-400 px-3.5 py-2.5 rounded-md text-[11px]" style={mono}>
                  ⚠ {error}
                </div>
              )}

              <div>
                <label className="block text-[10px] tracking-[0.15em] text-[#8BA4BE] uppercase mb-2" style={mono}>
                  Email address
                </label>
                <input type="email" required placeholder="you@blackrock.com"
                  value={email} onChange={e => setEmail(e.target.value)}
                  className={inputCls} style={sans} />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-[10px] tracking-[0.15em] text-[#8BA4BE] uppercase" style={mono}>
                    Password
                  </label>
                  <Link to="/forgot-password"
                    className="text-[10px] text-[#C9A84C] hover:opacity-80 transition-opacity tracking-wide"
                    style={mono}>
                    Forgot password?
                  </Link>
                </div>
                <input type="password" required placeholder="••••••••••••"
                  value={password} onChange={e => setPassword(e.target.value)}
                  className={inputCls} style={sans} />
              </div>

              <button type="submit" disabled={loading}
                className="w-full py-3 mt-1 rounded-md text-[11px] font-medium tracking-[0.2em] uppercase text-[#020810] hover:opacity-90 hover:-translate-y-px active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer"
                style={{ ...mono, background: 'linear-gradient(135deg, #C9A84C 0%, #A8892E 100%)' }}>
                {loading ? 'Authenticating...' : 'Access Platform'}
              </button>
            </div>
          </form>

          <p className="text-center text-[11px] text-[#8BA4BE] font-light mt-7 opacity-0 translate-y-3 animate-[fadeUp_0.7s_0.4s_forwards]">
            No account?{' '}
            <Link to="/register" className="text-[#C9A84C] hover:underline">Request access →</Link>
          </p>
        </div>

      </div>
    </>
  )
}
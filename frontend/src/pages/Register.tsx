import { useState } from 'react'
import type { BaseSyntheticEvent } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { register } from '../api/auth'
import TradingGame from '../components/trading/TradingGame'
import { mono, serif, sans } from '../lib/trading'

const STEPS = [{ label: 'Account Details' }, { label: 'Security' }]

export default function Register() {
  const navigate = useNavigate()
  const [step,            setStep]            = useState(0)
  const [fullName,        setFullName]        = useState('')
  const [email,           setEmail]           = useState('')
  const [password,        setPassword]        = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error,           setError]           = useState('')
  const [loading,         setLoading]         = useState(false)

  const handleSubmit = async (e: BaseSyntheticEvent) => {
    e.preventDefault()
    setError('')
    if (step === 0) { setStep(1); return }
    if (password !== confirmPassword) { setError('Passwords do not match'); return }
    setLoading(true)
    try {
      await register(fullName, email, password)
      navigate('/')
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Registration failed')
    } finally {
      setLoading(false)
    }
  }

  const inputCls =
    'w-full bg-[#0A1628]/80 border border-[#B8943C]/15 text-[#EDE8DF] rounded-md px-4 py-3 text-[13px] outline-none focus:border-[#C9A84C]/50 focus:ring-2 focus:ring-[#C9A84C]/[0.07] transition-all placeholder:text-[#1A2C42]'

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;600;700&family=IBM+Plex+Mono:wght@300;400;500&family=Sora:wght@300;400;500&display=swap');
        @keyframes fadeUp { to { opacity: 1; transform: translateY(0); } }
      `}</style>

      <div className="min-h-screen flex bg-[#020810] overflow-hidden" style={sans}>

        {/* LEFT: FORM */}
        <div className="w-[460px] flex-shrink-0 flex flex-col justify-center px-14 py-16 border-r border-[#B8943C]/10 relative">
          <div
            className="absolute inset-0 pointer-events-none"
            style={{ background: 'radial-gradient(ellipse 80% 60% at 0% 60%, rgba(180,140,60,0.04) 0%, transparent 70%)' }}
          />

          {/* Heading */}
          <div className="relative z-10 mb-10 opacity-0 translate-y-3 animate-[fadeUp_0.6s_0.05s_forwards]">
            <p className="text-[10px] tracking-[0.24em] text-[#B8943C] uppercase mb-2" style={mono}>
              Portfolio Risk Platform
            </p>
            <h1 className="text-[36px] font-semibold leading-[1.08] text-[#EDE8DF]" style={serif}>
              Create your<br />workspace
            </h1>
            <p className="text-[11px] text-[#8BA4BE] mt-2 font-light tracking-wide">
              Institutional access — set up in 2 steps
            </p>
          </div>

          {/* Step indicator */}
          <div className="relative z-10 mb-8 opacity-0 translate-y-3 animate-[fadeUp_0.6s_0.15s_forwards]">
            <div className="flex items-center mb-2.5">
              {STEPS.map((_, i) => (
                <div key={i} className="flex items-center flex-1 last:flex-none">
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-medium border transition-all duration-300 flex-shrink-0 ${
                      i < step    ? 'bg-[#C9A84C]/15 text-[#C9A84C] border-[#C9A84C]/35' :
                      i === step  ? 'bg-[#C9A84C] text-[#020810] border-[#C9A84C]'        :
                                    'bg-transparent text-[#8BA4BE] border-[#B8943C]/20'
                    }`}
                    style={mono}
                  >
                    {i < step ? '✓' : i + 1}
                  </div>
                  {i < STEPS.length - 1 && <div className="flex-1 h-px mx-2.5 bg-[#B8943C]/12" />}
                </div>
              ))}
            </div>
            <div className="flex justify-between pr-1">
              {STEPS.map((s, i) => (
                <span
                  key={i}
                  className={`text-[9px] tracking-[0.12em] uppercase transition-colors duration-300 ${i === step ? 'text-[#C9A84C]' : 'text-[#8BA4BE]'}`}
                  style={mono}
                >
                  {s.label}
                </span>
              ))}
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="relative z-10">
            <div className="flex flex-col gap-4 opacity-0 translate-y-3 animate-[fadeUp_0.6s_0.25s_forwards]">
              {error && (
                <div className="bg-red-500/[0.06] border border-red-500/20 text-red-400 px-3.5 py-2.5 rounded-md text-[11px]" style={mono}>
                  ⚠ {error}
                </div>
              )}

              {step === 0 && (
                <>
                  <div>
                    <label className="block text-[10px] tracking-[0.15em] text-[#8BA4BE] uppercase mb-2" style={mono}>
                      Full name
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Jane Smith"
                      value={fullName}
                      onChange={e => setFullName(e.target.value)}
                      className={inputCls}
                      style={sans}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] tracking-[0.15em] text-[#8BA4BE] uppercase mb-2" style={mono}>
                      Email address
                    </label>
                    <input
                      type="email"
                      required
                      placeholder="you@blackrock.com"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      className={inputCls}
                      style={sans}
                    />
                  </div>
                </>
              )}

              {step === 1 && (
                <>
                  <div>
                    <label className="block text-[10px] tracking-[0.15em] text-[#8BA4BE] uppercase mb-2" style={mono}>
                      Password
                    </label>
                    <input
                      type="password"
                      required
                      placeholder="Min. 8 characters"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      className={inputCls}
                      style={sans}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] tracking-[0.15em] text-[#8BA4BE] uppercase mb-2" style={mono}>
                      Confirm password
                    </label>
                    <input
                      type="password"
                      required
                      placeholder="••••••••••••"
                      value={confirmPassword}
                      onChange={e => setConfirmPassword(e.target.value)}
                      className={inputCls}
                      style={sans}
                    />
                  </div>
                </>
              )}

              <div className="flex gap-2.5 pt-1">
                {step > 0 && (
                  <button
                    type="button"
                    onClick={() => setStep(s => s - 1)}
                    className="px-5 py-3 bg-transparent border border-[#B8943C]/20 rounded-md text-[11px] tracking-[0.15em] text-[#8BA4BE] hover:border-[#B8943C]/40 hover:text-[#C9A84C] transition-all cursor-pointer"
                    style={mono}
                  >
                    ← Back
                  </button>
                )}
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 py-3 rounded-md text-[11px] font-medium tracking-[0.2em] uppercase text-[#020810] hover:opacity-90 hover:-translate-y-px active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer"
                  style={{ ...mono, background: 'linear-gradient(135deg, #C9A84C 0%, #A8892E 100%)' }}
                >
                  {loading ? 'Creating...' : step < STEPS.length - 1 ? 'Continue →' : 'Create Account'}
                </button>
              </div>
            </div>
          </form>

          <p className="relative z-10 text-center text-[11px] text-[#8BA4BE] font-light mt-7 opacity-0 translate-y-3 animate-[fadeUp_0.6s_0.4s_forwards]">
            Already have an account?{' '}
            <Link to="/login" className="text-[#C9A84C] hover:underline">Sign in →</Link>
          </p>
        </div>

        {/* RIGHT: TRADING GAME */}
        <div className="flex-1 flex flex-col min-h-0 px-10 py-8 relative overflow-hidden">
          <div
            className="absolute inset-0 pointer-events-none"
            style={{ background: 'radial-gradient(ellipse 65% 55% at 60% 45%, rgba(180,140,60,0.05) 0%, transparent 70%)' }}
          />
          <div className="relative z-10 flex-1 flex flex-col min-h-0 opacity-0 translate-y-4 animate-[fadeUp_0.8s_0.3s_forwards]">
            <TradingGame />
          </div>
        </div>

      </div>
    </>
  )
}
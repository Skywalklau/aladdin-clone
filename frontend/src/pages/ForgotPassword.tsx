import { useState } from 'react'
import { Link } from 'react-router-dom'
import axios from 'axios'

const mono  = { fontFamily: "'IBM Plex Mono', monospace" }
const serif = { fontFamily: "'Cormorant Garamond', serif" }
const sans  = { fontFamily: "'Sora', sans-serif" }

export default function ForgotPassword() {
  const [email,     setEmail]     = useState('')
  const [loading,   setLoading]   = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error,     setError]     = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      await axios.post('/api/auth/forgot-password', { email })
      setSubmitted(true)
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Something went wrong. Please try again.')
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

      <div className="min-h-screen flex items-center justify-center bg-[#020810]" style={sans}>
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: 'radial-gradient(ellipse 60% 50% at 50% 40%, rgba(180,140,60,0.05) 0%, transparent 70%)' }}
        />

        <div className="relative z-10 w-full max-w-[400px] px-6 opacity-0 translate-y-3 animate-[fadeUp_0.5s_0.05s_forwards]">

          {/* Brand */}
          <div className="text-center mb-10">
            <h1 className="text-[32px] font-semibold text-[#EDE8DF]" style={serif}>
              Ala<span className="text-[#C9A84C]">ddin</span>
            </h1>
            <p className="text-[9px] tracking-[0.24em] text-[#B8943C] uppercase mt-1" style={mono}>
              Portfolio Risk Platform
            </p>
          </div>

          <div className="border border-[#B8943C]/15 rounded-xl bg-[#020810]/80 p-8">

            {submitted ? (
              /* ── Success state ── */
              <div className="text-center">
                <div className="w-12 h-12 rounded-full border border-[#4CAF85]/30 bg-[#4CAF85]/[0.06] flex items-center justify-center mx-auto mb-5">
                  <span className="text-[#4CAF85] text-[20px]">✓</span>
                </div>
                <h2 className="text-[22px] font-semibold text-[#EDE8DF] mb-2" style={serif}>
                  Check your email
                </h2>
                <p className="text-[12px] text-[#8BA4BE] leading-relaxed mb-6" style={sans}>
                  If <span className="text-[#EDE8DF]">{email}</span> is registered, you'll receive a
                  reset link within a few minutes.
                </p>
                <p className="text-[10px] text-[#4A6070] mb-6" style={mono}>
                  The link expires in 30 minutes.
                </p>
                <Link
                  to="/login"
                  className="text-[11px] tracking-[0.12em] uppercase text-[#C9A84C] hover:opacity-80 transition-opacity"
                  style={mono}>
                  ← Back to sign in
                </Link>
              </div>
            ) : (
              /* ── Form state ── */
              <>
                <h2 className="text-[22px] font-semibold text-[#EDE8DF] mb-1" style={serif}>
                  Forgot password?
                </h2>
                <p className="text-[12px] text-[#8BA4BE] mb-7 font-light">
                  Enter your email and we'll send you a reset link.
                </p>

                <form onSubmit={handleSubmit} className="flex flex-col gap-5">
                  {error && (
                    <div className="bg-red-500/[0.06] border border-red-500/20 text-red-400 px-3.5 py-2.5 rounded-md text-[11px]" style={mono}>
                      ⚠ {error}
                    </div>
                  )}

                  <div>
                    <label className="block text-[10px] tracking-[0.15em] text-[#8BA4BE] uppercase mb-2" style={mono}>
                      Email address
                    </label>
                    <input
                      type="email"
                      required
                      placeholder="you@example.com"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      className={inputCls}
                      style={sans}
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3 rounded-md text-[11px] font-medium tracking-[0.2em] uppercase text-[#020810] hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    style={{ ...mono, background: 'linear-gradient(135deg, #C9A84C 0%, #A8892E 100%)' }}>
                    {loading ? 'Sending...' : 'Send Reset Link'}
                  </button>
                </form>

                <p className="text-center text-[11px] text-[#8BA4BE] mt-6">
                  Remember it?{' '}
                  <Link to="/login" className="text-[#C9A84C] hover:underline">Sign in →</Link>
                </p>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
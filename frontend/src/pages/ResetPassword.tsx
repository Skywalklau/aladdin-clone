import { useState, useEffect, type BaseSyntheticEvent } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import axios from 'axios'
import { mono, serif, sans } from '../lib/trading'

export default function ResetPassword() {
  const navigate       = useNavigate()
  const [searchParams] = useSearchParams()
  const token          = searchParams.get('token') ?? ''

  const [password,        setPassword]        = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading,         setLoading]         = useState(false)
  const [success,         setSuccess]         = useState(false)
  const [error,           setError]           = useState('')

  useEffect(() => {
    if (!token) navigate('/forgot-password', { replace: true })
  }, [token, navigate])

  const handleSubmit = async (e: BaseSyntheticEvent) => {
    e.preventDefault()
    setError('')
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return }
    if (password !== confirmPassword) { setError('Passwords do not match.'); return }
    setLoading(true)
    try {
      await axios.post('/api/auth/reset-password', { token, new_password: password })
      setSuccess(true)
      setTimeout(() => navigate('/login'), 3000)
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
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: 'radial-gradient(ellipse 60% 50% at 50% 40%, rgba(180,140,60,0.05) 0%, transparent 70%)' }} />

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

            {success ? (
              /* ── Success state ── */
              <div className="text-center">
                <div className="w-12 h-12 rounded-full border border-[#4CAF85]/30 bg-[#4CAF85]/[0.06] flex items-center justify-center mx-auto mb-5">
                  <span className="text-[#4CAF85] text-[20px]">✓</span>
                </div>
                <h2 className="text-[22px] font-semibold text-[#EDE8DF] mb-2" style={serif}>
                  Password updated
                </h2>
                <p className="text-[12px] text-[#8BA4BE] leading-relaxed mb-2" style={sans}>
                  Your password has been reset successfully.
                </p>
                <p className="text-[10px] text-[#4A6070] mb-6" style={mono}>
                  Redirecting you to sign in…
                </p>
                <Link to="/login"
                  className="text-[11px] tracking-[0.12em] uppercase text-[#C9A84C] hover:opacity-80 transition-opacity"
                  style={mono}>
                  Sign in now →
                </Link>
              </div>
            ) : (
              /* ── Form state ── */
              <>
                <h2 className="text-[22px] font-semibold text-[#EDE8DF] mb-1" style={serif}>
                  Set new password
                </h2>
                <p className="text-[12px] text-[#8BA4BE] mb-7 font-light">
                  Choose a strong password for your account.
                </p>

                <form onSubmit={handleSubmit} className="flex flex-col gap-5">
                  {error && (
                    <div className="bg-red-500/[0.06] border border-red-500/20 text-red-400 px-3.5 py-2.5 rounded-md text-[11px]" style={mono}>
                      ⚠ {error}
                    </div>
                  )}

                  <div>
                    <label className="block text-[10px] tracking-[0.15em] text-[#8BA4BE] uppercase mb-2" style={mono}>
                      New password
                    </label>
                    <input type="password" required placeholder="Min. 8 characters"
                      value={password} onChange={e => setPassword(e.target.value)}
                      className={inputCls} style={sans} />
                  </div>

                  <div>
                    <label className="block text-[10px] tracking-[0.15em] text-[#8BA4BE] uppercase mb-2" style={mono}>
                      Confirm password
                    </label>
                    <input type="password" required placeholder="••••••••••••"
                      value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
                      className={inputCls} style={sans} />
                  </div>

                  <button type="submit" disabled={loading}
                    className="w-full py-3 rounded-md text-[11px] font-medium tracking-[0.2em] uppercase text-[#020810] hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer"
                    style={{ ...mono, background: 'linear-gradient(135deg, #C9A84C 0%, #A8892E 100%)' }}>
                    {loading ? 'Updating...' : 'Update Password'}
                  </button>
                </form>

                <p className="text-center text-[11px] text-[#8BA4BE] mt-6">
                  <Link to="/login" className="text-[#C9A84C] hover:underline">← Back to sign in</Link>
                </p>
              </>
            )}

          </div>
        </div>
      </div>
    </>
  )
}
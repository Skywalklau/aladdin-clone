import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { listPortfolios, deletePortfolio, uploadPortfolio } from '../api/portfolio'
import { logout } from '../api/auth'
import type { Portfolio } from '../types/index'
import MarketIndices from '../components/MarketIndices'
import { mono, serif, sans } from '../lib/trading'

export default function Dashboard() {
  const navigate = useNavigate()
  const [portfolios,     setPortfolios]     = useState<Portfolio[]>([])
  const [loading,        setLoading]        = useState(true)
  const [error,          setError]          = useState('')
  const [uploading,      setUploading]      = useState(false)
  const [portfolioName,  setPortfolioName]  = useState('')
  const [file,           setFile]           = useState<File | null>(null)
  const [dragOver,       setDragOver]       = useState(false)
  const [showUpload,     setShowUpload]     = useState(false)

  useEffect(() => { fetchPortfolios() }, [])

  const fetchPortfolios = async () => {
    try {
      const data = await listPortfolios()
      setPortfolios(data)
    } catch {
      setError('Failed to load portfolios')
    } finally {
      setLoading(false)
    }
  }

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!file) return
    setUploading(true)
    setError('')
    try {
      await uploadPortfolio(file, portfolioName || 'My Portfolio')
      setFile(null)
      setPortfolioName('')
      setShowUpload(false)
      await fetchPortfolios()
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to upload portfolio')
    } finally {
      setUploading(false)
    }
  }

  const handleDelete = async (portfolioId: number, name: string) => {
    if (!confirm(`Delete "${name}"?`)) return
    try {
      await deletePortfolio(portfolioId)
      setPortfolios(portfolios.filter(p => p.id !== portfolioId))
    } catch {
      setError('Failed to delete portfolio')
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const dropped = e.dataTransfer.files[0]
    if (dropped?.name.endsWith('.csv')) setFile(dropped)
  }

  const inputCls = "w-full bg-[#0A1628]/80 border border-[#B8943C]/15 text-[#EDE8DF] rounded-md px-4 py-2.5 text-[13px] outline-none focus:border-[#C9A84C]/50 focus:ring-2 focus:ring-[#C9A84C]/[0.07] transition-all placeholder:text-[#1A2C42]"

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;600;700&family=IBM+Plex+Mono:wght@300;400;500&family=Sora:wght@300;400;500&display=swap');
        @keyframes fadeUp    { to { opacity: 1; transform: translateY(0); } }
        @keyframes slideDown { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>

      <div className="min-h-screen bg-[#020810] text-[#EDE8DF]" style={sans}>

        {/* ── NAVBAR ── */}
        <nav className="border-b border-[#B8943C]/10 px-10 py-4 flex items-center justify-between sticky top-0 z-50 bg-[#020810]/95 backdrop-blur-md">
          <div className="flex items-center gap-6">
            <span className="text-[22px] font-bold" style={serif}>
              Ala<span className="text-[#C9A84C]">ddin</span>
            </span>
            <div className="w-px h-4 bg-[#B8943C]/20" />
            <MarketIndices />
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setShowUpload(v => !v)}
              className="flex items-center gap-2 px-4 py-2 rounded-md text-[11px] tracking-[0.15em] uppercase text-[#020810] font-medium transition-all hover:opacity-90 cursor-pointer"
              style={{ ...mono, background: 'linear-gradient(135deg, #C9A84C 0%, #A8892E 100%)' }}>
              + New Portfolio
            </button>
            <button
              onClick={logout}
              className="text-[11px] tracking-[0.12em] uppercase text-[#8BA4BE] hover:text-[#EDE8DF] transition-colors cursor-pointer"
              style={mono}>
              Sign out
            </button>
          </div>
        </nav>

        <div className="max-w-5xl mx-auto px-8 py-10">

          {/* ── PAGE HEADER ── */}
          <div className="mb-10 opacity-0 translate-y-3 animate-[fadeUp_0.6s_0.05s_forwards]">
            <p className="text-[10px] tracking-[0.24em] text-[#B8943C] uppercase mb-2" style={mono}>
              Portfolio Management
            </p>
            <h1 className="text-[36px] font-semibold leading-tight" style={serif}>
              Your Portfolios
            </h1>
            <p className="text-[12px] text-[#8BA4BE] mt-1.5 font-light">
              {portfolios.length} portfolio{portfolios.length !== 1 ? 's' : ''} · Upload a CSV to analyse risk
            </p>
          </div>

          {/* ── UPLOAD PANEL ── */}
          {showUpload && (
            <div
              className="mb-8 border border-[#B8943C]/15 rounded-xl bg-[#020810]/80 overflow-hidden"
              style={{ animation: 'slideDown 0.25s ease forwards' }}>
              <div className="px-6 py-4 border-b border-[#B8943C]/10 flex items-center justify-between">
                <span className="text-[11px] tracking-[0.18em] uppercase text-[#8BA4BE]" style={mono}>
                  Upload Portfolio CSV
                </span>
                <button
                  onClick={() => setShowUpload(false)}
                  className="text-[#8BA4BE] hover:text-[#EDE8DF] text-[18px] leading-none transition-colors cursor-pointer">
                  ×
                </button>
              </div>

              <form onSubmit={handleUpload} className="p-6 flex flex-col gap-4">
                <div>
                  <label className="block text-[10px] tracking-[0.15em] text-[#8BA4BE] uppercase mb-2" style={mono}>
                    Portfolio Name
                  </label>
                  <input
                    type="text"
                    value={portfolioName}
                    onChange={e => setPortfolioName(e.target.value)}
                    placeholder="My Portfolio"
                    className={inputCls}
                    style={sans} />
                </div>

                {/* Drag & drop zone */}
                <div
                  onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={handleDrop}
                  className={`relative border-2 border-dashed rounded-lg px-6 py-8 text-center transition-all cursor-pointer ${
                    dragOver
                      ? 'border-[#C9A84C]/60 bg-[#C9A84C]/[0.04]'
                      : file
                        ? 'border-[#4CAF85]/40 bg-[#4CAF85]/[0.03]'
                        : 'border-[#B8943C]/15 hover:border-[#B8943C]/30'
                  }`}
                  onClick={() => document.getElementById('csv-input')?.click()}>
                  <input
                    id="csv-input"
                    type="file"
                    accept=".csv"
                    className="hidden"
                    onChange={e => setFile(e.target.files?.[0] || null)}
                    required={!file} />
                  {file ? (
                    <>
                      <p className="text-[#4CAF85] text-[11px]" style={mono}>✓ {file.name}</p>
                      <p className="text-[#8BA4BE] text-[10px] mt-1">{(file.size / 1024).toFixed(1)} KB</p>
                    </>
                  ) : (
                    <>
                      <p className="text-[#8BA4BE] text-[12px] mb-3">Drop CSV here or click to browse</p>
                      <div className="inline-block text-left rounded-md overflow-hidden border border-[#B8943C]/15 mb-2">
                        <div className="grid grid-cols-3 text-[9px] tracking-[0.12em] uppercase bg-[#0A1628]/80 border-b border-[#B8943C]/15" style={mono}>
                          {['symbol', 'quantity', 'avg_price'].map(col => (
                            <div key={col} className="px-3 py-1.5 text-[#C9A84C]">{col}</div>
                          ))}
                        </div>
                        {[
                          ['AAPL', '10', '172.50'],
                          ['MSFT', '2.5', '399.69'],
                          ['GOOGL', '4.25', '160.25'],
                        ].map((row, i) => (
                          <div key={i} className="grid grid-cols-3 text-[9px] border-b border-[#B8943C]/8 last:border-0 bg-[#020810]/60" style={mono}>
                            {row.map((cell, j) => (
                              <div key={j} className={`px-3 py-1.5 ${j === 0 ? 'text-[#EDE8DF]' : 'text-[#8BA4BE]'}`}>{cell}</div>
                            ))}
                          </div>
                        ))}
                      </div>
                      <p className="text-[11px] text-[#8BA4BE]" style={mono}>
                        one row per holding · fractional quantities supported
                      </p>
                    </>
                  )}
                </div>

                <div className="flex gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => setShowUpload(false)}
                    className="px-5 py-2.5 bg-transparent border border-[#B8943C]/20 rounded-md text-[11px] tracking-[0.15em] uppercase text-[#8BA4BE] hover:border-[#B8943C]/40 hover:text-[#C9A84C] transition-all cursor-pointer"
                    style={mono}>
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={uploading || !file}
                    className="flex-1 py-2.5 rounded-md text-[11px] font-medium tracking-[0.2em] uppercase text-[#020810] hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer"
                    style={{ ...mono, background: 'linear-gradient(135deg, #C9A84C 0%, #A8892E 100%)' }}>
                    {uploading ? 'Uploading...' : 'Upload Portfolio'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* ── ERROR ── */}
          {error && (
            <div className="bg-red-500/[0.06] border border-red-500/20 text-red-400 px-4 py-3 rounded-md text-[11px] mb-6" style={mono}>
              ⚠ {error}
            </div>
          )}

          {/* ── PORTFOLIO LIST ── */}
          {loading ? (
            <div className="flex flex-col gap-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-[76px] rounded-xl border border-[#B8943C]/8 bg-[#0A1628]/40 animate-pulse" />
              ))}
            </div>
          ) : portfolios.length === 0 ? (
            <div className="border border-dashed border-[#B8943C]/15 rounded-xl px-8 py-16 text-center opacity-0 translate-y-3 animate-[fadeUp_0.6s_0.2s_forwards]">
              <p className="text-[#C9A84C] text-[28px] mb-3" style={serif}>No portfolios yet</p>
              <p className="text-[12px] text-[#8BA4BE] mb-6 font-light">
                Upload a CSV file to start analysing your portfolio risk
              </p>
              <button
                onClick={() => setShowUpload(true)}
                className="px-6 py-2.5 rounded-md text-[11px] tracking-[0.18em] uppercase text-[#020810] font-medium cursor-pointer"
                style={{ ...mono, background: 'linear-gradient(135deg, #C9A84C 0%, #A8892E 100%)' }}>
                Upload your first portfolio
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {portfolios.map((portfolio, i) => (
                <div
                  key={portfolio.id}
                  onClick={() => navigate(`/portfolio/${portfolio.id}`)}
                  className="group border border-[#B8943C]/10 hover:border-[#B8943C]/25 rounded-xl bg-[#020810]/60 hover:bg-[#0F1E35] px-6 py-5 flex items-center justify-between transition-all duration-150 opacity-0 translate-y-3 cursor-pointer"
                  style={{ animation: `fadeUp 0.5s ${0.1 + i * 0.07}s forwards` }}>

                  {/* Left: index + name */}
                  <div className="flex items-center gap-5">
                    <div className="w-8 h-8 rounded-md border border-[#B8943C]/15 flex items-center justify-center flex-shrink-0">
                      <span className="text-[11px] text-[#C9A84C]" style={mono}>
                        {String(i + 1).padStart(2, '0')}
                      </span>
                    </div>
                    <div>
                      <h4 className="text-[15px] font-medium text-[#EDE8DF]" style={serif}>
                        {portfolio.name}
                      </h4>
                      <p className="text-[10px] text-[#8BA4BE] mt-0.5 tracking-wide" style={mono}>
                        Created {new Date(portfolio.created_at).toLocaleDateString('en-GB', {
                          day: 'numeric', month: 'short', year: 'numeric',
                        })}
                      </p>
                    </div>
                  </div>

                  {/* Right: delete + arrow */}
                  <div className="relative flex items-center justify-end w-[180px]">
                    <div className="absolute right-8 flex items-center">
                      <button
                        onClick={e => { e.stopPropagation(); handleDelete(portfolio.id, portfolio.name) }}
                        className="px-4 py-2 rounded-md text-[11px] tracking-[0.12em] uppercase text-red-400/50 border border-red-500/20 hover:text-red-400 hover:border-red-500/50 hover:bg-red-500/[0.06] transition-all cursor-pointer"
                        style={mono}>
                        Delete
                      </button>
                    </div>
                    <div className="text-[#B8943C]/30 group-hover:text-[#C9A84C]/60 transition-colors duration-150 text-[18px]">
                      →
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

        </div>
      </div>
    </>
  )
}
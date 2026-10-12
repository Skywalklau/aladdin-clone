import { useRef, useEffect } from 'react'
import type { Candle } from '../../types/index'
import {
  VOL_HEIGHT,
  BULL_COLOR, BEAR_COLOR,
  BULL_FILL,  BEAR_FILL,
  BULL_VOL,   BEAR_VOL,
} from '../../lib/trading'

interface CandleChartProps {
  candles:  Candle[]
  hoverIdx: number | null
  onHover:  (i: number | null) => void
}

function CandleChart({ candles, hoverIdx, onHover }: CandleChartProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef    = useRef<HTMLCanvasElement>(null)
  const dimsRef      = useRef({ w: 0, h: 0 })

  function draw(candles: Candle[], hoverIdx: number | null) {
    const canvas = canvasRef.current
    if (!canvas) return
    const { w: W, h: H } = dimsRef.current
    if (W === 0 || H === 0) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, W, H)

    const pad    = { t: 18, b: 6, l: 6, r: 52 }
    const chartH = H * (1 - VOL_HEIGHT)
    const volH   = H * VOL_HEIGHT - 4
    const innerW = W - pad.l - pad.r
    const innerH = chartH - pad.t - pad.b

    const allHigh = Math.max(...candles.map(c => c.h))
    const allLow  = Math.min(...candles.map(c => c.l))
    const rng = allHigh - allLow || 1
    const hi  = allHigh + rng * 0.06
    const lo  = allLow  - rng * 0.06

    const toX = (i: number) => pad.l + (i + 0.5) * (innerW / candles.length)
    const toY = (v: number) => pad.t + (1 - (v - lo) / (hi - lo)) * innerH
    const cw  = Math.max((innerW / candles.length) * 0.55, 2)

    // ── Grid lines + price labels ─────────────────────────────────────────────
    ctx.setLineDash([2, 5])
    ctx.lineWidth = 1
    for (let i = 0; i <= 5; i++) {
      const frac  = i / 5
      const price = lo + (1 - frac) * (hi - lo)
      const y     = pad.t + frac * innerH
      ctx.strokeStyle = 'rgba(255,255,255,0.04)'
      ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(W - pad.r, y); ctx.stroke()
      ctx.font      = "400 9px 'IBM Plex Mono'"
      ctx.fillStyle = 'rgba(139,164,190,0.65)'
      ctx.textAlign = 'left'
      ctx.fillText(price.toFixed(2), W - pad.r + 6, y + 3)
    }
    ctx.setLineDash([])

    // ── Volume bars ───────────────────────────────────────────────────────────
    const maxVol = Math.max(...candles.map(c => c.v))
    candles.forEach((c, i) => {
      const x  = toX(i)
      const bh = (c.v / maxVol) * volH
      ctx.fillStyle = c.c >= c.o ? BULL_VOL : BEAR_VOL
      ctx.beginPath()
      ctx.roundRect(
        x - cw * 0.5, H - bh, cw, bh,
        [Math.max(cw * 0.5, 1), Math.max(cw * 0.5, 1), 0, 0],
      )
      ctx.fill()
    })

    // ── Hover crosshair + tooltip ─────────────────────────────────────────────
    if (hoverIdx !== null && hoverIdx >= 0 && hoverIdx < candles.length) {
      const hc = candles[hoverIdx]
      const x  = toX(hoverIdx)
      const cy = toY((hc.o + hc.c) / 2)

      ctx.setLineDash([3, 4])
      ctx.strokeStyle = 'rgba(255,255,255,0.08)'
      ctx.lineWidth   = 1
      ctx.beginPath(); ctx.moveTo(x, pad.t);  ctx.lineTo(x, chartH);     ctx.stroke()
      ctx.beginPath(); ctx.moveTo(pad.l, cy); ctx.lineTo(W - pad.r, cy); ctx.stroke()
      ctx.setLineDash([])

      const bull  = hc.c >= hc.o
      const lines = [
        `O  ${hc.o.toFixed(2)}`,
        `H  ${hc.h.toFixed(2)}`,
        `L  ${hc.l.toFixed(2)}`,
        `C  ${hc.c.toFixed(2)}`,
      ]
      ctx.font  = "400 9px 'IBM Plex Mono'"
      const tw  = Math.max(...lines.map(t => ctx.measureText(t).width))
      const bw  = tw + 14
      const bh2 = lines.length * 13 + 10
      let   bx  = x - bw / 2
      if (bx + bw > W - pad.r) bx = W - pad.r - bw - 2
      if (bx < pad.l)           bx = pad.l
      const by = pad.t + 4

      ctx.fillStyle   = 'rgba(10,22,40,0.92)'
      ctx.strokeStyle = bull ? 'rgba(76,175,133,0.35)' : 'rgba(224,82,82,0.35)'
      ctx.lineWidth   = 1
      ctx.beginPath(); ctx.roundRect(bx, by, bw, bh2, 4); ctx.fill(); ctx.stroke()
      ctx.fillStyle = bull ? '#4CAF85' : '#E05252'
      ctx.textAlign = 'left'
      lines.forEach((line, li) => ctx.fillText(line, bx + 7, by + 13 + li * 13))
    }

    // ── Candle bodies + wicks ─────────────────────────────────────────────────
    candles.forEach((c, i) => {
      const x    = toX(i)
      const bull = c.c >= c.o
      const top  = toY(Math.max(c.o, c.c))
      const bot  = toY(Math.min(c.o, c.c))
      const ht   = Math.max(bot - top, 1.5)
      const isH  = hoverIdx === i

      ctx.globalAlpha = hoverIdx !== null && !isH ? 0.4 : 1

      // Wick
      ctx.strokeStyle = bull ? BULL_COLOR : BEAR_COLOR
      ctx.lineWidth   = 1
      if (isH) { ctx.shadowColor = bull ? BULL_COLOR : BEAR_COLOR; ctx.shadowBlur = 6 }
      ctx.beginPath(); ctx.moveTo(x, toY(c.h)); ctx.lineTo(x, toY(c.l)); ctx.stroke()
      ctx.shadowBlur = 0

      // Body
      ctx.fillStyle = bull ? BULL_FILL : BEAR_FILL
      if (isH) {
        ctx.strokeStyle = bull ? BULL_COLOR : BEAR_COLOR
        ctx.lineWidth   = 1.2
        ctx.shadowColor = bull ? BULL_COLOR : BEAR_COLOR
        ctx.shadowBlur  = 10
      }
      ctx.beginPath()
      ctx.roundRect(x - cw / 2, top, cw, ht, Math.min(cw * 0.25, 2))
      ctx.fill()
      if (isH) { ctx.stroke(); ctx.shadowBlur = 0 }

      ctx.globalAlpha = 1
    })

    // ── Last-price dashed line + badge ────────────────────────────────────────
    const last  = candles[candles.length - 1]
    const lastY = toY(last.c)
    const bull  = last.c >= last.o

    ctx.setLineDash([4, 4])
    ctx.strokeStyle = bull ? 'rgba(76,175,133,0.4)' : 'rgba(224,82,82,0.4)'
    ctx.lineWidth   = 1
    ctx.beginPath(); ctx.moveTo(pad.l, lastY); ctx.lineTo(W - pad.r, lastY); ctx.stroke()
    ctx.setLineDash([])

    ctx.fillStyle = bull ? BULL_COLOR : BEAR_COLOR
    ctx.beginPath(); ctx.roundRect(W - pad.r + 2, lastY - 7, 46, 14, 3); ctx.fill()
    ctx.font      = "500 9px 'IBM Plex Mono'"
    ctx.fillStyle = '#020810'
    ctx.textAlign = 'left'
    ctx.fillText(last.c.toFixed(2), W - pad.r + 5, lastY + 3.5)
  }

  // One ResizeObserver on the container div — never on the canvas
  useEffect(() => {
    const container = containerRef.current
    const canvas    = canvasRef.current
    if (!container || !canvas) return

    const ro = new ResizeObserver(() => {
      const dpr = window.devicePixelRatio || 1
      const w   = container.offsetWidth
      const h   = container.offsetHeight
      if (w === 0 || h === 0) return
      dimsRef.current = { w, h }
      canvas.width    = w * dpr
      canvas.height   = h * dpr
      draw(candles, hoverIdx)
    })
    ro.observe(container)
    return () => ro.disconnect()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Redraw on data / hover change — never resizes the buffer
  useEffect(() => {
    draw(candles, hoverIdx)
  }) // no dep array: runs after every render

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const { w: W } = dimsRef.current
    if (W === 0) return
    const canvas = canvasRef.current!
    const rect   = canvas.getBoundingClientRect()
    const scaleX = W / rect.width
    const x      = (e.clientX - rect.left) * scaleX
    const innerW = W - 6 - 52
    const i      = Math.floor((x - 6) / (innerW / candles.length))
    onHover(i >= 0 && i < candles.length ? i : null)
  }

  return (
    <div ref={containerRef} className="absolute inset-0 overflow-hidden">
      <canvas
        ref={canvasRef}
        style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => onHover(null)}
      />
    </div>
  )
}

export default CandleChart
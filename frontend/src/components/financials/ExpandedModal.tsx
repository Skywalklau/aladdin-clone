import type { ReactNode } from 'react'
import { mono, serif } from '../../lib/trading'

interface ExpandedModalProps {
  title:     string
  color:     string
  latest:    string
  badge?:    string | null
  badgeUp?:  boolean
  onClose:   () => void
  children:  ReactNode
}

function ExpandedModal({ title, color, latest, badge, badgeUp, onClose, children }: ExpandedModalProps) {
  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-8"
      style={{ background: 'rgba(2,8,16,0.88)', backdropFilter: 'blur(6px)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-4xl rounded-2xl overflow-hidden flex flex-col"
        style={{
          background: '#060F1E',
          border:     `1px solid ${color}30`,
          boxShadow:  `0 0 80px ${color}15, 0 0 0 1px #1A2840`,
        }}
        onClick={e => e.stopPropagation()}
      >
        <div className="h-[3px]" style={{ background: `linear-gradient(90deg, ${color}, ${color}20)` }} />

        <div className="px-7 pt-5 pb-4 flex items-center justify-between border-b border-[#1A2840]">
          <div>
            <p className="text-[11px] tracking-[0.16em] uppercase font-medium mb-1"
              style={{ ...mono, color: `${color}CC` }}>
              {title}
            </p>
            <div className="flex items-center gap-3">
              <p className="text-[32px] font-semibold leading-tight" style={{ ...serif, color: '#F0EBE0' }}>
                {latest}
              </p>
              {badge != null && (
                <span className="text-[13px] font-semibold px-2 py-1 rounded" style={{
                  ...mono,
                  color:      badgeUp ? '#5DD6A0' : '#F06B6B',
                  background: badgeUp ? 'rgba(76,175,133,0.15)' : 'rgba(224,82,82,0.15)',
                }}>
                  {badgeUp ? '▲' : '▼'} {badge}
                </span>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-[22px] leading-none transition-colors"
            style={{ color: '#4A6070' }}
            onMouseEnter={e => (e.currentTarget.style.color = '#EDE8DF')}
            onMouseLeave={e => (e.currentTarget.style.color = '#4A6070')}
          >
            ×
          </button>
        </div>

        <div className="px-7 py-6" style={{ height: 380 }}>
          {children}
        </div>

        <div className="px-7 pb-4">
          <p className="text-[9px] text-[#2E4460]" style={mono}>
            Click any bar for AI analysis · Click outside or × to close
          </p>
        </div>
      </div>
    </div>
  )
}

export default ExpandedModal
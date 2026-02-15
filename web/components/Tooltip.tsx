'use client'

import { createPortal, useCallback, useEffect, useRef, useState, type ReactNode } from 'react'

const TOOLTIP_OFFSET = 8

type Placement = 'top' | 'bottom'

interface TooltipProps {
  content: ReactNode
  children: ReactNode
  placement?: Placement
  /** Optional: only show tooltip when this is truthy (e.g. for conditional titles) */
  showWhen?: boolean
}

export default function Tooltip({ content, children, placement = 'top', showWhen = true }: TooltipProps) {
  const triggerRef = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  const [coords, setCoords] = useState<{ top: number; left: number; placement: Placement } | null>(null)

  const updatePosition = useCallback(() => {
    const el = triggerRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    let top: number
    let place: Placement = placement
    const left = rect.left + rect.width / 2
    const spaceAbove = rect.top
    const spaceBelow = typeof window !== 'undefined' ? window.innerHeight - rect.bottom : 999
    if (placement === 'top' && spaceAbove >= 40) {
      top = rect.top - TOOLTIP_OFFSET
      place = 'top'
    } else if (placement === 'bottom' || spaceAbove < 40) {
      top = rect.bottom + TOOLTIP_OFFSET
      place = 'bottom'
    } else {
      top = rect.top - TOOLTIP_OFFSET
      place = 'top'
    }
    setCoords({ top, left, placement: place })
  }, [placement])

  const show = useCallback(() => {
    if (!showWhen) return
    updatePosition()
    setVisible(true)
  }, [showWhen, updatePosition])

  const hide = useCallback(() => setVisible(false), [])

  useEffect(() => {
    if (!visible) return
    const onScroll = () => updatePosition()
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', updatePosition)
    return () => {
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', updatePosition)
    }
  }, [visible, updatePosition])

  const tooltipContent = visible && showWhen && content != null && content !== '' && coords && (
    <div
      className="fixed z-[100] pointer-events-none flex flex-col items-center"
      style={{
        left: coords.left,
        top: coords.top,
        transform: coords.placement === 'top' ? 'translate(-50%, -100%)' : 'translate(-50%, 0)',
      }}
    >
      <div
        className="rounded-[20px] backdrop-blur-md bg-black/60 border border-white/15 text-white text-sm font-medium px-3 py-2 shadow-lg whitespace-nowrap"
        style={{ backdropFilter: 'blur(12px)' }}
      >
        {content}
      </div>
    </div>
  )

  return (
    <>
      <div
        ref={triggerRef}
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
        className="inline-flex"
      >
        {children}
      </div>
      {typeof document !== 'undefined' && tooltipContent
        ? createPortal(tooltipContent, document.body)
        : null}
    </>
  )
}

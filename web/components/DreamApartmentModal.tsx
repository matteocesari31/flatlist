'use client'

import { useState, useEffect, useRef } from 'react'
import { Sparkles } from 'lucide-react'

interface DreamApartmentModalProps {
  isOpen: boolean
  onClose: () => void
  initialDescription: string | null
  onSave: (description: string) => Promise<void>
  isEvaluating?: boolean
  buttonRef?: React.RefObject<HTMLButtonElement | null>
}

export default function DreamApartmentModal({ 
  isOpen, 
  onClose, 
  initialDescription, 
  onSave,
  isEvaluating = false,
  buttonRef
}: DreamApartmentModalProps) {
  const [description, setDescription] = useState(initialDescription || '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [isAnimating, setIsAnimating] = useState(true)
  const [buttonPosition, setButtonPosition] = useState<{ x: number; y: number; width: number; height: number } | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const modalRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
      setDescription(initialDescription || '')
      setError(null)
      setSuccess(false)
      setIsAnimating(true)
      
      // Get button position for morph animation
      if (buttonRef?.current) {
        const rect = buttonRef.current.getBoundingClientRect()
        setButtonPosition({
          x: rect.left + rect.width / 2,
          y: rect.top + rect.height / 2,
          width: rect.width,
          height: rect.height
        })
      } else {
        setButtonPosition(null)
      }
      
      // Small delay to ensure the initial state is rendered, then start animation
      const timer = setTimeout(() => {
        setIsAnimating(false)
      }, 50)
      
      // Focus textarea after animation completes
      const focusTimer = setTimeout(() => {
        textareaRef.current?.focus()
      }, 300)
      
      return () => {
        clearTimeout(timer)
        clearTimeout(focusTimer)
      }
    } else {
      document.body.style.overflow = 'unset'
      // Reset animation state when modal closes so it's ready for next open
      setIsAnimating(true)
      setButtonPosition(null)
    }
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [isOpen, initialDescription, buttonRef])

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current
    if (textarea) {
      textarea.style.height = 'auto'
      textarea.style.height = `${Math.min(textarea.scrollHeight, 360)}px`
    }
  }, [description])

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      await onSave(description.trim())
      setSuccess(true)
      
      // Close modal after success
      setTimeout(() => {
        onClose()
        setSuccess(false)
      }, 1500)
    } catch (err: any) {
      console.error('Error saving dream apartment:', err)
      setError(err.message || 'Failed to save. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleClear = async () => {
    setLoading(true)
    setError(null)

    try {
      await onSave('')
      setDescription('')
      setSuccess(true)
      
      setTimeout(() => {
        onClose()
        setSuccess(false)
      }, 1500)
    } catch (err: any) {
      console.error('Error clearing dream apartment:', err)
      setError(err.message || 'Failed to clear. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const hasChanges = description.trim() !== (initialDescription || '').trim()
  const hasDescription = description.trim().length > 0

  if (!isOpen) return null

  // Calculate initial transform for morph animation
  const getInitialTransform = () => {
    if (!buttonPosition) return 'scale(1)'
    // Use viewport center as target
    const centerX = window.innerWidth / 2
    const centerY = window.innerHeight / 2
    // Estimate modal size (max-w-2xl ≈ 672px, but we'll use a reasonable estimate)
    const estimatedModalWidth = 600
    const estimatedModalHeight = 400
    const scaleX = buttonPosition.width / estimatedModalWidth
    const scaleY = buttonPosition.height / estimatedModalHeight
    const translateX = buttonPosition.x - centerX
    const translateY = buttonPosition.y - centerY
    return `translate(${translateX}px, ${translateY}px) scale(${scaleX}, ${scaleY})`
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-md bg-white/10 p-4"
      style={{ 
        opacity: isAnimating ? 0 : 1,
        transition: 'opacity 200ms ease-out',
        backdropFilter: 'blur(12px)'
      }}
      onClick={onClose}
    >
      <div
        ref={modalRef}
        className="backdrop-blur-md bg-white/10 border border-white/20 rounded-[30px] max-w-2xl w-full p-8 pb-6 shadow-2xl relative"
        style={{
          transform: isAnimating && buttonPosition ? getInitialTransform() : 'scale(1)',
          opacity: isAnimating ? 0 : 1,
          transition: 'transform 300ms cubic-bezier(0.4, 0, 0.2, 1), opacity 300ms ease-out',
          backdropFilter: 'blur(12px)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-white/70 hover:text-white transition-colors"
          aria-label="Close"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-6 w-6"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>

        {success ? (
          <div className="text-center py-8">
            <div className="text-green-400 mb-3">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-12 w-12 mx-auto"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <p className="text-white font-medium">
              {description.trim() ? 'Saved!' : 'Cleared!'}
            </p>
            {description.trim() && (
              <p className="text-sm text-gray-400 mt-2">
                Evaluating your listings...
              </p>
            )}
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <textarea
                ref={textareaRef}
                id="dream-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-0 py-3 border-0 bg-transparent text-white text-[18px] focus:outline-none focus:ring-0 resize-none min-h-[200px] placeholder-gray-500"
                placeholder="Describe your ideal apartment in your own words. The AI will compare each listing to your vision."
                disabled={loading}
                rows={4}
              />
            </div>

            {/* Evaluation status */}
            {isEvaluating && (
              <div className="flex items-center gap-2 p-3 bg-blue-900/30 text-blue-300 rounded-lg text-sm">
                <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                <span>Evaluating listings against your description...</span>
              </div>
            )}

            {error && (
              <div className="p-3 bg-red-900/30 text-red-300 rounded-lg text-sm">
                {error}
              </div>
            )}

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1 text-xs text-gray-400">
                <Sparkles className="w-3 h-3" />
                <span>AI-powered matching</span>
              </div>
              
              <div className="flex-1"></div>
              
              <button
                type="submit"
                disabled={loading || !hasChanges || !hasDescription}
                className="px-4 py-2 bg-white text-black rounded-[30px] hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Saving...
                  </>
                ) : (
                  'Save'
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

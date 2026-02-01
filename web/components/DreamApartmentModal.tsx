'use client'

import { useState, useEffect, useRef } from 'react'
import { Sparkles } from 'lucide-react'

interface DreamApartmentModalProps {
  isOpen: boolean
  onClose: () => void
  initialDescription: string | null
  onSave: (description: string) => Promise<void>
  isEvaluating?: boolean
  triggerPosition?: { x: number; y: number }
}

export default function DreamApartmentModal({ 
  isOpen, 
  onClose, 
  initialDescription, 
  onSave,
  isEvaluating = false,
  triggerPosition
}: DreamApartmentModalProps) {
  const [description, setDescription] = useState(initialDescription || '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [isAnimating, setIsAnimating] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const modalRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
      setDescription(initialDescription || '')
      setError(null)
      setSuccess(false)
      setIsAnimating(true)
      
      // Focus textarea after animation
      setTimeout(() => {
        textareaRef.current?.focus()
        setIsAnimating(false)
      }, 300)
    } else {
      document.body.style.overflow = 'unset'
      setIsAnimating(false)
    }
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [isOpen, initialDescription])

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

  // Calculate initial position for animation
  const getInitialStyle = () => {
    if (!triggerPosition || !isAnimating) return {}
    
    const windowWidth = typeof window !== 'undefined' ? window.innerWidth : 1920
    const windowHeight = typeof window !== 'undefined' ? window.innerHeight : 1080
    
    // Calculate translate values to position modal at trigger point
    const translateX = triggerPosition.x - windowWidth / 2
    const translateY = triggerPosition.y - windowHeight / 2
    
    return {
      transform: `translate(${translateX}px, ${translateY}px) scale(0.1)`,
      opacity: 0
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-md bg-white/10 p-4 transition-opacity duration-300"
      style={{ opacity: isAnimating ? 0 : 1 }}
      onClick={onClose}
    >
      <div
        ref={modalRef}
        className="bg-[#0D0D0D] rounded-[20px] max-w-2xl w-full min-h-[420px] p-6 shadow-2xl border border-gray-700 relative transition-all duration-300 ease-out"
        style={isAnimating ? getInitialStyle() : { transform: 'translate(0, 0) scale(1)', opacity: 1 }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-200 transition-colors"
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
                className="w-full px-0 py-3 border-0 bg-transparent text-white focus:outline-none focus:ring-0 resize-none min-h-[200px] placeholder-gray-500"
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

              {initialDescription && (
                <button
                  type="button"
                  onClick={handleClear}
                  className="px-4 py-2 text-red-400 border border-red-600 rounded-lg hover:bg-red-900/30 transition-colors text-sm"
                  disabled={loading}
                >
                  Clear
                </button>
              )}
              
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-gray-200 border border-gray-600 rounded-lg hover:bg-gray-800 transition-colors"
                disabled={loading}
              >
                Cancel
              </button>
              
              <button
                type="submit"
                disabled={loading || !hasChanges || !hasDescription}
                className="px-4 py-2 bg-white text-black rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
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

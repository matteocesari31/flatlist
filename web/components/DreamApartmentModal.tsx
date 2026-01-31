'use client'

import { useState, useEffect, useRef } from 'react'
import { House, Sparkles } from 'lucide-react'

interface DreamApartmentModalProps {
  isOpen: boolean
  onClose: () => void
  initialDescription: string | null
  onSave: (description: string) => Promise<void>
  isEvaluating?: boolean
}

export default function DreamApartmentModal({ 
  isOpen, 
  onClose, 
  initialDescription, 
  onSave,
  isEvaluating = false
}: DreamApartmentModalProps) {
  const [description, setDescription] = useState(initialDescription || '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
      setDescription(initialDescription || '')
      setError(null)
      setSuccess(false)
      // Focus textarea after modal opens
      setTimeout(() => {
        textareaRef.current?.focus()
      }, 100)
    } else {
      document.body.style.overflow = 'unset'
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

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-md bg-white/10 p-4"
      onClick={onClose}
    >
      <div
        className="bg-[#0D0D0D] rounded-[20px] max-w-2xl w-full min-h-[420px] p-6 shadow-2xl border border-gray-700"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <House className="w-6 h-6 text-white" />
            <h2 className="text-xl font-semibold text-white">My Dream Apartment</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-200 transition-colors"
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
        </div>

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
              <label htmlFor="dream-description" className="block text-sm text-gray-300 mb-2">
                Describe your ideal apartment in your own words. The AI will compare each listing to your vision.
              </label>
              <textarea
                ref={textareaRef}
                id="dream-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-4 py-3 border border-gray-600 bg-gray-900/50 text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-white/20 resize-none min-h-[200px] placeholder-gray-500"
                placeholder="e.g. A bright 2-bedroom apartment near the city center with a balcony, modern kitchen, and within walking distance to public transport. I prefer quiet neighborhoods and renovated buildings. Budget around €1,200/month."
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

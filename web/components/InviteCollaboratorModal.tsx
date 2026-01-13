'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'

interface InviteCollaboratorModalProps {
  isOpen: boolean
  onClose: () => void
  catalogId: string
}

export default function InviteCollaboratorModal({ isOpen, onClose, catalogId }: InviteCollaboratorModalProps) {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [isResend, setIsResend] = useState(false)

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
      setEmail('')
      setError(null)
      setSuccess(false)
      setIsResend(false)
    } else {
      document.body.style.overflow = 'unset'
    }
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [isOpen])

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setSuccess(false)

    try {
      const supabase = createClient()
      
      // Get session for auth token
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        throw new Error('You must be logged in to send invitations')
      }

      // Call the send-invitation edge function directly with fetch for better error handling
      console.log('Calling send-invitation function with:', { catalogId, invitedEmail: email.trim().toLowerCase() })
      
      // Get Supabase URL - in client components, we can access NEXT_PUBLIC_ env vars
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
      if (!supabaseUrl) {
        throw new Error('Supabase URL not configured')
      }
      
      const functionUrl = `${supabaseUrl}/functions/v1/send-invitation`
      
      const response = await fetch(functionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          catalogId,
          invitedEmail: email.trim().toLowerCase(),
        }),
      })

      const responseData = await response.json()

      if (!response.ok) {
        // Extract error message from response
        const errorMessage = responseData.error || `Failed to send invitation (${response.status})`
        throw new Error(errorMessage)
      }

      if (responseData.error) {
        throw new Error(responseData.error)
      }

      if (!responseData.success) {
        throw new Error('Failed to send invitation. Please try again.')
      }

      setIsResend(responseData.resend || false)
      setSuccess(true)
      setEmail('')
      
      // Show success message with resend info if applicable
      if (responseData.resend) {
        // Keep success state visible longer for resend
        setTimeout(() => {
          onClose()
          setSuccess(false)
          setIsResend(false)
        }, 3000)
      } else {
        // Close modal after 2 seconds for new invitations
        setTimeout(() => {
          onClose()
          setSuccess(false)
          setIsResend(false)
        }, 2000)
      }
    } catch (err: any) {
      console.error('Error sending invitation:', err)
      setError(err.message || 'Failed to send invitation. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-md bg-white/10 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-[20px] max-w-md w-full p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Invite Collaborator</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
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
          <div className="text-center py-4">
            <div className="text-green-600 mb-2">
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
            <p className="text-gray-700">
              {isResend ? 'Invitation resent successfully!' : 'Invitation sent successfully!'}
            </p>
            {isResend && (
              <p className="text-sm text-gray-500 mt-2">
                The invitation link has been updated and sent again.
              </p>
            )}
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                Email Address
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none"
                placeholder="collaborator@example.com"
                disabled={loading}
              />
            </div>

            {error && (
              <div className="p-3 bg-red-100 text-red-700 rounded-md text-sm">
                {error}
              </div>
            )}

            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
                disabled={loading}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || !email.trim()}
                className="px-4 py-2 bg-black text-white rounded-md hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? 'Sending...' : 'Send Invitation'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}


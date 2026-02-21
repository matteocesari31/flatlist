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
  const [inviteLink, setInviteLink] = useState<string | null>(null)
  const [emailSent, setEmailSent] = useState(true)

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
      setEmail('')
      setError(null)
      setSuccess(false)
      setIsResend(false)
      setInviteLink(null)
      setEmailSent(true)
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
      const url = responseData.acceptUrl ?? responseData.invitation?.acceptUrl
      if (url) setInviteLink(url)
      // Only treat as "email sent" when the backend explicitly says so (newer Edge Function)
      setEmailSent(responseData.emailSent === true)
      if (responseData.resend) {
        setTimeout(() => {
          onClose()
          setSuccess(false)
          setIsResend(false)
          setInviteLink(null)
        }, 3000)
      } else {
        setTimeout(() => {
          onClose()
          setSuccess(false)
          setIsResend(false)
          setInviteLink(null)
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
        className="backdrop-blur-md bg-black/80 border border-white/15 rounded-[30px] max-w-md w-full p-6 shadow-2xl"
        style={{ backdropFilter: 'blur(12px)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-xl font-semibold text-white">Invite Collaborator</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-white/70 hover:bg-white/10 hover:text-white transition-colors"
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
            <div className="text-green-400 mb-2">
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
              {inviteLink && !emailSent
                ? 'Invitation created. The email could not be sent.'
                : isResend
                  ? 'Invitation resent successfully!'
                  : 'Invitation sent successfully!'}
            </p>
            {isResend && emailSent && (
              <p className="text-sm text-gray-400 mt-2">
                The invitation link has been updated and sent again.
              </p>
            )}
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="invite-email" className="block text-sm font-medium text-[#979797] mb-2">
                Email Address
              </label>
              <input
                id="invite-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-4 py-2.5 bg-black/40 border border-white/20 text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-white/50 focus:border-white/50 placeholder-[#979797]"
                placeholder="collaborator@example.com"
                disabled={loading}
              />
            </div>

            {error && (
              <div className="p-3 bg-red-900/30 text-red-300 border border-red-800 rounded-xl text-sm">
                {error}
              </div>
            )}

            <div className="flex gap-3 justify-end pt-1">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 text-gray-200 border border-white/20 rounded-xl hover:bg-white/10 transition-colors font-medium"
                disabled={loading}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || !email.trim()}
                className="px-4 py-2.5 bg-white text-black rounded-xl hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
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


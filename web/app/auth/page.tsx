'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'

export default function AuthPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [isError, setIsError] = useState(false)

  // Check for invitation token in URL
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search)
    const inviteToken = urlParams.get('invite_token')
    if (inviteToken) {
      // Store token to use after auth callback
      sessionStorage.setItem('pending_invite_token', inviteToken)
    }
  }, [])

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage('')
    setIsError(false)

    try {
      const supabase = createClient()
      
      // Check for pending invitation token
      const inviteToken = sessionStorage.getItem('pending_invite_token')
      const redirectUrl = inviteToken 
        ? `${window.location.origin}/auth/callback?invite_token=${inviteToken}`
        : `${window.location.origin}/auth/callback`
      
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: redirectUrl,
        },
      })

      if (error) {
        throw error
      }

      setMessage('Check your email for the magic link!')
      setIsError(false)
    } catch (error: any) {
      setMessage(error.message || 'Failed to send magic link')
      setIsError(true)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <img src="/logo.svg" alt="flatlist" className="h-10 mx-auto" />
        </div>
        <form onSubmit={handleMagicLink} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm mb-2">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-900"
              placeholder="your@email.com"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full px-4 py-2 bg-gray-900 text-white rounded-md hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Sending...' : 'Send Magic Link'}
          </button>
        </form>
        {message && (
          <div className={`mt-4 p-3 rounded-md ${isError ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
            {message}
          </div>
        )}
      </div>
    </div>
  )
}


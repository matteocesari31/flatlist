'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import Link from 'next/link'

export default function ResetPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [isError, setIsError] = useState(false)
  const [sent, setSent] = useState(false)

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage('')
    setIsError(false)

    try {
      const supabase = createClient()
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/update-password`,
      })

      if (error) {
        throw error
      }

      setSent(true)
      setMessage('Check your email for the password reset link')
      setIsError(false)
    } catch (error: any) {
      setMessage(error.message || 'Failed to send password reset email')
      setIsError(true)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#0B0B0B] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <video
            src="/flatlist rotating logo.mp4"
            autoPlay
            loop
            muted
            playsInline
            className="h-10 mx-auto object-contain"
            aria-label="flatlist"
          />
        </div>

        <div className="backdrop-blur-md bg-black/60 border border-white/15 rounded-[20px] p-6 shadow-lg" style={{ backdropFilter: 'blur(12px)' }}>
          <h1 className="text-xl font-semibold text-white mb-2">Reset Password</h1>
          <p className="text-sm text-gray-400 mb-6">
            Enter your email address and we'll send you a link to reset your password.
          </p>

          {sent ? (
            <div className="space-y-4">
              <div className="p-4 bg-green-900/30 text-green-300 border border-green-800 rounded-md text-sm">
                {message}
              </div>
              <Link
                href="/auth"
                className="block w-full px-4 py-3 bg-white text-black rounded-xl hover:bg-gray-200 transition-colors font-medium text-center"
              >
                Back to Sign In
              </Link>
            </div>
          ) : (
            <form onSubmit={handleResetPassword} className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-sm text-gray-300 mb-2">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full px-4 py-2 bg-transparent border border-gray-700 text-white rounded-md focus:outline-none focus:ring-2 focus:ring-white/50 focus:border-white/50 placeholder-gray-500"
                  placeholder="your@email.com"
                  disabled={loading}
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full px-4 py-3 bg-white text-black rounded-xl hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Sending...
                  </span>
                ) : (
                  'Send Reset Link'
                )}
              </button>

              {message && (
                <div className={`p-3 rounded-md text-sm ${
                  isError 
                    ? 'bg-red-900/30 text-red-300 border border-red-800' 
                    : 'bg-green-900/30 text-green-300 border border-green-800'
                }`}>
                  {message}
                </div>
              )}

              <div className="text-center">
                <Link
                  href="/auth"
                  className="text-sm text-gray-400 hover:text-gray-200 transition-colors"
                >
                  Back to Sign In
                </Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}

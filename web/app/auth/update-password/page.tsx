'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff } from 'lucide-react'
import Link from 'next/link'

export default function UpdatePasswordPage() {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [isError, setIsError] = useState(false)
  const router = useRouter()

  useEffect(() => {
    // Check if user has a valid session (from password reset link)
    const checkSession = async () => {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.push('/auth/reset-password')
      }
    }
    checkSession()
  }, [router])

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage('')
    setIsError(false)

    // Validate passwords match
    if (password !== confirmPassword) {
      setMessage('Passwords do not match')
      setIsError(true)
      setLoading(false)
      return
    }

    // Validate password strength
    if (password.length < 6) {
      setMessage('Password must be at least 6 characters')
      setIsError(true)
      setLoading(false)
      return
    }

    try {
      const supabase = createClient()
      const { error } = await supabase.auth.updateUser({
        password: password,
      })

      if (error) {
        throw error
      }

      setMessage('Password updated successfully! Redirecting...')
      setIsError(false)
      
      // Redirect to home after a short delay
      setTimeout(() => {
        router.push('/')
      }, 2000)
    } catch (error: any) {
      setMessage(error.message || 'Failed to update password')
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
          <h1 className="text-xl font-semibold text-white mb-2">Set New Password</h1>
          <p className="text-sm text-gray-400 mb-6">
            Enter your new password below.
          </p>

          <form onSubmit={handleUpdatePassword} className="space-y-4">
            <div>
              <label htmlFor="password" className="block text-sm text-gray-300 mb-2">
                New Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full px-4 py-2 pr-10 bg-transparent border border-gray-700 text-white rounded-md focus:outline-none focus:ring-2 focus:ring-white/50 focus:border-white/50 placeholder-gray-500"
                  placeholder="At least 6 characters"
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-200 transition-colors"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm text-gray-300 mb-2">
                Confirm Password
              </label>
              <div className="relative">
                <input
                  id="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  className="w-full px-4 py-2 pr-10 bg-transparent border border-gray-700 text-white rounded-md focus:outline-none focus:ring-2 focus:ring-white/50 focus:border-white/50 placeholder-gray-500"
                  placeholder="Confirm your password"
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-200 transition-colors"
                  aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
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
                  Updating...
                </span>
              ) : (
                'Update Password'
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
        </div>
      </div>
    </div>
  )
}

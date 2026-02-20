'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff } from 'lucide-react'

export default function AuthPage() {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [isError, setIsError] = useState(false)
  const [hasInvitation, setHasInvitation] = useState(false)
  const router = useRouter()

  // Check for invitation token in URL
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search)
    const inviteToken = urlParams.get('invite_token')
    if (inviteToken) {
      sessionStorage.setItem('pending_invite_token', inviteToken)
      setHasInvitation(true)
    }
  }, [])

  const getRedirectUrl = () => {
    const inviteToken = sessionStorage.getItem('pending_invite_token')
    return inviteToken 
      ? `${window.location.origin}/auth/callback?invite_token=${inviteToken}`
      : `${window.location.origin}/auth/callback`
  }

  const handleSignUp = async (e: React.FormEvent) => {
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
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: getRedirectUrl(),
        },
      })

      if (error) {
        throw error
      }

      if (data.user && !data.session) {
        // Email confirmation required
        setMessage('Please check your email to confirm your account')
        setIsError(false)
      } else {
        // Auto-signed in, redirect
        router.push('/')
      }
    } catch (error: any) {
      if (error.message?.includes('already registered')) {
        setMessage('An account with this email already exists. Try signing in instead.')
      } else {
        setMessage(error.message || 'Failed to create account')
      }
      setIsError(true)
    } finally {
      setLoading(false)
    }
  }

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage('')
    setIsError(false)

    try {
      const supabase = createClient()
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) {
        // Handle backward compatibility: if user exists but has no password
        if (error.message?.includes('Invalid login credentials') || error.message?.includes('Email not confirmed')) {
          setMessage('No password set for this account. Please use "Forgot Password" to set one.')
          setIsError(true)
        } else {
          throw error
        }
        setLoading(false)
        return
      }

      if (data.session) {
        router.push('/')
      }
    } catch (error: any) {
      setMessage(error.message || 'Failed to sign in')
      setIsError(true)
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
        
        {/* Show invitation context */}
        {hasInvitation && (
          <div className="mb-6 p-4 backdrop-blur-md bg-blue-900/30 border border-blue-800 rounded-xl text-center">
            <div className="text-sm text-blue-300 mb-1">You've been invited to collaborate!</div>
            <div className="text-xs text-blue-400">Sign in or create an account to accept the invitation</div>
          </div>
        )}
        
        {/* Auth Card */}
        <div className="backdrop-blur-md bg-black/60 border border-white/15 rounded-[20px] p-6 shadow-lg" style={{ backdropFilter: 'blur(12px)' }}>
          {/* Toggle between Sign In and Sign Up */}
          <div className="flex gap-2 mb-6">
            <button
              type="button"
              onClick={() => {
                setMode('signin')
                setMessage('')
                setIsError(false)
              }}
              className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                mode === 'signin'
                  ? 'bg-white text-black'
                  : 'bg-transparent text-gray-400 hover:text-gray-200'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('signup')
                setMessage('')
                setIsError(false)
              }}
              className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                mode === 'signup'
                  ? 'bg-white text-black'
                  : 'bg-transparent text-gray-400 hover:text-gray-200'
              }`}
            >
              Sign Up
            </button>
          </div>

          <form onSubmit={mode === 'signup' ? handleSignUp : handleSignIn} className="space-y-4">
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

            <div>
              <label htmlFor="password" className="block text-sm text-gray-300 mb-2">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full px-4 py-2 pr-10 bg-transparent border border-gray-700 text-white rounded-md focus:outline-none focus:ring-2 focus:ring-white/50 focus:border-white/50 placeholder-gray-500"
                  placeholder={mode === 'signup' ? 'At least 6 characters' : 'Enter your password'}
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

            {mode === 'signup' && (
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
            )}

            {mode === 'signin' && (
              <div className="text-right">
                <a
                  href="/auth/reset-password"
                  className="text-sm text-gray-400 hover:text-gray-200 transition-colors"
                >
                  Forgot password?
                </a>
              </div>
            )}

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
                  {mode === 'signup' ? 'Creating account...' : 'Signing in...'}
                </span>
              ) : (
                mode === 'signup' ? 'Sign Up' : 'Sign In'
              )}
            </button>
          </form>

          {message && (
            <div className={`mt-4 p-3 rounded-md text-sm ${
              isError 
                ? 'bg-red-900/30 text-red-300 border border-red-800' 
                : 'bg-green-900/30 text-green-300 border border-green-800'
            }`}>
              {message}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}


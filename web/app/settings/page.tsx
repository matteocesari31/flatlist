'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { syncTokensToExtension as syncTokens } from '@/lib/extension-sync'
import { useRouter } from 'next/navigation'

export default function SettingsPage() {
  const [user, setUser] = useState<any>(null)
  const [token, setToken] = useState<string>('')
  const [message, setMessage] = useState('')
  const router = useRouter()

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        router.push('/auth')
        return
      }
      setUser(user)
      
      // Get session token and refresh token
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session?.access_token) {
          setToken(session.access_token)
          // Send tokens to extension automatically
          sendTokensToExtension(session.access_token, session.refresh_token, session.expires_at)
        }
      })
    })

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.access_token) {
        setToken(session.access_token)
        // Send tokens to extension automatically
        sendTokensToExtension(session.access_token, session.refresh_token, session.expires_at)
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [router])

  const sendTokensToExtension = (accessToken: string, refreshToken: string | undefined, expiresAt: number | undefined) => {
    syncTokens(accessToken, refreshToken, expiresAt)
  }

  const copyToken = () => {
    navigator.clipboard.writeText(token).then(() => {
      setMessage('Token copied! Paste it in the extension settings.')
      setTimeout(() => setMessage(''), 3000)
    })
  }

  const manualSyncTokens = async () => {
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    
    if (!session?.access_token) {
      setMessage('No active session. Please sign in again.')
      return
    }

    // Use the sync utility (which uses postMessage)
    syncTokens(session.access_token, session.refresh_token, session.expires_at)
    setMessage('Tokens synced to extension! If extension is installed, it should be signed in now.')
    setTimeout(() => setMessage(''), 5000)
  }

  const [apiUrl, setApiUrl] = useState('')

  useEffect(() => {
    setApiUrl(process.env.NEXT_PUBLIC_SUPABASE_URL || '')
  }, [])

  const getExtensionInstructions = () => {
    return `To connect the flatlist extension:

1. Open Chrome and go to chrome://extensions/
2. Find flatlist extension and click "Details"
3. Open the browser console (F12) on any page
4. Run these commands:
   chrome.storage.sync.set({ supabaseToken: '${token}' })
   chrome.storage.sync.set({ apiUrl: '${apiUrl}' })

Alternatively, you can manually copy the token below and configure it in the extension.`
  }

  if (!user) {
    return null
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <a href="/">
              <img src="/logo.svg" alt="flatlist" className="h-10" />
            </a>
            <a
              href="/"
              className="text-sm px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Back to Catalog
            </a>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-3xl font-bold mb-6">Extension Settings</h1>

        <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
          <div>
            <h2 className="text-lg font-semibold mb-2">Authentication Token</h2>
            <p className="text-sm text-gray-600 mb-4">
              Copy this token to connect your browser extension
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                value={token}
                readOnly
                className="flex-1 px-4 py-2 border border-gray-300 rounded-md bg-gray-50 font-mono text-sm"
              />
              <button
                onClick={copyToken}
                className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Copy Token
              </button>
              <button
                onClick={manualSyncTokens}
                className="px-4 py-2 rounded-md hover:opacity-90 btn-primary"
              >
                Sync to Extension
              </button>
            </div>
          </div>

          {message && (
            <div className="p-3 bg-green-100 text-green-700 rounded-md text-sm">
              {message}
            </div>
          )}

          <div className="mt-6 pt-6 border-t border-gray-200">
            <h2 className="text-lg font-semibold mb-2">Setup Instructions</h2>
            <div className="bg-gray-50 p-4 rounded-md">
              <pre className="text-xs whitespace-pre-wrap font-mono">
                {getExtensionInstructions()}
              </pre>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}


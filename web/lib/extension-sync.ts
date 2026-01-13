// Utility to sync tokens to extension automatically
// This can be used from any page in the app

export function syncTokensToExtension(
  accessToken: string,
  refreshToken: string | undefined,
  expiresAt: number | undefined
) {
  try {
    // Calculate expiry timestamp (Supabase uses seconds, not milliseconds)
    const expiry = expiresAt ? expiresAt : null
    
    // Send tokens to extension via postMessage (content script will pick it up)
    // This works because the extension has a content script on the flatlist domain
    window.postMessage({
      type: 'FLATLIST_SYNC_TOKENS',
      accessToken,
      refreshToken,
      expiry,
      anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
      apiUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || ''
    }, window.location.origin)
    
    // Also try dispatching a custom event (alternative method)
    const event = new CustomEvent('flatlist-sync-tokens', {
      detail: {
        accessToken,
        refreshToken,
        expiry,
        anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
        apiUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || ''
      }
    })
    document.dispatchEvent(event)
    
    console.log('✅ Tokens synced to extension automatically')
  } catch (error) {
    // Extension not available - that's okay
    console.log('Extension not available for auto-sync')
  }
}


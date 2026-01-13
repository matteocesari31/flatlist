// Content script that runs on flatlist domain to receive auth tokens
// This allows the web app to automatically sign in the extension

(function() {
  'use strict';

  // Listen for messages from the flatlist web app
  window.addEventListener('message', (event) => {
    // Only accept messages from the same origin (flatlist domain)
    if (event.origin !== window.location.origin) {
      return;
    }

    // Check if this is a token sync message
    if (event.data && event.data.type === 'FLATLIST_SYNC_TOKENS') {
      const { accessToken, refreshToken, expiry, anonKey, apiUrl } = event.data;
      
      // Forward to background script
      chrome.runtime.sendMessage({
        action: 'storeTokens',
        accessToken,
        refreshToken,
        expiry,
        anonKey,
        apiUrl
      }, (response) => {
        if (response && response.success) {
          console.log('✅ Tokens synced to extension automatically');
        } else {
          console.error('Failed to sync tokens to extension');
        }
      });
    }
  });

  // Also listen for a custom event that the page can dispatch
  document.addEventListener('flatlist-sync-tokens', (event) => {
    const { accessToken, refreshToken, expiry, anonKey, apiUrl } = event.detail || {};
    
    if (accessToken) {
      chrome.runtime.sendMessage({
        action: 'storeTokens',
        accessToken,
        refreshToken,
        expiry,
        anonKey,
        apiUrl
      }, (response) => {
        if (response && response.success) {
          console.log('✅ Tokens synced to extension automatically');
        }
      });
    }
  });

  // Listen for requests from background script to get current session
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'getSession') {
      // Inject a script into the page context to access localStorage and window.supabase
      const script = document.createElement('script');
      script.textContent = `
        (function() {
          // Try to get session from Supabase client if available
          if (window.supabase && typeof window.supabase.auth === 'object') {
            window.supabase.auth.getSession().then(({ data: { session } }) => {
              window.postMessage({
                type: 'FLATLIST_SESSION_RESPONSE',
                session: session ? {
                  access_token: session.access_token,
                  refresh_token: session.refresh_token,
                  expires_at: session.expires_at
                } : null
              }, '*');
            }).catch(() => {
              window.postMessage({
                type: 'FLATLIST_SESSION_RESPONSE',
                session: null
              }, '*');
            });
          } else {
            // Fallback: try to get from localStorage
            try {
              // Supabase stores session in localStorage with pattern sb-{project}-auth-token
              // We need to find the right key
              let session = null;
              for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && key.includes('auth-token')) {
                  try {
                    const stored = JSON.parse(localStorage.getItem(key));
                    if (stored && stored.currentSession) {
                      session = {
                        access_token: stored.currentSession.access_token,
                        refresh_token: stored.currentSession.refresh_token,
                        expires_at: stored.currentSession.expires_at
                      };
                      break;
                    }
                  } catch (e) {
                    // Continue searching
                  }
                }
              }
              window.postMessage({
                type: 'FLATLIST_SESSION_RESPONSE',
                session: session
              }, '*');
            } catch (e) {
              window.postMessage({
                type: 'FLATLIST_SESSION_RESPONSE',
                session: null
              }, '*');
            }
          }
        })();
      `;
      (document.head || document.documentElement).appendChild(script);
      script.remove();
      
      // Listen for the response
      const messageHandler = (event) => {
        if (event.data && event.data.type === 'FLATLIST_SESSION_RESPONSE') {
          window.removeEventListener('message', messageHandler);
          sendResponse({ session: event.data.session });
        }
      };
      window.addEventListener('message', messageHandler);
      
      // Timeout after 2 seconds
      setTimeout(() => {
        window.removeEventListener('message', messageHandler);
        sendResponse({ session: null });
      }, 2000);
      
      return true; // Async response
    }
  });
})();


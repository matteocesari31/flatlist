// Background service worker for flatlist extension

// Listen for messages from content scripts, popup, or web app
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'saveToken') {
    // Store auth token (legacy - for backward compatibility)
    chrome.storage.sync.set({ supabaseToken: request.token }, () => {
      sendResponse({ success: true });
    });
    return true;
  }
  
  if (request.action === 'storeTokens') {
    // Store access token, refresh token, expiry, and anon key
    chrome.storage.sync.set({
      supabaseToken: request.accessToken,
      supabaseRefreshToken: request.refreshToken || null,
      supabaseTokenExpiry: request.expiry ? request.expiry.toString() : null,
      supabaseAnonKey: request.anonKey || null,
      apiUrl: request.apiUrl || null
    }, () => {
      sendResponse({ success: true });
    });
    return true;
  }
  
  if (request.action === 'setApiUrl') {
    // Store API URL
    chrome.storage.sync.set({ apiUrl: request.url }, () => {
      sendResponse({ success: true });
    });
    return true;
  }
  
  if (request.action === 'getTokensFromFlatlist') {
    // Try to get tokens from flatlist domain tabs
    chrome.tabs.query({ 
      url: ['http://localhost:3000/*', 'https://*.vercel.app/*', 'https://flatlist.app/*'] 
    }, async (tabs) => {
      if (tabs.length === 0) {
        sendResponse({ success: false, error: 'No flatlist tab found' });
        return;
      }
      
      // Try to get session from the first flatlist tab
      try {
        const response = await chrome.tabs.sendMessage(tabs[0].id, { action: 'getSession' });
        if (response && response.session) {
          // Get API URL from storage or use default
          const storage = await chrome.storage.sync.get(['apiUrl', 'supabaseAnonKey']);
          const apiUrl = storage.apiUrl || 'http://localhost:54321';
          
          // Store the tokens
          await chrome.storage.sync.set({
            supabaseToken: response.session.access_token,
            supabaseRefreshToken: response.session.refresh_token,
            supabaseTokenExpiry: response.session.expires_at ? Math.floor(response.session.expires_at / 1000).toString() : null,
            apiUrl: apiUrl,
            supabaseAnonKey: storage.supabaseAnonKey || null
          });
          sendResponse({ 
            success: true, 
            token: response.session.access_token,
            refreshToken: response.session.refresh_token,
            expiry: response.session.expires_at ? Math.floor(response.session.expires_at / 1000) : null
          });
        } else {
          sendResponse({ success: false, error: 'No session found in flatlist tab' });
        }
      } catch (error) {
        console.error('Error getting session from flatlist tab:', error);
        sendResponse({ success: false, error: error.message });
      }
    });
    return true; // Async response
  }
});


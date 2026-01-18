// Background service worker for flatlist extension

// Handle extension icon click - show the floating button on the current page
chrome.action.onClicked.addListener(async (tab) => {
  // Don't try to inject into chrome:// or edge:// pages
  if (!tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('edge://') || tab.url.startsWith('about:')) {
    console.log('Cannot inject into this page:', tab.url);
    return;
  }

  try {
    // First, try to send a message to show the button (if content script is already loaded)
    try {
      await chrome.tabs.sendMessage(tab.id, { action: 'showFloatingButton' });
      console.log('Sent showFloatingButton message to existing content script');
      return;
    } catch (e) {
      // Content script not loaded, inject it
      console.log('Content script not loaded, injecting...');
    }

    // Inject the floating button script
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['floating-button.js']
    });

    // Wait a moment for script to load, then trigger the button
    setTimeout(async () => {
      try {
        await chrome.tabs.sendMessage(tab.id, { action: 'showFloatingButton' });
      } catch (e) {
        console.log('Could not send message after injection:', e);
      }
    }, 100);

  } catch (error) {
    console.error('Error handling extension click:', error);
  }
});

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
      url: ['http://localhost:3000/*', 'https://*.vercel.app/*', 'https://flatlist.app/*', 'https://my.flatlist.app/*'] 
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


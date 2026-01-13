// Token manager for extension - handles automatic token refresh

const TOKEN_STORAGE_KEY = 'supabaseToken';
const REFRESH_TOKEN_STORAGE_KEY = 'supabaseRefreshToken';
const TOKEN_EXPIRY_KEY = 'supabaseTokenExpiry';
const API_URL_KEY = 'apiUrl';

// Get API URL
async function getApiUrl() {
  const result = await chrome.storage.sync.get([API_URL_KEY]);
  return result[API_URL_KEY] || null;
}

// Get stored tokens
async function getStoredTokens() {
  const result = await chrome.storage.sync.get([
    TOKEN_STORAGE_KEY,
    REFRESH_TOKEN_STORAGE_KEY,
    TOKEN_EXPIRY_KEY
  ]);
  return {
    accessToken: result[TOKEN_STORAGE_KEY] || null,
    refreshToken: result[REFRESH_TOKEN_STORAGE_KEY] || null,
    expiry: result[TOKEN_EXPIRY_KEY] || null
  };
}

// Check if token is expired or will expire soon (within 5 minutes)
function isTokenExpired(expiry) {
  if (!expiry) return true;
  const expiryTime = parseInt(expiry, 10);
  const now = Math.floor(Date.now() / 1000);
  const buffer = 300; // 5 minutes buffer
  return expiryTime < (now + buffer);
}

// Refresh access token using refresh token
async function refreshAccessToken(refreshToken) {
  try {
    const apiUrl = await getApiUrl();
    if (!apiUrl) {
      throw new Error('API URL not configured');
    }

    // Extract base URL (remove /functions/v1 if present)
    const baseUrl = apiUrl.replace('/functions/v1', '').replace('/rest/v1', '');
    
    // Get anon key from storage
    const storage = await chrome.storage.sync.get(['supabaseAnonKey']);
    const anonKey = storage.supabaseAnonKey;
    
    if (!anonKey) {
      throw new Error('Supabase anon key not configured. Please set it in extension settings.');
    }
    
    const authUrl = `${baseUrl}/auth/v1/token?grant_type=refresh_token`;

    const response = await fetch(authUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': anonKey
      },
      body: JSON.stringify({
        refresh_token: refreshToken
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error_description || 'Failed to refresh token');
    }

    const data = await response.json();
    
    // Decode token to get expiry
    const tokenParts = data.access_token.split('.');
    const payload = JSON.parse(atob(tokenParts[1].replace(/-/g, '+').replace(/_/g, '/')));
    const expiry = payload.exp;

    // Store new tokens
    await chrome.storage.sync.set({
      [TOKEN_STORAGE_KEY]: data.access_token,
      [REFRESH_TOKEN_STORAGE_KEY]: data.refresh_token || refreshToken, // Use new refresh token if provided
      [TOKEN_EXPIRY_KEY]: expiry.toString()
    });

    return data.access_token;
  } catch (error) {
    console.error('Token refresh error:', error);
    throw error;
  }
}

// Get valid access token (refresh if needed)
async function getValidAccessToken() {
  const { accessToken, refreshToken, expiry } = await getStoredTokens();

  // If no tokens at all, return null
  if (!accessToken && !refreshToken) {
    return null;
  }

  // If token is expired or will expire soon, try to refresh
  if (isTokenExpired(expiry) && refreshToken) {
    try {
      console.log('Token expired or expiring soon, refreshing...');
      const newToken = await refreshAccessToken(refreshToken);
      return newToken;
    } catch (error) {
      console.error('Failed to refresh token:', error);
      // If refresh fails, return the old token anyway (might still work)
      // User will need to re-authenticate if it's truly expired
      return accessToken;
    }
  }

  return accessToken;
}

// Store tokens (called from settings page or manual setup)
async function storeTokens(accessToken, refreshToken, expiry) {
  await chrome.storage.sync.set({
    [TOKEN_STORAGE_KEY]: accessToken,
    [REFRESH_TOKEN_STORAGE_KEY]: refreshToken || null,
    [TOKEN_EXPIRY_KEY]: expiry ? expiry.toString() : null
  });
}

// Clear tokens
async function clearTokens() {
  await chrome.storage.sync.remove([
    TOKEN_STORAGE_KEY,
    REFRESH_TOKEN_STORAGE_KEY,
    TOKEN_EXPIRY_KEY
  ]);
}

// Make functions available globally for popup.js
window.tokenManager = {
  getValidAccessToken,
  storeTokens,
  clearTokens,
  getStoredTokens
};


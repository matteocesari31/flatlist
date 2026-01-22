// Floating button that appears on real estate listing pages
// Similar to Honey extension's floating icon

(function() {
  'use strict';

  // Listen for messages from background script
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'showFloatingButton') {
      // Force show the floating button regardless of page type
      createFloatingButton();
      sendResponse({ success: true });
    }
    return true;
  });

  // Check if this page is a real estate website listing page
  function isListingPage() {
    const url = window.location.href.toLowerCase();
    
    // List of known real estate website domains
    const realEstateDomains = [
      'immobiliare.it',
      'casa.it',
      'idealista.it',
      'subito.it',
      'bakeca.it',
      'rightmove.co.uk',
      'zoopla.co.uk',
      'realtor.com',
      'zillow.com',
      'apartments.com',
      'immobiliare',
      'casa.it',
      'idealista',
      'subito',
      'bakeca',
      'rightmove',
      'zoopla',
      'realtor',
      'zillow',
      'apartments'
    ];
    
    // Check if we're on a real estate domain
    const isRealEstateDomain = realEstateDomains.some(domain => url.includes(domain));
    
    if (!isRealEstateDomain) {
      return false;
    }
    
    // Additional check: exclude homepages and search pages
    // Look for indicators that this is an actual listing page
    const bodyText = document.body.innerText || '';
    const title = document.title || '';
    
    // Check for price indicators (more specific)
    const hasPrice = /€\s*\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})?|\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})?\s*€/i.test(bodyText);
    
    // Check for listing-specific URL patterns
    const listingUrlPatterns = [
      '/annunci/',
      '/annuncio/',
      '/listing/',
      '/property/',
      '/apartment/',
      '/immobile/',
      '/casa/',
      '/appartamento/',
      '/id/',
      '/detail/',
      '/details/'
    ];
    const hasListingUrlPattern = listingUrlPatterns.some(pattern => url.includes(pattern));
    
    // Check for listing-specific keywords in title or body
    const listingKeywords = [
      'appartamento', 'casa', 'immobile', 'trilocale', 'bilocale', 'monolocale',
      'annuncio', 'listing', 'property', 'apartment'
    ];
    const hasListingKeywords = listingKeywords.some(keyword => 
      title.toLowerCase().includes(keyword) || bodyText.toLowerCase().includes(keyword)
    );
    
    // Must be on a real estate domain AND (have listing URL pattern OR (have price AND listing keywords))
    return hasListingUrlPattern || (hasPrice && hasListingKeywords);
  }

  // Create and inject the floating button
  function createFloatingButton() {
    // Don't create if already exists
    if (document.getElementById('flatlist-floating-button')) {
      return;
    }

    const button = document.createElement('div');
    button.id = 'flatlist-floating-button';
    button.className = 'flatlist-compact';
    const logoUrl = chrome.runtime.getURL('logo.svg');
    button.innerHTML = `
      <div class="flatlist-compact-content">
        <img src="${logoUrl}" alt="flatlist" class="flatlist-logo-icon" />
      </div>
      <div class="flatlist-expanded-content hidden">
        <span class="flatlist-button-text"></span>
      </div>
    `;

    // Inject CSS
    const style = document.createElement('style');
    style.textContent = `
      @font-face {
        font-family: 'Satoshi';
        src: url('${chrome.runtime.getURL('fonts/Satoshi-Bold.woff2')}') format('woff2');
        font-weight: 700;
        font-style: normal;
      }
      
      #flatlist-floating-button {
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 999999;
        background: transparent;
        color: #ffffff;
        cursor: pointer;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;
        transition: all 0.2s ease;
        user-select: none;
      }
      
      /* Compact state (default) */
      #flatlist-floating-button.flatlist-compact {
        width: 48px;
        height: 48px;
        border-radius: 12px;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      
      /* Expanded state */
      #flatlist-floating-button.flatlist-expanded {
        border-radius: 12px;
        padding: 12px 20px;
        min-width: 120px;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
      }
      
      #flatlist-floating-button:hover {
        box-shadow: 0 6px 16px rgba(0, 0, 0, 0.2);
        transform: translateY(-2px);
        opacity: 0.9;
      }
      
      #flatlist-floating-button:active {
        transform: translateY(0);
      }
      
      #flatlist-floating-button.saving {
        background: #000000 !important;
        opacity: 1;
        cursor: not-allowed;
      }
      
      #flatlist-floating-button.saved {
        background: #10b981 !important;
        opacity: 1;
      }
      
      #flatlist-floating-button.error {
        background: #ef4444 !important;
        opacity: 1;
      }
      
      .flatlist-compact-content {
        display: flex;
        align-items: center;
        justify-content: center;
      }
      
      .flatlist-compact-content.hidden {
        display: none;
      }
      
      .flatlist-logo-icon {
        width: 48px;
        height: 48px;
        display: block;
      }
      
      .flatlist-expanded-content {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      
      .flatlist-expanded-content.hidden {
        display: none;
      }
      
      .flatlist-button-inner {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      
      .flatlist-button-text {
        font-weight: 500;
        font-size: 14px;
        color: #ffffff;
        white-space: nowrap;
      }
      
      .flatlist-button-loader {
        display: flex;
        align-items: center;
        justify-content: center;
      }
      
      .flatlist-button-loader.hidden {
        display: none;
      }
      
      .flatlist-spinner {
        width: 16px;
        height: 16px;
        border: 2px solid rgba(255, 255, 255, 0.3);
        border-top-color: #ffffff;
        border-radius: 50%;
        animation: flatlist-spin 0.6s linear infinite;
      }
      
      @keyframes flatlist-spin {
        to { transform: rotate(360deg); }
      }
      
      #flatlist-floating-button.saving .flatlist-button-inner {
        display: none;
      }
      
      #flatlist-floating-button.saving .flatlist-button-loader {
        display: flex;
      }
    `;
    
    document.head.appendChild(style);
    document.body.appendChild(button);

    // Check for tokens on load and try to get from flatlist if missing
    (async () => {
      const result = await chrome.storage.sync.get(['supabaseToken']);
      if (!result.supabaseToken) {
        // Try to get tokens from flatlist domain
        try {
          const response = await chrome.runtime.sendMessage({ action: 'getTokensFromFlatlist' });
          if (response && response.success) {
            console.log('✅ Automatically connected to flatlist session');
          }
        } catch (error) {
          // No flatlist tab open or not logged in - that's okay
        }
      }
    })();

    // Handle click - save directly on first click
    button.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      // Prevent multiple clicks while saving/saved
      if (button.classList.contains('saving') || button.classList.contains('saved')) {
        return;
      }

      // Show loading state
      button.classList.add('saving');
      const compactContent = button.querySelector('.flatlist-compact-content');
      if (compactContent) {
        compactContent.innerHTML = '<div class="flatlist-spinner"></div>';
      }

      try {
        // Extract data
        const data = extractContent();
        console.log('📦 Extracted data:', JSON.stringify({
          url: data.url,
          title: data.title,
          price: data.price,
          contentLength: data.content?.length || 0,
          contentPreview: data.content?.substring(0, 200) || '(empty)',
          imagesCount: data.images?.length || 0,
          images: data.images || [],
          hasContent: !!data.content && data.content.trim().length > 0
        }, null, 2));
        
        // Validate extracted data
        if (!data.url || !data.content || data.content.trim().length === 0) {
          throw new Error('Could not extract listing content. Please try again.');
        }
        
        // Get auth token (with auto-refresh if available)
        let token = null;
        let apiUrl = null;
        
        // First, try to get tokens from storage
        const result = await chrome.storage.sync.get([
          'supabaseToken', 
          'supabaseRefreshToken', 
          'supabaseTokenExpiry',
          'apiUrl',
          'supabaseAnonKey'
        ]);
        token = result.supabaseToken;
        apiUrl = result.apiUrl || 'http://localhost:54321';
        
        // If no token, try to get it from flatlist domain if open
        if (!token) {
          try {
            // Ask background script to get tokens from flatlist domain
            const response = await chrome.runtime.sendMessage({ action: 'getTokensFromFlatlist' });
            if (response && response.success && response.token) {
              token = response.token;
              apiUrl = result.apiUrl || 'http://localhost:54321';
              // Update result for refresh token check
              result.supabaseRefreshToken = response.refreshToken;
              result.supabaseTokenExpiry = response.expiry ? response.expiry.toString() : null;
            }
          } catch (error) {
            console.log('Could not get tokens from flatlist domain:', error);
          }
        }
        
        // Check if token is expired and try to refresh
        if (token && result.supabaseRefreshToken && result.supabaseTokenExpiry) {
          const expiry = parseInt(result.supabaseTokenExpiry, 10);
          const now = Math.floor(Date.now() / 1000);
          if (expiry < (now + 300)) { // Expires in less than 5 minutes
            // Try to refresh
            try {
              const refreshUrl = `${apiUrl.replace('/functions/v1', '').replace('/rest/v1', '')}/auth/v1/token?grant_type=refresh_token`;
              const refreshResponse = await fetch(refreshUrl, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'apikey': result.supabaseAnonKey || ''
                },
                body: JSON.stringify({
                  refresh_token: result.supabaseRefreshToken
                })
              });
              
              if (refreshResponse.ok) {
                const refreshData = await refreshResponse.json();
                if (refreshData.access_token) {
                  token = refreshData.access_token;
                  const newExpiry = Math.floor(Date.now() / 1000) + refreshData.expires_in;
                  await chrome.storage.sync.set({
                    supabaseToken: token,
                    supabaseTokenExpiry: newExpiry.toString()
                  });
                }
              }
            } catch (refreshError) {
              console.warn('Failed to refresh token:', refreshError);
            }
          }
        }
        
        if (!token) {
          // Show a better error message with instructions
          const errorMsg = 'Listing not saved. Open or refresh Flatlist in the browser, then refresh this page.';
          throw new Error(errorMsg);
        }
        
        if (!apiUrl) {
          apiUrl = 'http://localhost:54321';
        }

        // Prepare request body
        const requestBody = {
          url: data.url,
          title: data.title,
          price: data.price,
          content: data.content,
          images: Array.isArray(data.images) ? data.images : []
        };
        
        console.log('📤 Sending request to save-listing:', JSON.stringify({
          url: `${apiUrl}/functions/v1/save-listing`,
          method: 'POST',
          bodyKeys: Object.keys(requestBody),
          url: requestBody.url,
          title: requestBody.title,
          price: requestBody.price,
          contentLength: requestBody.content?.length || 0,
          contentPreview: requestBody.content?.substring(0, 100) || '(empty)',
          imagesCount: requestBody.images?.length || 0,
          images: requestBody.images || []
        }, null, 2));
        
        // Send to backend
        let response = await fetch(`${apiUrl}/functions/v1/save-listing`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(requestBody)
        });

        // If 401, try refreshing token and retry once
        if (response.status === 401) {
          // Try to refresh token
          const result = await chrome.storage.sync.get([
            'supabaseRefreshToken',
            'supabaseAnonKey',
            'apiUrl'
          ]);
          
          if (result.supabaseRefreshToken && result.supabaseAnonKey) {
            try {
              const refreshUrl = `${apiUrl.replace('/functions/v1', '').replace('/rest/v1', '')}/auth/v1/token?grant_type=refresh_token`;
              const refreshResponse = await fetch(refreshUrl, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'apikey': result.supabaseAnonKey
                },
                body: JSON.stringify({
                  refresh_token: result.supabaseRefreshToken
                })
              });
              
              if (refreshResponse.ok) {
                const refreshData = await refreshResponse.json();
                if (refreshData.access_token) {
                  const newToken = refreshData.access_token;
                  const newExpiry = Math.floor(Date.now() / 1000) + refreshData.expires_in;
                  await chrome.storage.sync.set({
                    supabaseToken: newToken,
                    supabaseTokenExpiry: newExpiry.toString()
                  });
                  
                  // Retry with new token
                  response = await fetch(`${apiUrl}/functions/v1/save-listing`, {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      'Authorization': `Bearer ${newToken}`
                    },
                    body: JSON.stringify({
                      url: data.url,
                      title: data.title,
                      price: data.price,
                      content: data.content,
                      images: Array.isArray(data.images) ? data.images : []
                    })
                  });
                }
              }
            } catch (refreshError) {
              console.warn('Failed to refresh token:', refreshError);
            }
          }
        }

        if (!response.ok) {
          let errorData = {};
          let responseText = '';
          try {
            responseText = await response.text();
            console.error('❌ Save listing failed - Status:', response.status, response.statusText);
            console.error('❌ Save listing failed - Response body:', responseText);
            
            if (responseText) {
              try {
                errorData = JSON.parse(responseText);
                console.error('❌ Save listing failed - Parsed error:', errorData);
              } catch (parseError) {
                console.error('❌ Save listing failed - Could not parse JSON, raw text:', responseText);
                errorData = { error: responseText || `HTTP ${response.status}: ${response.statusText}` };
              }
            } else {
              errorData = { error: `HTTP ${response.status}: ${response.statusText}` };
            }
          } catch (parseError) {
            console.error('❌ Save listing failed - Exception:', parseError);
            errorData = { error: `HTTP ${response.status}: ${response.statusText}` };
          }
          
          const errorMessage = errorData.error || errorData.details || errorData.message || 'Failed to save listing';
          console.error('❌ Throwing error:', errorMessage);
          throw new Error(errorMessage);
        }

        // Success!
        button.classList.remove('saving');
        button.classList.add('saved');
        button.classList.remove('flatlist-compact');
        button.classList.add('flatlist-expanded');
        const compactContent = button.querySelector('.flatlist-compact-content');
        const expandedContent = button.querySelector('.flatlist-expanded-content');
        const buttonText = button.querySelector('.flatlist-button-text');
        if (compactContent) compactContent.classList.add('hidden');
        if (expandedContent) expandedContent.classList.remove('hidden');
        if (buttonText) buttonText.textContent = 'Success!';
        
        // Reset after 3 seconds - back to logo
        setTimeout(() => {
          button.classList.remove('saved');
          button.classList.remove('flatlist-expanded');
          button.classList.add('flatlist-compact');
          if (compactContent) {
            compactContent.classList.remove('hidden');
            compactContent.innerHTML = `<img src="${logoUrl}" alt="flatlist" class="flatlist-logo-icon" />`;
          }
          if (expandedContent) expandedContent.classList.add('hidden');
        }, 3000);

      } catch (error) {
        console.error('Error saving listing:', error);
        button.classList.remove('saving');
        button.classList.remove('flatlist-compact');
        button.classList.add('flatlist-expanded');
        button.classList.add('error');
        const compactContent = button.querySelector('.flatlist-compact-content');
        const expandedContent = button.querySelector('.flatlist-expanded-content');
        const buttonText = button.querySelector('.flatlist-button-text');
        if (compactContent) compactContent.classList.add('hidden');
        if (expandedContent) expandedContent.classList.remove('hidden');
        
        // Determine error message with instructions
        let errorMessage = 'Listing not saved. Open or refresh Flatlist in the browser, then refresh this page.';
        if (error.message && !error.message.includes('sign in') && !error.message.includes('log in') && !error.message.includes('Please sign in') && !error.message.includes('Open flatlist')) {
          // For non-auth errors, show a shorter message if it's too long
          if (error.message.length > 50) {
            errorMessage = 'Listing not saved. Open or refresh Flatlist in the browser, then refresh this page.';
          } else {
            errorMessage = error.message;
          }
        }
        
        if (buttonText) buttonText.textContent = errorMessage;
        
        // Reset after 5 seconds - back to logo
        setTimeout(() => {
          button.classList.remove('error');
          button.classList.remove('flatlist-expanded');
          button.classList.add('flatlist-compact');
          if (compactContent) {
            compactContent.classList.remove('hidden');
            compactContent.innerHTML = `<img src="${logoUrl}" alt="flatlist" class="flatlist-logo-icon" />`;
          }
          if (expandedContent) expandedContent.classList.add('hidden');
        }, 5000);
      }
    });
  }

  // Extract content (reuse logic from content.js)
  function extractContent() {
    const content = document.body.innerText || '';
    const title = document.title || document.querySelector('h1')?.textContent || '';
    
    // Extract price
    const priceRegex = /€\s*(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})?)|(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})?)\s*€/gi;
    const priceMatches = content.match(priceRegex);
    const price = priceMatches ? priceMatches[0] : null;
    
    // Extract images (simplified version)
    const images = [];
    const allImages = document.querySelectorAll('img');
    for (const img of allImages) {
      if (images.length >= 2) break;
      const imgSrc = img.src || img.getAttribute('data-src') || img.getAttribute('data-lazy-src');
      if (imgSrc && !imgSrc.startsWith('data:') && !imgSrc.includes('.svg')) {
        const rect = img.getBoundingClientRect();
        if (rect.width > 200 || rect.height > 200) {
          images.push(imgSrc);
        }
      }
    }
    
    return {
      url: window.location.href,
      title: title.trim(),
      price: price || null,
      images: images.slice(0, 2),
      content: content.trim()
    };
  }

  // Initialize when page loads
  function init() {
    if (isListingPage()) {
      // Wait a bit for page to fully load
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', createFloatingButton);
      } else {
        createFloatingButton();
      }
    }
  }

  // Run on page load
  init();

  // Also check on navigation (for SPAs)
  let lastUrl = location.href;
  new MutationObserver(() => {
    const url = location.href;
    if (url !== lastUrl) {
      lastUrl = url;
      // Remove old button if exists
      const oldButton = document.getElementById('flatlist-floating-button');
      if (oldButton) {
        oldButton.remove();
      }
      // Check again after navigation
      setTimeout(init, 500);
    }
  }).observe(document, { subtree: true, childList: true });
})();


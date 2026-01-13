// Popup script for flatlist extension
console.log('popup.js script loaded');

// Initialize immediately (popup HTML is already loaded)
(function() {
  console.log('Initializing popup...');
  
  const expandBtn = document.getElementById('expandBtn');
  const expandedContent = document.getElementById('expandedContent');
  const saveBtn = document.getElementById('saveBtn');
  const btnText = document.getElementById('btnText');
  const btnLoader = document.getElementById('btnLoader');
  const message = document.getElementById('message');
  const authPrompt = document.getElementById('authPrompt');
  const authLink = document.getElementById('authLink');

  console.log('Elements found:', {
    expandBtn: !!expandBtn,
    expandedContent: !!expandedContent,
    saveBtn: !!saveBtn,
    btnText: !!btnText
  });

  if (!expandBtn) {
    console.error('Expand button not found!');
    return;
  }

  if (!expandedContent) {
    console.error('Expanded content not found!');
    return;
  }

  // Toggle expanded view
  expandBtn.addEventListener('click', () => {
    console.log('Expand button clicked');
    expandedContent.classList.remove('hidden');
    expandBtn.classList.add('hidden');
  });

  // Get Supabase URL from storage or use default
  async function getApiUrl() {
    const result = await chrome.storage.sync.get(['apiUrl']);
    return result.apiUrl || 'http://localhost:54321';
  }

  // Get valid auth token (auto-refreshes if needed)
  async function getAuthToken() {
    if (window.tokenManager) {
      return await window.tokenManager.getValidAccessToken();
    }
    const result = await chrome.storage.sync.get(['supabaseToken']);
    return result.supabaseToken || null;
  }

  // Show message
  function showMessage(text, isError = false) {
    if (!message) return;
    message.textContent = text;
    message.className = `message ${isError ? 'error' : 'success'}`;
    message.classList.remove('hidden');
    
    setTimeout(() => {
      if (message) {
        message.classList.add('hidden');
      }
    }, 3000);
  }

  // Show loading state
  function setLoading(loading) {
    if (!saveBtn || !btnText || !btnLoader) return;
    if (loading) {
      btnText.textContent = 'Saving...';
      btnLoader.classList.remove('hidden');
      saveBtn.disabled = true;
    } else {
      btnText.textContent = 'Save to flatlist';
      btnLoader.classList.add('hidden');
      saveBtn.disabled = false;
    }
  }

  // Save listing
  async function saveListing() {
    try {
      setLoading(true);
      if (message) message.classList.add('hidden');
      
      const token = await getAuthToken();
      if (!token) {
        if (authPrompt) authPrompt.classList.remove('hidden');
        setLoading(false);
        return;
      }
      
      if (authPrompt) authPrompt.classList.add('hidden');
      
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      if (!tab || !tab.id || !tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('edge://')) {
        throw new Error('Cannot save from this page. Please navigate to a valid listing page.');
      }
      
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['content.js']
        });
        const pingResponse = await chrome.tabs.sendMessage(tab.id, { action: 'ping' });
        if (!pingResponse || !pingResponse.success) {
          throw new Error('Content script not responsive');
        }
      } catch (error) {
        console.error('Error ensuring content script:', error);
        throw new Error('Content script not ready. Please refresh the page and try again.');
      }
      
      const response = await chrome.tabs.sendMessage(tab.id, { action: 'extract' });
      
      if (!response || !response.success) {
        throw new Error(response?.error || 'Failed to extract page data');
      }
      
      const data = response.data;
      
      console.log('Extracted data:', {
        hasImages: !!data.images,
        imagesCount: data.images?.length || 0,
        images: data.images,
        url: data.url,
        title: data.title
      });
      
      const requestBody = {
        url: data.url,
        title: data.title,
        price: data.price,
        content: data.content,
        images: Array.isArray(data.images) ? data.images : (data.images ? [data.images] : [])
      };
      
      console.log('Sending request body:', {
        hasImages: !!requestBody.images,
        imagesCount: requestBody.images.length,
        images: requestBody.images
      });
      
      const apiUrl = await getApiUrl();
      let saveResponse = await fetch(`${apiUrl}/functions/v1/save-listing`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(requestBody)
      });
      
      if (saveResponse.status === 401) {
        console.log('Token expired, attempting to refresh...');
        if (window.tokenManager) {
          const newToken = await window.tokenManager.getValidAccessToken();
          
          if (newToken && newToken !== token) {
            console.log('Token refreshed, retrying save...');
            saveResponse = await fetch(`${apiUrl}/functions/v1/save-listing`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${newToken}`
              },
              body: JSON.stringify(requestBody)
            });
          }
        }
      }
      
      if (!saveResponse.ok) {
        const errorData = await saveResponse.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to save: ${saveResponse.statusText}`);
      }
      
      showMessage('Listing saved successfully!', false);
      
    } catch (error) {
      console.error('Error saving listing:', error);
      showMessage(error.message || 'Failed to save listing', true);
    } finally {
      setLoading(false);
    }
  }

  // Set auth link URL
  async function setupAuthLink() {
    if (!authLink) return;
    const apiUrl = await getApiUrl();
    const baseUrl = apiUrl.replace('/functions/v1', '').replace('/rest/v1', '');
    authLink.href = baseUrl.replace('54321', '3000') || 'http://localhost:3000';
  }

  // Check auth status
  async function checkAuthStatus() {
    if (!authPrompt) return;
    const token = await getAuthToken();
    if (!token) {
      authPrompt.classList.remove('hidden');
    } else {
      authPrompt.classList.add('hidden');
    }
  }

  // Initialize
  if (saveBtn) {
    saveBtn.addEventListener('click', saveListing);
  }
  setupAuthLink();
  checkAuthStatus();
  
  // Check periodically
  setInterval(checkAuthStatus, 5000);
})();

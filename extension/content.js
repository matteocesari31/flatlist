// Generic DOM extraction for apartment listings
// Extracts: content, title, price, images, url

(function() {
  'use strict';

  // Extract page content
  function extractContent() {
    const content = document.body.innerText || '';
    const title = document.title || document.querySelector('h1')?.textContent || '';
    
    // Extract price using regex patterns
    const priceRegex = /€\s*(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})?)|(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})?)\s*€/gi;
    const priceMatches = content.match(priceRegex);
    const price = priceMatches ? priceMatches[0] : null;
    
    // Extract first 1-2 images above the fold
    const images = [];
    const allImages = document.querySelectorAll('img');
    const viewportHeight = window.innerHeight;
    
    // Helper to check if image should be excluded
    function shouldExcludeImage(imgSrc, img) {
      // Exclude data URIs
      if (imgSrc.startsWith('data:')) return true;
      
      // Exclude SVGs (logos, icons)
      if (imgSrc.endsWith('.svg') || imgSrc.includes('.svg')) return true;
      
      // Exclude common logo/icon paths
      const excludePatterns = ['logo', 'icon', 'favicon', 'sprite', 'button', 'arrow', 'chevron'];
      const lowerSrc = imgSrc.toLowerCase();
      if (excludePatterns.some(pattern => lowerSrc.includes(pattern))) return true;
      
      // Exclude very small images (icons)
      const rect = img.getBoundingClientRect();
      if (rect.width < 150 && rect.height < 150 && 
          img.naturalWidth < 150 && img.naturalHeight < 150) {
        return true;
      }
      
      return false;
    }
    
    for (const img of allImages) {
      if (images.length >= 2) break;
      
      // Get image source - check multiple attributes for lazy loading
      let imgSrc = img.src || img.getAttribute('src') || img.getAttribute('data-src') || 
                   img.getAttribute('data-lazy-src') || img.getAttribute('data-original');
      
      if (!imgSrc) continue;
      
      // Check if should be excluded
      if (shouldExcludeImage(imgSrc, img)) continue;
      
      // Check if image is visible and above the fold
      const rect = img.getBoundingClientRect();
      const isVisible = rect.width > 0 && rect.height > 0;
      const isAboveFold = rect.top < viewportHeight * 1.5;
      
      // Filter for reasonably large images (listing photos)
      const isLargeEnough = (img.naturalWidth > 200 || img.naturalHeight > 200) || 
                            (rect.width > 200 || rect.height > 200) ||
                            (img.width > 200 || img.height > 200);
      
      if (isVisible && isAboveFold && isLargeEnough) {
        // Keep full URL (don't strip query params, as they might be needed for CDN)
        if (!images.includes(imgSrc)) {
          images.push(imgSrc);
        }
      }
    }
    
    // If no images found above fold, try to find any large images on the page
    if (images.length === 0) {
      for (const img of allImages) {
        if (images.length >= 2) break;
        
        let imgSrc = img.src || img.getAttribute('src') || img.getAttribute('data-src') || 
                     img.getAttribute('data-lazy-src') || img.getAttribute('data-original');
        if (!imgSrc) continue;
        
        if (shouldExcludeImage(imgSrc, img)) continue;
        
        const rect = img.getBoundingClientRect();
        const isLargeEnough = (img.naturalWidth > 300 || img.naturalHeight > 300) || 
                              (rect.width > 300 || rect.height > 300);
        
        if (isLargeEnough) {
          if (!images.includes(imgSrc)) {
            images.push(imgSrc);
          }
        }
      }
    }
    
    const url = window.location.href;
    
    const extractedData = {
      url,
      title: title.trim(),
      price: price || null,
      images: images.slice(0, 2), // Max 2 images
      content: content.trim()
    };
    
    // Debug: log extracted images
    console.log('Content script extracted:', {
      imagesFound: images.length,
      images: images.slice(0, 2),
      url: url
    });
    
    return extractedData;
  }

  // Listen for messages from popup
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'ping') {
      sendResponse({ success: true });
      return true;
    }
    
    if (request.action === 'extract') {
      try {
        const data = extractContent();
        sendResponse({ success: true, data });
      } catch (error) {
        sendResponse({ success: false, error: error.message });
      }
    }
    return true; // Keep channel open for async response
  });
})();


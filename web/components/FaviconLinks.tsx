'use client'

import Script from 'next/script'

export default function FaviconLinks() {
  return (
    <Script
      id="favicon-updater"
      strategy="beforeInteractive"
      dangerouslySetInnerHTML={{
        __html: `
          (function() {
            function updateFavicons() {
              // Remove any existing favicon links
              const existingLinks = document.querySelectorAll('link[rel*="icon"], link[rel="shortcut icon"], link[rel="apple-touch-icon"]');
              existingLinks.forEach(link => link.remove());
              
              // Add light mode favicon (must come first)
              const lightIcon = document.createElement('link');
              lightIcon.rel = 'icon';
              lightIcon.href = '/flatlist light mode logo.svg';
              lightIcon.media = '(prefers-color-scheme: light)';
              document.head.appendChild(lightIcon);
              
              // Add dark mode favicon
              const darkIcon = document.createElement('link');
              darkIcon.rel = 'icon';
              darkIcon.href = '/flatlist dark mode logo.svg';
              darkIcon.media = '(prefers-color-scheme: dark)';
              document.head.appendChild(darkIcon);
              
              // Add shortcut icons
              const lightShortcut = document.createElement('link');
              lightShortcut.rel = 'shortcut icon';
              lightShortcut.href = '/flatlist light mode logo.svg';
              lightShortcut.media = '(prefers-color-scheme: light)';
              document.head.appendChild(lightShortcut);
              
              const darkShortcut = document.createElement('link');
              darkShortcut.rel = 'shortcut icon';
              darkShortcut.href = '/flatlist dark mode logo.svg';
              darkShortcut.media = '(prefers-color-scheme: dark)';
              document.head.appendChild(darkShortcut);
              
              // Add apple touch icons
              const lightApple = document.createElement('link');
              lightApple.rel = 'apple-touch-icon';
              lightApple.href = '/flatlist light mode logo.svg';
              lightApple.media = '(prefers-color-scheme: light)';
              document.head.appendChild(lightApple);
              
              const darkApple = document.createElement('link');
              darkApple.rel = 'apple-touch-icon';
              darkApple.href = '/flatlist dark mode logo.svg';
              darkApple.media = '(prefers-color-scheme: dark)';
              document.head.appendChild(darkApple);
            }
            
            // Run immediately if document is ready, otherwise wait for DOMContentLoaded
            if (document.readyState === 'loading') {
              document.addEventListener('DOMContentLoaded', updateFavicons);
            } else {
              updateFavicons();
            }
          })();
        `,
      }}
    />
  )
}

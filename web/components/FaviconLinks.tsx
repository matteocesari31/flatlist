'use client'

import { useEffect } from 'react'

function updateFavicons() {
  // Remove any existing favicon links (including those from Next.js metadata)
  const existingLinks = document.querySelectorAll('link[rel*="icon"], link[rel="shortcut icon"], link[rel="apple-touch-icon"]')
  existingLinks.forEach(link => link.remove())

  // Add light mode favicon (must come first)
  const lightIcon = document.createElement('link')
  lightIcon.rel = 'icon'
  lightIcon.href = '/flatlist light mode logo.svg'
  lightIcon.media = '(prefers-color-scheme: light)'
  document.head.appendChild(lightIcon)

  // Add dark mode favicon
  const darkIcon = document.createElement('link')
  darkIcon.rel = 'icon'
  darkIcon.href = '/flatlist dark mode logo.svg'
  darkIcon.media = '(prefers-color-scheme: dark)'
  document.head.appendChild(darkIcon)

  // Add fallback favicon (must come last)
  const fallbackIcon = document.createElement('link')
  fallbackIcon.rel = 'icon'
  fallbackIcon.href = '/logo.svg'
  document.head.appendChild(fallbackIcon)

    // Add shortcut icons (for older browsers)
    const lightShortcut = document.createElement('link')
    lightShortcut.rel = 'shortcut icon'
    lightShortcut.href = '/flatlist light mode logo.svg'
    lightShortcut.media = '(prefers-color-scheme: light)'
    document.head.appendChild(lightShortcut)

    const darkShortcut = document.createElement('link')
    darkShortcut.rel = 'shortcut icon'
    darkShortcut.href = '/flatlist dark mode logo.svg'
    darkShortcut.media = '(prefers-color-scheme: dark)'
    document.head.appendChild(darkShortcut)

    const fallbackShortcut = document.createElement('link')
    fallbackShortcut.rel = 'shortcut icon'
    fallbackShortcut.href = '/logo.svg'
    document.head.appendChild(fallbackShortcut)

    // Add apple touch icons
    const lightApple = document.createElement('link')
    lightApple.rel = 'apple-touch-icon'
    lightApple.href = '/flatlist light mode logo.svg'
    lightApple.media = '(prefers-color-scheme: light)'
    document.head.appendChild(lightApple)

    const darkApple = document.createElement('link')
    darkApple.rel = 'apple-touch-icon'
    darkApple.href = '/flatlist dark mode logo.svg'
    darkApple.media = '(prefers-color-scheme: dark)'
    document.head.appendChild(darkApple)

    const fallbackApple = document.createElement('link')
    fallbackApple.rel = 'apple-touch-icon'
    fallbackApple.href = '/logo.svg'
    document.head.appendChild(fallbackApple)
}

export default function FaviconLinks() {
  useEffect(() => {
    updateFavicons()
  }, [])

  return (
    <script
      dangerouslySetInnerHTML={{
        __html: `
          (function() {
            function updateFavicons() {
              const existingLinks = document.querySelectorAll('link[rel*="icon"], link[rel="shortcut icon"], link[rel="apple-touch-icon"]');
              existingLinks.forEach(link => link.remove());
              
              const lightIcon = document.createElement('link');
              lightIcon.rel = 'icon';
              lightIcon.href = '/flatlist light mode logo.svg';
              lightIcon.media = '(prefers-color-scheme: light)';
              document.head.appendChild(lightIcon);
              
              const darkIcon = document.createElement('link');
              darkIcon.rel = 'icon';
              darkIcon.href = '/flatlist dark mode logo.svg';
              darkIcon.media = '(prefers-color-scheme: dark)';
              document.head.appendChild(darkIcon);
              
              const fallbackIcon = document.createElement('link');
              fallbackIcon.rel = 'icon';
              fallbackIcon.href = '/logo.svg';
              document.head.appendChild(fallbackIcon);
            }
            
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

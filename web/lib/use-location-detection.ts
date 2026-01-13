'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

export interface LocationSuggestion {
  detectedLocation: string      // "Susa Metro Station Milan Italy"
  displayName: string           // "Susa Metro Station"
  remainingQuery: string        // "flat 2 beds"
  defaultDistance: number       // 1.5
  coordinates?: { 
    latitude: number
    longitude: number 
  }
}

export interface ConfirmedLocation {
  name: string           // Display name
  fullQuery: string      // Full geocodable string
  latitude: number
  longitude: number
  distance: number       // Default 1.5km
}

interface UseLocationDetectionOptions {
  debounceMs?: number
  minQueryLength?: number
}

interface UseLocationDetectionReturn {
  pendingSuggestion: LocationSuggestion | null
  isDetecting: boolean
  dismissSuggestion: () => void
  confirmLocation: () => Promise<ConfirmedLocation | null>
  autoConfirmedLocation: ConfirmedLocation | null
}

export function useLocationDetection(
  query: string,
  confirmedLocation: ConfirmedLocation | null,
  options: UseLocationDetectionOptions = {}
): UseLocationDetectionReturn {
  const { debounceMs = 500, minQueryLength = 8 } = options
  
  const [pendingSuggestion, setPendingSuggestion] = useState<LocationSuggestion | null>(null)
  const [isDetecting, setIsDetecting] = useState(false)
  const [autoConfirmedLocation, setAutoConfirmedLocation] = useState<ConfirmedLocation | null>(null)
  
  const lastDetectedQuery = useRef<string>('')
  const abortControllerRef = useRef<AbortController | null>(null)

  // Debounced location detection
  useEffect(() => {
    // Don't detect if we already have a confirmed location
    if (confirmedLocation) {
      setPendingSuggestion(null)
      setAutoConfirmedLocation(null)
      return
    }
    
    // Reset auto-confirmed location when query changes significantly
    if (query.trim().length < minQueryLength) {
      setAutoConfirmedLocation(null)
    }

    // Don't detect for short queries
    if (query.trim().length < minQueryLength) {
      setPendingSuggestion(null)
      return
    }

    // Don't re-detect the same query
    if (query === lastDetectedQuery.current) {
      return
    }

    // Cancel any pending request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }

    const timeoutId = setTimeout(async () => {
      // Check for location-related keywords before calling API
      const lowerQuery = query.toLowerCase()
      const hasLocationKeywords = [
        'near', 'close to', 'by ', 'next to', 'around',
        'within', 'from ', 'metro', 'm1', 'm2', 'm3', 'm4', 'm5',
        'station', 'university', 'università', 'politecnico', 'bocconi',
        'cattolica', 'bicocca', 'central', 'centrale'
      ].some(keyword => lowerQuery.includes(keyword))

      if (!hasLocationKeywords) {
        setPendingSuggestion(null)
        return
      }

      setIsDetecting(true)
      abortControllerRef.current = new AbortController()

      try {
        const response = await fetch('/api/detect-location', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query }),
          signal: abortControllerRef.current.signal
        })

        if (!response.ok) {
          // Log the actual error for debugging
          let errorData
          try {
            const text = await response.text()
            errorData = JSON.parse(text)
          } catch {
            errorData = { error: `HTTP ${response.status}`, message: 'Failed to parse error response' }
          }
          console.warn('Location detection failed:', {
            status: response.status,
            error: errorData.error || 'Unknown error',
            details: errorData.details || errorData.message || 'No details available',
            fullError: errorData
          })
          setPendingSuggestion(null)
          return
        }

        const result = await response.json()
        lastDetectedQuery.current = query

        if (result.hasLocation && result.detectedLocation && result.displayName) {
          const suggestion: LocationSuggestion = {
            detectedLocation: result.detectedLocation,
            displayName: result.displayName,
            remainingQuery: result.remainingQuery,
            defaultDistance: result.defaultDistance || 1.5
          }
          
          // Automatically confirm the location
          try {
            // Geocode the location
            const geocodeResponse = await fetch(
              `/api/geocode?q=${encodeURIComponent(suggestion.detectedLocation)}`
            )

            if (geocodeResponse.ok) {
              const geocodeResult = await geocodeResponse.json()

              if (geocodeResult.latitude && geocodeResult.longitude) {
                const confirmed: ConfirmedLocation = {
                  name: suggestion.displayName,
                  fullQuery: suggestion.detectedLocation,
                  latitude: geocodeResult.latitude,
                  longitude: geocodeResult.longitude,
                  distance: suggestion.defaultDistance
                }
                // Store remaining query in the confirmed location for later use
                ;(confirmed as any).remainingQuery = suggestion.remainingQuery
                setAutoConfirmedLocation(confirmed)
                setPendingSuggestion(null)
              } else {
                setPendingSuggestion(null)
                setAutoConfirmedLocation(null)
              }
            } else {
              setPendingSuggestion(null)
              setAutoConfirmedLocation(null)
            }
          } catch (geocodeError) {
            console.error('Error auto-confirming location:', geocodeError)
            setPendingSuggestion(null)
            setAutoConfirmedLocation(null)
          }
        } else {
          setPendingSuggestion(null)
          setAutoConfirmedLocation(null)
        }
      } catch (error: any) {
        if (error.name !== 'AbortError') {
          // Log errors for debugging, but don't break the UI
          console.warn('Location detection error:', {
            name: error.name,
            message: error.message,
            query: query.substring(0, 50)
          })
        }
        setPendingSuggestion(null)
      } finally {
        setIsDetecting(false)
      }
    }, debounceMs)

    return () => {
      clearTimeout(timeoutId)
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [query, confirmedLocation, debounceMs, minQueryLength])

  const dismissSuggestion = useCallback(() => {
    setPendingSuggestion(null)
    lastDetectedQuery.current = query // Prevent re-detection of same query
  }, [query])

  const confirmLocation = useCallback(async (): Promise<ConfirmedLocation | null> => {
    if (!pendingSuggestion) return null

    try {
      // Geocode the location
      const response = await fetch(
        `/api/geocode?q=${encodeURIComponent(pendingSuggestion.detectedLocation)}`
      )

      if (!response.ok) {
        console.error('Geocoding failed for:', pendingSuggestion.detectedLocation)
        return null
      }

      const geocodeResult = await response.json()

      if (!geocodeResult.latitude || !geocodeResult.longitude) {
        console.error('Invalid geocode result:', geocodeResult)
        return null
      }

      const confirmed: ConfirmedLocation = {
        name: pendingSuggestion.displayName,
        fullQuery: pendingSuggestion.detectedLocation,
        latitude: geocodeResult.latitude,
        longitude: geocodeResult.longitude,
        distance: pendingSuggestion.defaultDistance
      }

      setPendingSuggestion(null)
      return confirmed
    } catch (error) {
      console.error('Error confirming location:', error)
      return null
    }
  }, [pendingSuggestion])

  return {
    pendingSuggestion,
    isDetecting,
    dismissSuggestion,
    confirmLocation,
    autoConfirmedLocation
  }
}


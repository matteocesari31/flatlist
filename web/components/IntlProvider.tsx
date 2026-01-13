'use client'

import { NextIntlClientProvider } from 'next-intl'
import { useState, useEffect, createContext, useContext, ReactNode } from 'react'

export type Locale = 'en' | 'it'

// Import messages statically for client-side use
import enMessages from '@/messages/en.json'
import itMessages from '@/messages/it.json'

const messages: Record<Locale, typeof enMessages> = {
  en: enMessages,
  it: itMessages,
}

interface LocaleContextType {
  locale: Locale
  setLocale: (locale: Locale) => void
}

const LocaleContext = createContext<LocaleContextType>({
  locale: 'en',
  setLocale: () => {},
})

export const useLocale = () => useContext(LocaleContext)

interface IntlProviderProps {
  children: ReactNode
}

export default function IntlProvider({ children }: IntlProviderProps) {
  const [locale, setLocaleState] = useState<Locale>('en')
  const [isLoaded, setIsLoaded] = useState(false)

  // Load locale from localStorage on mount
  useEffect(() => {
    const savedLocale = localStorage.getItem('flatlist-locale') as Locale | null
    if (savedLocale && (savedLocale === 'en' || savedLocale === 'it')) {
      setLocaleState(savedLocale)
    }
    setIsLoaded(true)
  }, [])

  const setLocale = (newLocale: Locale) => {
    setLocaleState(newLocale)
    localStorage.setItem('flatlist-locale', newLocale)
  }

  // Don't render until we've loaded the locale from localStorage
  // to prevent flash of wrong language
  if (!isLoaded) {
    return null
  }

  return (
    <LocaleContext.Provider value={{ locale, setLocale }}>
      <NextIntlClientProvider locale={locale} messages={messages[locale]}>
        {children}
      </NextIntlClientProvider>
    </LocaleContext.Provider>
  )
}


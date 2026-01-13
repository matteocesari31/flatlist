'use client'

import { useLocale, type Locale } from './IntlProvider'

export default function LanguageSwitcher() {
  const { locale, setLocale } = useLocale()

  return (
    <div className="flex border border-gray-300 rounded-md overflow-hidden">
      <button
        onClick={() => setLocale('en')}
        className={`text-sm px-3 py-2 font-medium transition-colors duration-200 ${
          locale === 'en'
            ? 'bg-[#FF5C5C] text-white'
            : 'bg-white text-gray-600 hover:bg-gray-50'
        }`}
        title="English"
      >
        EN
      </button>
      <button
        onClick={() => setLocale('it')}
        className={`text-sm px-3 py-2 font-medium transition-colors duration-200 ${
          locale === 'it'
            ? 'bg-[#FF5C5C] text-white'
            : 'bg-white text-gray-600 hover:bg-gray-50'
        }`}
        title="Italiano"
      >
        IT
      </button>
    </div>
  )
}

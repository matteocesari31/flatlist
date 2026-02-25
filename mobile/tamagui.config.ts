import { createTamagui } from 'tamagui'
import { config } from '@tamagui/config/v3'

const flatlistTokens = {
  ...config.tokens,
  color: {
    ...config.tokens.color,
    background: '#0B0B0B',
    backgroundHover: '#111111',
    backgroundPress: '#1A1A1A',
    backgroundTransparent: 'rgba(0,0,0,0.6)',
    borderColor: '#2A2A2B',
    borderColorHover: '#3A3A3B',
    color: '#FFFFFF',
    colorMuted: '#979797',
    colorSubtle: '#6B6B6B',
    cardBackground: '#141414',
    success: '#22C55E',
    warning: '#FACC15',
    danger: '#F87171',
    scoreLow: '#F87171',
    scoreMid: '#FACC15',
    scoreHigh: '#22C55E',
  },
}

const tamaguiConfig = createTamagui({
  ...config,
  tokens: flatlistTokens,
  themes: {
    ...config.themes,
    dark: {
      ...config.themes.dark,
      background: '#0B0B0B',
      backgroundHover: '#111111',
      backgroundPress: '#1A1A1A',
      backgroundStrong: '#000000',
      backgroundTransparent: 'rgba(0,0,0,0.6)',
      borderColor: '#2A2A2B',
      borderColorHover: '#3A3A3B',
      color: '#FFFFFF',
      colorHover: '#E0E0E0',
      colorPress: '#C0C0C0',
    },
  },
  defaultTheme: 'dark',
})

export type AppConfig = typeof tamaguiConfig

declare module 'tamagui' {
  interface TamaguiCustomConfig extends AppConfig {}
}

export default tamaguiConfig

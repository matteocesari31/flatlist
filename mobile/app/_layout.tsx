import { useEffect } from 'react'
import { Stack, useRouter, useSegments } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { TamaguiProvider } from 'tamagui'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { AuthProvider, useAuth } from '@/lib/auth-context'
import tamaguiConfig from '../tamagui.config'

function AuthGate({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth()
  const segments = useSegments()
  const router = useRouter()

  useEffect(() => {
    if (loading) return

    const inAuthGroup = segments[0] === '(auth)'

    if (!session && !inAuthGroup) {
      router.replace('/(auth)/sign-in')
    } else if (session && inAuthGroup) {
      router.replace('/(tabs)')
    }
  }, [session, loading, segments])

  return <>{children}</>
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <TamaguiProvider config={tamaguiConfig} defaultTheme="dark">
        <AuthProvider>
          <AuthGate>
            <Stack
              screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: '#0B0B0B' },
                animation: 'slide_from_right',
              }}
            >
              <Stack.Screen name="(auth)" />
              <Stack.Screen name="(tabs)" />
              <Stack.Screen
                name="listing/[id]"
                options={{
                  headerShown: true,
                  headerStyle: { backgroundColor: '#0B0B0B' },
                  headerTintColor: '#FFFFFF',
                  headerTitle: '',
                  headerBackTitle: 'Back',
                  headerTransparent: true,
                }}
              />
              <Stack.Screen
                name="dream-apartment"
                options={{
                  presentation: 'modal',
                  animation: 'slide_from_bottom',
                }}
              />
              <Stack.Screen
                name="invite/accept"
                options={{ headerShown: false }}
              />
            </Stack>
          </AuthGate>
          <StatusBar style="light" />
        </AuthProvider>
      </TamaguiProvider>
    </GestureHandlerRootView>
  )
}

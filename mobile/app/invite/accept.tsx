import { useEffect, useState } from 'react'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { YStack, Text, Button, Spinner } from 'tamagui'
import { CheckCircle, XCircle } from 'lucide-react-native'
import * as Haptics from 'expo-haptics'
import Animated, { FadeIn, ZoomIn } from 'react-native-reanimated'
import { useAuth } from '@/lib/auth-context'
import { acceptInvitation } from '@/lib/api'

export default function AcceptInvitationScreen() {
  const { token } = useLocalSearchParams<{ token: string }>()
  const { user } = useAuth()
  const router = useRouter()
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    if (!user || !token) return

    ;(async () => {
      try {
        await acceptInvitation(token)
        setStatus('success')
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      } catch (err: any) {
        setStatus('error')
        setErrorMessage(err.message || 'Failed to accept invitation')
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
      }
    })()
  }, [user, token])

  if (!token) {
    return (
      <YStack flex={1} justifyContent="center" alignItems="center" backgroundColor="#0B0B0B" padding="$6">
        <Text color="#F87171" fontSize={16}>Invalid invitation link</Text>
      </YStack>
    )
  }

  return (
    <YStack flex={1} justifyContent="center" alignItems="center" backgroundColor="#0B0B0B" padding="$6" gap="$4">
      {status === 'loading' && (
        <Animated.View entering={FadeIn}>
          <YStack alignItems="center" gap="$3">
            <Spinner size="large" color="white" />
            <Text color="#979797" fontSize={16}>Accepting invitation...</Text>
          </YStack>
        </Animated.View>
      )}

      {status === 'success' && (
        <Animated.View entering={ZoomIn.springify()}>
          <YStack alignItems="center" gap="$4">
            <CheckCircle size={56} color="#22C55E" />
            <Text color="white" fontSize={20} fontWeight="700">Invitation Accepted</Text>
            <Text color="#979797" fontSize={14} textAlign="center">
              You now have access to the shared catalog. Your listings will appear on the home screen.
            </Text>
            <Button
              onPress={() => router.replace('/(tabs)')}
              backgroundColor="white"
              color="black"
              size="$5"
              borderRadius="$6"
              fontWeight="600"
              marginTop="$4"
              pressStyle={{ backgroundColor: '#E0E0E0', scale: 0.98 }}
            >
              Go to Listings
            </Button>
          </YStack>
        </Animated.View>
      )}

      {status === 'error' && (
        <Animated.View entering={ZoomIn.springify()}>
          <YStack alignItems="center" gap="$4">
            <XCircle size={56} color="#F87171" />
            <Text color="white" fontSize={20} fontWeight="700">Something went wrong</Text>
            <Text color="#979797" fontSize={14} textAlign="center">
              {errorMessage}
            </Text>
            <Button
              onPress={() => router.replace('/(tabs)')}
              backgroundColor="#141414"
              borderColor="$borderColor"
              borderWidth={0.5}
              borderRadius="$6"
              color="white"
              size="$5"
              fontWeight="600"
              marginTop="$4"
              pressStyle={{ backgroundColor: '#1A1A1A', scale: 0.98 }}
            >
              Go Home
            </Button>
          </YStack>
        </Animated.View>
      )}
    </YStack>
  )
}

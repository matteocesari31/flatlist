import { useEffect, useState } from 'react'
import { Alert, Linking } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { YStack, XStack, Text, Button, Separator } from 'tamagui'
import { User, Crown, LogOut, ExternalLink } from 'lucide-react-native'
import Animated, { FadeIn } from 'react-native-reanimated'
import * as Haptics from 'expo-haptics'
import { useAuth } from '@/lib/auth-context'
import { fetchSubscription } from '@/lib/api'
import { FREE_LISTINGS_LIMIT } from '../../../shared/constants'

export default function SettingsScreen() {
  const { user, signOut } = useAuth()
  const [subscription, setSubscription] = useState<{
    plan: 'free' | 'premium'
    isPremium: boolean
    listingsCount: number
    currentPeriodEnd: string | null
  } | null>(null)

  useEffect(() => {
    if (!user) return
    fetchSubscription(user.id).then(setSubscription).catch(console.error)
  }, [user])

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
          await signOut()
        },
      },
    ])
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0B0B0B' }} edges={['top']}>
      <Animated.View entering={FadeIn} style={{ flex: 1 }}>
        <YStack flex={1} padding="$4" gap="$5">
          <Text color="white" fontSize={22} fontWeight="700">Settings</Text>

          {/* Profile */}
          <YStack
            backgroundColor="#141414"
            borderRadius="$5"
            padding="$4"
            borderColor="$borderColor"
            borderWidth={0.5}
            gap="$3"
          >
            <XStack gap="$3" alignItems="center">
              <YStack
                width={44}
                height={44}
                borderRadius={22}
                backgroundColor="#2A2A2B"
                alignItems="center"
                justifyContent="center"
              >
                <User size={22} color="#979797" />
              </YStack>
              <YStack>
                <Text color="white" fontSize={16} fontWeight="600">
                  {user?.email || 'User'}
                </Text>
                <Text color="#979797" fontSize={13}>
                  {subscription?.isPremium ? 'Premium' : 'Free Plan'}
                </Text>
              </YStack>
            </XStack>
          </YStack>

          {/* Subscription */}
          <YStack
            backgroundColor="#141414"
            borderRadius="$5"
            padding="$4"
            borderColor="$borderColor"
            borderWidth={0.5}
            gap="$3"
          >
            <XStack gap="$2" alignItems="center">
              <Crown size={18} color={subscription?.isPremium ? '#FACC15' : '#979797'} />
              <Text color="white" fontSize={16} fontWeight="600">Subscription</Text>
            </XStack>

            <Separator borderColor="$borderColor" />

            <XStack justifyContent="space-between">
              <Text color="#979797" fontSize={14}>Plan</Text>
              <Text color="white" fontSize={14} fontWeight="500" textTransform="capitalize">
                {subscription?.plan || 'Free'}
              </Text>
            </XStack>

            <XStack justifyContent="space-between">
              <Text color="#979797" fontSize={14}>Listings</Text>
              <Text color="white" fontSize={14} fontWeight="500">
                {subscription?.listingsCount ?? 0}
                {!subscription?.isPremium && ` / ${FREE_LISTINGS_LIMIT}`}
              </Text>
            </XStack>

            {subscription?.isPremium && subscription.currentPeriodEnd && (
              <XStack justifyContent="space-between">
                <Text color="#979797" fontSize={14}>Renews</Text>
                <Text color="white" fontSize={14} fontWeight="500">
                  {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
                </Text>
              </XStack>
            )}

            {!subscription?.isPremium && (
              <Button
                onPress={() => Linking.openURL('https://my.flatlist.app')}
                backgroundColor="white"
                color="black"
                size="$4"
                borderRadius="$4"
                fontWeight="600"
                marginTop="$2"
                icon={<Crown size={16} color="black" />}
                pressStyle={{ backgroundColor: '#E0E0E0', scale: 0.98 }}
              >
                Upgrade to Premium
              </Button>
            )}
          </YStack>

          {/* Actions */}
          <YStack gap="$3" marginTop="auto" marginBottom="$4">
            <Button
              onPress={() => Linking.openURL('https://my.flatlist.app')}
              backgroundColor="#141414"
              borderColor="$borderColor"
              borderWidth={0.5}
              borderRadius="$4"
              color="white"
              icon={<ExternalLink size={16} color="white" />}
              pressStyle={{ backgroundColor: '#1A1A1A', scale: 0.98 }}
            >
              Open Web App
            </Button>

            <Button
              onPress={handleSignOut}
              backgroundColor="#141414"
              borderColor="#F87171"
              borderWidth={0.5}
              borderRadius="$4"
              color="#F87171"
              icon={<LogOut size={16} color="#F87171" />}
              pressStyle={{ backgroundColor: '#1A1A1A', scale: 0.98 }}
            >
              Sign Out
            </Button>
          </YStack>
        </YStack>
      </Animated.View>
    </SafeAreaView>
  )
}

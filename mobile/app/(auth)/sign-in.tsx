import { useState } from 'react'
import { Alert, KeyboardAvoidingView, Platform } from 'react-native'
import { useRouter } from 'expo-router'
import * as Haptics from 'expo-haptics'
import {
  YStack, XStack, Input, Button, Text, H2, Separator, ScrollView,
} from 'tamagui'
import { supabase } from '@/lib/supabase'

export default function SignInScreen() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleSignIn = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please enter email and password')
      return
    }

    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)

    if (error) {
      Alert.alert('Sign In Failed', error.message)
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1, backgroundColor: '#0B0B0B' }}
    >
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}
        keyboardShouldPersistTaps="handled"
      >
        <YStack flex={1} justifyContent="center" padding="$6" gap="$4">
          <YStack alignItems="center" marginBottom="$6">
            <H2 color="$color" fontWeight="700">flatlist</H2>
          </YStack>

          <YStack gap="$3">
            <Input
              placeholder="your@email.com"
              placeholderTextColor="#979797"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              size="$5"
              borderColor="$borderColor"
              backgroundColor="transparent"
              color="$color"
              borderRadius="$4"
              focusStyle={{ borderColor: '$color' }}
            />

            <Input
              placeholder="Password"
              placeholderTextColor="#979797"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              size="$5"
              borderColor="$borderColor"
              backgroundColor="transparent"
              color="$color"
              borderRadius="$4"
              focusStyle={{ borderColor: '$color' }}
            />

            <XStack justifyContent="flex-end">
              <Text
                color="#979797"
                fontSize="$2"
                onPress={() => router.push('/(auth)/reset-password')}
                pressStyle={{ opacity: 0.7 }}
              >
                Forgot password?
              </Text>
            </XStack>
          </YStack>

          <Button
            onPress={handleSignIn}
            disabled={loading}
            backgroundColor="white"
            color="black"
            size="$5"
            borderRadius="$6"
            fontWeight="600"
            pressStyle={{ backgroundColor: '#E0E0E0', scale: 0.98 }}
            disabledStyle={{ opacity: 0.5 }}
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </Button>

          <Separator marginVertical="$2" borderColor="$borderColor" />

          <XStack justifyContent="center" gap="$2">
            <Text color="#979797">Don't have an account?</Text>
            <Text
              color="white"
              fontWeight="600"
              onPress={() => router.push('/(auth)/sign-up')}
              pressStyle={{ opacity: 0.7 }}
            >
              Sign Up
            </Text>
          </XStack>
        </YStack>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

import { useState } from 'react'
import { Alert, KeyboardAvoidingView, Platform } from 'react-native'
import { useRouter } from 'expo-router'
import * as Haptics from 'expo-haptics'
import {
  YStack, XStack, Input, Button, Text, H2, Separator, ScrollView,
} from 'tamagui'
import { supabase } from '@/lib/supabase'

export default function SignUpScreen() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleSignUp = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please enter email and password')
      return
    }
    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match')
      return
    }
    if (password.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters')
      return
    }

    setLoading(true)
    const { data, error } = await supabase.auth.signUp({ email, password })
    setLoading(false)

    if (error) {
      Alert.alert('Sign Up Failed', error.message)
      return
    }

    if (data.user && !data.session) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      Alert.alert('Check Your Email', 'Please check your email to confirm your account.')
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
            <Text color="#979797" marginTop="$2">Create your account</Text>
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
              placeholder="At least 6 characters"
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

            <Input
              placeholder="Confirm password"
              placeholderTextColor="#979797"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
              size="$5"
              borderColor="$borderColor"
              backgroundColor="transparent"
              color="$color"
              borderRadius="$4"
              focusStyle={{ borderColor: '$color' }}
            />
          </YStack>

          <Button
            onPress={handleSignUp}
            disabled={loading}
            backgroundColor="white"
            color="black"
            size="$5"
            borderRadius="$6"
            fontWeight="600"
            pressStyle={{ backgroundColor: '#E0E0E0', scale: 0.98 }}
            disabledStyle={{ opacity: 0.5 }}
          >
            {loading ? 'Creating account...' : 'Sign Up'}
          </Button>

          <Separator marginVertical="$2" borderColor="$borderColor" />

          <XStack justifyContent="center" gap="$2">
            <Text color="#979797">Already have an account?</Text>
            <Text
              color="white"
              fontWeight="600"
              onPress={() => router.back()}
              pressStyle={{ opacity: 0.7 }}
            >
              Sign In
            </Text>
          </XStack>
        </YStack>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

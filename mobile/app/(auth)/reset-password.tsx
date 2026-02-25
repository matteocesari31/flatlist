import { useState } from 'react'
import { Alert, KeyboardAvoidingView, Platform } from 'react-native'
import { useRouter } from 'expo-router'
import { YStack, Input, Button, Text, H2, ScrollView } from 'tamagui'
import { supabase } from '@/lib/supabase'

export default function ResetPasswordScreen() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const router = useRouter()

  const handleReset = async () => {
    if (!email) {
      Alert.alert('Error', 'Please enter your email')
      return
    }

    setLoading(true)
    const { error } = await supabase.auth.resetPasswordForEmail(email)
    setLoading(false)

    if (error) {
      Alert.alert('Error', error.message)
    } else {
      setSent(true)
    }
  }

  if (sent) {
    return (
      <YStack flex={1} justifyContent="center" padding="$6" gap="$4" backgroundColor="#0B0B0B">
        <YStack alignItems="center" gap="$3">
          <H2 color="$color" fontWeight="700">Check Your Email</H2>
          <Text color="#979797" textAlign="center">
            We sent a password reset link to {email}
          </Text>
          <Button
            onPress={() => router.back()}
            backgroundColor="white"
            color="black"
            size="$5"
            borderRadius="$6"
            fontWeight="600"
            marginTop="$4"
            pressStyle={{ backgroundColor: '#E0E0E0', scale: 0.98 }}
          >
            Back to Sign In
          </Button>
        </YStack>
      </YStack>
    )
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
          <YStack alignItems="center" marginBottom="$4">
            <H2 color="$color" fontWeight="700">Reset Password</H2>
            <Text color="#979797" marginTop="$2" textAlign="center">
              Enter your email to receive a reset link
            </Text>
          </YStack>

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

          <Button
            onPress={handleReset}
            disabled={loading}
            backgroundColor="white"
            color="black"
            size="$5"
            borderRadius="$6"
            fontWeight="600"
            pressStyle={{ backgroundColor: '#E0E0E0', scale: 0.98 }}
            disabledStyle={{ opacity: 0.5 }}
          >
            {loading ? 'Sending...' : 'Send Reset Link'}
          </Button>

          <Text
            color="#979797"
            textAlign="center"
            onPress={() => router.back()}
            pressStyle={{ opacity: 0.7 }}
          >
            Back to Sign In
          </Text>
        </YStack>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

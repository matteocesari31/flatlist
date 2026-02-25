import { useEffect, useState } from 'react'
import { Alert, KeyboardAvoidingView, Platform } from 'react-native'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { YStack, XStack, Text, TextArea, Button } from 'tamagui'
import { Sparkles, X } from 'lucide-react-native'
import * as Haptics from 'expo-haptics'
import Animated, { FadeIn, SlideInDown } from 'react-native-reanimated'
import { useAuth } from '@/lib/auth-context'
import { fetchDreamApartment, saveDreamApartment } from '@/lib/api'

export default function DreamApartmentScreen() {
  const { user } = useAuth()
  const router = useRouter()
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)
  const [initialLoading, setInitialLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    ;(async () => {
      const dream = await fetchDreamApartment(user.id)
      if (dream) setDescription(dream)
      setInitialLoading(false)
    })()
  }, [user])

  const handleSave = async () => {
    if (!user || !description.trim()) return

    setLoading(true)
    try {
      await saveDreamApartment(user.id, description.trim())
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      router.back()
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to save')
    }
    setLoading(false)
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0B0B0B' }}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <Animated.View entering={SlideInDown.springify()} style={{ flex: 1 }}>
          <YStack flex={1} padding="$4" gap="$4">
            {/* Header */}
            <XStack justifyContent="space-between" alignItems="center">
              <XStack gap="$2" alignItems="center">
                <Sparkles size={22} color="#FACC15" />
                <Text color="white" fontSize={20} fontWeight="700">
                  Dream Apartment
                </Text>
              </XStack>
              <Button
                size="$3"
                circular
                backgroundColor="transparent"
                onPress={() => router.back()}
                icon={<X size={20} color="#979797" />}
                pressStyle={{ opacity: 0.7 }}
              />
            </XStack>

            <Animated.View entering={FadeIn.delay(150)} style={{ flex: 1 }}>
              <Text color="#979797" fontSize={14} marginBottom="$3">
                Describe your dream apartment and AI will score every listing against it.
              </Text>

              <TextArea
                value={description}
                onChangeText={setDescription}
                placeholder="e.g. A bright 2-bedroom apartment near M2, under €900/mo, with wood floors and a balcony. Quiet neighborhood, student-friendly area..."
                placeholderTextColor="#6B6B6B"
                backgroundColor="#141414"
                borderColor="$borderColor"
                borderWidth={0.5}
                borderRadius="$5"
                color="white"
                fontSize={15}
                lineHeight={24}
                padding="$4"
                flex={1}
                textAlignVertical="top"
                focusStyle={{ borderColor: '#3A3A3B' }}
              />
            </Animated.View>

            <Button
              onPress={handleSave}
              disabled={loading || !description.trim()}
              backgroundColor="white"
              color="black"
              size="$5"
              borderRadius="$6"
              fontWeight="600"
              pressStyle={{ backgroundColor: '#E0E0E0', scale: 0.98 }}
              disabledStyle={{ opacity: 0.5 }}
            >
              {loading ? 'Saving...' : 'Save & Evaluate Listings'}
            </Button>
          </YStack>
        </Animated.View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

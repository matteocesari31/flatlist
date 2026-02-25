import { useEffect, useState, useRef } from 'react'
import {
  ScrollView, Image, Dimensions, StyleSheet, View, Alert, Linking, Pressable,
  NativeSyntheticEvent, NativeScrollEvent,
} from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { Text, XStack, YStack, Button, TextArea } from 'tamagui'
import Animated, { ZoomIn, FadeIn } from 'react-native-reanimated'
import * as Haptics from 'expo-haptics'
import {
  BedDouble, Bath, Building2, MapPin, Sun, Volume2, PaintRoller,
  GraduationCap, PawPrint, Fence, ExternalLink, Trash2,
} from 'lucide-react-native'
import { useAuth } from '@/lib/auth-context'
import { deleteListing, saveListingNote, compareListing } from '@/lib/api'
import { ListingWithMetadata } from '../../../shared/types'
import { formatPrice, formatSize, isRental, getScoreColor, getListingImages } from '../../../shared/helpers'

const { width: SCREEN_WIDTH } = Dimensions.get('window')

export default function ListingDetailScreen() {
  const params = useLocalSearchParams<{
    id: string
    data: string
    score: string
    summary: string
  }>()
  const router = useRouter()
  const { user } = useAuth()

  const listing: ListingWithMetadata | null = params.data
    ? JSON.parse(params.data)
    : null

  const [matchScore, setMatchScore] = useState<number | undefined>(
    params.score ? Number(params.score) : undefined
  )
  const [comparisonSummary, setComparisonSummary] = useState(params.summary || '')
  const [currentImageIndex, setCurrentImageIndex] = useState(0)
  const [noteText, setNoteText] = useState('')
  const [savingNote, setSavingNote] = useState(false)
  const [scoreVisible, setScoreVisible] = useState(!!params.score)
  const [evaluating, setEvaluating] = useState(false)

  const metadata = listing?.listing_metadata?.[0]
  const images = listing ? getListingImages(listing.images) : []
  const rent = listing ? isRental(listing.raw_content, listing.title, metadata?.listing_type) : false

  useEffect(() => {
    if (listing?.listing_notes && user) {
      const userNote = listing.listing_notes.find((n) => n.user_id === user.id)
      if (userNote) setNoteText(userNote.note)
    }
  }, [listing, user])

  useEffect(() => {
    if (matchScore !== undefined && !scoreVisible) {
      setScoreVisible(true)
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    }
  }, [matchScore])

  const handleDelete = () => {
    Alert.alert('Delete Listing', 'Are you sure you want to delete this listing?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          if (!listing) return
          await deleteListing(listing.id)
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
          router.back()
        },
      },
    ])
  }

  const handleSaveNote = async () => {
    if (!listing || !user) return
    setSavingNote(true)
    try {
      await saveListingNote(listing.id, user.id, noteText)
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    } catch {
      Alert.alert('Error', 'Failed to save note')
    }
    setSavingNote(false)
  }

  const handleEvaluate = async () => {
    if (!listing || !user) return
    setEvaluating(true)
    try {
      const result = await compareListing(listing.id, user.id)
      setMatchScore(result.score)
      setComparisonSummary(result.summary)
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to evaluate')
    }
    setEvaluating(false)
  }

  const handleImageScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH)
    setCurrentImageIndex(idx)
  }

  if (!listing) {
    return (
      <YStack flex={1} justifyContent="center" alignItems="center" backgroundColor="#0B0B0B">
        <Text color="#979797">Listing not found</Text>
      </YStack>
    )
  }

  const scoreColor = matchScore !== undefined ? getScoreColor(matchScore) : null

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Image carousel */}
      {images.length > 0 && (
        <View style={styles.imageCarousel}>
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onScroll={handleImageScroll}
            scrollEventThrottle={16}
          >
            {images.map((uri, i) => (
              <Image key={i} source={{ uri }} style={styles.carouselImage} resizeMode="cover" />
            ))}
          </ScrollView>
          {images.length > 1 && (
            <XStack position="absolute" bottom={12} alignSelf="center" gap="$1.5">
              {images.map((_, i) => (
                <View
                  key={i}
                  style={[
                    styles.dot,
                    i === currentImageIndex && styles.dotActive,
                  ]}
                />
              ))}
            </XStack>
          )}
        </View>
      )}

      <YStack padding="$4" gap="$4">
        {/* Price + Score */}
        <XStack justifyContent="space-between" alignItems="center">
          <YStack>
            {metadata?.price != null && (
              <Text color="white" fontSize={28} fontWeight="800">
                {formatPrice(metadata.price, rent, metadata.currency)}
              </Text>
            )}
            {metadata?.address && (
              <XStack gap="$1.5" alignItems="center" marginTop="$1">
                <MapPin size={14} color="#979797" />
                <Text color="#E0E0E0" fontSize={15}>{metadata.address}</Text>
              </XStack>
            )}
          </YStack>

          {scoreVisible && matchScore !== undefined && (
            <Animated.View entering={ZoomIn.springify()} style={styles.scoreBadgeLarge}>
              <View style={[styles.scoreDotLarge, { backgroundColor: scoreColor!.bg }]} />
              <Text color="white" fontSize={20} fontWeight="700">{matchScore}</Text>
            </Animated.View>
          )}
        </XStack>

        {/* Metadata pills */}
        {metadata && (
          <XStack gap="$3" flexWrap="wrap">
            {metadata.size_sqm != null && (
              <Pill label={formatSize(metadata.size_sqm, metadata.size_unit)!} />
            )}
            {metadata.rooms != null && <Pill label={`${metadata.rooms} rooms`} />}
            {metadata.bedrooms != null && metadata.bedrooms > 0 && (
              <Pill icon={<BedDouble size={14} color="#979797" />} label={`${metadata.bedrooms}`} />
            )}
            {metadata.bathrooms != null && metadata.bathrooms > 0 && (
              <Pill icon={<Bath size={14} color="#979797" />} label={`${metadata.bathrooms}`} />
            )}
            {metadata.condo_fees != null && (
              <Pill
                icon={<Building2 size={14} color="#979797" />}
                label={`${formatPrice(metadata.condo_fees, false, metadata.currency)}/mo`}
              />
            )}
          </XStack>
        )}

        {/* Attributes */}
        {metadata && (
          <Animated.View entering={FadeIn.delay(200)}>
            <YStack
              backgroundColor="#141414"
              borderRadius="$5"
              padding="$4"
              gap="$3"
              borderColor="$borderColor"
              borderWidth={0.5}
            >
              {metadata.natural_light && (
                <AttributeRow icon={<Sun size={16} color="#FACC15" />} label="Natural Light" value={metadata.natural_light} />
              )}
              {metadata.noise_level && (
                <AttributeRow icon={<Volume2 size={16} color="#60A5FA" />} label="Noise Level" value={metadata.noise_level} />
              )}
              {metadata.renovation_state && (
                <AttributeRow icon={<PaintRoller size={16} color="#A78BFA" />} label="Renovation" value={metadata.renovation_state} />
              )}
              {metadata.floor_type && metadata.floor_type !== 'unknown' && (
                <AttributeRow icon={<View />} label="Floors" value={metadata.floor_type} />
              )}
              {metadata.student_friendly != null && (
                <AttributeRow icon={<GraduationCap size={16} color="#34D399" />} label="Student Friendly" value={metadata.student_friendly ? 'Yes' : 'No'} />
              )}
              {metadata.pet_friendly != null && (
                <AttributeRow icon={<PawPrint size={16} color="#FB923C" />} label="Pet Friendly" value={metadata.pet_friendly ? 'Yes' : 'No'} />
              )}
              {metadata.balcony != null && (
                <AttributeRow icon={<Fence size={16} color="#4ADE80" />} label="Balcony" value={metadata.balcony ? 'Yes' : 'No'} />
              )}
            </YStack>
          </Animated.View>
        )}

        {/* Vibe tags */}
        {metadata?.vibe_tags && metadata.vibe_tags.length > 0 && (
          <XStack gap="$2" flexWrap="wrap">
            {metadata.vibe_tags.map((tag) => (
              <View key={tag} style={styles.vibeTag}>
                <Text color="#E0E0E0" fontSize={12}>{tag}</Text>
              </View>
            ))}
          </XStack>
        )}

        {/* AI Comparison Summary */}
        {comparisonSummary ? (
          <Animated.View entering={FadeIn.delay(300)}>
            <YStack
              backgroundColor="#141414"
              borderRadius="$5"
              padding="$4"
              borderColor="$borderColor"
              borderWidth={0.5}
            >
              <Text color="#979797" fontSize={12} fontWeight="600" marginBottom="$2">
                AI COMPARISON
              </Text>
              <Text color="#E0E0E0" fontSize={14} lineHeight={22}>
                {comparisonSummary}
              </Text>
            </YStack>
          </Animated.View>
        ) : (
          <Button
            onPress={handleEvaluate}
            disabled={evaluating}
            backgroundColor="#141414"
            borderColor="$borderColor"
            borderWidth={0.5}
            borderRadius="$5"
            color="#979797"
            pressStyle={{ backgroundColor: '#1A1A1A', scale: 0.98 }}
            disabledStyle={{ opacity: 0.5 }}
          >
            {evaluating ? 'Evaluating...' : 'Evaluate with AI'}
          </Button>
        )}

        {/* Notes */}
        <YStack gap="$2">
          <Text color="#979797" fontSize={12} fontWeight="600">YOUR NOTES</Text>
          <TextArea
            value={noteText}
            onChangeText={setNoteText}
            placeholder="Add a note about this listing..."
            placeholderTextColor="#6B6B6B"
            backgroundColor="#141414"
            borderColor="$borderColor"
            borderWidth={0.5}
            borderRadius="$4"
            color="white"
            fontSize={14}
            minHeight={80}
            focusStyle={{ borderColor: '#3A3A3B' }}
          />
          <Button
            onPress={handleSaveNote}
            disabled={savingNote}
            size="$3"
            backgroundColor="white"
            color="black"
            borderRadius="$4"
            fontWeight="600"
            alignSelf="flex-end"
            pressStyle={{ backgroundColor: '#E0E0E0', scale: 0.98 }}
            disabledStyle={{ opacity: 0.5 }}
          >
            {savingNote ? 'Saving...' : 'Save Note'}
          </Button>
        </YStack>

        {/* Actions */}
        <XStack gap="$3" marginTop="$2">
          <Button
            flex={1}
            onPress={() => Linking.openURL(listing.source_url)}
            backgroundColor="#141414"
            borderColor="$borderColor"
            borderWidth={0.5}
            borderRadius="$4"
            color="white"
            icon={<ExternalLink size={16} color="white" />}
            pressStyle={{ backgroundColor: '#1A1A1A', scale: 0.98 }}
          >
            Open Original
          </Button>
          <Button
            onPress={handleDelete}
            backgroundColor="#141414"
            borderColor="#F87171"
            borderWidth={0.5}
            borderRadius="$4"
            icon={<Trash2 size={16} color="#F87171" />}
            pressStyle={{ backgroundColor: '#1A1A1A', scale: 0.98 }}
          />
        </XStack>
      </YStack>
    </ScrollView>
  )
}

function Pill({ icon, label }: { icon?: React.ReactNode; label: string }) {
  return (
    <XStack
      gap="$1"
      alignItems="center"
      backgroundColor="#141414"
      paddingHorizontal="$2.5"
      paddingVertical="$1.5"
      borderRadius="$3"
      borderColor="$borderColor"
      borderWidth={0.5}
    >
      {icon}
      <Text color="#979797" fontSize={13}>{label}</Text>
    </XStack>
  )
}

function AttributeRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <XStack justifyContent="space-between" alignItems="center">
      <XStack gap="$2" alignItems="center">
        {icon}
        <Text color="#979797" fontSize={14}>{label}</Text>
      </XStack>
      <Text color="white" fontSize={14} fontWeight="500" textTransform="capitalize">
        {value}
      </Text>
    </XStack>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B0B0B',
  },
  content: {
    paddingBottom: 40,
  },
  imageCarousel: {
    width: SCREEN_WIDTH,
    aspectRatio: 4 / 3,
    backgroundColor: '#1A1A1A',
  },
  carouselImage: {
    width: SCREEN_WIDTH,
    height: '100%',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  dotActive: {
    backgroundColor: 'white',
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  scoreBadgeLarge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 30,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  scoreDotLarge: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  vibeTag: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: '#1A1A1A',
    borderWidth: 0.5,
    borderColor: '#2A2A2B',
  },
})

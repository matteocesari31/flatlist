import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { StyleSheet, View, Image, Pressable } from 'react-native'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Text, XStack, YStack } from 'tamagui'
import MapView, { Marker, Region } from 'react-native-maps'
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated'
import * as Haptics from 'expo-haptics'
import { useAuth } from '@/lib/auth-context'
import { fetchListings, fetchUserCatalogs, fetchDreamApartment, fetchListingComparisons } from '@/lib/api'
import { ListingWithMetadata } from '../../../shared/types'
import { getScoreColor, formatPrice, isRental, getListingImages } from '../../../shared/helpers'

export default function MapScreen() {
  const { user } = useAuth()
  const router = useRouter()
  const mapRef = useRef<MapView>(null)
  const [listings, setListings] = useState<ListingWithMetadata[]>([])
  const [selectedListing, setSelectedListing] = useState<ListingWithMetadata | null>(null)
  const [dreamDescription, setDreamDescription] = useState<string | null>(null)
  const [comparisons, setComparisons] = useState<Map<string, { score: number; summary: string }>>(new Map())

  useEffect(() => {
    if (!user) return
    ;(async () => {
      const catalogs = await fetchUserCatalogs(user.id)
      const ids = catalogs.map((c: any) => c.catalog_id)
      const data = await fetchListings(ids)
      setListings(data)
      const dream = await fetchDreamApartment(user.id)
      setDreamDescription(dream)
      const comps = await fetchListingComparisons(user.id)
      setComparisons(comps)
    })()
  }, [user])

  const listingsWithCoords = useMemo(
    () => listings.filter((l) => l.listing_metadata?.[0]?.latitude && l.listing_metadata?.[0]?.longitude),
    [listings]
  )

  const initialRegion: Region | undefined = useMemo(() => {
    if (listingsWithCoords.length === 0) return undefined
    const lats = listingsWithCoords.map((l) => l.listing_metadata[0].latitude!)
    const lngs = listingsWithCoords.map((l) => l.listing_metadata[0].longitude!)
    return {
      latitude: (Math.min(...lats) + Math.max(...lats)) / 2,
      longitude: (Math.min(...lngs) + Math.max(...lngs)) / 2,
      latitudeDelta: Math.max(0.02, (Math.max(...lats) - Math.min(...lats)) * 1.5),
      longitudeDelta: Math.max(0.02, (Math.max(...lngs) - Math.min(...lngs)) * 1.5),
    }
  }, [listingsWithCoords])

  const handleMarkerPress = (listing: ListingWithMetadata) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setSelectedListing(listing)
  }

  const handlePreviewPress = () => {
    if (!selectedListing) return
    router.push({
      pathname: '/listing/[id]',
      params: {
        id: selectedListing.id,
        data: JSON.stringify(selectedListing),
        score: comparisons.get(selectedListing.id)?.score?.toString() || '',
        summary: comparisons.get(selectedListing.id)?.summary || '',
      },
    })
  }

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFillObject}
        initialRegion={initialRegion}
        showsUserLocation
        showsPointsOfInterest={false}
        userInterfaceStyle="dark"
        onPress={() => setSelectedListing(null)}
      >
        {listingsWithCoords.map((listing) => {
          const meta = listing.listing_metadata[0]
          const score = comparisons.get(listing.id)?.score
          const color = score !== undefined ? getScoreColor(score).bg : '#FFFFFF'

          return (
            <Marker
              key={listing.id}
              coordinate={{
                latitude: meta.latitude!,
                longitude: meta.longitude!,
              }}
              onPress={() => handleMarkerPress(listing)}
            >
              <View style={[styles.markerDot, { backgroundColor: color }]} />
            </Marker>
          )
        })}
      </MapView>

      {/* Preview card */}
      {selectedListing && (
        <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(150)} style={styles.previewCard}>
          <Pressable onPress={handlePreviewPress}>
            <PreviewCard
              listing={selectedListing}
              score={comparisons.get(selectedListing.id)?.score}
              hasDream={!!dreamDescription}
            />
          </Pressable>
        </Animated.View>
      )}
    </View>
  )
}

function PreviewCard({
  listing,
  score,
  hasDream,
}: {
  listing: ListingWithMetadata
  score?: number
  hasDream: boolean
}) {
  const meta = listing.listing_metadata?.[0]
  const images = getListingImages(listing.images)
  const thumbnail = images[0] || null
  const rent = isRental(listing.raw_content, listing.title, meta?.listing_type)
  const scoreColor = score !== undefined ? getScoreColor(score) : null

  return (
    <XStack
      backgroundColor="rgba(20,20,20,0.95)"
      borderRadius="$5"
      borderColor="$borderColor"
      borderWidth={0.5}
      overflow="hidden"
    >
      {thumbnail && (
        <Image source={{ uri: thumbnail }} style={styles.previewImage} resizeMode="cover" />
      )}
      <YStack flex={1} padding="$3" justifyContent="center" gap="$1">
        {meta?.price != null && (
          <XStack justifyContent="space-between" alignItems="center">
            <Text color="white" fontSize={17} fontWeight="700">
              {formatPrice(meta.price, rent, meta.currency)}
            </Text>
            {hasDream && score !== undefined && (
              <XStack gap="$1" alignItems="center">
                <View style={[styles.previewScoreDot, { backgroundColor: scoreColor!.bg }]} />
                <Text color="white" fontSize={13} fontWeight="600">{score}</Text>
              </XStack>
            )}
          </XStack>
        )}
        {meta?.address && (
          <Text color="#979797" fontSize={13} numberOfLines={1}>{meta.address}</Text>
        )}
      </YStack>
    </XStack>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B0B0B',
  },
  markerDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: 'white',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
  },
  previewCard: {
    position: 'absolute',
    bottom: 100,
    left: 16,
    right: 16,
  },
  previewImage: {
    width: 100,
    height: 80,
  },
  previewScoreDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
})

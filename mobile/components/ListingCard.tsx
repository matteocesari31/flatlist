import { Pressable, Image, StyleSheet, View } from 'react-native'
import { Text, XStack, YStack } from 'tamagui'
import Animated, { FadeInDown } from 'react-native-reanimated'
import { BedDouble, Bath, Building2 } from 'lucide-react-native'
import { ListingWithMetadata } from '../../shared/types'
import {
  formatPrice,
  formatSize,
  isRental,
  getScoreColor,
  getListingImages,
  extractBasicListingInfo,
} from '../../shared/helpers'

interface ListingCardProps {
  listing: ListingWithMetadata
  index: number
  matchScore?: number
  hasDreamApartment: boolean
  onPress: () => void
}

export default function ListingCard({
  listing,
  index,
  matchScore,
  hasDreamApartment,
  onPress,
}: ListingCardProps) {
  const metadata = listing.listing_metadata?.[0]
  const basicInfo = !metadata ? extractBasicListingInfo(listing) : null
  const images = getListingImages(listing.images)
  const thumbnail = images[0] || null
  const rent = isRental(listing.raw_content, listing.title, metadata?.listing_type)
  const scoreColor = matchScore !== undefined ? getScoreColor(matchScore) : null

  return (
    <Animated.View entering={FadeInDown.delay(index * 60).springify()}>
      <Pressable onPress={onPress} style={styles.container}>
        <View style={styles.imageContainer}>
          {thumbnail ? (
            <Image source={{ uri: thumbnail }} style={styles.image} resizeMode="cover" />
          ) : (
            <View style={[styles.image, styles.placeholder]} />
          )}

          {hasDreamApartment && matchScore !== undefined && (
            <View style={styles.scoreBadge}>
              <View style={[styles.scoreDot, { backgroundColor: scoreColor!.bg }]} />
              <Text color="white" fontSize={13} fontWeight="600">
                {matchScore}
              </Text>
            </View>
          )}
        </View>

        <YStack paddingTop="$1.5">
          {(metadata?.price != null || basicInfo?.price) && (
            <Text color="white" fontSize={20} fontWeight="700">
              {formatPrice(
                metadata?.price ?? basicInfo?.price ?? null,
                rent,
                metadata?.currency ?? null
              )}
            </Text>
          )}

          {(metadata?.address || basicInfo?.address) && (
            <Text color="#E0E0E0" fontSize={14} numberOfLines={1} marginTop="$0.5">
              {metadata?.address || basicInfo?.address}
            </Text>
          )}

          {metadata && (
            <XStack gap="$3" marginTop="$1.5" flexWrap="wrap">
              {metadata.size_sqm != null && (
                <Text color="#979797" fontSize={12}>
                  {formatSize(metadata.size_sqm, metadata.size_unit)}
                </Text>
              )}
              {metadata.bedrooms != null && metadata.bedrooms > 0 && (
                <XStack gap="$1" alignItems="center">
                  <BedDouble size={13} color="#979797" />
                  <Text color="#979797" fontSize={12}>{metadata.bedrooms}</Text>
                </XStack>
              )}
              {metadata.bathrooms != null && metadata.bathrooms > 0 && (
                <XStack gap="$1" alignItems="center">
                  <Bath size={13} color="#979797" />
                  <Text color="#979797" fontSize={12}>{metadata.bathrooms}</Text>
                </XStack>
              )}
              {metadata.condo_fees != null && (
                <XStack gap="$1" alignItems="center">
                  <Building2 size={13} color="#979797" />
                  <Text color="#979797" fontSize={12}>
                    {formatPrice(metadata.condo_fees, false, metadata.currency)}/mo
                  </Text>
                </XStack>
              )}
              {listing.distanceFromReference !== undefined && (
                <Text color="#979797" fontSize={12}>
                  {listing.distanceFromReference < 1
                    ? `${Math.round(listing.distanceFromReference * 1000)} m away`
                    : `${listing.distanceFromReference.toFixed(1)} km away`}
                </Text>
              )}
            </XStack>
          )}

          {!metadata && listing.enrichment_status !== 'failed' && (
            <Text color="#979797" fontSize={12} marginTop="$1.5">
              {listing.enrichment_status === 'processing'
                ? 'AI enrichment in progress...'
                : 'Waiting for AI enrichment...'}
            </Text>
          )}
        </YStack>
      </Pressable>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 24,
  },
  imageContainer: {
    position: 'relative',
    aspectRatio: 4 / 3,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#1A1A1A',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  placeholder: {
    backgroundColor: '#1A1A1A',
  },
  scoreBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 30,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  scoreDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
})

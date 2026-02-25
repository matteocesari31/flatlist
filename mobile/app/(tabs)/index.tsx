import { useCallback, useEffect, useState } from 'react'
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Text, XStack, YStack, Input } from 'tamagui'
import { Search, Sparkles, UserPlus } from 'lucide-react-native'
import * as Haptics from 'expo-haptics'
import { useAuth } from '@/lib/auth-context'
import { fetchListings, fetchUserCatalogs, fetchDreamApartment, compareListing } from '@/lib/api'
import { ListingWithMetadata } from '../../../shared/types'
import ListingCard from '@/components/ListingCard'
import { ListingCardSkeleton } from '@/components/Skeleton'

export default function ListingsScreen() {
  const { user } = useAuth()
  const router = useRouter()
  const [listings, setListings] = useState<ListingWithMetadata[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [catalogName, setCatalogName] = useState('')
  const [catalogIds, setCatalogIds] = useState<string[]>([])
  const [dreamDescription, setDreamDescription] = useState<string | null>(null)
  const [comparisons, setComparisons] = useState<Map<string, { score: number; summary: string }>>(new Map())

  const loadData = useCallback(async () => {
    if (!user) return

    try {
      const catalogs = await fetchUserCatalogs(user.id)
      const ids = catalogs.map((c: any) => c.catalog_id)
      setCatalogIds(ids)

      if (catalogs.length > 0) {
        const cat = catalogs[0] as any
        setCatalogName(cat.catalogs?.name || 'My Catalog')
      }

      const data = await fetchListings(ids)
      setListings(data)

      const dream = await fetchDreamApartment(user.id)
      setDreamDescription(dream)
    } catch (err) {
      console.error('Error loading data:', err)
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    loadData()
  }, [loadData])

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await loadData()
    setRefreshing(false)
  }, [loadData])

  const handleListingPress = (listing: ListingWithMetadata) => {
    router.push({
      pathname: '/listing/[id]',
      params: {
        id: listing.id,
        data: JSON.stringify(listing),
        score: comparisons.get(listing.id)?.score?.toString() || '',
        summary: comparisons.get(listing.id)?.summary || '',
      },
    })
  }

  const filteredListings = searchQuery.trim()
    ? listings.filter((l) => {
        const q = searchQuery.toLowerCase()
        const meta = l.listing_metadata?.[0]
        return (
          l.title?.toLowerCase().includes(q) ||
          meta?.address?.toLowerCase().includes(q) ||
          l.raw_content?.toLowerCase().includes(q)
        )
      })
    : listings

  const renderItem = ({ item, index }: { item: ListingWithMetadata; index: number }) => (
    <ListingCard
      listing={item}
      index={index}
      matchScore={comparisons.get(item.id)?.score}
      hasDreamApartment={!!dreamDescription}
      onPress={() => handleListingPress(item)}
    />
  )

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <YStack paddingHorizontal="$4" paddingBottom="$2">
        <XStack justifyContent="space-between" alignItems="center" marginBottom="$3">
          <Text color="white" fontSize={22} fontWeight="700">
            {catalogName || 'flatlist'}
          </Text>
          <XStack gap="$3">
            <Sparkles
              size={22}
              color={dreamDescription ? '#FACC15' : '#979797'}
              onPress={() => router.push('/dream-apartment')}
            />
          </XStack>
        </XStack>

        {/* Search bar */}
        <XStack
          backgroundColor="#141414"
          borderRadius="$4"
          alignItems="center"
          paddingHorizontal="$3"
          borderColor="$borderColor"
          borderWidth={0.5}
        >
          <Search size={18} color="#979797" />
          <Input
            flex={1}
            placeholder="Search listings..."
            placeholderTextColor="#979797"
            value={searchQuery}
            onChangeText={setSearchQuery}
            backgroundColor="transparent"
            borderWidth={0}
            color="white"
            fontSize={15}
            paddingHorizontal="$2"
            focusStyle={{ borderWidth: 0 }}
          />
        </XStack>
      </YStack>

      {/* Listings */}
      {loading ? (
        <View style={styles.skeletonContainer}>
          <ListingCardSkeleton />
          <ListingCardSkeleton />
          <ListingCardSkeleton />
        </View>
      ) : (
        <FlatList
          data={filteredListings}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#FFFFFF"
            />
          }
          ListEmptyComponent={
            <YStack flex={1} justifyContent="center" alignItems="center" paddingTop="$10">
              <Text color="#979797" fontSize={16}>
                {searchQuery ? 'No listings match your search' : 'No listings yet'}
              </Text>
              <Text color="#6B6B6B" fontSize={13} marginTop="$2" textAlign="center">
                Save listings using the Chrome extension on desktop
              </Text>
            </YStack>
          }
        />
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B0B0B',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  skeletonContainer: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
})

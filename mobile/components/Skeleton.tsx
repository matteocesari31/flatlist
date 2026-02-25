import { useEffect } from 'react'
import { StyleSheet, View, Dimensions } from 'react-native'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  interpolate,
} from 'react-native-reanimated'

const { width: SCREEN_WIDTH } = Dimensions.get('window')

interface SkeletonProps {
  width: number | string
  height: number
  borderRadius?: number
  style?: any
}

export default function Skeleton({ width, height, borderRadius = 8, style }: SkeletonProps) {
  const shimmer = useSharedValue(0)

  useEffect(() => {
    shimmer.value = withRepeat(withTiming(1, { duration: 1200 }), -1, true)
  }, [])

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(shimmer.value, [0, 1], [0.3, 0.6]),
  }))

  return (
    <Animated.View
      style={[
        {
          width: width as any,
          height,
          borderRadius,
          backgroundColor: '#1A1A1A',
        },
        animatedStyle,
        style,
      ]}
    />
  )
}

export function ListingCardSkeleton() {
  return (
    <View style={styles.card}>
      <Skeleton width="100%" height={180} borderRadius={20} />
      <View style={styles.info}>
        <Skeleton width={120} height={24} borderRadius={6} />
        <Skeleton width={200} height={16} borderRadius={6} style={{ marginTop: 6 }} />
        <View style={styles.pills}>
          <Skeleton width={60} height={14} borderRadius={4} />
          <Skeleton width={50} height={14} borderRadius={4} />
          <Skeleton width={40} height={14} borderRadius={4} />
        </View>
      </View>
    </View>
  )
}

export function ListingDetailSkeleton() {
  return (
    <View style={styles.detail}>
      <Skeleton width={SCREEN_WIDTH} height={SCREEN_WIDTH * 0.75} borderRadius={0} />
      <View style={styles.detailContent}>
        <Skeleton width={180} height={30} borderRadius={8} />
        <Skeleton width={240} height={18} borderRadius={6} style={{ marginTop: 8 }} />
        <View style={styles.pills}>
          <Skeleton width={70} height={30} borderRadius={12} />
          <Skeleton width={60} height={30} borderRadius={12} />
          <Skeleton width={80} height={30} borderRadius={12} />
        </View>
        <Skeleton width="100%" height={160} borderRadius={16} style={{ marginTop: 16 }} />
        <Skeleton width="100%" height={80} borderRadius={16} style={{ marginTop: 12 }} />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    marginBottom: 20,
  },
  info: {
    paddingTop: 8,
  },
  pills: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 10,
  },
  detail: {
    flex: 1,
  },
  detailContent: {
    padding: 16,
  },
})

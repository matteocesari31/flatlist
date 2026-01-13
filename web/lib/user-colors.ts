// Color palette for user note borders
// These colors are chosen to be distinct and work well as borders
const COLOR_PALETTE = [
  '#FF5C5C', // Red (primary brand color)
  '#3B82F6', // Blue
  '#10B981', // Green
  '#F59E0B', // Amber
  '#8B5CF6', // Purple
  '#EC4899', // Pink
  '#06B6D4', // Cyan
  '#F97316', // Orange
  '#84CC16', // Lime
  '#6366F1', // Indigo
  '#14B8A6', // Teal
  '#EF4444', // Red variant
]

/**
 * Generate a consistent color for a user based on their user_id
 * Uses a simple hash function to map user_id to a color from the palette
 */
export function getUserColor(userId: string): string {
  // Simple hash function
  let hash = 0
  for (let i = 0; i < userId.length; i++) {
    const char = userId.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32-bit integer
  }
  
  // Use absolute value and modulo to get index
  const index = Math.abs(hash) % COLOR_PALETTE.length
  return COLOR_PALETTE[index]
}

/**
 * Get border color class for Tailwind (if needed)
 * Returns the hex color directly for inline styles
 */
export function getUserBorderColor(userId: string): string {
  return getUserColor(userId)
}


import { Tabs } from 'expo-router'
import { List, Map, Settings } from 'lucide-react-native'
import * as Haptics from 'expo-haptics'

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#0B0B0B',
          borderTopColor: '#2A2A2B',
          borderTopWidth: 0.5,
          paddingBottom: 4,
        },
        tabBarActiveTintColor: '#FFFFFF',
        tabBarInactiveTintColor: '#979797',
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '500',
        },
      }}
      screenListeners={{
        tabPress: () => {
          Haptics.selectionAsync()
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Listings',
          tabBarIcon: ({ color, size }) => <List color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="map"
        options={{
          title: 'Map',
          tabBarIcon: ({ color, size }) => <Map color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color, size }) => <Settings color={color} size={size} />,
        }}
      />
    </Tabs>
  )
}

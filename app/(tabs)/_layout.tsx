import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import Theme from "@/constants/theme";

/**
 * Whether Settings keeps its own tab. Flip to false to move it behind the
 * profile/gear entry point: the route stays mounted and `router.push
 * ("/(tabs)/settings")` keeps working, it just leaves the bar. Nothing in
 * Stats depends on this either way.
 */
const SETTINGS_IN_TAB_BAR = true;

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Theme.colors.tabIconSelected,
        tabBarInactiveTintColor: Theme.colors.tabIconDefault,
        tabBarStyle: {
          backgroundColor: Theme.colors.card,
          borderTopColor: Theme.colors.cardBorder,
          borderTopWidth: 1,
          paddingBottom: 4,
          height: 88,
        },
        tabBarLabelStyle: {
          fontFamily: Theme.fonts.medium,
          fontSize: 11,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="customize"
        options={{
          title: "Customize",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="color-palette-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="timed-block"
        options={{
          // Shortened from "Timed Block": six tabs leave ~67pt each, which
          // truncated the longer label.
          title: "Blocks",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="hourglass-outline" size={size} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="stats"
        options={{
          title: "Stats",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="stats-chart-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="friends"
        options={{
          title: "Friends",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="people-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Settings",
          href: SETTINGS_IN_TAB_BAR ? undefined : null,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="settings-outline" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}

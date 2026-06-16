import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { Redirect, Tabs } from 'expo-router';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { Fonts } from '@/constants/theme';

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

const TABS: { name: string; label: string; icon: IoniconsName; iconActive: IoniconsName }[] = [
  { name: 'map',        label: 'Home',        icon: 'home-outline',          iconActive: 'home'          },
  { name: 'discover',   label: 'Discover',     icon: 'compass-outline',       iconActive: 'compass'       },
  { name: 'my-reports', label: 'Incident Log', icon: 'document-text-outline', iconActive: 'document-text' },
  { name: 'profile',    label: 'Profile',      icon: 'person-outline',        iconActive: 'person'        },
];

function CustomTabBar({ state, navigation }: { state: any; navigation: any }) {
  const insets = useSafeAreaInsets();
  const { isDark, colors } = useTheme();

  return (
    <View style={[styles.wrapper, { paddingBottom: insets.bottom || 12 }]}>
      {Platform.OS === 'ios' ? (
        <BlurView intensity={80} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
      ) : (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: isDark ? 'rgba(10,10,15,0.96)' : 'rgba(244,244,249,0.97)' }]} />
      )}
      <View style={[styles.topEdge, { backgroundColor: colors.borderStrong }]} />
      <View style={styles.row}>
        {state.routes.map((route: { key: string; name: string }, index: number) => {
          const tab = TABS.find(t => t.name === route.name);
          if (!tab) return null;
          const focused = state.index === index;

          function onPress() {
            const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
          }

          return (
            <Pressable key={route.key} onPress={onPress} style={styles.tabItem}>
              <View style={[styles.iconWrap, focused && { backgroundColor: colors.accent + '1F' }]}>
                <Ionicons
                  name={focused ? tab.iconActive : tab.icon}
                  size={22}
                  color={focused ? colors.accent : colors.textMuted}
                />
              </View>
              <Text style={[styles.label, { color: focused ? colors.accent : colors.textMuted }]}>
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export default function TabLayout() {
  const { isAuthenticated, isLoading } = useAuth();

  if (!isLoading && !isAuthenticated) {
    return <Redirect href="/(auth)/login" />;
  }

  return (
    <Tabs
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen name="map" />
      <Tabs.Screen name="discover" />
      <Tabs.Screen name="my-reports" />
      <Tabs.Screen name="profile" />
      <Tabs.Screen name="report" options={{ href: null }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    backgroundColor: 'transparent',
  },
  topEdge: { height: 1 },
  row: {
    flexDirection: 'row',
    paddingTop: 10,
    paddingHorizontal: 8,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
    paddingBottom: 2,
  },
  iconWrap: {
    width: 40,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontFamily: Fonts.medium,
    fontSize: 10,
    letterSpacing: 0.2,
  },
});

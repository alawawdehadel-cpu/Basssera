import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import type { TranslationKey } from '../../src/i18n/translations';
import { Tabs } from 'expo-router';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon, { type IconName } from '../../src/components/basirah/Icon';
import MiniPlayer from '../../src/components/basirah/MiniPlayer';
import { Press } from '../../src/components/basirah/primitives';
import Txt from '../../src/components/basirah/Txt';
import { useTheme } from '../../src/theme/ThemeContext';
import { useAppLanguage } from '../../src/hooks/useAppLanguage';

interface TabDef {
  route: string;
  labelKey: TranslationKey;
  icon: IconName;
  /** The المساعد tab highlights gold instead of emerald, per spec. */
  gold?: boolean;
}

const TAB_DEFS: TabDef[] = [
  { route: 'home', labelKey: 'nav.home', icon: 'home' },
  { route: 'quran', labelKey: 'nav.quran', icon: 'bookOpen' },
  { route: 'search', labelKey: 'nav.search', icon: 'search' },
  { route: 'assistant', labelKey: 'nav.assistant', icon: 'spark', gold: true },
  { route: 'library', labelKey: 'nav.library', icon: 'bookmark' },
];

/** Routes that keep the tab bar but highlight another tab. */
const ALIAS: Record<string, string> = { recitations: 'library' };

function BasirahTabBar({ state, navigation }: BottomTabBarProps) {
  const { colors } = useTheme();
  const { t } = useAppLanguage();
  const insets = useSafeAreaInsets();

  const currentRoute = state.routes[state.index]?.name ?? 'home';
  const activeName = ALIAS[currentRoute] ?? currentRoute;

  return (
    <View style={{ backgroundColor: colors.navBg }}>
      <MiniPlayer />
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingTop: 8,
          paddingHorizontal: 8,
          paddingBottom: Math.max(insets.bottom, 8),
          borderTopWidth: 1,
          borderTopColor: colors.border,
        }}
      >
        {TAB_DEFS.map((tab) => {
          const active = activeName === tab.route;
          const color = active ? (tab.gold ? colors.gold : colors.emerald) : colors.text2;
          const pillBg = active
            ? tab.gold
              ? colors.goldTintStrong
              : colors.navActive
            : 'transparent';
          return (
            <Press
              key={tab.route}
              accessibilityLabel={t(tab.labelKey)}
              onPress={() => {
                const target = state.routes.find((r) => r.name === tab.route);
                if (target) navigation.navigate(target.name as never);
              }}
              style={{ flex: 1, alignItems: 'center', gap: 3, paddingVertical: 5 }}
            >
              <View
                style={{
                  width: 54,
                  height: 30,
                  borderRadius: 16,
                  backgroundColor: pillBg,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Icon name={tab.icon} size={21} color={color} filled={tab.route === 'library' && active} />
              </View>
              <Txt size={10} weight={600} color={color} align="center">
                {t(tab.labelKey)}
              </Txt>
            </Press>
          );
        })}
      </View>
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <BasirahTabBar {...props} />}
      screenOptions={{ headerShown: false }}
      initialRouteName="home"
    >
      <Tabs.Screen name="home" />
      <Tabs.Screen name="quran" />
      <Tabs.Screen name="search" />
      <Tabs.Screen name="assistant" />
      <Tabs.Screen name="library" />
      <Tabs.Screen name="recitations" options={{ href: null }} />
    </Tabs>
  );
}

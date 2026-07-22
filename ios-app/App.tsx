import React, {useEffect} from 'react';
import {NavigationContainer} from '@react-navigation/native';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {StatusBar, StyleSheet, View, Text} from 'react-native';
import {BlurView} from '@react-native-community/blur';

import RoutePlannerScreen from './src/screens/RoutePlanner/RoutePlannerScreen';
import ChargerMapScreen from './src/screens/ChargerMap/ChargerMapScreen';
import AdminScreen from './src/screens/Admin/AdminScreen';
import {AppSettingsProvider} from './src/context/AppSettingsContext';
import {initDatabase} from './src/database/schema';
import {COLORS, GLASS} from './src/constants/colors';

const TAB_ICONS: Record<string, string> = {
  Plan: '🗺',
  Map: '⚡',
  Garage: '🚗',
};

// Simple tab bar icons using unicode symbols (no icon library dependency for CI)
const TabIcon = ({label, focused}: {label: string; focused: boolean}) => (
  <View style={styles.tabIcon}>
    <Text style={[styles.tabIconText, focused && styles.tabIconFocused]}>
      {TAB_ICONS[label] ?? '•'}
    </Text>
  </View>
);

const Tab = createBottomTabNavigator();

function App(): React.JSX.Element {
  useEffect(() => {
    // Initialise SQLite schema on first launch
    initDatabase().catch(err => console.error('DB init error', err));
  }, []);

  return (
    <SafeAreaProvider>
      <AppSettingsProvider>
        <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />
        <NavigationContainer>
          <Tab.Navigator
            screenOptions={({route}) => ({
              headerShown: false,
              tabBarActiveTintColor: COLORS.primary,
              tabBarInactiveTintColor: COLORS.textSecondary,
              // Floating + transparent, with tabBarBackground supplying the
              // actual blur — this is the standard react-navigation pattern
              // for a translucent Liquid-Glass-style tab bar (there is no
              // real native UITabBar under react-navigation's JS tab bar, so
              // it never gets the OS's automatic iOS 26 treatment for free).
              tabBarStyle: styles.tabBar,
              tabBarBackground: () => (
                <BlurView
                  style={StyleSheet.absoluteFill}
                  blurType="light"
                  blurAmount={24}
                  reducedTransparencyFallbackColor={GLASS.fallbackColor}
                />
              ),
              tabBarLabelStyle: styles.tabLabel,
              tabBarIcon: ({focused}) => (
                <TabIcon label={route.name} focused={focused} />
              ),
            })}>
            <Tab.Screen name="Plan" component={RoutePlannerScreen} />
            <Tab.Screen name="Map" component={ChargerMapScreen} />
            <Tab.Screen name="Garage" component={AdminScreen} />
          </Tab.Navigator>
        </NavigationContainer>
      </AppSettingsProvider>
    </SafeAreaProvider>
  );
}

export const TAB_BAR_HEIGHT = 60;

const styles = StyleSheet.create({
  tabBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'transparent',
    borderTopColor: GLASS.border,
    borderTopWidth: 1,
    height: TAB_BAR_HEIGHT,
    paddingBottom: 6,
    elevation: 0, // Android: let the BlurView itself carry the surface, no separate opaque shadow layer
  },
  tabLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
  tabIcon: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabIconText: {
    fontSize: 20,
    opacity: 0.5,
  },
  tabIconFocused: {
    opacity: 1,
  },
});

export default App;

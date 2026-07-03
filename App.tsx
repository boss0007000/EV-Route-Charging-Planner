import React, {useEffect} from 'react';
import {NavigationContainer} from '@react-navigation/native';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {StatusBar, StyleSheet, View, Text} from 'react-native';

import RoutePlannerScreen from './src/screens/RoutePlanner/RoutePlannerScreen';
import ChargerMapScreen from './src/screens/ChargerMap/ChargerMapScreen';
import {AppSettingsProvider} from './src/context/AppSettingsContext';
import {initDatabase} from './src/database/schema';
import {COLORS} from './src/constants/colors';

// Simple tab bar icons using unicode symbols (no icon library dependency for CI)
const TabIcon = ({label, focused}: {label: string; focused: boolean}) => (
  <View style={styles.tabIcon}>
    <Text style={[styles.tabIconText, focused && styles.tabIconFocused]}>
      {label === 'Plan' ? '🗺' : '⚡'}
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
              tabBarStyle: styles.tabBar,
              tabBarLabelStyle: styles.tabLabel,
              tabBarIcon: ({focused}) => (
                <TabIcon label={route.name} focused={focused} />
              ),
            })}>
            <Tab.Screen name="Plan" component={RoutePlannerScreen} />
            <Tab.Screen name="Map" component={ChargerMapScreen} />
          </Tab.Navigator>
        </NavigationContainer>
      </AppSettingsProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: COLORS.surface,
    borderTopColor: COLORS.border,
    borderTopWidth: 1,
    height: 60,
    paddingBottom: 6,
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

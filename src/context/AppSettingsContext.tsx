/**
 * App-wide settings context: reserve%, charge targets, etc.
 * Values persisted via AsyncStorage.
 */

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {RouteSettings, DEFAULT_ROUTE_SETTINGS} from '../types';

const STORAGE_KEY = '@chargeroute/settings';

interface AppSettingsContextValue {
  settings: RouteSettings;
  updateSettings: (partial: Partial<RouteSettings>) => Promise<void>;
  isLoaded: boolean;
}

const AppSettingsContext = createContext<AppSettingsContextValue>({
  settings: DEFAULT_ROUTE_SETTINGS,
  updateSettings: async () => {},
  isLoaded: false,
});

export function AppSettingsProvider({children}: {children: React.ReactNode}) {
  const [settings, setSettings] = useState<RouteSettings>(DEFAULT_ROUTE_SETTINGS);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then(raw => {
        if (raw) {
          const parsed = JSON.parse(raw) as Partial<RouteSettings>;
          setSettings({...DEFAULT_ROUTE_SETTINGS, ...parsed});
        }
      })
      .catch(console.warn)
      .finally(() => setIsLoaded(true));
  }, []);

  const updateSettings = useCallback(async (partial: Partial<RouteSettings>) => {
    const next = {...settings, ...partial};
    setSettings(next);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }, [settings]);

  return (
    <AppSettingsContext.Provider value={{settings, updateSettings, isLoaded}}>
      {children}
    </AppSettingsContext.Provider>
  );
}

export function useAppSettings(): AppSettingsContextValue {
  return useContext(AppSettingsContext);
}

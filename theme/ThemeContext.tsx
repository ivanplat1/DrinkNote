import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import { View, StyleSheet, LayoutAnimation, Platform, UIManager } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SplashScreen from 'expo-splash-screen';
import { ThemeName, getTheme, ThemeColors } from './themes';

const THEME_STORAGE_KEY = '@drinknote_theme';

// Держим сплэш до загрузки темы, чтобы не мелькала тёмная тема
SplashScreen.preventAutoHideAsync().catch(() => {});

interface ThemeContextType {
  themeName: ThemeName;
  colors: ThemeColors;
  setTheme: (theme: ThemeName) => Promise<void>;
  isThemeLoaded: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

type ThemeState = { themeName: ThemeName; isThemeLoaded: boolean };

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ThemeState>({ themeName: 'dark', isThemeLoaded: false });
  const themeName = state.themeName;
  const isThemeLoaded = state.isThemeLoaded;
  const colors = React.useMemo(() => getTheme(themeName), [themeName]);
  const initialLoadDone = useRef(false);

  // Загружаем сохраненную тему при запуске — до этого не показываем интерфейс
  useEffect(() => {
    if (initialLoadDone.current) return;
    initialLoadDone.current = true;
    loadTheme();
  }, []);

  const loadTheme = async () => {
    try {
      const savedTheme = await AsyncStorage.getItem(THEME_STORAGE_KEY);
      const name: ThemeName = (savedTheme === 'dark' || savedTheme === 'light' || savedTheme === 'sepia' || savedTheme === 'highContrast' || savedTheme === 'violet' || savedTheme === 'sand' || savedTheme === 'nord' || savedTheme === 'darcula')
        ? savedTheme
        : 'dark';
      setState({ themeName: name, isThemeLoaded: true });
      requestAnimationFrame(() => {
        SplashScreen.hideAsync().catch(() => {});
      });
    } catch (error) {
      console.error('Error loading theme:', error);
      setState((prev) => ({ ...prev, isThemeLoaded: true }));
      SplashScreen.hideAsync().catch(() => {});
    }
  };

  const setTheme = async (theme: ThemeName) => {
    try {
      await AsyncStorage.setItem(THEME_STORAGE_KEY, theme);
      if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
        UIManager.setLayoutAnimationEnabledExperimental(true);
      }
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setState((prev) => ({ ...prev, themeName: theme }));
    } catch (error) {
      console.error('Error saving theme:', error);
    }
  };

  // Не рендерим интерфейс до загрузки темы. Фон как у сплэша (#fff), чтобы при раннем скрытии (Expo Go) не мелькала тёмная тема
  if (!isThemeLoaded) {
    return (
      <ThemeContext.Provider value={{ themeName, colors, setTheme, isThemeLoaded: false }}>
        <View style={[styles.placeholder, { backgroundColor: '#ffffff' }]} />
      </ThemeContext.Provider>
    );
  }

  return (
    <ThemeContext.Provider value={{ themeName, colors, setTheme, isThemeLoaded }}>
      {children}
    </ThemeContext.Provider>
  );
}

const styles = StyleSheet.create({
  placeholder: {
    flex: 1,
  },
});

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}

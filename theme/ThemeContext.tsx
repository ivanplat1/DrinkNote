import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ThemeName, getTheme, ThemeColors } from './themes';

const THEME_STORAGE_KEY = '@drinknote_theme';

interface ThemeContextType {
  themeName: ThemeName;
  colors: ThemeColors;
  setTheme: (theme: ThemeName) => Promise<void>;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [themeName, setThemeName] = useState<ThemeName>('dark');
  const [colors, setColors] = useState<ThemeColors>(getTheme('dark'));

  // Загружаем сохраненную тему при запуске
  useEffect(() => {
    loadTheme();
  }, []);

  // Обновляем цвета при изменении темы
  useEffect(() => {
    setColors(getTheme(themeName));
  }, [themeName]);

  const loadTheme = async () => {
    try {
      const savedTheme = await AsyncStorage.getItem(THEME_STORAGE_KEY);
      if (savedTheme && (savedTheme === 'dark' || savedTheme === 'light' || savedTheme === 'sepia' || savedTheme === 'highContrast')) {
        setThemeName(savedTheme as ThemeName);
      }
    } catch (error) {
      console.error('Error loading theme:', error);
    }
  };

  const setTheme = async (theme: ThemeName) => {
    try {
      await AsyncStorage.setItem(THEME_STORAGE_KEY, theme);
      setThemeName(theme);
    } catch (error) {
      console.error('Error saving theme:', error);
    }
  };

  return (
    <ThemeContext.Provider value={{ themeName, colors, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}

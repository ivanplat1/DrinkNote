import AsyncStorage from '@react-native-async-storage/async-storage';

export type AppLanguage = 'ru' | 'en';

const LANGUAGE_OVERRIDE_KEY = 'app_language_override_v1';

export async function getAppLanguage(): Promise<AppLanguage | null> {
  const raw = await AsyncStorage.getItem(LANGUAGE_OVERRIDE_KEY);
  if (raw === 'ru' || raw === 'en') return raw;
  return null;
}

export async function setAppLanguage(language: AppLanguage): Promise<void> {
  await AsyncStorage.setItem(LANGUAGE_OVERRIDE_KEY, language);
}


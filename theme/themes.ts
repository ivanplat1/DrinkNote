// Цветовые темы приложения
export type ThemeName = 'dark' | 'light' | 'sepia' | 'highContrast' | 'violet' | 'sand' | 'nord' | 'darcula';

export interface ThemeColors {
  // Основные цвета
  primary: string;
  primaryLight: string;
  primaryDark: string;
  secondary: string;
  
  // Фон
  background: string;
  backgroundSecondary: string;
  backgroundTertiary: string;
  backgroundCard: string;
  /** Фон полей ввода / поиска (светлее secondary на светлых темах) */
  backgroundInput: string;
  /** Фон строки «запись о выпитом» в модалке дня календаря (светлая тема — вместо серого tertiary) */
  backgroundDrinkEntryRow?: string;
  
  // Текст
  text: string;
  textSecondary: string;
  textTertiary: string;
  
  // Границы
  border: string;
  borderLight: string;
  
  // Состояния
  success: string;
  warning: string;
  error: string;
  errorLight: string;
  
  // Типы напитков
  beer: {
    main: string;
    light: string;
    text: string;
  };
  wine: {
    main: string;
    light: string;
    text: string;
  };
  spirit: {
    main: string;
    light: string;
    text: string;
  };
  cocktail: {
    main: string;
    light: string;
    text: string;
  };
  other: {
    main: string;
    light: string;
    text: string;
  };
}

// Темная тема (текущая)
export const darkTheme: ThemeColors = {
  // Основные цвета
  primary: '#6366f1', // Индиго
  primaryLight: '#818cf8', // Светлый индиго
  primaryDark: '#4f46e5', // Темный индиго
  secondary: '#a78bfa', // Фиолетовый
  
  // Фон - темная тема
  background: '#0f172a', // Темно-синий (slate-900)
  backgroundSecondary: '#1e293b', // Светлее (slate-800)
  backgroundTertiary: '#334155', // Еще светлее (slate-700)
  backgroundCard: '#1e293b', // Для карточек
  
  // Текст - светлый на темном
  text: '#f1f5f9', // Почти белый (slate-100)
  textSecondary: '#cbd5e1', // Светло-серый (slate-300)
  textTertiary: '#94a3b8', // Средне-серый (slate-400)
  
  // Границы
  border: '#334155', // Слабая граница (slate-700)
  borderLight: '#475569', // Еще слабее (slate-600)
  
  // Состояния
  success: '#10b981', // Зеленый
  warning: '#f59e0b', // Янтарный
  error: '#ef4444', // Красный
  errorLight: '#7f1d1d', // Темно-красный фон
  
  // Типы напитков - яркие акценты на темном фоне
  beer: {
    main: '#f59e0b', // Янтарный
    light: '#451a03', // Темно-янтарный фон
    text: '#fbbf24', // Светло-янтарный текст
  },
  wine: {
    main: '#a855f7', // Фиолетовый
    light: '#3b0764', // Темно-фиолетовый фон
    text: '#c084fc', // Светло-фиолетовый текст
  },
  spirit: {
    main: '#ef4444', // Красный
    light: '#7f1d1d', // Темно-красный фон
    text: '#fca5a5', // Светло-красный текст
  },
  cocktail: {
    main: '#06b6d4', // Циан
    light: '#083344',
    text: '#67e8f9', // Светло-циановый текст
  },
  other: {
    main: '#64748b', // Серый
    light: '#1e293b', // Темно-серый фон
    text: '#94a3b8', // Светло-серый текст
  },
};

// Светлая тема — iOS-подобная иерархия, но с более глубоким фоном и контрастом (меньше «бледности»)
export const lightTheme: ThemeColors = {
  primary: '#0066DD',
  primaryLight: '#2B8CFF',
  primaryDark: '#004BB3',
  secondary: '#0077ED',
  
  // Фон темнее, чем #F2F2F7: белые карточки читаются заметнее, экран не «выцветший»
  background: '#E2E2EA',
  backgroundSecondary: '#D4D4DF',
  backgroundTertiary: '#C6C6D4',
  // Слегка тёплый «бумажный» белый вместо чистого #FFF — меньше ощущения плоской палитры
  backgroundCard: '#FAFAFC',
  backgroundInput: '#FFFFFF',
  backgroundDrinkEntryRow: '#DCEBFA',
  
  text: '#0C0C0F',
  textSecondary: '#404048',
  textTertiary: '#6B6B76',
  
  border: '#A7A7B2',
  borderLight: '#C8C8D2',
  
  // Состояния
  success: '#10b981', // Зеленый
  warning: '#f59e0b', // Янтарный
  error: '#ef4444', // Красный
  errorLight: '#fee2e2', // Светло-красный фон (red-100)
  
  // Типы напитков - приглушенные на светлом фоне
  beer: {
    main: '#f59e0b', // Янтарный
    light: '#fef3c7', // Светло-янтарный фон (amber-100)
    text: '#d97706', // Темно-янтарный текст (amber-700)
  },
  wine: {
    main: '#a855f7', // Фиолетовый
    light: '#f3e8ff', // Светло-фиолетовый фон (violet-100)
    text: '#7c3aed', // Темно-фиолетовый текст (violet-700)
  },
  spirit: {
    main: '#ef4444', // Красный
    light: '#fee2e2', // Светло-красный фон (red-100)
    text: '#dc2626', // Темно-красный текст (red-700)
  },
  cocktail: {
    main: '#06b6d4', // Циан
    light: '#cffafe', // Светло-циановый фон (cyan-100)
    text: '#0891b2', // Темно-циановый текст (cyan-700)
  },
  other: {
    main: '#64748b', // Серый
    light: '#f1f5f9', // Светло-серый фон (slate-100)
    text: '#475569', // Темно-серый текст (slate-600)
  },
};

// Sepia/Amber (Теплая тема)
export const sepiaTheme: ThemeColors = {
  // Основные цвета - теплые тона
  primary: '#f59e0b', // Янтарный
  primaryLight: '#fbbf24', // Светлый янтарный
  primaryDark: '#d97706', // Темный янтарный
  secondary: '#f97316', // Оранжевый
  
  // Фон - темно-коричневый/янтарный
  background: '#1c1917', // Темно-коричневый (stone-900)
  backgroundSecondary: '#292524', // Светлее (stone-800)
  backgroundTertiary: '#44403c', // Еще светлее (stone-700)
  backgroundCard: '#292524', // Для карточек
  backgroundInput: '#292524',
  
  // Текст - светлый на темном
  text: '#fafaf9', // Почти белый (stone-50)
  textSecondary: '#d6d3d1', // Светло-коричневый (stone-300)
  textTertiary: '#a8a29e', // Средне-коричневый (stone-400)
  
  // Границы
  border: '#44403c', // Слабая граница (stone-700)
  borderLight: '#57534e', // Еще слабее (stone-600)
  
  // Состояния
  success: '#10b981', // Зеленый
  warning: '#f59e0b', // Янтарный
  error: '#ef4444', // Красный
  errorLight: '#7f1d1d', // Темно-красный фон
  
  // Типы напитков - теплые акценты
  beer: {
    main: '#f59e0b', // Янтарный
    light: '#451a03', // Темно-янтарный фон
    text: '#fbbf24', // Светло-янтарный текст
  },
  wine: {
    main: '#f97316', // Оранжевый
    light: '#7c2d12', // Темно-оранжевый фон
    text: '#fb923c', // Светло-оранжевый текст
  },
  spirit: {
    main: '#dc2626', // Красный
    light: '#7f1d1d', // Темно-красный фон
    text: '#fca5a5', // Светло-красный текст
  },
  cocktail: {
    main: '#ea580c', // Оранжево-красный
    light: '#7c2d12', // Темно-оранжевый фон
    text: '#fdba74', // Светло-оранжевый текст
  },
  other: {
    main: '#78716c', // Коричнево-серый
    light: '#292524', // Темно-коричневый фон
    text: '#a8a29e', // Светло-коричневый текст
  },
};

// Нежная розово-бежевая тема
export const highContrastTheme: ThemeColors = {
  primary: '#db2777', // Розовый (pink-600)
  primaryLight: '#ec4899', // Светло-розовый (pink-500)
  primaryDark: '#be185d', // Тёмно-розовый (pink-700)
  secondary: '#e879f9', // Мягкий фуксия (fuchsia-400)
  
  background: '#fce7f3',   // pink-100
  backgroundSecondary: '#fbcfe8', // pink-200
  backgroundTertiary: '#f9a8d4',  // pink-300
  backgroundCard: '#fdf2f8',       // pink-50, без чистого белого
  backgroundInput: '#ffffff',
  
  text: '#4c0519', // Тёмно-розово-коричневый (rose-950)
  textSecondary: '#831843', // Розово-серый (rose-800)
  textTertiary: '#9d174d', // Серый акцент (rose-700)
  
  border: '#fbcfe8', // Розовая граница (pink-200)
  borderLight: '#fce7f3', // Светлее (pink-100)
  
  success: '#059669',
  warning: '#d97706',
  error: '#dc2626',
  errorLight: '#ffe4e6', // Светло-розовый фон (rose-100)
  
  beer: {
    main: '#b45309',
    light: '#fef3c7',
    text: '#78350f',
  },
  wine: {
    main: '#a855f7',
    light: '#f5d0fe', // Светло-фуксия (fuchsia-100)
    text: '#701a75',
  },
  spirit: {
    main: '#be123c',
    light: '#ffe4e6', // Мягкий красный фон (rose-100)
    text: '#9f1239',
  },
  cocktail: {
    main: '#0d9488',
    light: '#ccfbf1',
    text: '#115e59',
  },
  other: {
    main: '#9d174d', // Розово-серый (rose-700)
    light: '#fce7f3',
    text: '#831843',
  },
};

// Лавандовая — мягкий violet/mauve фон + приглушённый фиолетовый акцент
export const violetTheme: ThemeColors = {
  primary: '#6d28d9',
  primaryLight: '#7c3aed',
  primaryDark: '#5b21b6',
  secondary: '#8b5cf6',
  background: '#ede9fe',   // violet-100
  backgroundSecondary: '#ddd6fe',   // violet-200
  backgroundTertiary: '#c4b5fd',   // violet-300
  backgroundCard: '#f5f3ff',       // violet-50, без чистого белого
  backgroundInput: '#ffffff',
  text: '#0f172a',       // slate-900, нейтральный для читаемости
  textSecondary: '#475569',
  textTertiary: '#64748b',
  border: '#ddd6fe',
  borderLight: '#ede9fe',
  success: '#059669',
  warning: '#d97706',
  error: '#dc2626',
  errorLight: '#f5f3ff',
  beer: { main: '#b45309', light: '#fef3c7', text: '#78350f' },
  wine: { main: '#6d28d9', light: '#ede9fe', text: '#5b21b6' },
  spirit: { main: '#b91c1c', light: '#fee2e2', text: '#991b1b' },
  cocktail: { main: '#0d9488', light: '#ccfbf1', text: '#115e59' },
  other: { main: '#64748b', light: '#e2e8f0', text: '#475569' },
};

// Песочная — тёплый нейтрал (оставляем, но можно заменить на Северную в UI)
export const sandTheme: ThemeColors = {
  primary: '#b45309',
  primaryLight: '#d97706',
  primaryDark: '#92400e',
  secondary: '#d97706',
  background: '#f5f5f4',
  backgroundSecondary: '#e7e5e4',
  backgroundTertiary: '#d6d3d1',
  backgroundCard: '#fafaf9',
  backgroundInput: '#ffffff',
  text: '#171717',
  textSecondary: '#525252',
  textTertiary: '#737373',
  border: '#e7e5e4',
  borderLight: '#d6d3d1',
  success: '#059669',
  warning: '#d97706',
  error: '#dc2626',
  errorLight: '#f5f5f4',
  beer: { main: '#b45309', light: '#fef3c7', text: '#78350f' },
  wine: { main: '#7e22ce', light: '#f3e8ff', text: '#581c87' },
  spirit: { main: '#b91c1c', light: '#fee2e2', text: '#991b1b' },
  cocktail: { main: '#0d9488', light: '#ccfbf1', text: '#115e59' },
  other: { main: '#64748b', light: '#e7e5e4', text: '#525252' },
};

// Северная (Nord) — холодная арктическая палитра, Frost-акценты (как в Nord Theme / IDE)
export const nordTheme: ThemeColors = {
  primary: '#5e81ac',   // nord10
  primaryLight: '#81a1c1', // nord9
  primaryDark: '#4c566a',  // nord3
  secondary: '#88c0d0',   // nord8
  background: '#d8dee9',   // nord4
  backgroundSecondary: '#e5e9f0',   // nord5
  backgroundTertiary: '#eceff4',    // nord6
  backgroundCard: '#e5e9f0',
  backgroundInput: '#ffffff',
  text: '#2e3440',       // nord0
  textSecondary: '#3b4252', // nord1
  textTertiary: '#4c566a',  // nord3
  border: '#d8dee9',
  borderLight: '#e5e9f0',
  success: '#a3be8c',    // nord14
  warning: '#ebcb8b',    // nord13
  error: '#bf616a',      // nord11
  errorLight: '#eceff4',
  // More nuanced beverage shades for Nord theme
  beer: { main: '#d08770', light: '#f0e5df', text: '#8f4e3a' },      // warm copper
  wine: { main: '#b48ead', light: '#eee5f0', text: '#7a5a8f' },      // muted plum
  spirit: { main: '#bf616a', light: '#f2e2e4', text: '#8e4651' },    // deep rose
  cocktail: { main: '#8fbcbb', light: '#e2eeed', text: '#4f7f7e' },  // arctic teal
  other: { main: '#5e81ac', light: '#dbe4ef', text: '#3f5673' },     // cold blue-gray
};

// Зелёный — тёмная тема в духе IntelliJ IDEA: серые тона, зелёный акцент
export const darculaTheme: ThemeColors = {
  primary: '#6a9955',   // IDEA green
  primaryLight: '#7cb342',
  primaryDark: '#588238',
  secondary: '#78909c',
  background: '#2b2b2b',
  backgroundSecondary: '#3c3f41',
  backgroundTertiary: '#45494a',
  backgroundCard: '#3c3f41',
  backgroundInput: '#3c3f41',
  text: '#bbbbbb',
  textSecondary: '#999999',
  textTertiary: '#808080',
  border: '#45494a',
  borderLight: '#555555',
  success: '#6a9955',
  warning: '#d7ba7d',
  error: '#bc3f39',
  errorLight: '#4a3728',
  beer: { main: '#d7ba7d', light: '#3c3f41', text: '#d7ba7d' },
  wine: { main: '#9876aa', light: '#3c3f41', text: '#c678dd' },
  spirit: { main: '#bc3f39', light: '#3c3f41', text: '#e06c75' },
  cocktail: { main: '#56b6c2', light: '#3c3f41', text: '#56b6c2' },
  other: { main: '#808080', light: '#3c3f41', text: '#999999' },
};

// Экспорт всех тем
export const themes: Record<ThemeName, ThemeColors> = {
  dark: darkTheme,
  light: lightTheme,
  sepia: sepiaTheme,
  highContrast: highContrastTheme,
  violet: violetTheme,
  sand: sandTheme,
  nord: nordTheme,
  darcula: darculaTheme,
};

// Получить тему по имени
export function getTheme(themeName: ThemeName): ThemeColors {
  return themes[themeName];
}

const LIGHT_UI_THEME_NAMES = new Set<ThemeName>(['light', 'highContrast', 'violet', 'sand', 'nord']);

/** Светлые темы: у кнопок «+» вторичный фон даёт лишний круг/ореол — его убираем через прозрачный фон и без рамки */
export function isLightUiTheme(themeName: ThemeName): boolean {
  return LIGHT_UI_THEME_NAMES.has(themeName);
}

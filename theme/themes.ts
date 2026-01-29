// Цветовые темы приложения
export type ThemeName = 'dark' | 'light' | 'sepia' | 'highContrast';

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

// Светлая тема
export const lightTheme: ThemeColors = {
  // Основные цвета - синий вместо индиго
  primary: '#3b82f6', // Синий (blue-500)
  primaryLight: '#60a5fa', // Светлый синий (blue-400)
  primaryDark: '#2563eb', // Темный синий (blue-600)
  secondary: '#818cf8', // Светло-фиолетовый
  
  // Фон - светлая тема
  background: '#ffffff', // Белый
  backgroundSecondary: '#f8fafc', // Светло-серый (slate-50)
  backgroundTertiary: '#f1f5f9', // Светлее (slate-100)
  backgroundCard: '#ffffff', // Белые карточки
  
  // Текст - темный на светлом
  text: '#0f172a', // Темно-синий (slate-900)
  textSecondary: '#475569', // Средне-серый (slate-600)
  textTertiary: '#64748b', // Светло-серый (slate-500)
  
  // Границы
  border: '#e2e8f0', // Светло-серая граница (slate-200)
  borderLight: '#cbd5e1', // Еще светлее (slate-300)
  
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

// Серо-синяя профессиональная тема (Professional Blue-Gray) — больше серого
export const highContrastTheme: ThemeColors = {
  // Основные цвета - профессиональные серо-синие оттенки
  primary: '#475569', // Серо-синий (slate-600)
  primaryLight: '#64748b', // Светлый серо-синий (slate-500)
  primaryDark: '#334155', // Темный серо-синий (slate-700)
  secondary: '#3b82f6', // Профессиональный синий (blue-500)
  
  // Фон — более выраженные серые тона
  background: '#e2e8f0', // Серо-синий (slate-200)
  backgroundSecondary: '#cbd5e1', // Серо-синий (slate-300)
  backgroundTertiary: '#94a3b8', // Серо-синий (slate-400)
  backgroundCard: '#ffffff', // Белые карточки
  
  // Текст - темный на светлом
  text: '#0f172a', // Темно-серо-синий (slate-900)
  textSecondary: '#475569', // Средне-серо-синий (slate-600)
  textTertiary: '#64748b', // Светло-серо-синий (slate-500)
  
  // Границы - более серые
  border: '#94a3b8', // Серо-синяя граница (slate-400)
  borderLight: '#cbd5e1', // Светлее (slate-300)
  
  // Состояния - профессиональные
  success: '#059669', // Профессиональный зеленый (emerald-600)
  warning: '#d97706', // Профессиональный янтарный (amber-600)
  error: '#dc2626', // Профессиональный красный (red-600)
  errorLight: '#fee2e2', // Светло-красный фон (red-100)
  
  // Типы напитков — приглушённые оттенки в стиле календаря (зелёный, персиковый, мягкий красный)
  beer: {
    main: '#b45309', // Приглушённый янтарный (как дни календаря)
    light: '#fef3c7', // Светло-янтарный фон (amber-100)
    text: '#78350f', // Тёмно-янтарный текст (amber-900)
  },
  wine: {
    main: '#7e22ce', // Приглушённый фиолетовый
    light: '#f3e8ff', // Светло-фиолетовый фон (violet-100)
    text: '#581c87', // Тёмно-фиолетовый текст (violet-900)
  },
  spirit: {
    main: '#b91c1c', // Приглушённый красный (как верх шкалы календаря)
    light: '#fee2e2', // Светло-красный фон (red-100)
    text: '#991b1b', // Тёмно-красный текст (red-800)
  },
  cocktail: {
    main: '#15803d', // Приглушённый зелёный (как низ шкалы календаря)
    light: '#dcfce7', // Светло-зелёный фон (green-100)
    text: '#166534', // Тёмно-зелёный текст (green-800)
  },
  other: {
    main: '#64748b', // Серо-синий (slate-500)
    light: '#e2e8f0', // Серо-синий фон (slate-200)
    text: '#475569', // Средне-серо-синий текст (slate-600)
  },
};

// Экспорт всех тем
export const themes: Record<ThemeName, ThemeColors> = {
  dark: darkTheme,
  light: lightTheme,
  sepia: sepiaTheme,
  highContrast: highContrastTheme,
};

// Получить тему по имени
export function getTheme(themeName: ThemeName): ThemeColors {
  return themes[themeName];
}

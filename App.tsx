import 'react-native-gesture-handler';
import React from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { View, StyleSheet, Platform } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { MaterialIcons } from '@expo/vector-icons';
import TodayScreen from './screens/TodayScreen';
import CalendarScreen from './screens/CalendarScreen';
import StatsScreen from './screens/StatsScreen';
import SettingsScreen from './screens/SettingsScreen';
import PremiumScreen from './screens/PremiumScreen';
import { ThemeProvider, useTheme } from './theme/ThemeContext';
import { generateTestDrinks, generateTestPresets } from './utils/testData';
import { getAllDrinks, setAllDrinks } from './storage/drinks';
import { getUserPresets, setUserPresets } from './storage/presets';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

// Оптимизированные функции иконок вынесены наружу, чтобы не пересоздавались при каждом рендере
const TodayIcon = ({ color, size }: { color: string; size: number }) => (
  <Ionicons name="today" size={size} color={color} />
);

const CalendarIcon = ({ color, size }: { color: string; size: number }) => (
  <MaterialIcons name="calendar-month" size={size} color={color} />
);

const StatsIcon = ({ color, size }: { color: string; size: number }) => (
  <Ionicons name="stats-chart" size={size} color={color} />
);

const SettingsIcon = ({ color, size }: { color: string; size: number }) => (
  <Ionicons name="settings" size={size} color={color} />
);

function AppContent() {
  const insets = useSafeAreaInsets();
  const { colors, themeName } = useTheme();
  
  // Определяем iOS в веб-версии (PWA)
  const isIOS = Platform.OS === 'ios' || 
                (Platform.OS === 'web' && typeof window !== 'undefined' && 
                 (/iPad|iPhone|iPod/.test(navigator.userAgent) || 
                  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)));
  
  // Определяем стиль статус-бара в зависимости от темы
  const statusBarStyle = themeName === 'light' ? 'dark' : 'light';
  
  // TODO: Удалить перед релизом - загрузка тестовых данных
  // Установите FORCE_LOAD_TEST_DATA = true для принудительной загрузки
  const FORCE_LOAD_TEST_DATA = true; // Изменить на false перед релизом
  
  React.useEffect(() => {
    const loadTestData = async () => {
      try {
        const existingDrinks = await getAllDrinks();
        const existingPresets = await getUserPresets();
        
        console.log(`📊 Существующие записи: ${existingDrinks.length}, пресеты: ${existingPresets.length}`);
        
        // Загружаем тестовые данные если их нет или если включена принудительная загрузка
        if (existingDrinks.length === 0 || FORCE_LOAD_TEST_DATA) {
          const testDrinks = generateTestDrinks();
          console.log(`🔄 Генерирую ${testDrinks.length} тестовых записей...`);
          await setAllDrinks(testDrinks);
          console.log(`✅ Загружено ${testDrinks.length} тестовых записей о напитках`);
          
          // Проверяем, что данные сохранились
          const verify = await getAllDrinks();
          console.log(`✓ Проверка: сохранено ${verify.length} записей`);
        } else {
          console.log(`⏭️ Пропускаю загрузку тестовых данных (уже есть ${existingDrinks.length} записей)`);
        }
        
        if (existingPresets.length === 0 || FORCE_LOAD_TEST_DATA) {
          const testPresets = generateTestPresets();
          await setUserPresets(testPresets);
          console.log(`✅ Загружено ${testPresets.length} тестовых пресетов`);
        }
      } catch (error) {
        console.error('❌ Ошибка загрузки тестовых данных:', error);
      }
    };
    
    loadTestData();
  }, []);
  
  return (
    <NavigationContainer>
        <StatusBar style={statusBarStyle} />
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="MainTabs">
            {() => (
        <Tab.Navigator
          screenOptions={{
            headerShown: true,
            headerStyle: {
              backgroundColor: colors.background,
            },
            headerTintColor: colors.text,
            headerTitleStyle: {
              fontWeight: '700',
              fontSize: 20,
            },
            tabBarStyle: {
              backgroundColor: colors.background,
              borderTopColor: colors.border,
              borderTopWidth: 1,
              paddingBottom: isIOS ? Math.max(8, insets.bottom) : 8, // Минимальный отступ от Home индикатора
              paddingTop: 8, // Padding сверху
              height: isIOS ? 60 + Math.max(8, insets.bottom) : 70, // Фиксированная высота с учетом padding
              minHeight: isIOS ? 60 + Math.max(8, insets.bottom) : 70, // Минимальная высота
              elevation: 8, // Тень для Android (фиксирует поверх контента)
              shadowColor: '#000', // Тень для iOS
              shadowOffset: { width: 0, height: -2 },
              shadowOpacity: 0.25,
              shadowRadius: 3.84,
            },
            tabBarActiveTintColor: colors.primary,
            tabBarInactiveTintColor: themeName === 'light' ? colors.textSecondary : colors.textTertiary,
            tabBarLabelStyle: {
              fontWeight: '600',
              fontSize: 10, // Уменьшаем размер шрифта подписей
              marginTop: 4, // Небольшой отступ сверху для подписей
            },
          }}
        >
          <Tab.Screen 
            name="Сегодня" 
            component={TodayScreen}
            options={{
              headerShown: false,
              tabBarIcon: TodayIcon,
            }}
          />
          <Tab.Screen 
            name="Календарь" 
            component={CalendarScreen} 
            options={{ 
              headerShown: false,
              tabBarIcon: CalendarIcon,
            }} 
          />
          <Tab.Screen 
            name="Статистика" 
            component={StatsScreen}
            options={{
              tabBarIcon: StatsIcon,
            }}
          />
          <Tab.Screen 
            name="Настройки" 
            component={SettingsScreen}
            options={{
              tabBarIcon: SettingsIcon,
            }}
          />
        </Tab.Navigator>
            )}
          </Stack.Screen>
          <Stack.Screen 
            name="Premium" 
            component={PremiumScreen}
            options={{
              presentation: 'card',
              headerShown: false,
            }}
          />
        </Stack.Navigator>
      </NavigationContainer>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <AppContent />
        </GestureHandlerRootView>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

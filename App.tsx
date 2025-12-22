import 'react-native-gesture-handler';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StatusBar } from 'expo-status-bar';
import { View, StyleSheet, Platform } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { MaterialIcons } from '@expo/vector-icons';
import TodayScreen from './screens/TodayScreen';
import CalendarScreen from './screens/CalendarScreen';
import StatsScreen from './screens/StatsScreen';
import SettingsScreen from './screens/SettingsScreen';
import { colors } from './theme/colors';

const Tab = createBottomTabNavigator();

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
  
  // Определяем iOS в веб-версии (PWA)
  const isIOS = Platform.OS === 'ios' || 
                (Platform.OS === 'web' && typeof window !== 'undefined' && 
                 (/iPad|iPhone|iPod/.test(navigator.userAgent) || 
                  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)));
  
  return (
    <NavigationContainer>
        <StatusBar style="light" />
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
              height: isIOS ? undefined : 70, // Автоматическая высота для iOS с учетом padding
              minHeight: isIOS ? 60 : 70, // Минимальная высота
            },
            tabBarActiveTintColor: colors.primaryLight || colors.primary,
            tabBarInactiveTintColor: colors.textTertiary,
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
      </NavigationContainer>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <AppContent />
      </GestureHandlerRootView>
    </SafeAreaProvider>
  );
}

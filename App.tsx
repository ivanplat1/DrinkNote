import 'react-native-gesture-handler';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StatusBar } from 'expo-status-bar';
import { View, StyleSheet } from 'react-native';
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

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
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
            },
            tabBarActiveTintColor: colors.primaryLight || colors.primary,
            tabBarInactiveTintColor: colors.textTertiary,
            tabBarLabelStyle: {
              fontWeight: '600',
              fontSize: 12,
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
    </GestureHandlerRootView>
  );
}

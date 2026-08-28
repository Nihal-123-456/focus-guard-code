import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useTheme } from 'react-native-paper';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

import { HomeScreen } from '../screens/HomeScreen';
import { AppListScreen } from '../screens/AppListScreen';
import { TimerSetupScreen } from '../screens/TimerSetupScreen';
import { ActiveTimerScreen } from '../screens/ActiveTimerScreen';
import { StatsScreen } from '../screens/StatsScreen';
import { HistoryScreen } from '../screens/HistoryScreen';
import { SchedulesScreen } from '../screens/SchedulesScreen';
import { ScheduleEditorScreen } from '../screens/ScheduleEditorScreen';
import { SettingsScreen } from '../screens/SettingsScreen';

export type HomeStackParamList = {
  Home: undefined;
  TimerSetup: undefined;
  ActiveTimer: undefined;
};

export type StatsStackParamList = {
  Stats: undefined;
  History: undefined;
};

export type SchedulesStackParamList = {
  Schedules: undefined;
  ScheduleEditor: { scheduleId?: string };
};

const HomeStack = createNativeStackNavigator<HomeStackParamList>();
const StatsStack = createNativeStackNavigator<StatsStackParamList>();
const SchedulesStack = createNativeStackNavigator<SchedulesStackParamList>();
const Tab = createBottomTabNavigator();

function HomeStackScreen() {
  return (
    <HomeStack.Navigator screenOptions={{ headerShown: false }}>
      <HomeStack.Screen name="Home" component={HomeScreen} />
      <HomeStack.Screen name="TimerSetup" component={TimerSetupScreen} />
      <HomeStack.Screen
        name="ActiveTimer"
        component={ActiveTimerScreen}
        options={{ gestureEnabled: false }}
      />
    </HomeStack.Navigator>
  );
}

function StatsStackScreen() {
  return (
    <StatsStack.Navigator screenOptions={{ headerShown: false }}>
      <StatsStack.Screen name="Stats" component={StatsScreen} />
      <StatsStack.Screen name="History" component={HistoryScreen} />
    </StatsStack.Navigator>
  );
}

function SchedulesStackScreen() {
  return (
    <SchedulesStack.Navigator screenOptions={{ headerShown: false }}>
      <SchedulesStack.Screen name="Schedules" component={SchedulesScreen} />
      <SchedulesStack.Screen name="ScheduleEditor" component={ScheduleEditorScreen} />
    </SchedulesStack.Navigator>
  );
}

export function AppNavigator() {
  const theme = useTheme();

  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <Tab.Navigator
          screenOptions={{
            headerShown: false,
            tabBarActiveTintColor: theme.colors.primary,
            tabBarInactiveTintColor: theme.colors.onSurfaceVariant,
            tabBarStyle: {
              backgroundColor: theme.colors.surface,
              borderTopColor: theme.colors.outlineVariant,
              height: 72,
              paddingBottom: 8,
              paddingTop: 8,
            },
            tabBarLabelStyle: {
              fontSize: 12,
              fontWeight: '500',
            },
          }}
        >
          <Tab.Screen
            name="HomeTab"
            component={HomeStackScreen}
            options={{
              tabBarLabel: 'Home',
              tabBarIcon: ({ color, size }) => (
                <MaterialCommunityIcons name="home-variant-outline" color={color} size={size} />
              ),
            }}
          />
          <Tab.Screen
            name="Apps"
            component={AppListScreen}
            options={{
              tabBarLabel: 'Apps',
              tabBarIcon: ({ color, size }) => (
                <MaterialCommunityIcons name="apps" color={color} size={size} />
              ),
            }}
          />
          <Tab.Screen
            name="SchedulesTab"
            component={SchedulesStackScreen}
            options={{
              tabBarLabel: 'Schedules',
              tabBarIcon: ({ color, size }) => (
                <MaterialCommunityIcons name="calendar-clock-outline" color={color} size={size} />
              ),
            }}
          />
          <Tab.Screen
            name="StatsTab"
            component={StatsStackScreen}
            options={{
              tabBarLabel: 'Stats',
              tabBarIcon: ({ color, size }) => (
                <MaterialCommunityIcons name="chart-line" color={color} size={size} />
              ),
            }}
          />
          <Tab.Screen
            name="Settings"
            component={SettingsScreen}
            options={{
              tabBarLabel: 'Settings',
              tabBarIcon: ({ color, size }) => (
                <MaterialCommunityIcons name="cog-outline" color={color} size={size} />
              ),
            }}
          />
        </Tab.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}

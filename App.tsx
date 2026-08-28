import { useEffect } from 'react';
import { StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { PaperProvider } from 'react-native-paper';
import { AppNavigator } from './src/navigation/AppNavigator';
import { materialTheme } from './src/theme';
import { initScheduler, teardownScheduler } from './src/services/scheduler';
import { useSettingsStore } from './src/data/settingsStore';
import { useScheduleStore } from './src/data/scheduleStore';
import { useBlacklistStore } from './src/data/blacklistStore';
import { useTimerStore } from './src/data/timerStore';

export default function App() {
  useEffect(() => {
    // Hydrate core stores on app launch.
    Promise.all([
      useSettingsStore.getState().hydrate(),
      useScheduleStore.getState().hydrate(),
      useBlacklistStore.getState().hydrate(),
      useTimerStore.getState().hydrate(),
    ]).then(() => {
      // Start the scheduler service — auto-fires any scheduled sessions.
      initScheduler();
    });

    return () => {
      teardownScheduler();
    };
  }, []);

  return (
    <SafeAreaProvider>
      <PaperProvider theme={materialTheme}>
        <StatusBar
          barStyle="dark-content"
          backgroundColor={materialTheme.colors.surface}
          translucent={false}
        />
        <AppNavigator />
      </PaperProvider>
    </SafeAreaProvider>
  );
}

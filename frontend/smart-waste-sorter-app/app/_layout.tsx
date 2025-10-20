import { PaperProvider } from 'react-native-paper';
import { Slot } from 'expo-router';

/**
 * This is the root layout for the entire application.
 * We wrap the app in PaperProvider to ensure a consistent theme
 * is available to all components.
 */
export default function RootLayout() {
  return (
    <PaperProvider>
      <Slot />
    </PaperProvider>
  );
}
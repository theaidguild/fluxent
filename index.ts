import './src/polyfills';

import { registerRootComponent } from 'expo';
import * as SplashScreen from 'expo-splash-screen';

import App from './App';

// Keep splash screen visible while app initializes
SplashScreen.preventAutoHideAsync();

// Configure splash screen animation
SplashScreen.setOptions({
  duration: 1000,
  fade: true,
});

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);

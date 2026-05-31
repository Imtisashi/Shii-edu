import { registerRootComponent } from 'expo';
import App from './App'; // This explicitly points to your App.js

// This forces Expo to boot up your App.js manually
registerRootComponent(App);
import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.pieos.academy',
  appName: 'pie Academy',
  server: {
    url: 'https://edtech-dashboard-alpha.vercel.app',
    cleartext: false,
  },
  webDir: 'dist',
  android: {
    allowMixedContent: false,
    captureInput: true,
    webContentsDebuggingEnabled: false,
  },
  plugins: {
    SplashScreen: {
      // Don't auto-hide — we call SplashScreen.hide() manually from React
      // once the app is fully loaded
      launchShowDuration: 0,
      launchAutoHide: false,
      // Show splash on app resume too (coming back from background)
      showOnLaunch: true,
      backgroundColor: '#0f0f1a',
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
    },
    StatusBar: {
      style: 'dark',
      backgroundColor: '#0f0f1a',
    },
    Keyboard: {
      resize: 'body',
      style: 'dark',
      resizeOnFullScreen: true,
    },
  },
};

export default config;

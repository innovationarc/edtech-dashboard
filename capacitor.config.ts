import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.pieos.academy',
  appName: 'pie Academy',
  // Points to your live Vercel deployment
  // Secrets never leave the server — APK is just a native shell
  server: {
    url: 'https://edtech-dashboard-alpha.vercel.app',
    cleartext: false, // HTTPS only
  },
  webDir: 'dist', // fallback for local builds
  android: {
    allowMixedContent: false,
    captureInput: true,
    webContentsDebuggingEnabled: false, // set true only during dev
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      backgroundColor: '#0f0f1a',
      androidSplashResourceName: 'splash',
      showSpinner: false,
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

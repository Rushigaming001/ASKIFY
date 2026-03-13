import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'fun.minequest.askify',
  appName: 'Askify',
  webDir: 'dist',
  server: {
    url: 'https://minequest.fun',
    cleartext: true
  },
  android: {
    allowMixedContent: true,
    captureInput: true,
    webContentsDebuggingEnabled: false,
    minWebViewVersion: '55.0.2883.91',
    appendUserAgent: 'Askify-Android'
  },
  ios: {
    contentInset: 'automatic',
    allowsLinkPreview: true
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#0f172a',
      showSpinner: false,
      androidSplashResourceName: 'splash',
      splashFullScreen: true,
      splashImmersive: true
    }
  }
};

export default config;

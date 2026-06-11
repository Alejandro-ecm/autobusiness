import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.skytechnologies.autobusiness',
  appName: 'AutoBusiness',
  webDir: 'dist',
  android: {
    buildOptions: {
      releaseType: 'AAB',
    },
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1500,
      backgroundColor: '#0f172a',
      showSpinner: false,
    },
  },
}

export default config

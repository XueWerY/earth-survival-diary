import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.earthsurvivaldiary.app',
  appName: 'Earth-Survival-Diary',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  }
}

export default config
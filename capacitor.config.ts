import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.earthsurvivaldiary.app',
  appName: '地球 Online 生存日记',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  }
}

export default config
/**
 * Capacitor HTTP Server plugin bridge (Android only)
 */
import { registerPlugin } from '@capacitor/core'

export interface HttpServerPlugin {
  startServer(options: { data: string; port: number }): Promise<{ ip: string; port: number }>
  stopServer(): Promise<void>
}

const HttpServer = registerPlugin<HttpServerPlugin>('HttpServer')

export default HttpServer
import { webview } from '@kit.ArkWeb';
import { FileBridge } from '../utils/FileBridge';

/**
 * 主页面：Web 组件加载 Vue 前端应用
 * 通过 javaScriptProxy 注入 harmonyAPI 供前端调用原生文件操作
 *
 * 前端 JS 由 harmony-sync.cjs 打包为 IIFE 格式（非 ES module），
 * 避免 ArkWeb 对 resource:// 协议的跨域限制。
 */
@Entry
@Component
struct Index {
  controller: webview.WebviewController = new webview.WebviewController();
  private bridge: FileBridge | null = null;

  aboutToAppear() {
    const filesDir = AppStorage.get<string>('filesDir') || ''
    if (filesDir) {
      this.bridge = new FileBridge(filesDir + '/data')
    }
  }

  build() {
    Column() {
      if (this.bridge) {
        Web({ src: $rawfile('web/index.html'), controller: this.controller })
          .javaScriptAccess(true)
          .domStorageAccess(true)
          .javaScriptProxy({
            object: this.bridge,
            name: 'harmonyAPI',
            methodList: ['readFile', 'writeFile', 'deleteFile', 'stat', 'mkdir', 'readdir', 'rmdir'],
            controller: this.controller
          })
          .onConsole((event) => {
            console.log('Web Console: ' + event.message.getMessage())
            return false
          })
          .onErrorReceive((event) => {
            console.log('Web Error: ' + event.error.getErrorInfo() + ' URL: ' + event.request.getRequestUrl())
          })
          .width('100%')
          .height('100%')
      }
    }
    .width('100%')
    .height('100%')
    .expandSafeArea([SafeAreaType.SYSTEM], [SafeAreaEdge.TOP, SafeAreaEdge.BOTTOM])
  }
}

import { webview } from '@kit.ArkWeb';
import { FileBridge } from '../utils/FileBridge';

/**
 * 主页面：Web 组件加载 Vue 前端应用
 * 通过 javaScriptProxy 注入 harmonyAPI 供前端调用原生文件操作
 *
 * 使用 HTTPS 自定义域名 + onInterceptRequest 方案解决 ArkWeb 对 resource:// 协议的跨域限制
 * 参考：https://developer.huawei.com/consumer/cn/doc/harmonyos-guides/web-cross-origin
 */
const FAKE_HOST = 'www.example.com'
const FAKE_ORIGIN = `https://${FAKE_HOST}`

@Entry
@Component
struct Index {
  controller: webview.WebviewController = new webview.WebviewController();
  private bridge: FileBridge | null = null;
  private mimeMap: Map<string, string> = new Map([
    ['.html', 'text/html'],
    ['.js', 'application/javascript'],
    ['.mjs', 'application/javascript'],
    ['.css', 'text/css'],
    ['.json', 'application/json'],
    ['.png', 'image/png'],
    ['.jpg', 'image/jpeg'],
    ['.jpeg', 'image/jpeg'],
    ['.svg', 'image/svg+xml'],
    ['.ico', 'image/x-icon'],
    ['.woff', 'font/woff'],
    ['.woff2', 'font/woff2'],
    ['.ttf', 'font/ttf'],
  ]);

  aboutToAppear() {
    const filesDir = AppStorage.get<string>('filesDir') || ''
    if (filesDir) {
      this.bridge = new FileBridge(filesDir + '/data')
    }
  }

  private getMimeType(path: string): string {
    const ext = path.substring(path.lastIndexOf('.')).toLowerCase();
    return this.mimeMap.get(ext) || 'application/octet-stream';
  }

  private isTextFile(path: string): boolean {
    const ext = path.substring(path.lastIndexOf('.')).toLowerCase();
    const textExts = ['.html', '.js', '.mjs', '.css', '.json', '.svg'];
    return textExts.includes(ext);
  }

  build() {
    Column() {
      if (this.bridge) {
        Web({ src: `${FAKE_ORIGIN}/web/index.html`, controller: this.controller })
          .javaScriptAccess(true)
          .domStorageAccess(true)
          .fileAccess(true)
          .onInterceptRequest((event) => {
            if (!event) return;
            const url = event.request.getRequestUrl();
            if (!url.startsWith(FAKE_ORIGIN)) return;

            // 提取 rawfile 相对路径：https://www.example.com/web/assets/index.js -> web/assets/index.js
            const rawfilePath = url.substring(FAKE_ORIGIN.length + 1);

            try {
              let response = new WebResourceResponse();
              response.setResponseData($rawfile(rawfilePath));
              if (this.isTextFile(rawfilePath)) {
                response.setResponseEncoding('utf-8');
              }
              response.setResponseMimeType(this.getMimeType(rawfilePath));
              response.setResponseCode(200);
              response.setReasonMessage('OK');
              response.setResponseIsReady(true);
              return response;
            } catch (e) {
              console.log('Intercept error: ' + e);
              return;
            }
          })
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

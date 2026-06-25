import { webview } from '@kit.ArkWeb';
import { FileBridge } from '../utils/FileBridge';

/**
 * 主页面：Web 组件加载 Vue 前端应用
 * 通过 javaScriptProxy 注入 harmonyAPI 供前端调用原生文件操作
 */
@Entry
@Component
struct Index {
  controller: webview.WebviewController = new webview.WebviewController();
  private bridge: FileBridge | null = null;

  aboutToAppear() {
    const context = getContext(this);
    this.bridge = new FileBridge(context.filesDir + '/data');
  }

  build() {
    Column() {
      if (this.bridge) {
        Web({ src: 'resource://rawfile/web/index.html', controller: this.controller })
          .javaScriptAccess(true)
          .domStorageAccess(true)
          .fileAccess(true)
          .javaScriptProxy({
            object: this.bridge,
            name: 'harmonyAPI',
            methodList: ['readFile', 'writeFile', 'deleteFile', 'stat', 'mkdir', 'readdir', 'rmdir'],
            controller: this.controller
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

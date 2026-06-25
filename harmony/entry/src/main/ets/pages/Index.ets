import { webview } from '@kit.ArkWeb';
import { FileBridge } from '../utils/FileBridge';

/**
 * 主页面：Web 组件加载 Vue 前端应用
 * 通过 registerJavaScriptProxy 注入 harmonyAPI 供前端调用原生文件操作
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
      Web({ src: 'resource://rawfile/web/index.html', controller: this.controller })
        .javaScriptAccess(true)
        .domStorageAccess(true)
        .fileAccess(true)
        .onControllerAttached(() => {
          if (this.bridge) {
            this.controller.registerJavaScriptProxy(
              this.bridge,
              'harmonyAPI',
              ['readFile', 'writeFile', 'deleteFile', 'stat', 'mkdir', 'readdir', 'rmdir']
            );
          }
        })
        .width('100%')
        .height('100%')
    }
    .width('100%')
    .height('100%')
    .expandSafeArea([SafeAreaType.SYSTEM], [SafeAreaEdge.TOP, SafeAreaEdge.BOTTOM, SafeAreaEdge.LEFT, SafeAreaEdge.RIGHT])
  }
}

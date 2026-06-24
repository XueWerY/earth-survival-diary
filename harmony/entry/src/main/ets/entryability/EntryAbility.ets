import { UIAbility, AbilityConstant, Want } from '@kit.AbilityKit';
import { window } from '@kit.ArkUI';
import hilog from '@ohos.hilog';

const DOMAIN = 0x0000;
const TAG = 'EntryAbility';

export default class EntryAbility extends UIAbility {
  onCreate(want: Want, launchParam: AbilityConstant.LaunchParam) {
    hilog.info(DOMAIN, TAG, 'onCreate');
  }

  onDestroy() {
    hilog.info(DOMAIN, TAG, 'onDestroy');
  }

  async onWindowStageCreate(windowStage: window.WindowStage) {
    hilog.info(DOMAIN, TAG, 'onWindowStageCreate');

    // 设置全屏布局（edge-to-edge），让应用延伸至状态栏和导航栏区域
    const mainWindow = await windowStage.getMainWindow();
    await mainWindow.setWindowLayoutFullScreen(true);

    windowStage.loadContent('pages/Index', (err) => {
      if (err.code) {
        hilog.error(DOMAIN, TAG, 'Failed to load content: %{public}s', JSON.stringify(err));
        return;
      }
      hilog.info(DOMAIN, TAG, 'Content loaded successfully');
    });
  }

  onWindowStageDestroy() {
    hilog.info(DOMAIN, TAG, 'onWindowStageDestroy');
  }

  onForeground() {
    hilog.info(DOMAIN, TAG, 'onForeground');
  }

  onBackground() {
    hilog.info(DOMAIN, TAG, 'onBackground');
  }
}

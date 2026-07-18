const fs = require('fs')
const path = require('path')

/**
 * Electron 在 Linux 上需要禁用沙箱才能从 GUI 正常启动。
 * 通过环境变量和命令行参数在原生初始化前生效。
 *
 * - AppImage：包装 AppRun 入口脚本
 * - deb/tar.gz：包装 Electron 二进制文件
 */
module.exports = async function (context) {
  if (context.packager.platform.name !== 'linux') return

  const appOutDir = context.appOutDir
  const productName = context.packager.appInfo.productName
  const appRunPath = path.join(appOutDir, 'AppRun')

  if (fs.existsSync(appRunPath)) {
    // AppImage - 包装 AppRun
    wrapAppRun(appRunPath)
  } else {
    // deb/tar.gz - 包装二进制
    const binPath = path.join(appOutDir, productName)
    wrapBinary(binPath, productName)
  }
}

function wrapAppRun(runPath) {
  const dir = path.dirname(runPath)
  const realPath = path.join(dir, 'AppRun.bin')

  if (fs.existsSync(realPath)) {
    console.log('[linux-after-pack] AppRun already wrapped')
    return
  }

  try { fs.renameSync(runPath, realPath) } catch (e) {
    console.error('[linux-after-pack] AppRun rename failed:', e.message)
    return
  }

  const wrapper = `#!/bin/bash
export ELECTRON_DISABLE_SANDBOX=1
HERE="\$(dirname "\$(readlink -f "\$0")")"
exec "\${HERE}/AppRun.bin" --no-sandbox --no-zygote --disable-dev-shm-usage "\$@"
`
  fs.writeFileSync(runPath, wrapper, { mode: 0o755 })
  console.log('[linux-after-pack] AppRun wrapped')
}

function wrapBinary(binPath, productName) {
  const dir = path.dirname(binPath)
  const realPath = path.join(dir, productName + '.bin')

  if (!fs.existsSync(binPath)) {
    console.log('[linux-after-pack] Binary not found:', binPath)
    return
  }

  if (fs.existsSync(realPath)) {
    console.log('[linux-after-pack] Binary already wrapped')
    return
  }

  // 只处理真正的二进制（跳过 symlink 和已有脚本）
  if (fs.lstatSync(binPath).isSymbolicLink()) {
    console.log('[linux-after-pack] Binary is symlink, skipping')
    return
  }

  try { fs.renameSync(binPath, realPath) } catch (e) {
    console.error('[linux-after-pack] Binary rename failed:', e.message)
    return
  }

  const wrapper = `#!/bin/bash
export ELECTRON_DISABLE_SANDBOX=1
HERE="\$(dirname "\$(readlink -f "\$0")")"
exec "\${HERE}/${productName}.bin" --no-sandbox --no-zygote --disable-dev-shm-usage "\$@"
`
  fs.writeFileSync(binPath, wrapper, { mode: 0o755 })
  console.log('[linux-after-pack] Binary wrapped')
}

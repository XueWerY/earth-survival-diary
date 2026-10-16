// 应用入口。
//
// 历史上这里还负责分发 --setup-mode=install/uninstall/worker 到 Electron 安装向导，
// 该向导已被移除；安装与卸载改由 Inno Setup 完成
// （安装脚本 build/installer.iss，卸载器由 ISCC 编译时生成）。
require('./main.cjs')

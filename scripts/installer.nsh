# 自定义安装脚本（electron-builder 会将其 !include 到安装/卸载脚本中）
#
# 安装位置选择页之后插入一个"创建快捷方式"自定义页：
#   - 两个默认勾选的复选框：桌面快捷方式 / 开始菜单快捷方式
#   - 用户可取消勾选，对应快捷方式将不会被创建
#   - 静默安装（/S）时跳过该页，变量为空，customInstall 按"创建"处理，默认全建
# 注意：package.json 的 nsis 中 createDesktopShortcut / createStartMenuShortcut
# 已设为 false，electron-builder 自带创建逻辑被关闭，改为此处按用户选择创建。
#
# 关键点 1：本文件在 MUI2.nsh 之前被 !include，因此所有依赖 MUI / nsDialogs /
# LogicLib 的宏不能在文件顶层（函数编译期）使用。故将 Function 定义放入
# customPageAfterChangeDir 宏内——该宏在模板（assistedInstaller.nsh）MUI2 加载之后
# 才展开，此时相关宏均已可用。
#
# 关键点 2：electron-builder 会用 -DBUILD_UNINSTALLER 再编译一次卸载脚本。本文件被
# 两份脚本都 !include，但仅在安装脚本中才会展开 customPageAfterChangeDir（读取这些
# Var 的唯一地方）。因此这些 Var 与自定义页宏必须包在 !ifndef BUILD_UNINSTALLER 内，
# 否则卸载脚本里它们被声明却从不引用，会触发 6001 警告（被当作错误）。

!ifndef BUILD_UNINSTALLER
  # 对话框句柄用内置寄存器 $1（避免未引用 Var 触发 6001 警告），其余状态用 Var 保存
  Var DesktopCheckbox
  Var StartMenuCheckbox
  Var CreateDesktopShortcut
  Var CreateStartMenuShortcut

  # 在"选择安装位置"页之后插入自定义页（宏在 MUI2 加载后展开，故 Function 放此处）
  !macro customPageAfterChangeDir
    Page custom ShortcutPage ShortcutPageLeave

    Function ShortcutPage
      # 静默安装时跳过自定义页（变量保持空，customInstall 默认全建）
      ${If} ${Silent}
        Abort
      ${EndIf}

      !insertmacro MUI_HEADER_TEXT "创建快捷方式" "选择需要创建的快捷方式"

      nsDialogs::Create 1018
      Pop $1

      ${If} $1 == error
        Abort
      ${EndIf}

      ${NSD_CreateLabel} 0 0 100% 12u "请选择要创建的快捷方式（默认全部创建）："
      Pop $0

      ${NSD_CreateCheckBox} 0 28u 100% 12u "创建桌面快捷方式"
      Pop $DesktopCheckbox
      ${NSD_Check} $DesktopCheckbox

      ${NSD_CreateCheckBox} 0 48u 100% 12u "创建开始菜单快捷方式"
      Pop $StartMenuCheckbox
      ${NSD_Check} $StartMenuCheckbox

      nsDialogs::Show
    FunctionEnd

    Function ShortcutPageLeave
      ${NSD_GetState} $DesktopCheckbox $CreateDesktopShortcut
      ${NSD_GetState} $StartMenuCheckbox $CreateStartMenuShortcut
    FunctionEnd
  !macroend
!endif

!macro customInstall
  # 非静默安装时由选择页写入 "1"/"0"；静默安装跳过该页，变量为空，按"创建"处理
  ${If} $CreateDesktopShortcut != "0"
    CreateShortCut "$DESKTOP\${SHORTCUT_NAME}.lnk" "$appExe" "" "$appExe" 0
  ${EndIf}
  ${If} $CreateStartMenuShortcut != "0"
    CreateShortCut "$SMPROGRAMS\${SHORTCUT_NAME}.lnk" "$appExe" "" "$appExe" 0
  ${EndIf}
!macroend

!macro customUnInstall
  Delete "$DESKTOP\${SHORTCUT_NAME}.lnk"
  Delete "$SMPROGRAMS\${SHORTCUT_NAME}.lnk"
!macroend

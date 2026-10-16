; 地球 Online 生存日记 —— Inno Setup 安装/卸载脚本
;
; 本文件是模板；scripts/build-installer.cjs 在构建时替换其中的 {{...}} 占位符，
; 生成 build/installer.generated.iss 后再交给 ISCC.exe 编译，不会直接使用本文件。
;
; 可用占位符：
;   {{AppName}}           产品名（package.json build.productName，用于界面显示与开始菜单）
;   {{InstallDirName}}    安装目录名（英文，取自 build.win.executableName）
;   {{AppExeName}}        主程序文件名（package.json build.win.executableName）
;   {{AppVersion}}        版本号（package.json version）
;   {{AppVersionNumeric}} 版本号的纯数字形式（2026.10.12-1 → 2026.10.12.1）
;   {{AppPublisher}}      发布者（package.json author）
;   {{AppId}}             应用唯一标识（GUID，来自 package.json innoSetup.guid）
;   {{SourceDir}}         待打包的应用目录（release/win-unpacked）
;   {{OutputDir}}         安装包输出目录（release）
;   {{OutputBaseFilename}} 安装包文件名（不含 .exe）
;   {{IconFile}}          安装器图标（build/images/icon.ico）
;   {{LanguageFile}}      简体中文语言文件（build/languages/ChineseSimplified.isl）
;   {{SidebarImage}}      左侧大图 PNG（build/images/installer-sidebar.png，星空 + 地球）
;   {{SidebarBackColor}}  侧边图边缘填充色（与星空底色一致，避免白边）
;   {{WizardSmallImage}}  右上小图 PNG（build/images/installer-small.png，透明背景）
;   {{LicenseFile}}       中文许可协议（build/installer-license.txt）
;   {{AppDataDir}}        用户数据目录名（%APPDATA%\<AppDataDir>）
;
; 权限模型（对应原 NSIS perMachine:false + allowElevation:true）：
;   PrivilegesRequired=lowest       默认免管理员，安装到当前用户目录
;   PrivilegesRequiredOverridesAllowed=dialog commandline
;   用户可在"选择安装位置"页切换到管理员模式（装到 Program Files），与 NSIS 多用户安装模式等价。
;
; 卸载器由 Inno Setup 自动生成（unins000.exe）并写入注册表卸载项，
; 支持控制面板卸载、命令行静默卸载（/VERYSILENT）与开始菜单中的卸载入口。
;
; 安装器图形由 generate-installer-images.js 生成：
;   installer-sidebar.png  星空 + 地球，只在欢迎页的左侧显示
;   installer-small.png    透明背景小图（当前未启用，保留备用）

#define AppName "{{AppName}}"
#define InstallDirName "{{InstallDirName}}"
#define AppVersion "{{AppVersion}}"
; Inno Setup 的 VersionInfoVersion 只接受 1-4 段纯数字（如 2026.10.12.1），
; 项目版本号形如 2026.10.12-1，由 scripts/build-installer.cjs 预先转换成 {{AppVersionNumeric}}。
#define AppVersionNumeric "{{AppVersionNumeric}}"
#define AppExeName "{{AppExeName}}"
#define AppPublisher "{{AppPublisher}}"
#define AppDataDir "{{AppDataDir}}"
#define AppId "{{AppId}}"

[Setup]
; —— 基本信息 ——
; AppId 用 {#AppId}（预处理器常量）而非 {{{AppId}}}，避免与 Inno 的 {{ 转义语法冲突
AppId={#AppId}
AppName={#AppName}
AppVersion={#AppVersion}
AppPublisher={#AppPublisher}
VersionInfoVersion={#AppVersionNumeric}
VersionInfoProductName={#AppName}
VersionInfoDescription={#AppName} 安装程序
AppCopyright=Copyright (C) {#AppPublisher}

; —— 安装目录 ——
; 安装路径用英文目录名 Earth-Survival-Diary（与主程序文件名一致），
; 避免在磁盘路径中出现中文；界面显示的仍是中文产品名 {#AppName}。
DefaultDirName={autopf}\{#InstallDirName}
; 开始菜单文件夹保留中文，符合中文用户习惯
DefaultGroupName={#AppName}
UninstallDisplayName={#AppName} {#AppVersion}
UninstallDisplayIcon={app}\{#AppExeName}.exe
AllowNoIcons=yes

; —— 权限：默认每用户（免管理员），允许用户提升 ——
PrivilegesRequired=lowest
PrivilegesRequiredOverridesAllowed=dialog commandline
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible

; —— 输出 ——
OutputDir={{OutputDir}}
OutputBaseFilename={{OutputBaseFilename}}
SetupIconFile={{IconFile}}
Compression=lzma2/max
SolidCompression=yes
WizardStyle=modern

; —— 图形 ——
; 星空直接画在左侧大图内部（installer-sidebar.png），因此只出现在左侧面板，
; 不会像 WizardBackImageFile 那样铺满整个向导窗口。
;
; 各项设置的作用：
;   WizardImageFile                 左侧星空大图
;   WizardSmallImageFile=（留空）   不显示右上角小图，避免各页出现多余图标
;   WizardImageBackColor           侧边图区域填充星空底色，不出现白色缝隙
;   WizardBackColor=none            关闭"自定义整窗背景色"，内页不再出现白底块
;
; 页面行为（由 [Code] 段的 CurPageChanged 控制）：
;   欢迎页     → 左侧星空 + 居中地球
;   内页       → 完全空白（无地球、无白底）
;   安装完成页 → 左侧星空 + 居中地球
;
; 注意：不要使用 WizardBackImageFile —— 它会把背景图铺满整个窗口的所有页面。
WizardImageFile={{SidebarImage}}
WizardSmallImageFile=
WizardImageBackColor={{SidebarBackColor}}
WizardBackColor=none
WizardImageStretch=yes

; —— 行为 ——
; 注意：不能使用 CloseApplications=yes。它会启用 Inno 的 Restart Manager，
; 对"最小化到托盘"的 Electron 应用只会发 WM_CLOSE —— 而应用把 WM_CLOSE
; 当成"最小化"拦截（preventDefault + hide），进程继续存活并占用安装目录，
; 于是安装器反复弹"未能自动关闭"，且"重试"只是重发注定失败的 WM_CLOSE。
; 关闭应用的职责改由 [Code] 段的 CloseRunningApp() 承担：
; 优雅退出 → 温和 taskkill → 强制 taskkill /F → 申请 UAC 提权后强制结束。
; （PrivilegesRequired=lowest 见上方"权限"节：默认免 UAC，按需提权。）
CloseApplications=no
RestartApplications=no
DisableWelcomePage=no
; 许可协议：使用安装器专用的中文协议（build/installer-license.txt），
; 而非仓库根目录的 MIT 英文原文。
LicenseFile={{LicenseFile}}
ChangesEnvironment=no
AllowCancelDuringInstall=no
UsePreviousAppDir=yes
UsePreviousGroup=yes
UsePreviousSetupType=yes
UsePreviousLanguage=yes
UsePreviousPrivileges=yes
UsePreviousTasks=yes
DisableDirPage=auto
DisableProgramGroupPage=auto
; 只提供简体中文，跳过语言选择对话框
ShowLanguageDialog=no
CreateUninstallRegKey=yes
Uninstallable=yes

[Languages]
; 全部界面中文化：只提供简体中文，不显示语言选择对话框。
; 语言文件为项目自带的 build/languages/ChineseSimplified.isl
; （Inno Setup 官方未附带简体中文翻译）。
; MessagesFile 使用绝对路径，因为生成的 .iss 位于 build/ 目录下。
Name: "chinesesimplified"; MessagesFile: "{{LanguageFile}}"

[CustomMessages]
; "为所有用户创建桌面图标"不是 Inno Setup 内置消息，需要自定义
chinesesimplified.CreateDesktopIconOnAllUsers=为所有用户创建桌面快捷方式（需要管理员权限）

[Tasks]
; 桌面快捷方式：任务名中的 "\" 表示父子层级。
; 默认只给当前用户创建；"为所有用户创建"仅在管理员模式下出现，且默认不勾选，
; 与原 NSIS createDesktopShortcut 的单用户语义一致。
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"
Name: "desktopicon\common"; Description: "{cm:CreateDesktopIconOnAllUsers}"; GroupDescription: "{cm:AdditionalIcons}"; Flags: unchecked; Check: IsAdmin

[Files]
; 主程序与依赖：win-unpacked 全部内容（含 exe、resources、dll、node_modules、LICENSE 等）
Source: "{{SourceDir}}\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs
; 安装器图标供卸载项与快捷方式复用
Source: "{{IconFile}}"; DestDir: "{app}"; Flags: ignoreversion

[Icons]
; 开始菜单
Name: "{group}\{#AppName}"; Filename: "{app}\{#AppExeName}.exe"; WorkingDir: "{app}"
Name: "{group}\{cm:UninstallProgram,{#AppName}}"; Filename: "{uninstallexe}"; WorkingDir: "{app}"
; 桌面（每用户 / 所有用户两个任务）
Name: "{autodesktop}\{#AppName}"; Filename: "{app}\{#AppExeName}.exe"; WorkingDir: "{app}"; Tasks: desktopicon
Name: "{commondesktop}\{#AppName}"; Filename: "{app}\{#AppExeName}.exe"; WorkingDir: "{app}"; Tasks: desktopicon\common

[Run]
; 安装完成页的可选"立即运行"勾选
Filename: "{app}\{#AppExeName}.exe"; Description: "{cm:LaunchProgram,{#StringChange(AppName, '&', '&&')}}"; Flags: nowait postinstall skipifsilent

[UninstallDelete]
; 个人数据（笔记、设置、日志）默认保留，仅在用户于卸载时明确选择"删除"后由 [Code] 段移除。
; 这里只清理 Electron 崩溃转储目录，避免残留。
Type: filesandordirs; Name: "{userappdata}\{#AppDataDir}\Crashpad"
Type: filesandordirs; Name: "{localappdata}\{#InstallDirName}\Crashpad"

[Code]
{ 自定义安装/卸载逻辑 }

var
  DeleteUserData: Boolean;
  DetailLines: String;
  FailedList: TStringList;

// —— 按页面控制图形显示 ——
// Inno Setup 用两个独立的图像控件承载左侧大图：
//   WizardBitmapImage   → 欢迎页的左侧图位
//   WizardBitmapImage2  → 安装完成页的左侧图位
// （官方示例 CodeClasses.iss 也是成对操作这两个控件。）
//
// 这里让星空地球只出现在欢迎页与安装完成页，内页保持空白：
//   欢迎页          → 左侧星空 + 居中地球
//   内页（许可协议、选择安装位置等）→ 完全空白
//   安装完成页      → 左侧星空 + 居中地球
procedure CurPageChanged(CurPageID: Integer);
var
  ShowSidebar: Boolean;
begin
  ShowSidebar := (CurPageID = wpWelcome) or (CurPageID = wpFinished);
  WizardForm.WizardBitmapImage.Visible := ShowSidebar;
  WizardForm.WizardBitmapImage2.Visible := ShowSidebar;
  WizardForm.WizardSmallBitmapImage.Visible := ShowSidebar;
end;

// —— 应用运行检测 ——
// Electron 的单实例互斥体名不可预知（requestSingleInstanceLock 内部生成的是命名管道），
// CheckForMutexes 检测不到；曾尝试辅助 DLL 方案（esdcheck.dll），
// 但 CallDLLProc 只支持两个 32 位参数，x64 下传指针会被截断导致调用失败，故弃用。
//
// 最终方案：调用系统自带 tasklist 查询进程（无依赖、无指针问题），
// 结果写临时文件后读取，判断是否包含主程序名。
function IsAppRunning(): Boolean;
var
  TmpOut: String;
  Args: String;
  ResultCode: Integer;
  Content: AnsiString;
begin
  Result := False;
  TmpOut := ExpandConstant('{tmp}\esd-tasklist.txt');
  DeleteFile(TmpOut);

  // /NH 去表头 /FO CSV 稳定格式；只查主程序名，输出极小
  Args := '/NH /FO CSV /FI "IMAGENAME eq {#AppExeName}.exe"';
  if not Exec(ExpandConstant('{cmd}'), '/C tasklist ' + Args + ' > "' + TmpOut + '" 2>NUL',
              '', SW_HIDE, ewWaitUntilTerminated, ResultCode) then
    Exit;

  if not LoadStringFromFile(TmpOut, Content) then Exit;
  DeleteFile(TmpOut);

  // CSV 行形如："Earth-Survival-Diary.exe","12345","Console",...
  //
  // 必须用大小写不敏感比较！tasklist 的 /FI 过滤器虽大小写不敏感（能查到进程），
  // 但返回的进程名取自系统实际名称，而 Windows 上"重命名打包产物"会产生小写形式
  // （earth-survival-diary.exe）。Pascal 的 Pos() 大小写敏感，
  // 直接 Pos('Earth-Survival-Diary.exe', ...) 会漏检，导致安装器认为应用未运行、
  // 跳过关闭流程——这正是"直接进入安装、不关闭应用"的根因。
  Result := Pos(LowerCase('{#AppExeName}.exe'), LowerCase(Content)) > 0;
end;

// —— 当前安装器是否已具备管理员权限 ——
// 用于判断结束应用进程时是否需要申请提权（应用以管理员身份运行时，
// 非提权的安装器 taskkill 会被拒绝：Access is denied）。
// Inno Setup 的 IsAdminLoggedOn 只判断"当前登录用户是管理员组成员"，
// 而 UAC 下未提升的令牌同样返回 True，因此改用命令行实测。
function IsSetupElevated(): Boolean;
var
  ResultCode: Integer;
begin
  // net session 在非提权令牌下必定失败（拒绝访问），提权后成功
  Result := Exec(ExpandConstant('{cmd}'), '/C net session >NUL 2>&1',
                 '', SW_HIDE, ewWaitUntilTerminated, ResultCode) and (ResultCode = 0);
end;

// —— 申请提权后结束应用进程树 ——
// 场景：应用由用户"以管理员身份运行"启动，安装器自身未提权（PrivilegesRequired=lowest），
// 普通 taskkill 会因完整性级别不足被拒绝（Access is denied）。
// 此时通过 PowerShell 的 Start-Process -Verb RunAs 弹出 UAC，
// 用提升后的令牌重新执行 taskkill。
//
// 实现说明（已实测验证）：
//   - Inno Setup 6.7.3 的 Exec 只有 6 参数签名，不接受 Verb 参数，
//     因此不能用 Exec(..., 'runas')；改用 powershell 的 RunAs 动词触发 UAC；
//   - 实测：非提权执行 "net session" 返回系统错误 5（拒绝访问），
//     经本函数提权后同一命令成功执行（resultcode=0）；
//   - 用户在 UAC 中点"否"时 Start-Process 抛出异常、退出码非 0，由上层按"关闭失败"处理；
//   - Force=True 时强杀（/F），否则温和结束。
function KillAppProcessesElevated(Force: Boolean): Boolean;
var
  Switch: String;
  Ps: String;
  ResultCode: Integer;
begin
  if Force then Switch := '/F ' else Switch := '';
  // Start-Process -Verb RunAs 触发 UAC；-Wait 等待提权进程结束
  Ps := '-NoProfile -ExecutionPolicy Bypass -Command "' +
        'Start-Process -FilePath ''cmd.exe'' ' +
        '-ArgumentList ''/C taskkill ' + Switch + '/T /IM \"{#AppExeName}.exe\"'' ' +
        '-Verb RunAs -WindowStyle Hidden -Wait; exit 0"';
  Result := Exec(ExpandConstant('{sys}\WindowsPowerShell\v1.0\powershell.exe'),
                 Ps, '', SW_HIDE, ewWaitUntilTerminated, ResultCode)
            and (ResultCode = 0);
end;

// —— 获取运行中应用的实际安装目录 ——
// 注意：不能用 {app} 常量 —— InitializeSetup 阶段它尚未初始化
// （会报 "An attempt was made to expand the "app" constant before it was initialized"），
// 且即将进行的安装可能改变安装位置。运行中的应用来自上一次安装，其位置
// 从卸载注册表项读取；读不到时返回空串（上层跳过需要路径的步骤）。
function GetInstalledAppDir(): String;
var
  UninsKey: String;
  V: String;
begin
  Result := '';
  UninsKey := 'Software\Microsoft\Windows\CurrentVersion\Uninstall\{#AppId}_is1';
  // 每用户安装写在 HKCU；管理员模式安装写在 HKLM（两处都查）
  if RegQueryStringValue(HKEY_CURRENT_USER, UninsKey, 'InstallLocation', V) and (V <> '') then
    Result := V
  else if RegQueryStringValue(HKEY_LOCAL_MACHINE, 'SOFTWARE\' + UninsKey, 'InstallLocation', V) and (V <> '') then
    Result := V
  else if RegQueryStringValue(HKEY_LOCAL_MACHINE, 'SOFTWARE\WOW6432Node\' + UninsKey, 'InstallLocation', V) and (V <> '') then
    Result := V;
end;

// —— 解析主程序实际文件名 ——
// electron-builder 打包时会把 executableName 归一化为小写
// （Earth-Survival-Diary → earth-survival-diary.exe），
// 而 Windows 文件系统与 taskkill 的 /IM 均大小写不敏感，故此处仅作探测；
// 找不到时回退到 {#AppExeName}.exe。
function AppExeFileName(const AppDir: String): String;
begin
  Result := '{#AppExeName}.exe';
  if FileExists(AppDir + '\' + Result) then Exit;
  if FileExists(AppDir + '\' + LowerCase('{#AppExeName}.exe')) then
    Result := LowerCase('{#AppExeName}.exe');
end;

// —— 优雅退出：请求运行中的应用自行退出 ——
// 启动一个带 --esd-graceful-exit 参数的新实例：它拿不到单实例锁随即退出，
// 参数经 Electron 的 second-instance 事件转发给运行中的实例，应用走正常退出流程
// （main.cjs 已处理该参数：保存数据、清理托盘与子进程后退出）。
// 比强杀进程更安全：不会打断未保存的数据写入。
// 路径来自 GetInstalledAppDir（卸载注册表），不能用 {app} ——
// InitializeSetup 阶段该常量尚未初始化。
procedure GracefulExitApp();
var
  AppDir: String;
  ResultCode: Integer;
begin
  AppDir := GetInstalledAppDir();
  if AppDir = '' then Exit;
  if not FileExists(AppDir + '\' + AppExeFileName(AppDir)) then Exit;
  Exec(AppDir + '\' + AppExeFileName(AppDir), '--esd-graceful-exit', '',
       SW_HIDE, ewNoWait, ResultCode);
  // 不同步等待辅助实例；它的启动/退出时间由 WaitForAppExit 的超时统一约束。
end;

// —— 强制结束进程树 ——
// taskkill 的 /IM 大小写不敏感，直接用配置名即可匹配小写进程名。
function KillAppProcesses(): Boolean;
var
  ResultCode: Integer;
begin
  ResultCode := -1;
  Result := Exec(ExpandConstant('{cmd}'),
                 '/C taskkill /F /T /IM "{#AppExeName}.exe" >NUL 2>&1',
                 '', SW_HIDE, ewWaitUntilTerminated, ResultCode)
            and (ResultCode = 0);
end;

// —— 等待应用全部退出 ——
// 轮询 IsAppRunning（tasklist 查询），使用系统单调时钟计时；
// tasklist 自身耗时也计入超时，避免进程查询变慢时等待时间不断累加。
function GetSystemTickCount: DWORD;
external 'GetTickCount@kernel32.dll stdcall';

function WaitForAppExit(TotalMs: Integer): Boolean;
var
  StartTick: DWORD;
begin
  StartTick := GetSystemTickCount();
  while True do
  begin
    if not IsAppRunning() then
    begin
      Result := True;
      Exit;
    end;
    // DWORD 差值可自然处理 GetTickCount 的回绕；此处等待上限远小于回绕周期。
    if (GetSystemTickCount() - StartTick) >= DWORD(TotalMs) then
    begin
      Result := False;
      Exit;
    end;
    Sleep(500);
  end;
end;

// —— 自动关闭正在运行的应用，返回是否已全部关闭 ——
// 策略（逐级升级，每级后轮询等待退出；等待是"上限"，应用一退出立即返回）：
//   1) 优雅退出：启动带 --esd-graceful-exit 的新实例，应用自行保存数据后退出
//      （上限 6s；正常 2-4s 内完成——应用收到请求即 app.quit()）
//   2) 强制结束：taskkill /F /T 强杀进程树（上限 5s）
//   3) 申请提权后强制结束：应用可能以管理员身份运行，未提权的安装器会被拒绝
//      （Access is denied），此时弹出 UAC 用管理员身份重试 taskkill，再最多等待 3s 确认退出。
//      若安装器自身已是管理员权限则跳过本级（再提权无意义）。
//
// 关于"权限不够"：PrivilegesRequired=lowest 时安装器运行在标准用户令牌，
// 若用户曾"以管理员身份运行"启动应用，则普通 taskkill 会因完整性级别不足失败，
// 必须经 UAC 提权才能结束——这正是需要申请权限的场景。
function CloseRunningApp(): Boolean;
begin
  Result := True;
  if not IsAppRunning() then Exit;

  // 1) 优雅退出：应用自行保存数据后退出（最安全，避免强杀丢数据）
  GracefulExitApp();
  if WaitForAppExit(6000) then Exit;

  // 2) 强制结束进程树。普通 WM_CLOSE 会被默认的"最小化到托盘"行为拦截，
  //    因此跳过无效的温和结束等待；taskkill 自身失败时也不再空等 5 秒。
  if KillAppProcesses() then
  begin
    if WaitForAppExit(5000) then Exit;
  end
  else if not IsAppRunning() then
    Exit;

  // 3) 仍未退出：说明当前令牌权限不足（应用以管理员身份运行，或句柄被系统进程持有）。
  //    若安装器自身已是管理员权限，再提权也无济于事，直接跳过，把时间留给用户手动处理；
  //    否则申请 UAC 提权后强制结束。用户拒绝 UAC 时同样返回 False。
  if not IsSetupElevated() then
  begin
    Log('当前权限下无法关闭应用，正在申请管理员权限……');
    if KillAppProcessesElevated(True) then
    begin
      if WaitForAppExit(3000) then Exit;
    end;
  end
  else
    Log('安装程序已具有管理员权限，但应用仍未关闭（可能被系统进程占用文件）。');

  Result := not IsAppRunning();
end;

// —— 安装前初始化：检测应用是否正在运行 ——
function InitializeSetup(): Boolean;
var
  Msg: String;
begin
  Result := True;

  // 若应用正在运行，点"确定"后自动关闭（优雅退出优先，避免强杀丢数据）。
  // 注意：这里不能用 CheckForMutexes({#AppMutexName}) —— Electron 的单实例锁
  // 是内部生成的命名管道，不是这个互斥体名，检测必然失效；统一用 IsAppRunning()。
  // 注意：静默判断必须用 WizardSilent（Inno 官方函数，安装/卸载通用）；
  // UninstallSilent 只能在卸载流程中调用，在 InitializeSetup 里调用会触发运行时错误
  // "Cannot call UninstallSilent function during Setup"。
  if IsAppRunning() then
  begin
    if WizardSilent then
    begin
      // 静默安装：自动关闭，关不掉才中止
      if not CloseRunningApp() then
      begin
        MsgBox('检测到 {#AppName} 正在运行且无法自动关闭，请手动关闭应用后再安装。', mbError, MB_OK);
        Result := False;
      end;
      Exit;
    end;
    Msg := '检测到 {#AppName} 正在运行。' + #13#10#13#10 +
           '单击"确定"后将自动关闭应用并继续安装；' + #13#10 +
           '应用会先保存数据再退出。' + #13#10 +
           '若当前权限不足，安装程序会申请管理员权限来完成关闭。' + #13#10#13#10 +
           '单击"取消"退出安装。';
    if MsgBox(Msg, mbConfirmation, MB_OKCANCEL) = IDOK then
    begin
      if not CloseRunningApp() then
      begin
        // 自动关闭失败（含用户拒绝 UAC）：给用户一次手动处理后重试的机会
        Msg := '{#AppName} 未能自动关闭。' + #13#10#13#10 +
               '请手动关闭应用后单击"确定"重试，或单击"取消"退出安装。';
        if MsgBox(Msg, mbConfirmation, MB_OKCANCEL) = IDOK then
        begin
          if not CloseRunningApp() then
          begin
            MsgBox('应用仍在运行，无法继续安装。请关闭应用后重新运行安装程序。', mbError, MB_OK);
            Result := False;
            Exit;
          end;
        end
        else
        begin
          Result := False;
          Exit;
        end;
      end;
    end
    else
    begin
      Result := False;
      Exit;
    end;
  end;
end;

// —— 卸载：提供"是否删除个人数据"选项，默认保留 ——
function InitializeUninstall(): Boolean;
var
  Msg: String;
begin
  Result := True;
  DeleteUserData := False;
  // 删除失败清单（供卸载收尾汇总）
  FailedList := TStringList.Create;

  // 卸载前确认应用已关闭；单击"确定"后自动关闭正在运行的应用。
  if IsAppRunning() then
  begin
    if UninstallSilent then
    begin
      // 静默模式下不弹确认框，自动尝试关闭应用；关不掉再中止，避免留下删不掉的文件
      if not CloseRunningApp() then
      begin
        MsgBox('检测到 {#AppName} 正在运行且无法自动关闭，请手动关闭应用后再执行卸载。', mbError, MB_OK);
        Result := False;
      end;
      Exit;
    end;
    Msg := '检测到 {#AppName} 正在运行。' + #13#10#13#10 +
           '单击"确定"后将自动关闭应用并继续卸载；' + #13#10 +
           '应用会先保存数据再退出。' + #13#10 +
           '若当前权限不足，卸载程序会申请管理员权限来完成关闭。' + #13#10#13#10 +
           '单击"取消"退出卸载。';
    if MsgBox(Msg, mbConfirmation, MB_OKCANCEL) = IDOK then
    begin
      // 自动关闭应用（此处卸载进度表单尚未创建，AddDetail 不可用，无法回显进度）
      if not CloseRunningApp() then
      begin
        // 自动关闭失败（含用户拒绝 UAC）：给用户最后一次机会手动处理后继续，取消则中止
        Msg := '{#AppName} 未能自动关闭。' + #13#10#13#10 +
               '请手动关闭应用后单击"确定"重试，或单击"取消"退出卸载。';
        if MsgBox(Msg, mbConfirmation, MB_OKCANCEL) = IDOK then
        begin
          if not CloseRunningApp() then
          begin
            MsgBox('应用仍在运行，无法继续卸载。请关闭应用后重新执行卸载。', mbError, MB_OK);
            Result := False;
            Exit;
          end;
        end
        else
        begin
          Result := False;
          Exit;
        end;
      end;
    end
    else
    begin
      Result := False;
      Exit;
    end;
  end;

  if UninstallSilent then Exit;

  Msg := '卸载完成后，是否同时删除 {#AppName} 的个人数据？' + #13#10#13#10 +
         '个人数据包括笔记、清单、设置与日志，' + #13#10 +
         '保存在 %APPDATA%\{#AppDataDir} 目录下。' + #13#10#13#10 +
         '  是：删除个人数据' + #13#10 +
         '  否：保留个人数据（下次安装后仍可继续使用）' + #13#10 +
         '  取消：退出卸载';
  case MsgBox(Msg, mbConfirmation, MB_YESNOCANCEL or MB_DEFBUTTON2) of
    IDYES: DeleteUserData := True;
    IDCANCEL: Result := False;
  end;
end;

// —— 卸载：显示删除详情 ——
// Inno Setup 的卸载进度表单只有"状态标签 + 进度条"。
// 动态创建 TNewMemo 会在部分系统上触发 "Control has no parent window" 运行时错误
// （进度表单的子控件句柄在 InitializeUninstallProgressForm 时尚未就绪），
// 因此改为把详情文本写进原生 StatusLabel —— 它的句柄由 Inno Setup 自行管理，绝对可靠。
// 逐行拼接最近几条记录，换行显示，让用户能看到正在删除什么、什么删失败了。
// （DetailLines 变量声明在 [Code] 段顶部。）
// 注意 Pascal 顺序要求：InitDetailLayout → AddDetail → InitializeUninstallProgressForm。

// 初始化卸载详情区布局：把进度条下移，给状态标签腾出多行空间，保证二者有间距。
// （官方 DFM：InnerNotebook 内 StatusLabel Top=12 H=16、ProgressBar Top=56。
//   标签扩高到 96px 后底部会紧贴进度条，故把进度条同步下移。）
procedure InitDetailLayout();
var
  Form: TUninstallProgressForm;
begin
  try
    Form := GetUninstallProgressForm;
  except
    Exit;
  end;
  if Form = nil then Exit;

  with Form.StatusLabel do
  begin
    AutoSize := False;
    Top := Form.ProgressBar.Top;           // 与进度条同起始高度（12）
    Left := Form.ProgressBar.Left;
    Width := Form.ProgressBar.Width;
    Height := 96;                          // 容纳 6 行
  end;
  with Form.ProgressBar do
  begin
    Top := Form.StatusLabel.Top + 96 + 14; // 标签底部 + 14px 间距
  end;
end;

// 记录一条详情：写进卸载进度表单的状态标签（最多保留最近 6 行）
// 注意：必须通过 GetUninstallProgressForm() 获取表单引用——
// 在事件函数里直接引用全局 UninstallProgressForm 变量可能触发
// "Could not call proc" 运行时错误（全局变量尚未完成绑定时）。
// 表单未创建（usAppMutexCheck 阶段）或已销毁时函数静默返回。
procedure AddDetail(const Line: String);
var
  I, Start: Integer;
  Combined: String;
  Form: TUninstallProgressForm;
begin
  try
    Form := GetUninstallProgressForm;
  except
    Exit;   // 表单尚未创建或已销毁，跳过 UI 更新
  end;
  if Form = nil then Exit;

  if Line <> '' then
    DetailLines := DetailLines + Line + #13#10;
  // 只保留最近 6 行，避免超出标签高度
  Combined := DetailLines;
  for I := 1 to 6 do
  begin
    Start := Pos(#13#10, Combined);
    if Start <= 0 then Break;
    if Length(Combined) <= 480 then Break;
    Combined := Copy(Combined, Start + 2, Length(Combined));
  end;
  with Form.StatusLabel do
  begin
    AutoSize := False;
    Height := 96;           // 容纳 6 行（DFM 原高 16，下方有充足空间）
    Caption := Combined;
    Update;
  end;
end;

// 卸载进度表单初始化：调整布局并在详情区写入首条记录
procedure InitializeUninstallProgressForm();
begin
  InitDetailLayout();
  AddDetail('开始卸载');
end;

// 记录删除失败的项目，供卸载结束时汇总
procedure NoteFailure(const Path: String);
begin
  if FailedList = nil then Exit;
  FailedList.Add(Path);
end;

// 递归枚举目录下所有文件与子目录，返回文件数量；失败项记入 LockedFiles。
// 用于删除前后对比：删除前列出总数，删除后重新枚举即可精确定位"删不掉"的文件。
procedure EnumTree(const Dir: String; var FileCount: Integer; var DirCount: Integer);
var
  FindRec: TFindRec;
  Sub: String;
begin
  if FindFirst(Dir + '\*', FindRec) then
  try
    repeat
      // 跳过 . 与 ..
      if (FindRec.Name <> '.') and (FindRec.Name <> '..') then
      begin
        Sub := Dir + '\' + FindRec.Name;
        if (FindRec.Attributes and FILE_ATTRIBUTE_DIRECTORY) <> 0 then
        begin
          DirCount := DirCount + 1;
          EnumTree(Sub, FileCount, DirCount);
        end
        else
          FileCount := FileCount + 1;
      end;
    until not FindNext(FindRec);
  finally
    FindClose(FindRec);
  end;
end;

// 删除后重新枚举：仍存在的文件即"删不掉"的，逐个列出（最多列 12 个，避免刷屏）
procedure ReportLockedFiles(const Dir: String);
var
  FindRec: TFindRec;
  Sub: String;
  Reported: Integer;
begin
  if not DirExists(Dir) then Exit;
  Reported := 0;
  if FindFirst(Dir + '\*', FindRec) then
  try
    repeat
      if (FindRec.Name <> '.') and (FindRec.Name <> '..') then
      begin
        Sub := Dir + '\' + FindRec.Name;
        if (FindRec.Attributes and FILE_ATTRIBUTE_DIRECTORY) <> 0 then
          ReportLockedFiles(Sub)
        else
        begin
          if Reported < 12 then
          begin
            AddDetail('  【占用】' + Sub);
            NoteFailure(Sub);
          end;
          Reported := Reported + 1;
        end;
      end;
    until not FindNext(FindRec);
  finally
    FindClose(FindRec);
  end;
  if Reported > 12 then
    AddDetail('  ……以及另外 ' + IntToStr(Reported - 12) + ' 个文件');
end;

// 删除个人数据（默认不删；仅在用户明确选择"是"时执行）
procedure DeleteAppData();
var
  Target: String;
begin
  Target := ExpandConstant('{userappdata}\{#AppDataDir}');
  AddDetail('正在删除个人数据：' + Target);
  if DelTree(Target, True, True, True) then
    AddDetail('  已删除：' + Target)
  else
  begin
    AddDetail('  【失败】无法完全删除：' + Target);
    NoteFailure(Target);
  end;

  Target := ExpandConstant('{localappdata}\{#AppDataDir}');
  if DirExists(Target) then
  begin
    AddDetail('正在删除缓存数据：' + Target);
    if DelTree(Target, True, True, True) then
      AddDetail('  已删除：' + Target)
    else
    begin
      AddDetail('  【失败】无法完全删除：' + Target);
      NoteFailure(Target);
    end;
  end;
end;

procedure CurUninstallStepChanged(CurUninstallStep: TUninstallStep);
var
  I: Integer;
  AppDir: String;
  TotalFiles, TotalDirs: Integer;
begin
  // usAppMutexCheck 是最早的阶段（此时卸载进度表单尚未创建，
  // 访问 StatusLabel 会触发 "attempt to access UninstallProgressForm" 内部错误），
  // 因此在此阶段不做任何 UI 操作。
  // 应用的关闭已在 InitializeUninstall 中完成，这里无需处理。
  if CurUninstallStep = usAppMutexCheck then
    Exit;

  if CurUninstallStep = usUninstall then
  begin
    AppDir := ExpandConstant('{app}');
    AddDetail('开始卸载');
    AddDetail('程序目录：' + AppDir);

    // 删除前统计文件规模，让用户对卸载量有预期
    TotalFiles := 0;
    TotalDirs := 0;
    if DirExists(AppDir) then
    begin
      EnumTree(AppDir, TotalFiles, TotalDirs);
      AddDetail('待删除：' + IntToStr(TotalFiles) + ' 个文件，' + IntToStr(TotalDirs) + ' 个子目录');
    end;

    if DeleteUserData then
    begin
      AddDetail('');
      DeleteAppData();
    end
    else
    begin
      AddDetail('');
      AddDetail('个人数据按选择保留在：' + ExpandConstant('{userappdata}\{#AppDataDir}'));
    end;
  end;

  // 卸载收尾：枚举残留文件，精确列出被占用而删不掉的项
  if CurUninstallStep = usPostUninstall then
  begin
    AddDetail('');
    if DirExists(ExpandConstant('{app}')) then
    begin
      AddDetail('以下文件被占用未能删除：');
      ReportLockedFiles(ExpandConstant('{app}'));
      AddDetail('');
      AddDetail('请关闭正在使用这些文件的程序后重新卸载，');
      AddDetail('或手动删除目录：' + ExpandConstant('{app}'));
    end
    else if (FailedList <> nil) and (FailedList.Count > 0) then
    begin
      AddDetail('以下项目无法删除：');
      for I := 0 to FailedList.Count - 1 do
        AddDetail('  - ' + FailedList.Strings[I]);
    end
    else
      AddDetail('卸载完成，所有文件已移除。');
  end;
end;

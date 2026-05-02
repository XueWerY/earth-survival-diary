!macro customUnInstall
  MessageBox MB_YESNO|MB_ICONQUESTION "是否同时删除所有用户数据？$\n（包括足迹记录、清单、设置等数据将永久删除）" /SD IDNO IDNO skipDeleteUserData
  RMDir /r "$APPDATA\earth-survival-diary"
  skipDeleteUserData:
!macroend

!macro customInstall
!macroend

!macro customUnInstall
  nsExec::ExecToLog 'taskkill /F /IM "地球 Online 生存日记.exe" /T'
  Sleep 2000
!macroend

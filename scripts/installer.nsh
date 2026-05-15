!macro customInstall
!macroend

!macro customUnInstall
  nsExec::ExecToLog 'taskkill /F /IM "Earth-Survival-Diary.exe" /T'
  Sleep 2000
!macroend

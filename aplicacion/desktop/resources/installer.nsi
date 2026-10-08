Unicode true
!include "MUI2.nsh"
!include "LogicLib.nsh"
!include "x64.nsh"
!include "WinVer.nsh"
Name "Control Emprende"
OutFile "${RELEASE_DIR}/Control-Emprende-${VERSION}-Windows-x64-Instalador.exe"
InstallDir "$LOCALAPPDATA\Programs\Control Emprende"
InstallDirRegKey HKCU "Software\ControlEmprende\Desktop" "InstallDir"
RequestExecutionLevel user
SetCompressor /SOLID lzma
SetCompressorDictSize 16
ShowInstDetails show
ShowUninstDetails show
BrandingText "Control Emprende ${VERSION} · Edición de prueba"
VIProductVersion "${VERSION}.0"
VIAddVersionKey /LANG=3082 "ProductName" "Control Emprende"
VIAddVersionKey /LANG=3082 "FileDescription" "Instalador de Control Emprende"
VIAddVersionKey /LANG=3082 "FileVersion" "${VERSION}"
VIAddVersionKey /LANG=3082 "LegalCopyright" "Control Emprende"
!define MUI_ICON "${RES_DIR}/icon.ico"
!define MUI_UNICON "${RES_DIR}/icon.ico"
!define MUI_ABORTWARNING
!define MUI_WELCOMEPAGE_TITLE "Tu negocio, a tu manera."
!define MUI_WELCOMEPAGE_TEXT "Instala Control Emprende y configura tu propio negocio.$\r$\n$\r$\nEmpieza sin registros precargados. Carga tus productos, clientes y ventas. Tus datos permanecen en este equipo. La licencia requiere Internet al activar y periódicamente. Esta versión usa pagos de prueba."
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_LICENSE "${RES_DIR}/LEEME.txt"
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!define MUI_FINISHPAGE_RUN "$INSTDIR\Control Emprende.exe"
!define MUI_FINISHPAGE_RUN_TEXT "Abrir Control Emprende"
!insertmacro MUI_PAGE_FINISH
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_UNPAGE_FINISH
!insertmacro MUI_LANGUAGE "Spanish"
Function .onInit
  ${IfNot} ${AtLeastWin10}
    MessageBox MB_OK|MB_ICONSTOP "Esta versión requiere Windows 10 o posterior."
    Abort
  ${EndIf}
  ${IfNot} ${RunningX64}
    MessageBox MB_OK|MB_ICONSTOP "Esta versión requiere Windows de 64 bits."
    Abort
  ${EndIf}
  SetRegView 64
  SetShellVarContext current
  ReadRegStr $2 HKCU "Software\ControlEmprende\Desktop" "InstallDir"
  ${If} $2 != ""
    StrCpy $INSTDIR $2
  ${EndIf}
  System::Call 'kernel32::CreateMutexW(p 0, i 0, w "Local\ControlEmprendeInstaller") p .r0 ?e'
  Pop $1
  ${If} $1 = 183
    MessageBox MB_OK|MB_ICONINFORMATION "Ya hay un instalador de Control Emprende abierto."
    Abort
  ${EndIf}
FunctionEnd
!macro CheckClosed
  IfFileExists "$INSTDIR\Control Emprende.exe" 0 closed
  ClearErrors
  FileOpen $0 "$INSTDIR\Control Emprende.exe" a
  ${If} ${Errors}
    MessageBox MB_OK|MB_ICONEXCLAMATION "Cierra Control Emprende y vuelve a intentarlo. Si continúa, comprueba los permisos de esta carpeta."
    Abort
  ${EndIf}
  FileClose $0
  closed:
!macroend
Section "Instalar"
  !insertmacro CheckClosed
  SetOutPath "$INSTDIR"
  File /r "${APP_DIR}/*.*"
  WriteUninstaller "$INSTDIR\Desinstalar Control Emprende.exe"
  CreateDirectory "$SMPROGRAMS\Control Emprende"
  CreateShortcut "$SMPROGRAMS\Control Emprende\Control Emprende.lnk" "$INSTDIR\Control Emprende.exe"
  CreateShortcut "$DESKTOP\Control Emprende.lnk" "$INSTDIR\Control Emprende.exe"
  WriteRegStr HKCU "Software\ControlEmprende\Desktop" "InstallDir" "$INSTDIR"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\ControlEmprende" "DisplayName" "Control Emprende"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\ControlEmprende" "DisplayVersion" "${VERSION}"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\ControlEmprende" "DisplayIcon" "$INSTDIR\Control Emprende.exe"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\ControlEmprende" "UninstallString" '$\"$INSTDIR\Desinstalar Control Emprende.exe$\"'
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\ControlEmprende" "InstallLocation" "$INSTDIR"
  WriteRegDWORD HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\ControlEmprende" "NoModify" 1
  WriteRegDWORD HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\ControlEmprende" "NoRepair" 1
SectionEnd
Function un.onInit
  SetRegView 64
  SetShellVarContext current
FunctionEnd
Section "Uninstall"
  !insertmacro CheckClosed
  !include "${RELEASE_DIR}/uninstall-files.nsh"
  Delete "$INSTDIR\Desinstalar Control Emprende.exe"
  Delete "$DESKTOP\Control Emprende.lnk"
  Delete "$SMPROGRAMS\Control Emprende\Control Emprende.lnk"
  RMDir "$SMPROGRAMS\Control Emprende"
  RMDir "$INSTDIR"
  DeleteRegKey HKCU "Software\ControlEmprende\Desktop"
  DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\ControlEmprende"
  ; Preserve user data and unrelated files. Never recursively delete the chosen installation directory.
SectionEnd

@echo off
setlocal
pushd "%~dp0" || exit /b 1
if exist "Control-Emprende-4.3.2-Windows-x64-Instalador.exe" goto verificar
 echo Preparando el instalador de Control Emprende 4.3.2...
copy /y /b "sitio\descargas\control-emprende-4.3.2-0334890632d2-01.bin"+"sitio\descargas\control-emprende-4.3.2-0334890632d2-02.bin"+"sitio\descargas\control-emprende-4.3.2-0334890632d2-03.bin"+"sitio\descargas\control-emprende-4.3.2-0334890632d2-04.bin"+"sitio\descargas\control-emprende-4.3.2-0334890632d2-05.bin"+"sitio\descargas\control-emprende-4.3.2-0334890632d2-06.bin"+"sitio\descargas\control-emprende-4.3.2-0334890632d2-07.bin" "Control-Emprende-4.3.2-Windows-x64-Instalador.exe.partial" >nul
if errorlevel 1 goto fallo
powershell.exe -NoLogo -NoProfile -Command "try { if ((Get-FileHash -LiteralPath 'Control-Emprende-4.3.2-Windows-x64-Instalador.exe.partial' -Algorithm SHA256 -ErrorAction Stop).Hash -ne '0334890632d24a647a5951405db1fc6711dd16ad2a2ac6db2dedce432ff2749a') { exit 1 } } catch { exit 1 }"
if errorlevel 1 goto fallo
move /y "Control-Emprende-4.3.2-Windows-x64-Instalador.exe.partial" "Control-Emprende-4.3.2-Windows-x64-Instalador.exe" >nul
if errorlevel 1 goto fallo
:verificar
powershell.exe -NoLogo -NoProfile -Command "try { if ((Get-FileHash -LiteralPath 'Control-Emprende-4.3.2-Windows-x64-Instalador.exe' -Algorithm SHA256 -ErrorAction Stop).Hash -ne '0334890632d24a647a5951405db1fc6711dd16ad2a2ac6db2dedce432ff2749a') { exit 1 } } catch { exit 1 }"
if errorlevel 1 goto fallo
 echo.
 echo Listo. Abre este archivo para instalar:
 echo Control-Emprende-4.3.2-Windows-x64-Instalador.exe
 echo.
 echo El instalador aun no tiene firma digital del editor.
 echo No se ha probado la instalacion en Windows.
popd
pause
exit /b 0
:fallo
 echo.
 echo No se pudo preparar o verificar el instalador.
 echo Extrae TODO el ZIP en una carpeta y vuelve a intentarlo.
 echo No abras un ejecutable que no haya pasado la verificacion.
popd
pause
exit /b 1

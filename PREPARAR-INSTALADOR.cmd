@echo off
setlocal
pushd "%~dp0" || exit /b 1
if exist "Control-Emprende-4.4.0-Windows-x64-Instalador.exe" goto verificar
 echo Preparando Control Emprende 4.4.0 - PRUEBAS DE PAGO...
copy /y /b "descargas\control-emprende-4.4.0-5b97badca7d1-01.bin"+"descargas\control-emprende-4.4.0-5b97badca7d1-02.bin"+"descargas\control-emprende-4.4.0-5b97badca7d1-03.bin"+"descargas\control-emprende-4.4.0-5b97badca7d1-04.bin"+"descargas\control-emprende-4.4.0-5b97badca7d1-05.bin"+"descargas\control-emprende-4.4.0-5b97badca7d1-06.bin"+"descargas\control-emprende-4.4.0-5b97badca7d1-07.bin" "Control-Emprende-4.4.0-Windows-x64-Instalador.exe.partial" >nul
if errorlevel 1 goto fallo
powershell.exe -NoLogo -NoProfile -Command "try { if ((Get-FileHash -LiteralPath 'Control-Emprende-4.4.0-Windows-x64-Instalador.exe.partial' -Algorithm SHA256 -ErrorAction Stop).Hash -ne '5b97badca7d1c6c95648df28fa04d14127b4c2c651b201ed3e2d9b6b68247c2b') { exit 1 } } catch { exit 1 }"
if errorlevel 1 goto fallo
move /y "Control-Emprende-4.4.0-Windows-x64-Instalador.exe.partial" "Control-Emprende-4.4.0-Windows-x64-Instalador.exe" >nul
if errorlevel 1 goto fallo
:verificar
powershell.exe -NoLogo -NoProfile -Command "try { if ((Get-FileHash -LiteralPath 'Control-Emprende-4.4.0-Windows-x64-Instalador.exe' -Algorithm SHA256 -ErrorAction Stop).Hash -ne '5b97badca7d1c6c95648df28fa04d14127b4c2c651b201ed3e2d9b6b68247c2b') { exit 1 } } catch { exit 1 }"
if errorlevel 1 goto fallo
 echo.
 echo Listo. Abre este archivo para instalar:
 echo Control-Emprende-4.4.0-Windows-x64-Instalador.exe
 echo.
 echo Esta version usa cuentas y tarjetas de PRUEBA de Mercado Pago.
 echo El instalador aun no tiene firma digital del editor.
 echo La instalacion en Windows necesita validacion.
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

@echo off
setlocal
pushd "%~dp0" || exit /b 1
if exist "Control-Emprende-4.3.1-Windows-x64-Instalador.exe" goto verificar
 echo Preparando el instalador de Control Emprende 4.3.1...
copy /b "sitio\descargas\control-emprende-4.3.1-6c56bcf79825-01.bin"+"sitio\descargas\control-emprende-4.3.1-6c56bcf79825-02.bin"+"sitio\descargas\control-emprende-4.3.1-6c56bcf79825-03.bin"+"sitio\descargas\control-emprende-4.3.1-6c56bcf79825-04.bin"+"sitio\descargas\control-emprende-4.3.1-6c56bcf79825-05.bin"+"sitio\descargas\control-emprende-4.3.1-6c56bcf79825-06.bin"+"sitio\descargas\control-emprende-4.3.1-6c56bcf79825-07.bin" "Control-Emprende-4.3.1-Windows-x64-Instalador.exe.partial" >nul
if errorlevel 1 goto fallo
powershell.exe -NoLogo -NoProfile -Command "try { if ((Get-FileHash -LiteralPath 'Control-Emprende-4.3.1-Windows-x64-Instalador.exe.partial' -Algorithm SHA256 -ErrorAction Stop).Hash -ne '6c56bcf79825e71ecf632cccb8370d18e54b6dbdb627eaaa6ec36996b51fefec') { exit 1 } } catch { exit 1 }"
if errorlevel 1 goto fallo
move /y "Control-Emprende-4.3.1-Windows-x64-Instalador.exe.partial" "Control-Emprende-4.3.1-Windows-x64-Instalador.exe" >nul
if errorlevel 1 goto fallo
:verificar
powershell.exe -NoLogo -NoProfile -Command "try { if ((Get-FileHash -LiteralPath 'Control-Emprende-4.3.1-Windows-x64-Instalador.exe' -Algorithm SHA256 -ErrorAction Stop).Hash -ne '6c56bcf79825e71ecf632cccb8370d18e54b6dbdb627eaaa6ec36996b51fefec') { exit 1 } } catch { exit 1 }"
if errorlevel 1 goto fallo
 echo.
 echo Listo. Abre este archivo para instalar:
 echo Control-Emprende-4.3.1-Windows-x64-Instalador.exe
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

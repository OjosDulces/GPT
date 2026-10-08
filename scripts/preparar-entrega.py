"""Split a completed Windows installer and generate a checksum-verifying helper."""
from pathlib import Path
import hashlib,json,sys
root=Path(__file__).resolve().parent.parent
installer=Path(sys.argv[1]).resolve()
version=json.loads((root/'aplicacion/desktop/package.json').read_text())['version']
name=f'Control-Emprende-{version}-Windows-x64-Instalador.exe'
assert installer.name==name
raw=installer.read_bytes()
assert raw[:2]==b'MZ' and len(raw)>10_000_000
pe=int.from_bytes(raw[60:64],'little');assert raw[pe:pe+4]==b'PE\0\0'
hash=lambda b:hashlib.sha256(b).hexdigest()
digest=hash(raw);out=root/'descargas';out.mkdir(exist_ok=True)
parts=[]
for i,start in enumerate(range(0,len(raw),16*1024*1024),1):
 data=raw[start:start+16*1024*1024];file=f'control-emprende-{version}-{digest[:12]}-{i:02}.bin'
 (out/file).write_bytes(data);parts.append({'file':file,'size_bytes':len(data),'sha256':hash(data)})
manifest={'version':version,'mode':'test','file':name,'size_bytes':len(raw),'sha256':digest,'parts':parts}
(out/'version.json').write_text(json.dumps(manifest,indent=2)+'\n')
for p in out.glob('*.bin'):
 if p.name not in {part['file'] for part in parts}:p.unlink()
joined=b''.join((out/p['file']).read_bytes() for p in parts)
assert joined==raw and hash(joined)==digest
(root/'SHA256SUMS.txt').write_text(digest+'  '+name+'\n')
partargs='+'.join('"descargas\\'+p['file']+'"' for p in parts)
cmd=f'''@echo off
setlocal
pushd "%~dp0" || exit /b 1
if exist "{name}" goto verificar
 echo Preparando Control Emprende {version} - PRUEBAS DE PAGO...
copy /y /b {partargs} "{name}.partial" >nul
if errorlevel 1 goto fallo
powershell.exe -NoLogo -NoProfile -Command "try {{ if ((Get-FileHash -LiteralPath '{name}.partial' -Algorithm SHA256 -ErrorAction Stop).Hash -ne '{digest}') {{ exit 1 }} }} catch {{ exit 1 }}"
if errorlevel 1 goto fallo
move /y "{name}.partial" "{name}" >nul
if errorlevel 1 goto fallo
:verificar
powershell.exe -NoLogo -NoProfile -Command "try {{ if ((Get-FileHash -LiteralPath '{name}' -Algorithm SHA256 -ErrorAction Stop).Hash -ne '{digest}') {{ exit 1 }} }} catch {{ exit 1 }}"
if errorlevel 1 goto fallo
 echo.
 echo Listo. Abre este archivo para instalar:
 echo {name}
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
'''
(root/'PREPARAR-INSTALADOR.cmd').write_bytes(cmd.replace('\n','\r\n').encode('ascii'))
print(json.dumps({'file':name,'size_bytes':len(raw),'sha256':digest,'parts':len(parts),'reassembled_verified':True}))

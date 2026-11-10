@echo off
chcp 65001 >nul
title Los Amigos del Kaffe
cd /d "%~dp0"

if not exist "node_modules" goto :falta_instalar
if not exist "server\dist\index.js" goto :falta_instalar
if not exist "client\dist\index.html" goto :falta_instalar

rem Abre el navegador cuando el servidor ya tuvo tiempo de arrancar.
rem Si cambiaste PORT en .env, entra manualmente a la direccion que aparece abajo.
start "" /b cmd /c "timeout /t 2 /nobreak >nul & start http://localhost:5050"

echo Para cerrar la aplicacion, cierra esta ventana. Tus datos quedan guardados.
call npm start
pause
exit /b 0

:falta_instalar
echo La aplicacion aun no esta instalada. Abre primero instalar.bat.
pause
exit /b 1

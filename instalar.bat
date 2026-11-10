@echo off
chcp 65001 >nul
title Los Amigos del Kaffe - Instalacion
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo No se encontro Node.js. Instala la version LTS desde https://nodejs.org y vuelve a intentarlo.
  pause
  exit /b 1
)

echo Instalando dependencias y compilando la aplicacion...
echo Tus datos no se tocan: viven en la carpeta "data".
call npm run setup
if errorlevel 1 (
  echo.
  echo La instalacion no se pudo completar. Revisa el mensaje de arriba.
  pause
  exit /b 1
)

echo.
echo Listo. Ahora abre iniciar.bat para usar la aplicacion.
pause

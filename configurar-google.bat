@echo off
chcp 65001 >nul
title Los Amigos del Kaffe - Configurar Google Maps
cd /d "%~dp0"

if not exist "node_modules" (
  echo La aplicacion aun no esta instalada. Abre primero instalar.bat.
  pause
  exit /b 1
)

call npm run google:setup
echo.
pause

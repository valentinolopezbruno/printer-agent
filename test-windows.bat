@echo off
echo Iniciando prueba del Print Agent...

:: Crear directorio para logs
mkdir "%USERPROFILE%\AppData\Local\TuttoBenePrintAgent" 2>nul

:: Ejecutar el agente con output visible
echo Iniciando Print Agent...
cd "%~dp0"
dist\print-agent.exe > "%USERPROFILE%\AppData\Local\TuttoBenePrintAgent\output.log" 2>&1

pause 
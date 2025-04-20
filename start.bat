@echo off
echo Iniciando Print Agent...
echo.

cd /d "%~dp0"
echo Directorio actual: %CD%

echo.
echo Iniciando servicio...
print-agent.exe

echo.
echo Si ves este mensaje, el programa se cerró inesperadamente.
echo Presiona cualquier tecla para salir...
pause 
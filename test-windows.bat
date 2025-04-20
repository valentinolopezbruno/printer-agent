@echo off
echo Iniciando prueba del Print Agent...

:: Crear directorio para logs
echo Creando directorio para logs...
mkdir "%USERPROFILE%\AppData\Local\TuttoBenePrintAgent" 2>nul

:: Mostrar directorio actual
echo Directorio actual:
cd
echo.

:: Verificar que existe el ejecutable
echo Verificando ejecutable...
if not exist "dist\print-agent.exe" (
    echo ERROR: No se encuentra dist\print-agent.exe
    echo Asegurate que el archivo existe en la carpeta dist
    pause
    exit /b 1
)

:: Ejecutar el agente directamente en la consola
echo.
echo Iniciando Print Agent...
echo (Esta ventana mostrara los logs en tiempo real)
echo.
dist\print-agent.exe

:: Esta línea solo se ejecutará si el programa termina
echo.
echo El programa ha terminado. Presiona una tecla para salir.
pause 
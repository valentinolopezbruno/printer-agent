@echo off
echo Instalando Agente de Impresion Tutto Bene...

:: Verificar permisos de administrador
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo Este script requiere permisos de administrador.
    echo Por favor, ejecute como administrador.
    pause
    exit /b 1
)

:: Detener el servicio si ya existe
taskkill /F /IM print-agent.exe >nul 2>&1

:: Crear directorio de instalacion
if not exist "C:\Program Files\TuttoBenePrintAgent" mkdir "C:\Program Files\TuttoBenePrintAgent"

:: Copiar archivos
copy /Y "dist\print-agent.exe" "C:\Program Files\TuttoBenePrintAgent\"
if errorlevel 1 (
    echo Error al copiar archivos.
    pause
    exit /b 1
)

:: Agregar al inicio
reg add "HKEY_CURRENT_USER\Software\Microsoft\Windows\CurrentVersion\Run" /v "TuttoBenePrintAgent" /t REG_SZ /d "\"C:\Program Files\TuttoBenePrintAgent\print-agent.exe\"" /f

:: Iniciar el servicio
start "" "C:\Program Files\TuttoBenePrintAgent\print-agent.exe"

echo Instalacion completada exitosamente!
echo El servicio esta corriendo en http://localhost:3001
pause 
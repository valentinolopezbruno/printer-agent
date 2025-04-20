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

:: Configurar variables
set INSTALL_DIR=C:\Program Files\TuttoBenePrintAgent
set LOG_DIR=%LOCALAPPDATA%\TuttoBenePrintAgent

:: Detener servicio existente
echo Deteniendo servicios existentes...
taskkill /F /IM print-agent.exe >nul 2>&1

:: Crear directorios
echo Creando directorios...
mkdir "%INSTALL_DIR%" 2>nul
mkdir "%LOG_DIR%" 2>nul

:: Copiar archivos
echo Copiando archivos...
copy /Y "dist\print-agent.exe" "%INSTALL_DIR%\"
if errorlevel 1 (
    echo Error al copiar archivos.
    pause
    exit /b 1
)

:: Crear archivo bat de inicio
echo @echo off > "%INSTALL_DIR%\start.bat"
echo cd /d "%INSTALL_DIR%" >> "%INSTALL_DIR%\start.bat"
echo start /min print-agent.exe >> "%INSTALL_DIR%\start.bat"

:: Agregar al inicio
echo Configurando inicio automatico...
reg add "HKEY_CURRENT_USER\Software\Microsoft\Windows\CurrentVersion\Run" /v "TuttoBenePrintAgent" /t REG_SZ /d "\"%INSTALL_DIR%\start.bat\"" /f

:: Iniciar el servicio
echo Iniciando el servicio...
cd /d "%INSTALL_DIR%"
start /min print-agent.exe

:: Esperar y verificar
echo Esperando que el servicio inicie...
timeout /t 5 /nobreak > nul

:: Verificar si el servicio está corriendo
netstat -ano | find ":3001" > nul
if errorlevel 1 (
    echo ADVERTENCIA: El servicio no parece estar corriendo
    echo Verificando logs...
    if exist "%LOG_DIR%\print-agent.log" (
        type "%LOG_DIR%\print-agent.log"
    ) else (
        echo No se encontro archivo de log
    )
) else (
    echo Servicio iniciado correctamente
)

echo.
echo Instalacion completada!
echo Para verificar el estado, abra en su navegador:
echo http://localhost:3001/status
echo.
echo Los logs se encuentran en:
echo %LOG_DIR%\print-agent.log
pause
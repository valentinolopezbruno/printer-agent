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
echo Deteniendo servicios existentes...
taskkill /F /IM print-agent.exe >nul 2>&1

:: Crear directorio de instalacion
echo Creando directorio de instalacion...
if not exist "C:\Program Files\TuttoBenePrintAgent" mkdir "C:\Program Files\TuttoBenePrintAgent"

:: Copiar archivos
echo Copiando archivos...
copy /Y "dist\print-agent.exe" "C:\Program Files\TuttoBenePrintAgent\"
if errorlevel 1 (
    echo Error al copiar archivos.
    pause
    exit /b 1
)

:: Agregar al inicio
echo Configurando inicio automatico...
reg add "HKEY_CURRENT_USER\Software\Microsoft\Windows\CurrentVersion\Run" /v "TuttoBenePrintAgent" /t REG_SZ /d "\"C:\Program Files\TuttoBenePrintAgent\print-agent.exe\"" /f

:: Iniciar el servicio
echo Iniciando el servicio...
cd "C:\Program Files\TuttoBenePrintAgent"
start "" "print-agent.exe"

:: Esperar un momento y verificar si el servicio está corriendo
timeout /t 5 /nobreak
netstat -ano | find "3001" > nul
if errorlevel 1 (
    echo ADVERTENCIA: El servicio no parece estar corriendo en el puerto 3001
    echo Verificando el archivo de log...
    if exist "print-agent.log" (
        type "print-agent.log"
    ) else (
        echo No se encontro archivo de log
    )
) else (
    echo Servicio iniciado correctamente
)

echo.
echo Instalacion completada!
echo El servicio deberia estar corriendo en http://localhost:3001
echo Si hay problemas, revisa el archivo de log en:
echo C:\Program Files\TuttoBenePrintAgent\print-agent.log
pause 
@echo off
echo Instalando Agente de Impresion Tutto Bene...

:: Crear directorio de instalacion
mkdir "C:\Program Files\TuttoBenePrintAgent"
copy print-agent.exe "C:\Program Files\TuttoBenePrintAgent\"

:: Agregar al inicio
reg add "HKEY_CURRENT_USER\Software\Microsoft\Windows\CurrentVersion\Run" /v "TuttoBenePrintAgent" /t REG_SZ /d "\"C:\Program Files\TuttoBenePrintAgent\print-agent.exe\"" /f

echo Instalacion completada!
pause 
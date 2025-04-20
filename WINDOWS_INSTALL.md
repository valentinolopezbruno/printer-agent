# Instalación en Windows

## Pasos para instalar el Print Agent

1. Asegúrate de tener la impresora térmica conectada y configurada en Windows
   - La impresora debe estar configurada con el nombre "printer"
   - Verifica que la impresora funcione correctamente desde Windows

2. Ejecuta el archivo `install-windows.bat` como administrador
   - Haz clic derecho en `install-windows.bat`
   - Selecciona "Ejecutar como administrador"
   - Espera a que termine la instalación

3. El agente se iniciará automáticamente
   - Se ejecutará en http://localhost:3001
   - Se iniciará automáticamente cada vez que inicies Windows

## Solución de problemas

Si tienes problemas con la impresión:

1. Verifica que la impresora esté encendida y conectada
2. Revisa los logs en `C:\Program Files\TuttoBenePrintAgent\print-agent.log`
3. Asegúrate de que el puerto 3001 no esté siendo usado por otra aplicación
4. Reinicia el servicio desde el administrador de tareas

Para soporte técnico, contacta a: valentinolopezbruno@gmail.com 
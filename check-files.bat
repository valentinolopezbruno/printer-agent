@echo off
echo === Verificacion de archivos ===
echo.
echo Directorio actual:
cd
echo.
echo Listando archivos en el directorio actual:
dir
echo.
echo Verificando si existe la carpeta dist:
if exist "dist" (
    echo SI - La carpeta dist existe
    echo Contenido de la carpeta dist:
    dir dist
) else (
    echo NO - La carpeta dist no existe
)
echo.
echo Presiona una tecla para salir...
pause 
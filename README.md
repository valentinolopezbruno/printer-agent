# Agente de Impresión Tutto Bene

Agente local de impresión de tickets para Pastas Tutto Bene.

## Requisitos

- Node.js 18 o superior
- Impresora térmica compatible con ESC/POS
- Sistema operativo: Windows o Linux

## Instalación

### Linux

1. Compilar la aplicación:
```bash
npm run build
```

2. Instalar el servicio:
```bash
sudo cp dist/print-agent /opt/print-agent/
sudo cp print-agent.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable print-agent
sudo systemctl start print-agent
```

### Windows

1. Compilar la aplicación:
```bash
npm run build
```

2. Ejecutar el script de instalación:
```bash
install-windows.bat
```

## Uso

La aplicación se ejecuta automáticamente al iniciar el sistema y expone un servidor local en `http://localhost:3001`.

### Endpoint de impresión

- URL: `http://localhost:3001/imprimir`
- Método: POST
- Content-Type: application/json

Ejemplo de JSON:
```json
{
  "cliente": "Juan Pérez",
  "telefono": "123456789",
  "fecha": "2025-04-20",
  "pagado": 1,
  "tipoEntrega": 2,
  "direccion": "Bv. Alvear 470",
  "detalles": [
    {
      "productoRel": { "nombre": "Ravioles" },
      "precioUnitario": 1500,
      "cantidad": 2,
      "variacionesDetalle": [
        { "variacion": { "nombre": "Ricota" } }
      ]
    }
  ]
}
```

## Logs

Los logs se guardan en el archivo `print-agent.log` en el directorio de la aplicación.

## Solución de problemas

1. Verificar que la impresora esté conectada y configurada correctamente
2. Revisar los logs en `print-agent.log`
3. Asegurarse de que el puerto 3001 esté disponible
4. Verificar los permisos de ejecución en Linux 
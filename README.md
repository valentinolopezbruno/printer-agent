# Tutto Bene Print Agent

Local ticket printing agent for Pastas Tutto Bene.

## Requirements

- Node.js 18 or higher
- ESC/POS compatible thermal printer
- Operating System: Windows or Linux

## Installation

### Linux

1. Build the application:
```bash
npm run build
```

2. Install the service:
```bash
sudo cp dist/print-agent /opt/print-agent/
sudo cp print-agent.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable print-agent
sudo systemctl start print-agent
```

### Windows

1. Build the application:
```bash
npm run build
```

2. Run the installation script:
```bash
install-windows.bat
```

## Usage

The application runs automatically on system startup and exposes a local server at `http://localhost:3001`.

### Print Endpoint

- URL: `http://localhost:3001/imprimir`
- Method: POST
- Content-Type: application/json

Example JSON:
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

Logs are saved in the `print-agent.log` file in the application directory.

## Troubleshooting

1. Verify that the printer is connected and configured correctly
2. Check the logs in `print-agent.log`
3. Ensure port 3001 is available
4. Verify execution permissions in Linux

 valentino-lopez - valentinolopezbruno@gmail.com
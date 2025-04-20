#!/usr/bin/env node

const express = require('express');
const { spawn } = require('child_process');
const winston = require('winston');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { ThermalPrinter, PrinterTypes, CharacterSet } = require('node-thermal-printer');

// Reemplazar la dependencia normalize-text con una función propia
function normalizarTexto(texto) {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Eliminar acentos
    .replace(/[áàäâ]/g, 'a')
    .replace(/[éèëê]/g, 'e')
    .replace(/[íìïî]/g, 'i')
    .replace(/[óòöô]/g, 'o')
    .replace(/[úùüû]/g, 'u')
    .replace(/[ñ]/g, 'n');
}

// Configurar ruta de logs en AppData para Windows
const logDirectory = process.platform === 'win32'
  ? path.join(process.env.LOCALAPPDATA || process.env.USERPROFILE, 'TuttoBenePrintAgent')
  : '.';

const logPath = path.join(logDirectory, 'print-agent.log');

// Debug inicial
console.log('=== Print Agent Debug Info ===');
console.log('Directorio actual:', process.cwd());
console.log('Directorio de logs:', logDirectory);
console.log('Archivo de log:', logPath);

// Crear directorio de logs si no existe
try {
  if (!fs.existsSync(logDirectory)) {
    fs.mkdirSync(logDirectory, { recursive: true });
  }
} catch (error) {
  console.error('Error al crear directorio de logs:', error);
  process.exit(1);
}

// Configuración del logger
const logger = winston.createLogger({
  level: 'debug',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ timestamp, level, message }) => {
      return `${timestamp} [${level}]: ${message}`;
    })
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ 
      filename: logPath,
      options: { flags: 'a' }
    })
  ]
});

const app = express();
const port = 3001;

// Middleware
app.use(express.json());

// Ruta de prueba
app.get('/', (req, res) => {
  logger.info('Acceso a ruta principal');
  res.json({ 
    status: 'Print Agent running',
    time: new Date().toISOString(),
    platform: process.platform
  });
});

// Ruta de estado
app.get('/status', (req, res) => {
  logger.info('Verificando estado');
  res.json({
    status: 'running',
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    logs: logPath
  });
});

// Configuración de la impresora
const PRINTER_NAME = 'POS-58(copy of 2)';
const PRINTER_PORT = 'USB001';

// Función para configurar la impresora
async function configurarImpresora(logger) {
    const printer = new ThermalPrinter({
        type: PrinterTypes.EPSON,
        interface: `\\\\localhost\\${PRINTER_NAME}`,
        characterSet: CharacterSet.PC437_USA,
        removeSpecialCharacters: false,
        lineCharacter: "-",
    });

    printer.setTextNormal();
    printer.alignCenter();
    return printer;
}

// Función para generar los comandos de impresión
function generarComandosImpresion(ticket) {
    const commands = [];
    
    // Espacios iniciales
    commands.push(Buffer.from('\n\n\n\n'));
    
    // Inicializar impresora
    commands.push(Buffer.from([0x1B, 0x40])); // Inicializar impresora
    
    // Encabezado
    commands.push(Buffer.from([0x1B, 0x21, 0x30])); // Texto en doble altura y negrita
    commands.push(Buffer.from([0x1B, 0x61, 0x01])); // Centrado
    commands.push(Buffer.from('TUTTO BENE\n'));
    commands.push(Buffer.from([0x1B, 0x21, 0x00])); // Texto normal
    commands.push(Buffer.from('PASTAS ARTESANALES\n\n'));
    commands.push(Buffer.from('Tel: (353) 461-3071\n'));
    commands.push(Buffer.from('Bv. Alvear 470 - Villa Maria\n'));
    commands.push(Buffer.from('Cordoba - Argentina\n\n'));
    
    // Información del pedido
    commands.push(Buffer.from([0x1B, 0x21, 0x08])); // Texto en negrita
    commands.push(Buffer.from('Sin validez fiscal\n'));
    commands.push(Buffer.from([0x1B, 0x21, 0x00])); // Texto normal
    commands.push(Buffer.from(`Fecha: ${ticket.fecha}\n`));
    commands.push(Buffer.from('--------------------------------\n\n'));

    // Datos del cliente
    commands.push(Buffer.from([0x1B, 0x21, 0x08])); // Texto en negrita
    commands.push(Buffer.from('DATOS DEL CLIENTE\n'));
    commands.push(Buffer.from([0x1B, 0x21, 0x00])); // Texto normal
    commands.push(Buffer.from('--------------------------------\n'));
    commands.push(Buffer.from(`Cliente: ${ticket.cliente}\n`));
    commands.push(Buffer.from(`Telefono: ${ticket.telefono}\n`));
    commands.push(Buffer.from(`Estado: ${ticket.pagado === 1 ? 'PAGADO' : 'NO PAGADO'}\n`));
    commands.push(Buffer.from(`Tipo: ${ticket.tipoEntrega === 1 ? 'DOMICILIO' : 'LOCAL'}\n`));
    
    if (ticket.tipoEntrega === 1) {
        commands.push(Buffer.from([0x1B, 0x21, 0x08])); // Texto en negrita
        commands.push(Buffer.from(`Direccion: ${ticket.direccion}\n`));
    }
    commands.push(Buffer.from('\n'));

    // Productos
    commands.push(Buffer.from([0x1B, 0x61, 0x01])); // Centrado
    commands.push(Buffer.from([0x1B, 0x21, 0x08])); // Texto en negrita
    commands.push(Buffer.from('PRODUCTO\n'));
    commands.push(Buffer.from([0x1B, 0x21, 0x00])); // Texto normal
    commands.push(Buffer.from('--------------------------------\n'));

    let total = 0;
    ticket.detalles.forEach(detalle => {
        const subtotal = detalle.precioUnitario * detalle.cantidad;
        total += subtotal;
        const variaciones = detalle.variacionesDetalle
            .map(v => v.variacion.nombre)
            .join(' - ');
        const linea = `${detalle.productoRel.nombre} ${variaciones} x${detalle.cantidad} $${subtotal}\n`;
        commands.push(Buffer.from(linea));
    });

    // Total
    commands.push(Buffer.from('\n--------------------------------\n'));
    commands.push(Buffer.from([0x1B, 0x61, 0x01])); // Centrado
    commands.push(Buffer.from([0x1B, 0x21, 0x10])); // Texto en doble altura
    commands.push(Buffer.from(`TOTAL: $${total}\n`));
    commands.push(Buffer.from([0x1B, 0x21, 0x00])); // Texto normal
    commands.push(Buffer.from('--------------------------------\n\n'));

    // Pie de ticket
    commands.push(Buffer.from([0x1B, 0x61, 0x01])); // Centrado
    commands.push(Buffer.from('Gracias por su compra\n\n'));
    commands.push(Buffer.from('--------------------------------\n'));
    
    // Espacio final y corte
    commands.push(Buffer.from('\n\n\n\n'));
    commands.push(Buffer.from([0x1B, 0x64, 0x05])); // Corte de papel

    return Buffer.concat(commands);
}

// Función para imprimir en Windows
async function imprimirWindows(ticket, logger) {
    const tempFile = path.join(os.tmpdir(), `ticket-${Date.now()}.bin`);
    const printerName = 'POS-58(copy of 2)';
    
    try {
        // Generar y guardar los comandos en un archivo temporal
        const comandos = generarComandosImpresion(ticket);
        fs.writeFileSync(tempFile, comandos);
        logger.info(`Archivo temporal creado en: ${tempFile}`);
        
        // Intentar imprimir usando el puerto directamente
        const comando = `copy /b "${tempFile}" "${printerName}"`;
        logger.info(`Ejecutando comando: ${comando}`);
        
        await new Promise((resolve, reject) => {
            const printProcess = spawn('cmd', ['/c', comando], {
                windowsHide: true
            });
            
            printProcess.stdout?.on('data', (data) => {
                logger.info(`Salida: ${data}`);
            });

            printProcess.stderr?.on('data', (data) => {
                logger.error(`Error: ${data}`);
            });
            
            printProcess.on('error', (error) => {
                logger.error(`Error al ejecutar comando: ${error.message}`);
                reject(error);
            });
            
            printProcess.on('close', (code) => {
                if (code === 0) {
                    logger.info('Comando ejecutado exitosamente');
                    resolve();
                } else {
                    const error = `Comando falló con código: ${code}`;
                    logger.error(error);
                    reject(new Error(error));
                }
            });
        });
        
        logger.info('Impresión enviada exitosamente');
        return true;
    } catch (error) {
        logger.error(`Error en imprimirWindows: ${error.message}`);
        throw error;
    } finally {
        // Limpiar archivo temporal
        try {
            fs.unlinkSync(tempFile);
            logger.info('Archivo temporal eliminado');
        } catch (error) {
            logger.warn(`No se pudo eliminar archivo temporal: ${error.message}`);
        }
    }
}

// Endpoint para imprimir
app.post('/imprimir', async (req, res) => {
    try {
        const ticket = req.body;
        logger.info('Recibido nuevo ticket para imprimir');
        logger.info(`Datos del ticket: ${JSON.stringify(ticket)}`);

        await imprimirWindows(ticket, logger);
        res.status(200).json({ mensaje: 'Ticket impreso exitosamente' });
    } catch (error) {
        logger.error(`Error: ${error.message}`);
        logger.error(error.stack);
        res.status(500).json({ error: error.message });
    }
});

// Iniciar servidor
const server = app.listen(port, '0.0.0.0', () => {
  logger.info(`Servidor iniciado en http://localhost:${port}`);
  console.log(`Servidor iniciado en http://localhost:${port}`);
})
.on('error', (error) => {
  logger.error(`Error al iniciar el servidor: ${error.message}`);
  console.error(`Error al iniciar el servidor: ${error.message}`);
  if (error.code === 'EADDRINUSE') {
    logger.error(`El puerto ${port} está en uso. Verificar si el servicio ya está corriendo.`);
  }
  process.exit(1);
});

// Manejo de errores
process.on('uncaughtException', (error) => {
  logger.error(`Error no capturado: ${error.message}`);
  logger.error(error.stack);
  console.error('Error no capturado:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Promesa rechazada no manejada:', reason);
  console.error('Promesa rechazada no manejada:', reason);
});

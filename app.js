#!/usr/bin/env node

const express = require('express');
const { spawn } = require('child_process');
const winston = require('winston');
const path = require('path');
const fs = require('fs');
const os = require('os');

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

// Función para generar el comando ESC/POS
function generarComandoEscPos(ticket) {
  const lineas = [];
  
  // Espacios iniciales
  lineas.push('\n\n\n\n');
  
  // Inicializar impresora
  lineas.push('\x1B\x40'); // Inicializar impresora
  
  // Encabezado
  lineas.push('\x1B\x21\x30'); // Texto en doble altura y negrita
  lineas.push('\x1B\x61\x01'); // Centrado
  lineas.push('TUTTO BENE\n');
  lineas.push('\x1B\x21\x00'); // Texto normal
  lineas.push('PASTAS ARTESANALES\n\n');
  lineas.push('Tel: (353) 461-3071\n');
  lineas.push('Bv. Alvear 470 - Villa Maria\n');
  lineas.push('Cordoba - Argentina\n\n');
  
  // Información del pedido
  lineas.push('\x1B\x21\x08'); // Texto en negrita
  lineas.push('Sin validez fiscal\n');
  lineas.push('\x1B\x21\x00'); // Texto normal
  lineas.push(`Fecha: ${ticket.fecha}\n`);
  lineas.push('--------------------------------\n\n');

  // Datos del cliente
  lineas.push('\x1B\x21\x08'); // Texto en negrita
  lineas.push('DATOS DEL CLIENTE\n');
  lineas.push('\x1B\x21\x00'); // Texto normal
  lineas.push('--------------------------------\n');
  lineas.push(`Cliente: ${normalizarTexto(ticket.cliente)}\n`);
  lineas.push(`Telefono: ${ticket.telefono}\n`);
  lineas.push(`Estado: ${ticket.pagado === 1 ? 'PAGADO' : 'NO PAGADO'}\n`);
  lineas.push(`Tipo: ${ticket.tipoEntrega === 1 ? 'DOMICILIO' : 'LOCAL'}\n`);
  
  if (ticket.tipoEntrega === 1) {
    lineas.push('\x1B\x21\x08'); // Texto en negrita
    lineas.push(`Direccion: ${normalizarTexto(ticket.direccion)}\n`);
  }
  lineas.push('\n');

  // Productos
  lineas.push('\x1B\x61\x01'); // Centrado
  lineas.push('\x1B\x21\x08'); // Texto en negrita
  lineas.push('PRODUCTO\n');
  lineas.push('\x1B\x21\x00'); // Texto normal
  lineas.push('--------------------------------\n');

  let total = 0;
  ticket.detalles.forEach(detalle => {
    const subtotal = detalle.precioUnitario * detalle.cantidad;
    total += subtotal;
    const variaciones = detalle.variacionesDetalle
      .map(v => normalizarTexto(v.variacion.nombre))
      .join(' - ');
    const linea = `${normalizarTexto(detalle.productoRel.nombre)} ${variaciones} x${detalle.cantidad} $${subtotal}\n`;
    lineas.push(linea);
  });

  // Total
  lineas.push('\n--------------------------------\n');
  lineas.push('\x1B\x61\x01'); // Centrado
  lineas.push('\x1B\x21\x10'); // Texto en doble altura
  lineas.push(`TOTAL: $${total}\n`);
  lineas.push('\x1B\x21\x00'); // Texto normal
  lineas.push('--------------------------------\n\n');

  // Pie de ticket
  lineas.push('\x1B\x61\x01'); // Centrado
  lineas.push('Gracias por su compra\n\n');
  lineas.push('--------------------------------\n');
  
  // Espacio final y corte
  lineas.push('\n\n\n\n');
  lineas.push('\x1B\x64\x05'); // Corte de papel
  
  return lineas.join('');
}

// Función para imprimir en Windows
async function imprimirWindows(comandoEscPos, logger) {
    const tempFile = path.join(os.tmpdir(), `ticket-${Date.now()}.txt`);
    
    try {
        // Guardar el contenido en un archivo temporal
        fs.writeFileSync(tempFile, comandoEscPos);
        logger.info(`Archivo temporal creado en: ${tempFile}`);
        
        // Intentar imprimir usando el nombre específico de la impresora
        try {
            logger.info(`Intentando imprimir en ${PRINTER_NAME} usando comando 'print'`);
            await new Promise((resolve, reject) => {
                const printProcess = spawn('cmd', ['/c', `type "${tempFile}" > "${PRINTER_NAME}"`]);
                
                printProcess.stdout?.on('data', (data) => {
                    logger.info(`Salida del proceso: ${data}`);
                });

                printProcess.stderr?.on('data', (data) => {
                    logger.error(`Error del proceso: ${data}`);
                });
                
                printProcess.on('error', (error) => {
                    logger.error(`Error al ejecutar el comando: ${error.message}`);
                    reject(error);
                });
                
                printProcess.on('close', (code) => {
                    if (code === 0) {
                        logger.info('Comando de impresión ejecutado exitosamente');
                        resolve();
                    } else {
                        logger.error(`Comando falló con código: ${code}`);
                        reject(new Error(`Código de salida: ${code}`));
                    }
                });
            });
            
            logger.info(`Impresión enviada exitosamente a ${PRINTER_NAME}`);
            return true;
        } catch (error) {
            logger.error(`Error al imprimir: ${error.message}`);
            throw error;
        }
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
        
        const comandoEscPos = generarComandoEscPos(ticket);
        
        if (process.platform === 'win32') {
            await imprimirWindows(comandoEscPos, logger);
            res.status(200).json({ mensaje: 'Ticket impreso exitosamente' });
        } else {
            // Código existente para Linux
            const printProcess = spawn('lp', ['-d', 'printer', '-']);
            printProcess.stdin.write(comandoEscPos);
            printProcess.stdin.end();
            
            printProcess.on('error', (error) => {
                logger.error(`Error al ejecutar el proceso de impresión: ${error.message}`);
                res.status(500).json({ error: error.message });
            });
            
            printProcess.on('close', (code) => {
                if (code === 0) {
                    logger.info('Ticket impreso exitosamente');
                    res.status(200).json({ mensaje: 'Ticket impreso exitosamente' });
                } else {
                    logger.error(`Error al imprimir: código ${code}`);
                    res.status(500).json({ error: `Error al imprimir el ticket (código ${code})` });
                }
            });
        }
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

#!/usr/bin/env node

const express = require('express');
const { spawn } = require('child_process');
const winston = require('winston');
const { normalize } = require('normalize-text');
const path = require('path');
const fs = require('fs');

// Configurar ruta de logs en AppData para Windows
const logDirectory = process.platform === 'win32'
  ? path.join(process.env.LOCALAPPDATA || process.env.USERPROFILE, 'TuttoBenePrintAgent')
  : '.';

const logPath = path.join(logDirectory, 'print-agent.log');

// Crear directorio de logs si no existe
try {
  if (!fs.existsSync(logDirectory)) {
    fs.mkdirSync(logDirectory, { recursive: true });
  }
  // Escribir un archivo de prueba para verificar permisos
  fs.writeFileSync(path.join(logDirectory, 'test.txt'), 'test');
  fs.unlinkSync(path.join(logDirectory, 'test.txt'));
} catch (error) {
  console.error('Error al crear directorio de logs:', error);
  process.exit(1);
}

// Escribir directamente al archivo de log para debug inicial
fs.writeFileSync(logPath, `=== Print Agent Started at ${new Date().toISOString()} ===\n`);

// Configuración del logger
const logger = winston.createLogger({
  level: 'debug', // Cambiar a debug para más información
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

// Log información inicial
process.stdout.write('Iniciando Print Agent...\n');
logger.info('=== Información del sistema ===');
logger.info(`Sistema operativo: ${process.platform}`);
logger.info(`Directorio actual: ${process.cwd()}`);
logger.info(`Archivo de log: ${logPath}`);
logger.info(`Versión de Node: ${process.version}`);
logger.info(`Memoria disponible: ${Math.round(process.memoryUsage().heapTotal / 1024 / 1024)}MB`);

const app = express();
const port = 3001;

// Middleware básico
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

// Función para normalizar texto
function normalizarTexto(texto) {
  return normalize(texto)
    .replace(/[áàäâ]/g, 'a')
    .replace(/[éèëê]/g, 'e')
    .replace(/[íìïî]/g, 'i')
    .replace(/[óòöô]/g, 'o')
    .replace(/[úùüû]/g, 'u')
    .replace(/[ñ]/g, 'n');
}

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
  
  // Si es un pedido a domicilio, mostrar la dirección
  if (ticket.tipoEntrega === 1) {
    lineas.push('\x1B\x21\x08'); // Texto en negrita
    lineas.push(`Direccion: ${normalizarTexto(ticket.direccion)}\n`);
  }
  lineas.push('\n');

  // Encabezados de columnas
  lineas.push('\x1B\x61\x01'); // Centrado
  lineas.push('\x1B\x21\x08'); // Texto en negrita
  lineas.push('PRODUCTO\n');
  lineas.push('\x1B\x21\x00'); // Texto normal
  lineas.push('--------------------------------\n');

  // Productos
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
  lineas.push('--------------------------------\n');
  lineas.push('\x1B\x21\x08'); // Texto en negrita
  lineas.push('Gracias por su compra\n\n');
  lineas.push('--------------------------------\n');
  
  // Espacio final y corte
  lineas.push('\n\n\n\n');
  lineas.push('\x1B\x64\x05'); // Corte de papel
  
  return lineas.join('');
}

// Endpoint para imprimir
app.post('/imprimir', async (req, res) => {
  try {
    const ticket = req.body;
    logger.info('Recibido nuevo ticket para imprimir');
    
    // Generar comando ESC/POS
    const comandoEscPos = generarComandoEscPos(ticket);
    
    // Enviar a la impresora usando lp
    const lp = spawn('lp', ['-d', 'printer', '-']);
    
    lp.stdin.write(comandoEscPos);
    lp.stdin.end();
    
    lp.on('close', (code) => {
      if (code === 0) {
        logger.info('Ticket impreso exitosamente');
        res.status(200).json({ mensaje: 'Ticket impreso exitosamente' });
      } else {
        logger.error(`Error al imprimir: código ${code}`);
        res.status(500).json({ error: 'Error al imprimir el ticket' });
      }
    });
    
  } catch (error) {
    logger.error(`Error: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// Mejorar el inicio del servidor
const server = app.listen(port, '0.0.0.0', () => {
  const mensaje = `Servidor iniciado en http://localhost:${port}`;
  logger.info(mensaje);
  process.stdout.write(mensaje + '\n');
})
.on('error', (error) => {
  const errorMsg = `Error al iniciar el servidor: ${error.message}`;
  logger.error(errorMsg);
  process.stdout.write(errorMsg + '\n');
  if (error.code === 'EADDRINUSE') {
    logger.error(`El puerto ${port} está en uso. Verificar si el servicio ya está corriendo.`);
  }
  process.exit(1);
});

// Manejo de errores mejorado
process.on('uncaughtException', (error) => {
  const errorMsg = `Error no capturado: ${error.message}\n${error.stack}`;
  logger.error(errorMsg);
  process.stdout.write(errorMsg + '\n');
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  const errorMsg = `Promesa rechazada no manejada: ${reason}`;
  logger.error(errorMsg);
  process.stdout.write(errorMsg + '\n');
});

// Mantener el proceso vivo
process.stdin.resume();

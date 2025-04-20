#!/usr/bin/env node

const express = require('express');
const { spawn } = require('child_process');
const winston = require('winston');
const { normalize } = require('normalize-text');

// Configuración del logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ timestamp, level, message }) => {
      return `${timestamp} [${level}]: ${message}`;
    })
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'print-agent.log' })
  ]
});

const app = express();
const port = 3001;

// Middleware para parsear JSON
app.use(express.json());

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

// Iniciar servidor
app.listen(port, () => {
  logger.info(`Servidor iniciado en http://localhost:${port}`);
});

// Manejar errores no capturados
process.on('uncaughtException', (error) => {
  logger.error(`Error no capturado: ${error.message}`);
  process.exit(1);
});

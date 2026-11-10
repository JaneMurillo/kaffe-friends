import os from 'node:os';
import { createApp } from './app.js';
import { config } from './config.js';
import { closeDatabase, openDatabase } from './db/connection.js';

const LOCAL_ONLY = ['127.0.0.1', 'localhost', '::1'].includes(config.host);

// Sin contraseña, cualquiera en la misma red podría leer y borrar tus datos.
if (!LOCAL_ONLY && !config.accessPassword) {
  console.error(`HOST=${config.host} abre la aplicación a otros dispositivos. Define APP_PASSWORD en el archivo .env para continuar.`);
  process.exit(1);
}

openDatabase();

function networkAddresses(): string[] {
  return Object.values(os.networkInterfaces())
    .flat()
    .filter((net) => net && net.family === 'IPv4' && !net.internal)
    .map((net) => net!.address);
}

const server = createApp().listen(config.port, config.host, () => {
  const host = config.host === '127.0.0.1' ? 'localhost' : config.host;
  console.log('\n  Los Amigos del Kaffe · Un café a la vez');
  console.log(`  Abre en tu navegador: http://${host === '0.0.0.0' ? 'localhost' : host}:${config.port}`);
  if (!LOCAL_ONLY) {
    for (const address of networkAddresses()) console.log(`  Desde tu teléfono (misma red Wi-Fi): http://${address}:${config.port}`);
  }
  console.log('');
});

server.on('error', (error: NodeJS.ErrnoException) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`El puerto ${config.port} ya está en uso. ¿La aplicación ya está abierta en otra ventana?`);
  } else {
    console.error(error);
  }
  closeDatabase();
  process.exit(1);
});

function shutdown() {
  server.close(() => {
    closeDatabase();
    process.exit(0);
  });
  server.closeAllConnections();
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

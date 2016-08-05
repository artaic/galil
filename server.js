import { Server } from 'net';
import Galil from './dist/galil';

const galil = new Galil();
const server = new Server();
const connections = new Set();

server.on('listening', function () {
  const { port, address } = server.address();
  const host = address === '::' ? 'localhost' : address;

  console.log(`Accepting connections on http://${host}:${port}/`);
  console.log('Attempting to create a new connection...');

  galil.once('connect', () => {
    console.info('Galil successfully connected.')
  }).connect(port, host);
}).on('connection', function (socket) {
  console.log(`Received new connection ${socket.remoteAddress}`);
}).listen(5000);

process.on('exit', function () {
  server.close();
}).on('SIGINT', function () {
  console.log('Closing server');
  process.exit();
});

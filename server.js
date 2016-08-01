import { Server } from 'net';

const server = new Server();
const connections = new Set();

function closeConnection (socket, timeout=5000) {
  socket.once('close', () => {
    console.info('Closing socket!');
  });

  setTimeout(() => {
    socket.end();
    socket.destroy();
  }, timeout);
}

server.on('listening', function () {
  const { port, address } = server.address();
  const host = address === '::' ? 'localhost' : address;
  console.log(`Accepting connections on http://${host}:${port}/`);
}).on('connection', function (socket) {
  console.log(`Received new connection ${socket.remoteAddress}`);
  connections.add(socket);
  socket.write(':\r\n');
  closeConnection(socket);
}).listen(5000);

process.on('exit', function () {
  server.close();
}).on('SIGINT', function () {
  console.log('Closing server');
  process.exit();
});

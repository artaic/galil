/**
 * Mock server for galil.
 * Probably no real use in production
 */
const Server = Npm.require('net').Server;

GalilServer = class GalilServer extends Server {
  constructor() {
    super(...arguments);
    this._clients = new Set();

    this.on('connection', Meteor.bindEnvironment(client => {
      console.log(`Connected: ${client.remoteAddress}:${client.remotePort}`);
      this._clients.add(client);
      let message = /^MG\s*(\w+)$/;

      client.on('data', Meteor.bindEnvironment(data => {
        client.write(':\r\n');
        let mg = message.exec(data);
        if (mg) {
          client.write(`${mg[1]}\r\n`);
        }
      }));
    }));

    this.on('close', Meteor.bindEnvironment(() => {
      this._clients.forEach(client => client.destroy());
    }));
  }
  broadcast(message) {
    this._clients.forEach(client => client.write(`${message}\r\n`));
  }
  get clients() {
    return this._clients;
  }
}

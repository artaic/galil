/**
 * Mock server for galil.
 * Probably no real use in production
 */
const fs = Npm.require('fs');
const util = Npm.require('util');
const Server = Npm.require('net').Server;
const Future = Npm.require('fibers/future');

const wait = function () {
  let f = new Future();
  let timeoutId = Meteor.setTimeout(f.return.bind(f), milliseconds);
  f.resolve(() => Meteor.clearTimeout(timeoutId));
  return future;
}.future();

GalilServer = class GalilServer extends Server {
  constructor() {
    super(...arguments);
    this._clients = new Set();
    this._routines = new Map();

    this.on('connection', Meteor.bindEnvironment(client => {
      console.log(`Connected: ${client.remoteAddress}:${client.remotePort}`);
      this._clients.add(client);
      client.on('data', Meteor.bindEnvironment(data => {
        Promise.await(data.toString('ascii').split(/(?:\r\n|\;)+/).filter(Boolean).reduce((p, message) => {
          const subroutine = /^XQ\s*#(\w+)\s*$/.exec(data);
          console.log(subroutine);
          if (subroutine) {
            return p.then(() => {
              client.write(':\r\n');
              return this.execute(subroutine[1]);
            });
          } else {
            return p.then(() => client.write(':\r\n'));
          }
        }, Promise.resolve()));
      }));

      client.on('close', Meteor.bindEnvironment(() => {
        this._clients.remove(client);
      }));
    }));

    this.on('close', Meteor.bindEnvironment(() => {
      this._clients.forEach(client => client.destroy());
    }));
  }
  execute(subroutine) {
    console.log(subroutine);
    return this._routines.get(subroutine).reduce((promise, command) => {
      console.log(command);
      return promise.then(() => {
        return new Promise((resolve, reject) => {
          let wt = /(?:WT|wt|wT|Wt)\s*(\d+)\s*/.exec(command);
          let mg = /^(?:MG|mg|Mg|mG)\s*(?:\"\'?)(\w+)(?:\"\'?)\s*$/.exec(command);
          if (wt) {
            console.log('Should wait now')
            Meteor.setTimeout(resolve, parseInt(wt[1], 10));
          } else if (mg) {
            Galil._messages.write(`${mg[1]}\r\n`);
          } else {
            Promise.resolve();
          }
        });
      });
    }, Promise.resolve());
  }
  broadcast(message) {
    this._clients.forEach(client => client.write(`${message}\r\n`));
  }
  get clients() {
    return this._clients;
  }
  load(subroutine, commands) {
    check(subroutine, String);
    check(commands, [String]);
    this._routines.set(subroutine, commands);
  }
}

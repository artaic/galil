import {Meteor} from 'meteor/meteor';
import {EventEmitter} from 'events';

/**
 * Emit `complete` when you want to end the operation
 */
export class AsyncOperation extends EventEmitter {
  constructor(galil, subroutine, timeout=60000) {
    super(...arguments);
    this._galil = galil;
    this._subroutine = subroutine;
    this._timeout = timeout;

    const onUnsolicitedMessage = Meteor.bindEnvironment(data => {
      data.split(/\r\n/).forEach(line => {
        try {
          const parsed = EJSON.parse(line);
          Object.keys(parsed).forEach(key => {
            this.emit(...[key].concat(parsed[key]))
          });
        } catch(e) {
          this.emit('message', line)
        }
      });
    });

    galil.messages.on('data', onUnsolicitedMessage);
    this.once('complete', Meteor.bindEnvironment(data => {
      galil.messages.removeListener('data', onUnsolicitedMessage);
    })).on('End', Meteor.bindEnvironment(subroutine => {
      if (subroutine === this._subroutine) {
        this.emit('complete', false);
      }
    })).on('error', Meteor.bindEnvironment(err => {
      // errors technically count as completions.
      this.emit('complete', err);
    }));
  }
  start() {
    let timeoutId;
    return new Promise((resolve, reject) => {
      timeoutId = Meteor.setTimeout(() => reject(new Meteor.Error(408, "Timeout exceeded")), this._timeout);
      this.once('complete', resolve).once('error', reject);
      this._galil.commands.send(`XQ#${subroutine}`);
    }).finally(() => {
      Meteor.clearTimeout(timeoutId);
    });
  }
  async run() {
    await this.start();
  }
}

export default AsyncOperation;

import { Socket } from 'dgram';

export default class InterruptListener extends Socket {
  constructor() {
    super(...arguments);
  }
}

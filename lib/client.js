Galil = class GalilClient extends GalilBase {
  constructor() {
    super(...arguments);
  }

  get status() {
    return this.Connections.find({ device: this._id }).map(conn => conn.connection);
  }
}

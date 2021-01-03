/* eslint-disable max-classes-per-file */

const PythonInterop = require('./pyinterop');

const core = new PythonInterop();

class Dispatcher {
  #dispatch = async (root, path, ...args) => core.exec(`${root.map(item => `${item}:`).join('')}${path}`, ...args);

  static get = (obj, ...root) => (...args) => obj.#dispatch(root, ...args);
}

class YouTube extends Dispatcher {
  #dispatcher = Dispatcher.get(this, 'youtube');

  lookup = id => this.#dispatcher('lookup', id);
}

class YouTubeMusic extends Dispatcher {
  #dispatcher = Dispatcher.get(this, 'ytmusic');

  search = query => this.#dispatcher('search', query);
}

module.exports = {YouTube, YouTubeMusic};

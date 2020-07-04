/* eslint-disable consistent-return */
const {sortBy} = require('lodash');

const symbols = require('./symbols');
const {YouTube, YouTubeMusic} = require('./services/youtube');
const Deezer = require('./services/deezer');
const Spotify = require('./services/spotify');
const AppleMusic = require('./services/apple_music');

class FreyrCore {
  static ENGINES = [Deezer, Spotify, AppleMusic, YouTube, YouTubeMusic];

  static getBitrates() {
    return Array.from(
      new Set(this.ENGINES.reduce((stack, engine) => stack.concat(engine[symbols.meta].BITRATES || []), [])),
    ).sort((a, b) => (typeof a === 'string' || a > b ? 1 : -1));
  }

  static getEngineMetas(ops) {
    return this.ENGINES.map(engine => (ops || (v => v))(engine[symbols.meta]));
  }

  static identifyService(content) {
    return this.ENGINES.find(engine =>
      engine[symbols.meta].PROPS.isQueryable ? content.match(engine[symbols.meta].VALID_URL) : undefined,
    );
  }

  static collateSources() {
    return this.ENGINES.filter(engine => engine[symbols.meta].PROPS.isSourceable);
  }

  static sortSources(order) {
    order = order ? (Array.isArray(order) ? order : [order]) : [];
    return sortBy(this.collateSources(), source =>
      (index => (index < 0 ? Infinity : index))(order.indexOf(source[symbols.meta].ID)),
    );
  }

  static urify(url) {
    const service = this.identifyService(url);
    if (!service) return null;
    return service.prototype.parseURI.call(service.prototype, url).uri;
  }

  constructor(ServiceConfig, AuthServer, serverOpts) {
    ServiceConfig = ServiceConfig || {};
    this.ENGINES = FreyrCore.ENGINES.map(Engine => new Engine(ServiceConfig[Engine[symbols.meta].ID], AuthServer, serverOpts));
  }

  identifyService = FreyrCore.identifyService;

  collateSources = FreyrCore.collateSources;

  sortSources = FreyrCore.sortSources;
}

module.exports = FreyrCore;

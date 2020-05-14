/* eslint-disable consistent-return */
const {sortBy} = require('lodash');
const Promise = require('bluebird');

const symbols = require('./symbols');
const YouTube = require('./services/youtube');
const Deezer = require('./services/deezer');
const Spotify = require('./services/spotify');
const AppleMusic = require('./services/apple_music');

class FreyrCore {
  static ENGINES = [Deezer, Spotify, AppleMusic, YouTube];

  static getBitrates() {
    return Array.from(
      new Set(this.ENGINES.reduce((stack, engine) => stack.concat(engine[symbols.meta].BITRATES || []), [])),
    ).sort((a, b) => (typeof a === 'string' || a > b ? 1 : -1));
  }

  static getEngineMetas(ops) {
    return this.ENGINES.map(engine => (ops || (v => v))(engine[symbols.meta]));
  }

  constructor(ServiceConfig, AuthServer, serverOpts) {
    ServiceConfig = ServiceConfig || {};
    this.engines = FreyrCore.ENGINES.map(Engine => new Engine(ServiceConfig[Engine[symbols.meta].ID], AuthServer, serverOpts));
  }

  identifyService(content) {
    return this.engines.find(engine => (engine[symbols.meta].PROPS.isQueryable ? content.match(engine.VALID_URL) : undefined));
  }

  collateSources() {
    return this.engines.filter(engine => engine[symbols.meta].PROPS.isSourceable);
  }

  sortSources(order) {
    order = order ? (Array.isArray(order) ? order : [order]) : [];
    return sortBy(this.collateSources(), source =>
      (index => (index < 0 ? Infinity : index))(order.indexOf(source[symbols.meta].ID)),
    );
  }
}

module.exports = FreyrCore;

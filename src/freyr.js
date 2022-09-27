/* eslint-disable consistent-return */
import _sortBy from 'lodash.sortby';

import symbols from './symbols.js';
import {YouTube, YouTubeMusic} from './services/youtube.js';
import Deezer from './services/deezer.js';
import Spotify from './services/spotify.js';
import AppleMusic from './services/apple_music.js';
import MusicBrainz from './services/musicbrainz.js';

export default class FreyrCore {
  static ENGINES = [Deezer, Spotify, AppleMusic, YouTube, YouTubeMusic, MusicBrainz];

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

  static sortSources(includeOrder, exclude) {
    includeOrder = includeOrder ? (Array.isArray(includeOrder) ? includeOrder : [includeOrder]) : [];
    return _sortBy(this.collateSources(), source =>
      (index => (index < 0 ? Infinity : index))(includeOrder.indexOf(source[symbols.meta].ID)),
    ).filter(source => !~exclude.indexOf(source[symbols.meta].ID));
  }

  static parseURI(url) {
    const service = this.identifyService(url);
    if (!service) return null;
    return service.prototype.parseURI.call(service.prototype, url);
  }

  constructor(ServiceConfig, AuthServer, serverOpts) {
    ServiceConfig = ServiceConfig || {};
    this.ENGINES = FreyrCore.ENGINES.map(Engine => new Engine(ServiceConfig[Engine[symbols.meta].ID], AuthServer, serverOpts));
  }

  identifyService = FreyrCore.identifyService;

  collateSources = FreyrCore.collateSources;

  sortSources = FreyrCore.sortSources;
}

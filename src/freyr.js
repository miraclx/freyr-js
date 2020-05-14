/* eslint-disable consistent-return */
const util = require('util');

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

  static getDownloaders() {
    return this.ENGINES.reduce((stack, engine) => {
      const meta = engine[symbols.meta];
      if (meta.PROPS.isSourceable) stack.push(meta.ID);
      return stack;
    }, []);
  }

  constructor(ServiceConfig, AuthServer, serverOpts) {
    ServiceConfig = ServiceConfig || {};
    this.engines = FreyrCore.ENGINES.map(Engine => new Engine(ServiceConfig[Engine[symbols.meta].ID], AuthServer, serverOpts));
  }

  identifyService(content) {
    return this.engines.find(engine => content.match(engine.VALID_URL));
  }

  async getYoutubeSource(metaInfo) {
    return this.youtube.get(metaInfo.artists, metaInfo.name.replace(/\s*\((((feat|ft).)|with).+\)/, ''), metaInfo.duration);
  }

  async getYoutubeStream(ytInfo) {
    const data = await Promise.resolve(
      this.ytdlGet(ytInfo.videoId, ['--socket-timeout=20', '--retries=20', '--no-cache-dir']),
    ).reflect();
    return data.isFulfilled()
      ? {id: data.value().id, formats: data.value().formats.filter(format => format.acodec !== 'none')}
      : {err: data.reason()};
  }
}

module.exports = FreyrCore;

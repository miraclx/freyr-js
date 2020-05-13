/* eslint-disable consistent-return */
const util = require('util');

const Promise = require('bluebird');

const YouTube = require('./services/youtube');
const Deezer = require('./services/deezer');
const Spotify = require('./services/spotify');
const AppleMusic = require('./services/apple_music');

class FreyrCore {
  constructor(ServiceConfig, AuthServer, serverOpts) {
    ServiceConfig = ServiceConfig || {};
    this.youtube = new YouTube();
    this.engines = [
      new Deezer(ServiceConfig.deezer, AuthServer, serverOpts),
      new Spotify(ServiceConfig.spotify, AuthServer, serverOpts),
      new AppleMusic(ServiceConfig.apple_music, AuthServer, serverOpts),
    ];
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

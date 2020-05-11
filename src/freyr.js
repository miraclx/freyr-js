/* eslint-disable consistent-return */
const util = require('util');

const Conf = require('conf');
const Promise = require('bluebird');
const youtubedl = require('youtube-dl');

const YouTube = require('./youtube');
const Deezer = require('./services/deezer');
const Spotify = require('./services/spotify');
const AppleMusic = require('./services/apple_music');

class FreyrCore {
  constructor(ServiceConfig, AuthServer, serverOpts) {
    ServiceConfig = ServiceConfig || {};
    this.youtube = new YouTube();
    this.ytdlGet = util.promisify(youtubedl.getInfo);
    this.engines = [
      new Deezer(ServiceConfig.deezer, AuthServer, serverOpts),
      new Spotify(ServiceConfig.spotify, AuthServer, serverOpts),
      new AppleMusic(ServiceConfig.apple_music, AuthServer, serverOpts),
    ];
  }

  async init() {
    await this.loadConfig();
  }

  async loadConfig() {
    this.config = new Conf({
      projectName: 'FreyrCLI',
      projectSuffix: '',
      configName: 'd3fault',
      fileExtension: 'enc',
      schema: {
        services: {
          type: 'object',
          additionalProperties: false,
          default: {
            spotify: {},
          },
          properties: {
            spotify: {
              type: 'object',
              additionalProperties: false,
              properties: {
                expiry: {type: 'integer'},
                access_token: {type: 'string'},
                refresh_token: {type: 'string'},
              },
            },
          },
        },
      },
    });
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

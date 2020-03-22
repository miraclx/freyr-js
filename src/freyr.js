/* eslint-disable consistent-return */
const util = require('util');

const Conf = require('conf');
const crypto = require('crypto');
const keytar = require('keytar');
const Promise = require('bluebird');
const youtubedl = require('youtube-dl');

const YouTube = require('./youtube');
const Deezer = require('./services/deezer');
const Spotify = require('./services/spotify');
const AppleMusic = require('./services/apple_music');

class FreyrCore {
  constructor(ServiceConfig, AuthServer) {
    this.youtube = new YouTube();
    this.ytdlGet = util.promisify(youtubedl.getInfo);
    this.engines = [
      new Deezer(ServiceConfig.deezer, AuthServer),
      new Spotify(ServiceConfig.spotify, AuthServer),
      new AppleMusic(ServiceConfig.apple_music, AuthServer),
    ];
  }

  async init() {
    this.isFirstRun = (await keytar.findCredentials('FreyrCLI')).length === 0;
    await this.loadConfig();
  }

  async getEncryptionKey() {
    return (this.key =
      this.key && this.key.length === 64
        ? this.key
        : (await keytar.getPassword('FreyrCLI', 'd3fault')) ||
          (k => (keytar.setPassword('FreyrCLI', 'd3fault', k), k))(crypto.randomBytes(32).toString('hex')));
  }

  async loadConfig() {
    this.config = new Conf({
      projectName: 'FreyrCLI',
      projectSuffix: '',
      configName: 'd3fault',
      fileExtension: 'enc',
      encryptionKey: await this.getEncryptionKey(),
      schema: {
        settings: {
          type: 'object',
          default: {format: 'm4a', bitrate: '320kbps', save_dir: './Music', export_list_file: true},
          additionalProperties: false,
          properties: {
            format: {type: 'string', pattern: '^(m4a|mp4)$'},
            bitrate: {type: 'string', pattern: '(\\d+)kbps'},
            save_dir: {type: 'string'},
            export_list_file: {type: 'boolean'},
          },
        },
        services: {
          type: 'object',
          additionalProperties: false,
          default: {
            deezer: {},
            spotify: {},
            apple_music: {},
            youtube_music: {},
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
            deezer: {
              type: 'object',
              additionalProperties: false,
              properties: {
                developerToken: {type: 'string'},
              },
            },
            apple_music: {
              type: 'object',
              additionalProperties: false,
              properties: {
                username: {type: 'string'},
              },
            },
            youtube_music: {
              type: 'object',
              additionalProperties: false,
              properties: {
                username: {type: 'string'},
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
    const data = await Promise.resolve(this.ytdlGet(ytInfo.videoId)).reflect();
    return data.isFulfilled()
      ? {id: data.value().id, formats: data.value().formats.filter(format => format.acodec !== 'none')}
      : {err: data.reason()};
  }

  async downloadActiveSpotifyTrack() {
    if (!this.spotify.isAuthenticated) console.log('[!] Please authenticate the spotify client first'), process.exit();
    const info = await this.spotify.getActiveTrackInfo();
    if (!info) return console.log('[i] No actively playing track detected');
    await this.downloadMusicFromYoutube(info);
    return true;
  }

  async downloadSpotifyTrack(uri) {
    if (!this.spotify.isAuthenticated) console.log('[!] Please authenticate the spotify client first'), process.exit();
    const info = await this.spotify.getTrackInfo(uri);
    await this.downloadMusicFromYoutube(info);
  }
}

module.exports = FreyrCore;

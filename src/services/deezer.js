/* eslint-disable max-classes-per-file */
/* eslint-disable camelcase, no-underscore-dangle, class-methods-use-this */
const url = require('url');
const path = require('path');
const request = require('request');
const Promise = require('bluebird');
const NodeCache = require('node-cache');

const validUriTypes = ['track', 'album', 'artist', 'playlist'];

function WebapiError(message, statusCode) {
  this.name = 'WebapiError';
  this.message = message || '';
  this.statusCode = statusCode;
}

WebapiError.prototype = Error.prototype;

class DeezerCore {
  hostname = 'api.deezer.com';

  async request(ref, opts) {
    return new Promise((res, rej) =>
      request.get(ref, {baseUrl: `https://${this.hostname}/`, json: true, qs: {...opts, output: 'json'}}, (err, response) => {
        return err
          ? rej(new WebapiError(`${err.syscall ? `${err.syscall} ` : ''}${err.code} ${err.hostname || err.host}`))
          : response.body && typeof response.body === 'object' && 'error' in response.body
          ? rej(
              new WebapiError(
                `${response.body.error.code} [${response.body.error.type}]: ${response.body.error.message}`,
                response.body.error.code,
              ),
            )
          : res(response.body);
      }),
    );
  }

  processID(gnFn) {
    return (id, opts) => this.request(gnFn(id), opts);
  }

  processIDs(gnFn) {
    return (ids, opts) => Promise.mapSeries(ids, id => gnFn(id, opts));
  }

  wrapPagination(id, wrpFnx, pagedURL, opts) {
    return pagedURL
      ? () => wrpFnx(id, (({index, limit}) => ({index, limit: limit || opts.limit}))(url.parse(pagedURL, true).query))
      : null;
  }

  processList(gnFn) {
    const decoyProcessor = async (id, opts = {}) => {
      const itemObject = await gnFn(id, {index: opts.index || 0, limit: opts.limit || 100});
      itemObject.next = this.wrapPagination(id, decoyProcessor, itemObject.next, opts);
      itemObject.prev = this.wrapPagination(id, decoyProcessor, itemObject.prev, opts);
      return itemObject;
    };
    return decoyProcessor;
  }

  getTrack = this.processID(id => `track/${id}`);

  getAlbum = this.processID(id => `album/${id}`);

  getArtist = this.processID(id => `artist/${id}`);

  getPlaylist = this.processID(id => `playlist/${id}`);

  getTracks = this.processIDs(this.getTrack);

  getAlbums = this.processIDs(this.getAlbum);

  getArtists = this.processIDs(this.getArtist);

  getPlaylists = this.processIDs(this.getPlaylist);

  getAlbumTracks = this.processList((id, opts) => this.getAlbum(`${id}/tracks`, opts));

  getArtistAlbums = this.processList((id, opts) => this.getArtist(`${id}/albums`, opts));

  getPlaylistTracks = this.processList((id, opts) => this.getPlaylist(`${id}/tracks`, opts));
}

class Deezer {
  ID = 'deezer';

  DESC = 'Deezer';

  // https://www.debuggex.com/r/IuFIxSZGFJ07tOkR
  VALID_URL = /(?:(?:(?:https?:\/\/)?(?:www\.)?)deezer.com(?:\/[a-z]{2})?\/(track|album|artist|playlist)\/(.+))|(?:deezer:(track|album|artist|playlist):(.+))/;

  isAuthenticated = true;

  constructor() {
    this.core = new DeezerCore();
    this.cache = new NodeCache();
  }

  hasOnceAuthed() {
    throw Error('Unimplemented: [Deezer:hasOnceAuthed()]');
  }

  isAuthed() {
    return this.isAuthenticated;
  }

  newAuth() {
    throw Error('Unimplemented: [Deezer:newAuth()]');
  }

  canTryLogin() {
    return true;
  }

  hasProps() {
    return false;
  }

  getProps() {
    throw Error('Unimplemented: [Deezer:getProps()]');
  }

  async login() {
    throw Error('Unimplemented: [Deezer:login()]');
  }

  validateType(uri) {
    const {type} = this.identifyType(uri);
    return type in validUriTypes;
  }

  identifyType(uri) {
    return this.parseURI(uri).type;
  }

  parseURI(uri) {
    const match = uri.match(this.VALID_URL);
    if (!match) return null;
    const isURI = !!match[3];
    const parsedURL = url.parse(uri, true);
    const id = isURI ? match[4] : path.basename(parsedURL.pathname);
    const type = match[isURI ? 3 : 1];
    return {id, type, uri: `deezer:${type}:${id}`};
  }

  wrapTrackMeta(trackInfo, albumInfo = {}) {
    return {
      id: trackInfo.id,
      uri: trackInfo.link,
      name: trackInfo.title,
      artists: [trackInfo.artist.name],
      album: albumInfo.name,
      image: albumInfo.images[0],
      duration: trackInfo.duration * 1000,
      album_artist: albumInfo.artists[0],
      track_number: trackInfo.track_position,
      total_tracks: albumInfo.total_tracks,
      release_date: new Date(trackInfo.release_date),
      disc_number: trackInfo.disk_number,
      explicit: !!trackInfo.explicit_lyrics,
      isrc: trackInfo.isrc,
      genres: albumInfo.genres,
      label: albumInfo.label,
      copyrights: albumInfo.copyrights,
      composers: trackInfo.contributors.map(composer => composer.name).join(', '),
      compilation: albumInfo.type === 'compilation',
    };
  }

  wrapAlbumData(albumObject) {
    const artistObject = albumObject.artist || {};
    return {
      id: albumObject.id,
      uri: albumObject.link,
      name: albumObject.title,
      artists: [artistObject.name],
      type:
        artistObject.name === 'Various Artists' && artistObject.id === 5080
          ? 'compilation'
          : albumObject.record_type === 'single'
          ? 'single'
          : 'album',
      genres: ((albumObject.genres || {}).data || []).map(genre => genre.name),
      copyrights: [{type: 'P', text: albumObject.copyright}], // find workaround
      images: [albumObject.cover_big.replace('500x500', '640x640')],
      label: albumObject.label,
      release_date: new Date(albumObject.release_date),
      total_tracks: albumObject.nb_tracks,
      tracks: (albumObject.tracks || {}).data,
    };
  }

  wrapArtistData(artistObject) {
    return {
      id: artistObject.id,
      uri: artistObject.link,
      name: artistObject.name,
      genres: [],
      followers: artistObject.nb_fan,
    };
  }

  wrapPlaylistData(playlistObject) {
    throw Error('Unimplemented: [Deezer:wrapPlaylistData()]');
  }

  async processData(uris, max, coreFn) {
    const wasArr = Array.isArray(uris);
    uris = (wasArr ? uris : [uris]).map(_uri => {
      const parsed = this.parseURI(_uri);
      parsed.value = this.cache.get(parsed.uri);
      return [parsed.id, parsed];
    });
    const packs = uris.filter(([, {value}]) => !value);
    uris = Object.fromEntries(uris);
    if (packs.length)
      (
        await Promise.mapSeries(
          ((f, c) => ((c = Math.min(c, f.length)), [...Array(Math.ceil(f.length / c))].map((_, i) => f.slice(i * c, i * c + c))))(
            packs.map(([id]) => id),
            max || Infinity,
          ),
          coreFn,
        )
      )
        .flat(1)
        .forEach(item => (item ? this.cache.set(uris[item.id].uri, (uris[item.id].value = item)) : null));
    const ret = Object.values(uris).map(item => item.value);
    return !wasArr ? ret[0] : ret;
  }

  async getTrack(uris) {
    return this.processData(uris, 300, async items =>
      Promise.mapSeries(this.core.getTracks(items), async track =>
        this.wrapTrackMeta(track, await this.getAlbum(`deezer:album:${track.album.id}`)),
      ),
    );
  }

  async getAlbum(uris) {
    return this.processData(uris, 100, async items =>
      Promise.mapSeries(this.core.getAlbums(items), async album => this.wrapAlbumData(album)),
    );
  }

  async getAlbumTracks(uri) {
    const album = await this.getAlbum(uri);
    return this.getTrack(
      (await this._gatherCompletely(() => this.core.getAlbumTracks(album.id), 'data')).map(track => track.link),
    );
  }

  async getArtist(uris) {
    return this.processData(uris, 25, async items =>
      Promise.mapSeries(this.core.getArtists(items), async artist => this.wrapArtistData(artist)),
    );
  }

  async getPlaylist(uris, store) {
    throw Error('Unimplemented: [Deezer:getPlaylist()]');
  }

  async getPlaylistTracks(uris, store) {
    throw Error('Unimplemented: [Deezer:getPlaylistTracks()]');
  }

  async getArtistAlbums(uris) {
    const artist = await this.getArtist(uris);
    return Promise.mapSeries(
      this._gatherCompletely(() => this.core.getArtistAlbums(artist.id)),
      async _album => this.wrapAlbumData(_album, artist),
    );
  }

  async _gatherCompletely(fnOrObject, sel = 'data') {
    const data = typeof fnOrObject === 'object' ? fnOrObject : await fnOrObject();
    if (data.next) data[sel].concat(await this._gatherCompletely(data.next, sel));
    return data[sel];
  }
}

module.exports = Deezer;
module.exports.DeezerCore = DeezerCore;

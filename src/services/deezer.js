/* eslint-disable camelcase, no-underscore-dangle, class-methods-use-this, max-classes-per-file */
const url = require('url');
const path = require('path');

const got = require('got').default;
const NodeCache = require('node-cache');

const symbols = require('../symbols');
const AsyncQueue = require('../async_queue');

const validUriTypes = ['track', 'album', 'artist', 'playlist'];

function WebapiError(message, statusCode, status) {
  this.name = 'WebapiError';
  this.message = message || '';
  if (status) this.status = status;
  if (statusCode) this.statusCode = statusCode;
}

WebapiError.prototype = Error.prototype;

class DeezerCore {
  legacyApiUrl = 'https://api.deezer.com';

  requestObject = got.extend({
    responseType: 'json',
    searchParams: {output: 'json'},
  });

  async legacyApiCall(ref, opts) {
    const response = await this.requestObject
      .get(ref, {
        prefixUrl: this.legacyApiUrl,
        searchParams: opts,
      })
      .catch(err => {
        throw new WebapiError(
          `${err.syscall ? `${err.syscall} ` : ''}${err.code} ${err.hostname || err.host}`,
          err.response ? err.response.statusCode : null,
        );
      });
    if (response.body && typeof response.body === 'object' && 'error' in response.body)
      throw new WebapiError(
        `${response.body.error.code} [${response.body.error.type}]: ${response.body.error.message}`,
        null,
        response.body.error.code,
      );
    return response.body;
  }

  processID(gnFn) {
    return (id, opts) => this.legacyApiCall(gnFn(id), opts);
  }

  processList(gnFn) {
    const wrapPagination = (id, wrpFnx, pagedURL, opts) =>
      pagedURL
        ? () => wrpFnx(id, (({index, limit}) => ({index, limit: limit || opts.limit}))(url.parse(pagedURL, true).query))
        : null;
    const decoyProcessor = async (id, opts = {}) => {
      const itemObject = await gnFn(id, {index: opts.index || 0, limit: Math.min(opts.limit, 300) || 300});
      itemObject.next = wrapPagination(id, decoyProcessor, itemObject.next, opts);
      itemObject.prev = wrapPagination(id, decoyProcessor, itemObject.prev, opts);
      return itemObject;
    };
    return decoyProcessor;
  }

  getTrack = this.processID(id => `track/${id}`);

  getAlbum = this.processID(id => `album/${id}`);

  getArtist = this.processID(id => `artist/${id}`);

  getPlaylist = this.processID(id => `playlist/${id}`);

  getAlbumTracks = this.processList((id, opts) => this.getAlbum(`${id}/tracks`, opts));

  getArtistAlbums = this.processList((id, opts) => this.getArtist(`${id}/albums`, opts));

  getPlaylistTracks = this.processList((id, opts) => this.getPlaylist(`${id}/tracks`, opts));
}

class Deezer {
  static [symbols.meta] = {
    ID: 'deezer',
    DESC: 'Deezer',
    PROPS: {
      isQueryable: true,
      isSearchable: false,
      isSourceable: false,
    },
    BITRATES: ['FLAC'],
  };

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
      uri: `deezer:track:${trackInfo.id}`,
      link: trackInfo.link,
      name: trackInfo.title,
      artists: [trackInfo.artist.name],
      album: albumInfo.name,
      album_uri: `deezer:album:${albumInfo.id}`,
      images: albumInfo.images,
      duration: trackInfo.duration * 1000,
      album_artist: albumInfo.artists[0],
      track_number: trackInfo.track_position,
      total_tracks: albumInfo.ntracks,
      release_date: new Date(trackInfo.release_date),
      disc_number: trackInfo.disk_number,
      explicit: !!trackInfo.explicit_lyrics,
      isrc: trackInfo.isrc,
      genres: albumInfo.genres,
      label: albumInfo.label,
      copyrights: albumInfo.copyrights,
      composers: trackInfo.contributors.map(composer => composer.name).join(', '),
      compilation: albumInfo.type === 'compilation',
      getImage: albumInfo.getImage,
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
      images: [albumObject.cover_small, albumObject.cover_medium, albumObject.cover_big, albumObject.cover_xl],
      label: albumObject.label,
      release_date: new Date(albumObject.release_date),
      ntracks: albumObject.nb_tracks,
      tracks: albumObject.tracks,
      getImage(width, height) {
        const min = (val, max) => Math.min(max, val) || max;
        return this.images
          .slice()
          .pop()
          .replace(/(?<=.+\/)\d+x\d+(?=.+$)/g, `${min(width, 1800)}x${min(height, 1800)}`);
      },
    };
  }

  wrapArtistData(artistObject) {
    return {
      id: artistObject.id,
      uri: artistObject.link,
      name: artistObject.name,
      genres: null,
      nalbum: artistObject.nb_album,
      followers: artistObject.nb_fan,
    };
  }

  wrapPlaylistData(playlistObject) {
    return {
      id: playlistObject.id,
      uri: playlistObject.link,
      name: playlistObject.title,
      followers: playlistObject.fans,
      description: playlistObject.description,
      owner_id: playlistObject.creator.id,
      owner_name: playlistObject.creator.name,
      type: `${playlistObject.public ? 'Public' : 'Private'}${playlistObject.collaborative ? ' (Collaborative)' : ''}`,
      ntracks: playlistObject.nb_tracks,
      tracks: playlistObject.tracks,
    };
  }

  createDataProcessor(coreFn) {
    return async uri => {
      const parsed = this.parseURI(uri);
      if (!this.cache.has(parsed.uri)) this.cache.set(parsed.uri, await coreFn(parsed.id));
      return this.cache.get(parsed.uri);
    };
  }

  trackQueue = new AsyncQueue(
    'deezer:trackQueue',
    4,
    this.createDataProcessor(async id => {
      const track = await this.core.getTrack(id);
      return this.wrapTrackMeta(track, await this.getAlbum(`deezer:album:${track.album.id}`));
    }),
  );

  async getTrack(uris) {
    return this.trackQueue.push(uris);
  }

  albumQueue = new AsyncQueue(
    'deezer:albumQueue',
    4,
    this.createDataProcessor(async id => this.wrapAlbumData(await this.core.getAlbum(id))),
  );

  async getAlbum(uris) {
    return this.albumQueue.push(uris);
  }

  artistQueue = new AsyncQueue(
    'deezer:artistQueue',
    4,
    this.createDataProcessor(async id => this.wrapArtistData(await this.core.getArtist(id))),
  );

  async getArtist(uris) {
    return this.artistQueue.push(uris);
  }

  playlistQueue = new AsyncQueue(
    'deezer:playlistQueue',
    4,
    this.createDataProcessor(async id => this.wrapPlaylistData(await this.core.getPlaylist(id, {limit: 1}))),
  );

  async getPlaylist(uris) {
    return this.playlistQueue.push(uris);
  }

  async getAlbumTracks(uri) {
    const album = await this.getAlbum(uri);
    return this.trackQueue.push(album.tracks.data.map(track => track.link));
  }

  async getArtistAlbums(uris) {
    const artist = await this.getArtist(uris);
    return this.wrapPagination(() =>
      this.core.getArtistAlbums(artist.id, {limit: Math.min(artist.nalbum, Math.max(300, artist.nalbum / 4))}),
    );
  }

  async getPlaylistTracks(uri) {
    const playlist = await this.getPlaylist(uri);
    return this.wrapPagination(
      () => this.core.getPlaylistTracks(playlist.id, {limit: Math.min(playlist.ntracks, Math.max(300, playlist.ntracks / 4))}),
      data => this.trackQueue.push(data.map(track => track.link)),
    );
  }

  async wrapPagination(genFn, processor) {
    const collateAllPages = async px => {
      const page = await px();
      if (page.next) page.data.push(...(await collateAllPages(page.next)));
      return page.data;
    };
    const results = await collateAllPages(genFn);
    return processor ? processor(results) : results;
  }
}

module.exports = Deezer;
module.exports.DeezerCore = DeezerCore;

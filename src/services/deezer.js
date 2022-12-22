/* eslint-disable camelcase, no-underscore-dangle, class-methods-use-this, max-classes-per-file */
import url from 'url';
import path from 'path';

import got from 'got';
import NodeCache from 'node-cache';

import symbols from '../symbols.js';
import AsyncQueue from '../async_queue.js';

const validUriTypes = ['track', 'album', 'artist', 'playlist'];

class WebapiError extends Error {
  constructor(message, statusCode, status) {
    super(message);
    if (status) this.status = status;
    if (statusCode) this.statusCode = statusCode;
  }
}

const sleep = ms => new Promise(res => setTimeout(res, ms));

export class DeezerCore {
  legacyApiUrl = 'https://api.deezer.com';

  requestObject = got.extend({
    responseType: 'json',
    searchParams: {output: 'json'},
  });

  #validatorData = {expires: 0, queries: []};

  #retrySymbol = Symbol('DeezerCoreTrialCount');

  #getIfHasError = response =>
    response.body && typeof response.body === 'object' && 'error' in response.body && response.body.error;

  validatorQueue = new AsyncQueue('validatorQueue', 1, async now => {
    if (this.#validatorData.queries.length === 50)
      await sleep(this.#validatorData.expires - Date.now()).then(() => Promise.all(this.#validatorData.queries));
    if (this.#validatorData.expires <= (now = Date.now())) this.#validatorData = {expires: now + 5000, queries: []};
    return new Promise(res => this.#validatorData.queries.push(new Promise(res_ => res(res_))));
  });

  #sendRequest = async (ref, opts, retries) => {
    retries = typeof retries === 'object' ? retries : {prior: 0, remaining: retries};
    const ticketFree = await this.validatorQueue[retries.prior === 0 ? 'push' : 'unshift']();
    return this.requestObject
      .get(ref, {
        prefixUrl: this.legacyApiUrl,
        searchParams: opts,
      })
      .finally(ticketFree)
      .then((response, error) => {
        if ((error = this.#getIfHasError(response)) && error.code === 4 && error.message === 'Quota limit exceeded') {
          error[this.#retrySymbol] = retries.prior + 1;
          if (retries.remaining > 1)
            return this.#sendRequest(ref, opts, {prior: retries.prior + 1, remaining: retries.remaining - 1});
        }
        return response;
      });
  };

  totalTrials = 5;

  async legacyApiCall(ref, opts) {
    const response = await this.#sendRequest(ref, opts, this.totalTrials || 5).catch(err => {
      throw new WebapiError(
        `${err.syscall ? `${err.syscall} ` : ''}${err.code} ${err.hostname || err.host}`,
        err.response ? err.response.statusCode : null,
      );
    });

    let error;
    if ((error = this.#getIfHasError(response))) {
      const err = new WebapiError(`${error.code} [${error.type}]: ${error.message}`, null, error.code);
      if (error[this.#retrySymbol]) err[this.#retrySymbol] = error[this.#retrySymbol];
      throw err;
    }

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

export default class Deezer {
  static [symbols.meta] = {
    ID: 'deezer',
    DESC: 'Deezer',
    PROPS: {
      isQueryable: true,
      isSearchable: false,
      isSourceable: false,
    },
    // https://www.debuggex.com/r/IuFIxSZGFJ07tOkR
    VALID_URL:
      /(?:(?:(?:https?:\/\/)?(?:www\.)?)deezer.com(?:\/[a-z]{2})?\/(track|album|artist|playlist)\/(\d+))|(?:deezer:(track|album|artist|playlist):(\d+))/,
    PROP_SCHEMA: {},
  };

  [symbols.meta] = Deezer[symbols.meta];

  #store = {
    core: new DeezerCore(),
    cache: new NodeCache(),
  };

  constructor(config) {
    if (config && 'retries' in config) this.#store.core.totalTrials = config.retries + 1;
  }

  loadConfig(_config) {}

  hasOnceAuthed() {
    throw Error('Unimplemented: [Deezer:hasOnceAuthed()]');
  }

  isAuthed() {
    return true;
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
    const match = uri.match(Deezer[symbols.meta].VALID_URL);
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
      album_type: albumInfo.type,
      images: albumInfo.images,
      duration: trackInfo.duration * 1000,
      album_artist: albumInfo.artists[0],
      track_number: trackInfo.track_position,
      total_tracks: albumInfo.ntracks,
      release_date: new Date(trackInfo.release_date),
      disc_number: trackInfo.disk_number,
      contentRating: !!trackInfo.explicit_lyrics,
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
      if (!this.#store.cache.has(parsed.uri)) this.#store.cache.set(parsed.uri, await coreFn(parsed.id));
      return this.#store.cache.get(parsed.uri);
    };
  }

  trackQueue = new AsyncQueue(
    'deezer:trackQueue',
    4,
    this.createDataProcessor(async id => {
      const track = await this.#store.core.getTrack(id);
      return this.wrapTrackMeta(track, await this.getAlbum(`deezer:album:${track.album.id}`));
    }),
  );

  async getTrack(uris) {
    return this.trackQueue.push(uris);
  }

  albumQueue = new AsyncQueue(
    'deezer:albumQueue',
    4,
    this.createDataProcessor(async id => this.wrapAlbumData(await this.#store.core.getAlbum(id))),
  );

  async getAlbum(uris) {
    return this.albumQueue.push(uris);
  }

  artistQueue = new AsyncQueue(
    'deezer:artistQueue',
    4,
    this.createDataProcessor(async id => this.wrapArtistData(await this.#store.core.getArtist(id))),
  );

  async getArtist(uris) {
    return this.artistQueue.push(uris);
  }

  playlistQueue = new AsyncQueue(
    'deezer:playlistQueue',
    4,
    this.createDataProcessor(async id => this.wrapPlaylistData(await this.#store.core.getPlaylist(id, {limit: 1}))),
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
    return this.wrapPagination(
      () => this.#store.core.getArtistAlbums(artist.id, {limit: Math.min(artist.nalbum, Math.max(300, artist.nalbum / 4))}),
      data => this.albumQueue.push(data.map(album => album.link)),
    );
  }

  async getPlaylistTracks(uri) {
    const playlist = await this.getPlaylist(uri);
    return this.wrapPagination(
      () =>
        this.#store.core.getPlaylistTracks(playlist.id, {limit: Math.min(playlist.ntracks, Math.max(300, playlist.ntracks / 4))}),
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

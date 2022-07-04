/* eslint-disable camelcase, no-underscore-dangle, class-methods-use-this */
import xurl from 'url';
import path from 'path';

import Promise from 'bluebird';
import NodeCache from 'node-cache';
import {Client} from '@yujinakayama/apple-music';

import symbols from '../symbols.js';

const validUriTypes = ['track', 'album', 'artist', 'playlist'];

export default class AppleMusic {
  static [symbols.meta] = {
    ID: 'apple_music',
    DESC: 'Apple Music',
    PROPS: {
      isQueryable: true,
      isSearchable: false,
      isSourceable: false,
    },
    // https://www.debuggex.com/r/BcVR1cjFQmNgJn-E
    VALID_URL:
      /(?:(?:(?:(?:https?:\/\/)?(?:www\.)?)(?:(?:music|(?:geo\.itunes))\.apple.com)\/([a-z]{2})\/(album|artist|playlist)\/([^/]+)\/.+)|(?:apple_music:(track|album|artist|playlist):(.+)))/,
    PROP_SCHEMA: {},
  };

  [symbols.meta] = AppleMusic[symbols.meta];

  #store = {
    cache: new NodeCache(),
    core: null,
    defaultStorefront: null,
    isAuthenticated: false,
  };

  constructor(config) {
    if (!config) throw new Error(`[AppleMusic] Please define a configuration object`);
    if (typeof config !== 'object') throw new Error(`[AppleMusic] Please define a configuration as an object`);
    if (!config.developerToken)
      throw new Error(`[AppleMusic] Please define [developerToken] as a property within the configuration`);
      
    this.#store.core = new Client({ developerToken: config.developerToken });

    function augmentAxiosInstance(instance) {
      instance.interceptors.request.use((conf) => {
        conf.headers.origin = 'https://music.apple.com';
        return conf;
      });
    }

    augmentAxiosInstance(this.#store.core.albums.axiosInstance);
    augmentAxiosInstance(this.#store.core.artists.axiosInstance);
    augmentAxiosInstance(this.#store.core.playlists.axiosInstance);
    augmentAxiosInstance(this.#store.core.songs.axiosInstance);

    this.#store.defaultStorefront = config.storefront || 'us';
    this.#store.isAuthenticated = !!config.developerToken;
  }

  loadConfig(_config) {}

  hasOnceAuthed() {
    throw Error('Unimplemented: [AppleMusic:hasOnceAuthed()]');
  }

  isAuthed() {
    return this.#store.isAuthenticated;
  }

  newAuth() {
    throw Error('Unimplemented: [AppleMusic:newAuth()]');
  }

  canTryLogin() {
    return !!this.#store.core.configuration.developerToken;
  }

  hasProps() {
    return false;
  }

  getProps() {
    throw Error('Unimplemented: [AppleMusic:getProps()]');
  }

  async login() {
    throw Error('Unimplemented: [AppleMusic:login()]');
  }

  validateType(uri) {
    const { type } = this.identifyType(uri);
    return type in validUriTypes;
  }

  identifyType(uri) {
    return this.parseURI(uri).type;
  }

  parseURI(uri, storefront) {
    const match = uri.match(AppleMusic[symbols.meta].VALID_URL);
    if (!match) return null;
    const isURI = !!match[4];
    const parsedURL = xurl.parse(uri, true);
    const collection_type = match[isURI ? 4 : 2];
    const id =
      (isURI && match[4] === 'track' ? match[5] : parsedURL.query.i) || null;
    const type = isURI
      ? match[4]
      : collection_type === 'album' && id
      ? 'track'
      : collection_type;
    const refID = isURI
      ? type !== 'track'
        ? match[5]
        : null
      : path.basename(parsedURL.pathname);
    return {
      id,
      type,
      refID,
      key: match[3] || null,
      uri: `apple_music:${type}:${id || refID}`,
      storefront: match[1] || storefront || this.#store.defaultStorefront,
      collection_type,
    };
  }

  wrapTrackMeta(trackInfo, albumInfo = {}) {
    return {
      id: trackInfo.id,
      uri: `apple_music:track:${trackInfo.id}`,
      link: trackInfo.attributes.url,
      name: trackInfo.attributes.name,
      artists: [trackInfo.attributes.artistName],
      album: albumInfo.name,
      album_uri: `apple_music:album:${
        albumInfo.id || this.parseURI(trackInfo.attributes.url).refID
      }`,
      album_type: albumInfo.type,
      images: trackInfo.attributes.artwork,
      duration: trackInfo.attributes.durationInMillis,
      album_artist: albumInfo.artists[0],
      track_number: trackInfo.attributes.trackNumber,
      total_tracks: albumInfo.ntracks,
      release_date: albumInfo.release_date,
      disc_number: trackInfo.attributes.discNumber,
      contentRating: trackInfo.attributes.contentRating,
      isrc: trackInfo.attributes.isrc,
      genres: trackInfo.attributes.genreNames,
      label: albumInfo.label,
      copyrights: albumInfo.copyrights,
      composers: trackInfo.attributes.composerName,
      compilation: albumInfo.type === 'compilation',
      getImage: albumInfo.getImage,
    };
  }

  wrapAlbumData(albumObject) {
    return {
      id: albumObject.id,
      uri: albumObject.attributes.url,
      name: albumObject.attributes.name.replace(/\s-\s(Single|EP)$/, ''),
      artists: [albumObject.attributes.artistName],
      type:
        albumObject.attributes.artistName === 'Various Artists' &&
        albumObject.relationships.artists.data.length === 0
          ? 'compilation'
          : albumObject.attributes.isSingle
          ? 'single'
          : 'album',
      genres: albumObject.attributes.genreNames,
      copyrights: [{ type: 'P', text: albumObject.attributes.copyright }],
      images: albumObject.attributes.artwork,
      label: albumObject.attributes.recordLabel,
      release_date: ((date) =>
        typeof date === 'string'
          ? date
          : [
              [date.year, 4],
              [date.month, 2],
              [date.day, 2],
            ]
              .map(([val, size]) => val.toString().padStart(size, '0'))
              .join('-'))(albumObject.attributes.releaseDate),
      ntracks: albumObject.attributes.trackCount,
      tracks: albumObject.relationships.tracks.data,
      getImage(width, height) {
        const min = (val, max) => Math.min(max, val) || max;
        const images = albumObject.attributes.artwork;
        return images.url.replace(
          '{w}x{h}',
          `${min(width, images.width)}x${min(height, images.height)}`
        );
      },
    };
  }

  wrapArtistData(artistObject) {
    return {
      id: artistObject.id,
      uri: artistObject.attributes.url,
      name: artistObject.attributes.name,
      genres: artistObject.attributes.genreNames,
      albums: artistObject.relationships.albums.data.map((album) => album.id),
      nalbums: null,
    };
  }

  wrapPlaylistData(playlistObject) {
    return {
      id: playlistObject.id,
      uri: playlistObject.attributes.url,
      name: playlistObject.attributes.name,
      followers: null,
      description: (playlistObject.attributes.description || { short: null })
        .short,
      owner_id: null,
      owner_name: playlistObject.attributes.curatorName,
      type: playlistObject.attributes.playlistType
        .split('-')
        .map((word) => `${word[0].toUpperCase()}${word.slice(1)}`),
      ntracks: playlistObject.relationships.tracks.data.length,
      tracks: playlistObject.relationships.tracks.data,
    };
  }

  async processData(uris, max, store, coreFn) {
    const wasArr = Array.isArray(uris);
    uris = (wasArr ? uris : [uris]).map((_uri) => {
      const parsed = this.parseURI(_uri, store);
      parsed.value = this.#store.cache.get(parsed.uri);
      return [parsed.id || parsed.refID, parsed];
    });
    const packs = uris
      .filter(([, { value }]) => !value)
      .map(([, parsed]) => parsed);
    uris = Object.fromEntries(uris);
    if (packs.length)
      (
        await Promise.mapSeries(
          Object.entries(
            // organise by storefront
            packs.reduce(
              (all, item) => (
                ((all[item.storefront] = all[item.storefront] || []),
                all[item.storefront].push(item)),
                all
              ),
              {}
            )
          ),
          async ([storefront, _items]) =>
            Promise.mapSeries(
              // cut to maximum query length
              ((f, c) => (
                (c = Math.min(c, f.length)),
                [...Array(Math.ceil(f.length / c))].map((_, i) =>
                  f.slice(i * c, i * c + c)
                )
              ))(_items, max || Infinity),
              async (items) => coreFn(items, storefront) // request select collection
            )
        )
      )
        .flat(2)
        .forEach((item) =>
          item
            ? this.#store.cache.set(
                uris[item.id].uri,
                (uris[item.id].value = item)
              )
            : null
        );
    const ret = Object.values(uris).map((item) => item.value);
    return !wasArr ? ret[0] : ret;
  }

  async getTrack(uris, store) {
    return this.processData(uris, 300, store, async (items, storefront) => {
      const { data: tracks } = await this.#store.core.songs.get(
        `?ids=${items.map((item) => item.id).join(',')}`,
        { storefront }
      );
      await this.getAlbum(
        items.map((item) => `apple_music:album:${item.refID}`),
        storefront
      );
      return Promise.mapSeries(tracks, async (track) =>
        this.wrapTrackMeta(
          track,
          await this.getAlbum(
            `apple_music:album:${this.parseURI(track.attributes.url).refID}`,
            storefront
          )
        )
      );
    });
  }

  async getAlbum(uris, store) {
    return this.processData(uris, 100, store, async (items, storefront) =>
      Promise.mapSeries(
        (
          await this.#store.core.albums.get(
            `?ids=${items.map((item) => item.refID).join(',')}`,
            { storefront }
          )
        ).data,
        (album) => this.wrapAlbumData(album)
      )
    );
  }

  async getAlbumTracks(url, store) {
    return this.getTrack(
      (await this.getAlbum(url, store)).tracks.map(
        (track) => track.attributes.url
      ),
      store
    );
  }

  async getArtist(uris, store) {
    return this.processData(uris, 25, store, async (items, storefront) =>
      Promise.mapSeries(
        (
          await this.#store.core.artists.get(
            `?ids=${items.map((item) => item.refID).join(',')}`,
            { storefront }
          )
        ).data,
        (artist) => this.wrapArtistData(artist)
      )
    );
  }

  async getPlaylist(uris, store) {
    return this.processData(uris, 25, store, async (items, storefront) =>
      Promise.mapSeries(
        (
          await this.#store.core.playlists.get(
            `?ids=${items.map((item) => item.refID).join(',')}`,
            { storefront }
          )
        ).data,
        (playlist) => this.wrapPlaylistData(playlist)
      )
    );
  }

  async getPlaylistTracks(uris, store) {
    return this.getTrack(
      (await this.getPlaylist(uris, store)).tracks.map(
        (track) => track.attributes.url
      ),
      store
    );
  }

  async getArtistAlbums(uris, store) {
    return this.processData(
      (await this.getArtist(uris)).albums.map(
        (album) => `apple_music:album:${album}`
      ),
      100,
      store,
      (items, storefront) =>
        this.getAlbum(
          items.map((item) => item.uri),
          storefront
        )
    );
  }
}

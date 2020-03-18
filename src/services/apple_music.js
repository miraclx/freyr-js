/* eslint-disable camelcase, no-underscore-dangle, class-methods-use-this */
const xurl = require('url');
const path = require('path');
const Promise = require('bluebird');
const NodeCache = require('node-cache');
const {Client} = require('@yujinakayama/apple-music');

const validUriTypes = ['track', 'album', 'artist', 'playlist'];

class AppleMusic {
  ID = 'apple_music';

  DESC = 'Apple Music';

  // https://www.debuggex.com/r/BcVR1cjFQmNgJn-E
  VALID_URL = /(?:(?:(?:(?:https?:\/\/)?(?:www\.)?)(?:(?:music|(?:geo\.itunes))\.apple.com)\/([a-z]{2})\/(album|artist|playlist)\/([^/]+)\/.+)|(?:apple_music:(track|album|artist|playlist):(.+)))/;

  isAuthenticated = false;

  DEFAULT_AUTH = {
    developerToken:
      'eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6IldlYlBsYXlLaWQifQ.eyJpc3MiOiJBTVBXZWJQbGF5IiwiaWF0IjoxNTgyMTQzMTIxLCJleHAiOjE1OTc2OTUxMjF9.j3MAuNa0ZfVVOsBtsGFBmNwT4jPrKu2Alp5PzdhQC3Id--pboI9GqrysOSj2bfg0P-iJboXsg3R_dWr1TQ3pwg',
  };

  constructor() {
    this.cache = new NodeCache();
    this.core = new Client({developerToken: this.DEFAULT_AUTH.developerToken});
    this.isAuthenticated = !!this.DEFAULT_AUTH.developerToken;
  }

  hasOnceAuthed() {
    throw Error('Unimplemented: [AppleMusic:hasOnceAuthed()]');
  }

  isAuthed() {
    return this.isAuthenticated;
  }

  newAuth() {
    throw Error('Unimplemented: [AppleMusic:newAuth()]');
  }

  async login() {
    throw Error('Unimplemented: [AppleMusic:login()]');
  }

  validateType(uri) {
    const {type} = this.identifyType(uri);
    return type in validUriTypes;
  }

  identifyType(uri) {
    return this.parseURI(uri).type;
  }

  parseURI(uri, storefront) {
    const match = uri.match(this.VALID_URL);
    if (!match) return null;
    const isURI = !!match[4];
    const parsedURL = xurl.parse(uri, true);
    const collection_type = match[isURI ? 4 : 2];
    const id = (isURI && match[4] === 'track' ? match[5] : parsedURL.query.i) || null;
    const type = isURI ? match[4] : collection_type === 'album' && id ? 'track' : collection_type;
    const refID = isURI ? (type !== 'track' ? match[5] : null) : path.basename(parsedURL.pathname);
    return {
      id,
      type,
      refID,
      key: match[3] || null,
      uri: `apple_music:${type}:${id || refID}`,
      storefront: match[1] || storefront || 'us',
      collection_type,
    };
  }

  wrapTrackMeta(trackInfo, albumInfo = {}) {
    return {
      id: trackInfo.id,
      uri: trackInfo.attributes.url,
      name: trackInfo.attributes.name,
      artists: [trackInfo.attributes.artistName],
      album: albumInfo.name,
      album_uri: `apple_music:album:${albumInfo.id || this.parseURI(trackInfo.attributes.url).refID}`,
      image: trackInfo.attributes.artwork.url.replace('{w}x{h}', '640x640'),
      duration: trackInfo.attributes.durationInMillis,
      album_artist: albumInfo.artists[0],
      track_number: trackInfo.attributes.trackNumber,
      total_tracks: albumInfo.total_tracks,
      release_date: (date =>
        [
          [date.year, 4],
          [date.month, 2],
          [date.day, 2],
        ]
          .map(([val, size]) => val.toString().padStart(size, '0'))
          .join('-'))(trackInfo.attributes.releaseDate),
      disc_number: trackInfo.attributes.discNumber,
      explicit: trackInfo.attributes.contentRating === 'explicit',
      isrc: trackInfo.attributes.isrc,
      genres: trackInfo.attributes.genreNames,
      label: albumInfo.label,
      copyrights: albumInfo.copyrights,
      composers: trackInfo.attributes.composerName,
      compilation: albumInfo.type === 'compilation',
    };
  }

  wrapAlbumData(albumObject) {
    return {
      id: albumObject.id,
      uri: albumObject.attributes.url,
      name: albumObject.attributes.name.replace(/\s-\s(Single|EP)$/, ''),
      artists: [albumObject.attributes.artistName],
      type:
        albumObject.attributes.artistName === 'Various Artists' && albumObject.relationships.artists.data.length === 0
          ? 'compilation'
          : albumObject.attributes.isSingle
          ? 'single'
          : 'album',
      genres: albumObject.attributes.genreNames,
      copyrights: [{type: 'P', text: albumObject.attributes.copyright}],
      images: albumObject.attributes.artwork.url.replace('{w}x{h}', '640x640'),
      label: albumObject.attributes.recordLabel,
      release_date: (date =>
        [
          [date.year, 4],
          [date.month, 2],
          [date.day, 2],
        ]
          .map(([val, size]) => val.toString().padStart(size, '0'))
          .join('-'))(albumObject.attributes.releaseDate),
      total_tracks: albumObject.attributes.trackCount,
      tracks: albumObject.relationships.tracks.data,
    };
  }

  wrapArtistData(artistObject) {
    return {
      id: artistObject.id,
      uri: artistObject.attributes.url,
      name: artistObject.attributes.name,
      genres: artistObject.attributes.genreNames,
      albums: artistObject.relationships.albums.data.map(album => album.id),
    };
  }

  wrapPlaylistData(playlistObject) {
    return {
      id: playlistObject.id,
      uri: playlistObject.attributes.url,
      name: playlistObject.attributes.name,
      followers: null,
      description: playlistObject.attributes.description.short,
      owner_id: null,
      owner_name: playlistObject.attributes.curatorName,
      type: playlistObject.attributes.playlistType.split('-').map(word => `${word[0].toUpperCase()}${word.slice(1)}`),
      tracks: playlistObject.relationships.tracks.data,
    };
  }

  async processData(uris, max, coreFn) {
    const wasArr = Array.isArray(uris);
    uris = (wasArr ? uris : [uris]).map(_uri => {
      const parsed = this.parseURI(_uri);
      parsed.value = this.cache.get(parsed.uri);
      return [parsed.id || parsed.refID, parsed];
    });
    const packs = uris.filter(([, {value}]) => !value).map(([, parsed]) => parsed);
    uris = Object.fromEntries(uris);
    if (packs.length)
      (
        await Promise.mapSeries(
          Object.entries(
            // organise by storefront
            packs.reduce(
              (all, item) => (((all[item.storefront] = all[item.storefront] || []), all[item.storefront].push(item)), all),
              {},
            ),
          ),
          async ([store, _items]) =>
            Promise.mapSeries(
              // cut to maximum query length
              ((f, c) => (
                (c = Math.min(c, f.length)), [...Array(Math.ceil(f.length / c))].map((_, i) => f.slice(i * c, i * c + c))
              ))(_items, max || Infinity),
              async items => coreFn(items, store), // request select collection
            ),
        )
      )
        .flat(2)
        .forEach(item => (item ? this.cache.set(uris[item.id].uri, (uris[item.id].value = item)) : null));
    const ret = Object.values(uris).map(item => item.value);
    return !wasArr ? ret[0] : ret;
  }

  async getTrack(uris, store) {
    return this.processData(uris, 300, async (items, storefront) => {
      const {data: tracks} = await this.core.songs.get(`?ids=${items.map(item => item.id).join(',')}`, {
        storefront: store || storefront,
      });
      await this.getAlbum(items.map(item => `apple_music:album:${item.refID}`));
      return Promise.mapSeries(tracks, async track =>
        this.wrapTrackMeta(track, await this.getAlbum(`apple_music:album:${this.parseURI(track.attributes.url).refID}`)),
      );
    });
  }

  async getAlbum(uris, store) {
    return this.processData(uris, 100, async (items, storefront) =>
      Promise.mapSeries(
        (
          await this.core.albums.get(`?ids=${items.map(item => item.refID).join(',')}`, {
            storefront: store || storefront,
          })
        ).data,
        album => this.wrapAlbumData(album),
      ),
    );
  }

  async getAlbumTracks(url, store) {
    return this.getTrack(
      (await this.getAlbum(url, store)).tracks.map(track => track.attributes.url),
      store,
    );
  }

  async getArtist(uris, store) {
    return this.processData(uris, 25, async (items, storefront) =>
      Promise.mapSeries(
        (await this.core.artists.get(`?ids=${items.map(item => item.refID).join(',')}`, {storefront: store || storefront})).data,
        artist => this.wrapArtistData(artist),
      ),
    );
  }

  async getPlaylist(uris, store) {
    return this.processData(uris, 25, async (items, storefront) =>
      Promise.mapSeries(
        (await this.core.playlists.get(`?ids=${items.map(item => item.refID).join(',')}`, {storefront: store || storefront}))
          .data,
        playlist => this.wrapPlaylistData(playlist),
      ),
    );
  }

  async getPlaylistTracks(uris, store) {
    return this.getTrack(
      (await this.getPlaylist(uris, store)).tracks.map(track => track.attributes.url),
      store,
    );
  }

  async getArtistAlbums(uris, store) {
    return this.processData(
      (await this.getArtist(uris)).albums.map(album => `apple_music:album:${album}`),
      100,
      async (items, storefront) =>
        Promise.mapSeries(
          (await this.core.albums.get(`?ids=${items.map(item => item.refID).join(',')}`, {storefront: store || storefront})).data,
          album => this.wrapAlbumData(album),
        ),
    );
  }
}

module.exports = AppleMusic;

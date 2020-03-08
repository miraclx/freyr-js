/* eslint-disable camelcase, no-underscore-dangle, class-methods-use-this */
const xurl = require('url');
const path = require('path');
const NodeCache = require('node-cache');
const {Client} = require('@yujinakayama/apple-music');

const validUriTypes = ['track', 'album', 'artist', 'playlist'];

class AppleMusic {
  ID = 'apple-music';

  DESC = 'Apple Music';

  VALID_URL = /(?:(?:(?:(?:https?:\/\/)?(?:www\.)?)(?:(?:music|(?:geo\.itunes))\.apple.com)\/([a-z]{2})\/(album|artist|playlist)\/([\w-]+)\/.+)|(?:apple_music:(track|album|artist|playlist):(\d+)))/;

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
      album: trackInfo.attributes.albumName,
      album_uri: `apple_music:album:${albumInfo.id || trackInfo.relationships.albums.data[0].id}`,
      image: trackInfo.attributes.artwork.url.replace('{w}x{h}', '640x640'),
      duration: trackInfo.attributes.durationInMillis,
      album_artist: trackInfo.attributes.artistName,
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
    };
  }

  wrapAlbumData(albumObject) {
    const wrapped = {
      id: albumObject.id,
      uri: albumObject.attributes.url,
      name: albumObject.attributes.name,
      artists: [albumObject.attributes.artistName],
      type: albumObject.attributes.isSingle ? 'single' : 'album',
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
    };
    wrapped.tracks = albumObject.relationships.tracks.data.map(track => this.wrapTrackMeta(track, wrapped));
    return wrapped;
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
      uri: playlistObject.uri,
      name: playlistObject.name,
      followers: playlistObject.followers.total,
      description: playlistObject.description,
      owner_id: playlistObject.owner.id,
      owner_name: playlistObject.owner.display_name,
      public: playlistObject.public,
      tracks: playlistObject.tracks.items.map(item => this.wrapTrackMeta(item.track)),
    };
  }

  async getTrack(url) {
    const {id, uri, refID, storefront} = this.parseURI(url);
    if (!this.cache.has(uri))
      this.cache.set(
        uri,
        (
          await this.getAlbum(
            `apple_music:album:${refID || (await this.core.songs.get(id, {storefront})).data[0].relationships.albums.data[0].id}`,
            storefront,
          )
        ).tracks.find(track => track.id === id),
      );
    return this.cache.get(uri);
  }

  async getAlbum(url, store) {
    const {uri, refID, storefront} = this.parseURI(url);
    if (!this.cache.has(uri))
      this.cache.set(uri, this.wrapAlbumData((await this.core.albums.get(refID, {storefront: store || storefront})).data[0]));
    return this.cache.get(uri);
  }

  async getArtist(url) {
    const {uri, refID, storefront} = this.parseURI(url);
    if (!this.cache.has(uri))
      this.cache.set(uri, this.wrapArtistData((await this.core.artists.get(refID, {storefront})).data[0]));
    return this.cache.get(uri);
  }

  async getPlaylist() {
    throw Error('Unimplemented: [AppleMusic:getPlaylist()]');
  }

  async getArtistAlbums(url) {
    const {uri: artistUri, refID} = this.parseURI(url);
    const uri = `spotify:artist_albums:${refID}`;
    if (!this.cache.has(uri))
      this.cache.set(
        uri,
        (
          await this.core.albums.get(`?ids=${(await this.getArtist(artistUri)).albums.join(',')}`, {storefront: 'us'})
        ).data.map(album => this.wrapAlbumData(album)),
      );
    return this.cache.get(uri);
  }
}

module.exports = AppleMusic;

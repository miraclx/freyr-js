/* eslint-disable no-underscore-dangle, class-methods-use-this */
const Promise = require('bluebird');
const NodeCache = require('node-cache');
const spotifyUri = require('spotify-uri');
const SpotifyWebApi = require('spotify-web-api-node');

const validUriTypes = ['track', 'album', 'artist', 'playlist'];

class Spotify {
  ID = 'spotify';

  DESC = 'Spotify';

  // https://www.debuggex.com/r/mrPLQQIORTxQzE9J
  VALID_URL = /(?:(?:(?:https?:\/\/)?(?:www\.)?)(?:(?:(?:open|embed)\.)spotify.com).+)|(?:spotify:(?:artist|track|album|playlist):(?:[0-9A-Za-z]{22}))/;

  isAuthenticated = false;

  DEFAULT_AUTH = {
    client_id: '888aa4540c09464abc9ed8bbe2a5f18a',
    client_secret: '84e7ab36abed48318bfb2eae7b32415d',
  };

  constructor(args) {
    const {AuthServer, ConfFile} = {ConfFile: {client_id: '', client_secret: ''}, ...args};
    this.AuthServer = AuthServer;
    this.core = new SpotifyWebApi(
      ConfFile.client_id
        ? {
            clientId: ConfFile.client_id,
            clientSecret: ConfFile.client_secret,
          }
        : this.DEFAULT_AUTH,
    );
    this.cache = new NodeCache();
  }

  hasOnceAuthed() {
    return this.isAuthenticated;
  }

  isAuthed() {
    return this.isAuthenticated && Date.now() < this.expiry;
  }

  newAuth() {
    const server = new this.AuthServer('Spotify');
    this.core.setRedirectURI(server.getRedirectURL());
    const scope = ['user-read-private', 'user-read-email', 'user-read-playback-state'];
    const authCode = Promise.resolve(server.getCode());
    return {
      getUrl: server.init(state => this.core.createAuthorizeURL(scope, state)),
      userToAuth: async () => {
        const code = await authCode;
        const data = await this.core.authorizationCodeGrant(code);
        this.setExpiry(data.body.expires_in);
        this.core.setRefreshToken(data.body.refresh_token);
        this.core.setAccessToken(data.body.access_token);
        this.isAuthenticated = true;
        return {refresh_token: data.body.refresh_token, expiry: this.expiry};
      },
    };
  }

  setExpiry(expiry) {
    this.expiry = Date.now() + expiry * 1000;
  }

  async login(config) {
    this.core.setRefreshToken(config.refresh_token);
    const data = await this.core.refreshAccessToken();
    this.core.setAccessToken(data.body.access_token);
    this.setExpiry(data.body.expires_in);
    return (this.isAuthenticated = true);
  }

  validateType(uri) {
    const {type} = spotifyUri(uri);
    if (!validUriTypes.includes(type)) throw new Error(`Spotify URI type [${type}] is invalid.`);
    return uri;
  }

  identifyType(uri) {
    return this.parseURI(uri).type;
  }

  parseURI(uri) {
    return spotifyUri(this.validateType(uri));
  }

  wrapTrackMeta(trackInfo, albumInfo = trackInfo.album) {
    return {
      id: trackInfo.id,
      uri: trackInfo.uri,
      name: trackInfo.name,
      artists: trackInfo.artists.map(artist => artist.name),
      album: albumInfo.name,
      album_uri: albumInfo.uri,
      image: albumInfo.images[0].url,
      duration: trackInfo.duration_ms,
      album_artist: albumInfo.artists[0],
      track_number: trackInfo.track_number,
      total_tracks: albumInfo.total_tracks,
      release_date: albumInfo.release_date,
      disc_number: trackInfo.disc_number,
      explicit: trackInfo.explicit,
      isrc: (trackInfo.external_ids || {}).isrc,
      genres: albumInfo.genres,
      label: albumInfo.label,
      copyrights: albumInfo.copyrights,
    };
  }

  wrapAlbumData(albumObject) {
    const wrapped = {
      uri: albumObject.uri,
      name: albumObject.name,
      artists: albumObject.artists.map(artist => artist.name),
      type: albumObject.album_type,
      copyrights: albumObject.copyrights,
      genres: albumObject.genres,
      images: albumObject.images,
      label: albumObject.label,
      release_date: new Date(albumObject.release_date),
      total_tracks: albumObject.total_tracks,
      tracks: albumObject.tracks.items,
    };
    return wrapped;
  }

  wrapArtistData(artistObject) {
    return {
      id: artistObject.id,
      uri: artistObject.uri,
      name: artistObject.name,
      genres: artistObject.genres,
      followers: artistObject.followers.total,
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
      tracks: playlistObject.tracks.items.map(item => item.track),
    };
  }

  async processData(uris, max, coreFn) {
    uris = (Array.isArray(uris) ? uris : [uris]).map(uri => {
      const parsedURI = this.parseURI(uri);
      uri = spotifyUri.formatURI(parsedURI);
      return [parsedURI.id, this.cache.get(uri)];
    });
    const ids = uris.filter(([, value]) => !value).map(([id]) => id);
    uris = Object.fromEntries(uris);
    if (ids.length)
      (
        await Promise.mapSeries(
          ((f, c) => ((c = Math.min(c, f.length)), [...Array(Math.ceil(f.length / c))].map((_, i) => f.slice(i * c, i * c + c))))(
            ids,
            max || Infinity,
          ),
          coreFn,
        )
      )
        .flat()
        .forEach(item => (this.cache.set(item.uri, item), (uris[this.parseURI(item.uri).id] = item)));

    const ret = Object.values(uris);
    return ret.length === 1 ? ret[0] : ret;
  }

  async getTrack(uris) {
    return this.processData(uris, 50, async ids =>
      Promise.map((await this.core.getTracks(ids)).body.tracks, async track =>
        this.wrapTrackMeta(track, await this.getAlbum(track.album.uri)),
      ),
    );
  }

  async getAlbum(uris) {
    return this.processData(uris, 20, async ids =>
      Promise.map((await this.core.getAlbums(ids)).body.albums, async album => this.wrapAlbumData(album)),
    );
  }

  async getAlbumTracks(uri) {
    return this.getTrack((await this.getAlbum(uri)).tracks.map(item => item.uri));
  }

  async getArtist(uris) {
    return this.processData(uris, 50, async ids =>
      Promise.map((await this.core.getArtists(ids)).body.artists, async artist => this.wrapArtistData(artist)),
    );
  }

  async getPlaylist(uri) {
    const parsedURI = this.parseURI(uri);
    uri = spotifyUri.formatURI(parsedURI);
    if (!this.cache.has(uri)) this.cache.set(uri, this.wrapPlaylistData((await this.core.getPlaylist(parsedURI.id)).body));
    return this.cache.get(uri);
  }

  async getPlaylistTracks(uri) {
    return this.getTrack((await this.getPlaylist(uri)).tracks.map(item => item.uri));
  }

  async getArtistAlbums(uri) {
    const {id} = this.parseURI(uri);
    uri = `spotify:artist_albums:${id}`;
    if (!this.cache.has(uri))
      this.cache.set(
        uri,
        await this.getAlbum(
          (
            await this._gatherCompletely(
              (offset, limit) => this.core.getArtistAlbums(id, {offset, limit, include_groups: 'album,single'}),
              {offset: 0, limit: 50, sel: 'items'},
            )
          ).map(album => album.uri),
        ),
      );
    return this.cache.get(uri);
  }

  async checkIsActivelyListening() {
    return (await this.core.getMyCurrentPlaybackState()).statusCode !== '204';
  }

  async getActiveTrack() {
    return this.core.getMyCurrentPlayingTrack();
  }

  async _gatherCompletely(fn, {offset, limit, sel} = {}) {
    const {body} = await fn(offset, limit);
    if (body.next) body[sel].push(await this._gatherCompletely(fn, {offset: offset + body.total, limit, sel}));
    return body[sel].filter(item => item.name);
  }
}

module.exports = Spotify;

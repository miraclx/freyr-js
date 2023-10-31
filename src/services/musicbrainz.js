/* eslint-disable camelcase, no-underscore-dangle, class-methods-use-this */
import got from 'got';

import Promise from 'bluebird';
import NodeCache from 'node-cache';

import symbols from '../symbols.js';
import AsyncQueue from '../async_queue.js';

const mbPageSize = 25;
const validUriTypes = ['artist', 'release-group', 'release', 'recording'];

class WebapiError extends Error {
  constructor(message, statusCode, status) {
    super(message);
    if (status) this.status = status;
    if (statusCode) this.statusCode = statusCode;
  }
}

const sleep = ms => new Promise(res => setTimeout(res, ms));

export class MusicBrainzCore {
  musicBrainzApiUrl = 'https://musicbrainz.org/ws/2/';
  lastRequestTime = 0;

  requestObject = got.extend({
    responseType: 'json',
    searchParams: {output: 'json'},
  });

  #getIfHasError = response =>
    response.body && typeof response.body === 'object' && 'error' in response.body && response.body.error;

  #sendRequest = async (ref, opts) => {
    // Rate limiting to one request per second per MusicBrainz api spec.
    const requestTime = Date.now();
    await sleep(this.lastRequestTime + 1000 - requestTime);
    this.lastRequestTime = Date.now();

    return this.requestObject
      .get(ref, {
        prefixUrl: this.musicBrainzApiUrl,
        searchParams: opts,
      })
      .then((response, error) => {
        if (error = this.#getIfHasError(response)) {
          console.log(error);
        }
        return response;
      });
  };

  totalTrials = 5;

  async legacyApiCall(ref, opts) {
    const response = await this.#sendRequest(ref, opts).catch(err => {
      throw new WebapiError(
        `${err.syscall ? `${err.syscall} ` : ''}${err.code} ${err.hostname || err.host}`,
        err.response ? err.response.statusCode : null,
      );
    });

    let error;
    if (error = this.#getIfHasError(response)) {
      throw new WebapiError(`${error.code} [${error.type}]: ${error.message}`, null, error.code);
    }

    return response.body;
  }

  processID(gnFn) {
    return (id, opts) => this.legacyApiCall(gnFn(id), opts);
  }

  processList(listType, gnFn) {
    const decoyProcessor = async (id, opts = {}) => {
      const limit = Math.min(opts.limit, mbPageSize) || mbPageSize;
      const itemObject = await gnFn(id, { offset: opts.offset || 0, limit });
      const total = itemObject[`${listType}-count`];
      const offset = itemObject[`${listType}-offset`];
      const values = itemObject[`${listType}s`];
      if (total > offset + limit) {
        opts.offset = offset + limit;
        values.push.apply(values, await decoyProcessor(id, opts));
      }
      return values;
    };
    return decoyProcessor;
  }

  artistIncludes = "genres"
  recordingIncludes = "isrcs"
  releaseGroupIncludes = "genres"
  releaseIncludes = `artist-credits+media+release-groups+${this.releaseGroupIncludes}+labels+recordings+${this.recordingIncludes}`

  getReleaseById = this.processID(id => `release/${id}?inc=${this.releaseIncludes}`);

  getReleaseGroupById = this.processID(id => `release-group/${id}?inc=${this.releaseGroupIncludes}`);

  getArtistById = this.processID(id => `artist/${id}?inc=${this.artistIncludes}`);

  getReleaseGroupsByArtistId = this.processList(`release-group`, (id, opts) => {
    const newOpts = { artist: `${id}`, inc: `${this.releaseGroupIncludes}` };
    Object.assign(newOpts, opts);
    return this.legacyApiCall(`release-group`, newOpts);
  });

  getReleasesByReleaseGroupId = this.processList(`release`, (id, opts) => {
    const newOpts = { 'release-group': `${id}`, inc: `${this.releaseIncludes}` };
    Object.assign(newOpts, opts);
    return this.legacyApiCall(`release`, newOpts);
  });

  getRecordingsByReleaseId = this.processList(`recording`, (id, opts) => {
    const newOpts = { 'release': `${id}`, inc: `${this.recordingIncludes}` };
    Object.assign(newOpts, opts);
    return this.legacyApiCall(`recording`, newOpts);
  });

  getReleasesByRecordingId = this.processList(`release`, (id, opts) => {
    const newOpts = { 'recording': `${id}`, inc: `${this.releaseIncludes}` };
    Object.assign(newOpts, opts);
    return this.legacyApiCall(`release`, newOpts);
  });
}

export default class MusicBrainz {
  static [symbols.meta] = {
    ID: 'musicbrainz',
    DESC: 'MusicBrainz',
    PROPS: {
      isQueryable: true,
      isSearchable: false,
      isSourceable: false,
    },
    VALID_URL:
      /(?:(?:(?:(?:https?:\/\/)?(?:www\.)?)(?:musicbrainz\.org)\/(artist|release-group|release|recording)\/(.+))|(?:(?:musicbrainz|mb):(artist|release-group|release|recording):(.+)))/,
    PROP_SCHEMA: {},
  };

  [symbols.meta] = MusicBrainz[symbols.meta];

  #store = {
    core: new MusicBrainzCore(),
    cache: new NodeCache(),
    defaultStorefront: null,
  };

  constructor(config) {
    this.#store.defaultStorefront = config?.storefront || 'us';
  }

  loadConfig(_config) {}

  hasOnceAuthed() {
    throw Error('Unimplemented: [MusicBrainz:hasOnceAuthed()]');
  }

  isAuthed() {
    return true;
  }

  newAuth() {
    throw Error('Unimplemented: [MusicBrainz:newAuth()]');
  }

  canTryLogin() {
    return true;
  }

  hasProps() {
    return false;
  }

  getProps() {
    throw Error('Unimplemented: [MusicBrainz:getProps()]');
  }

  async login() {
    throw Error('Unimplemented: [MusicBrainz:login()]');
  }

  validateType(uri) {
    const {type} = this.identifyType(uri);
    return type in validUriTypes;
  }

  identifyType(uri) {
    return this.parseURI(uri).type;
  }

  parseURI(uri, storefront) {
    const match = uri.match(MusicBrainz[symbols.meta].VALID_URL);
    if (!match) return null;
    const isURI = !!match[4];
    const collection_type = match[isURI ? 3 : 1];
    const id = match[isURI ? 4 : 2];
    const type = collection_type;
    const refID = id;
    return {
      id,
      type,
      refID,
      key: match[3] || null,
      uri: `musicbrainz:${type}:${id}`,
      storefront: storefront || this.#store.defaultStorefront,
      collection_type,
    };
  }

  wrapRecordingData(recordingObject, releaseObject = {}) {
    // Find the recording in the media of the release.
    const media = releaseObject.media.find(media => media.tracks.some(track => track.recording.id === recordingObject.id));
    const track = media.tracks.find(track => track.recording.id === recordingObject.id);

    return {
      id: recordingObject.id,
      uri: `musicbrainz:recording:${recordingObject.id}`,
      name: recordingObject.title,
      artists: recordingObject['artist-credit'] ? recordingObject['artist-credit'].map(credit => credit.name) : [],
      album: releaseObject.name,
      album_uri: releaseObject.uri,
      album_type: releaseObject.type,
      duration: track.length * 1000,
      album_artist: releaseObject.artists[0],
      track_number: track.position,
      disc_number: media.position,
      total_tracks: releaseObject.ntracks,
      release_date: new Date(recordingObject['first-release-date']),
      isrc: recordingObject.isrcs?.length ? recordingObject.isrcs[0] : null,
      genres: releaseObject.genres,
      label: releaseObject.label,
      compilation: releaseObject.type === 'compilation',
      imageUri: releaseObject.imageUri,
      getImage: releaseObject.getImage,
      release: releaseObject,
    };
  }

  wrapReleaseGroupData(releaseGroupObject) {
    return {
      id: releaseGroupObject.id,
      uri: `musicbrainz:release-group:${releaseGroupObject.id}`,
      name: releaseGroupObject.title,
      type: releaseGroupObject['secondary-types'].some(x => x.toLowerCase() === 'compilation') ? 'compilation' : releaseGroupObject['primary-type'],
      genres: (releaseGroupObject.genres || []).map(genre => genre.name),
    };
  }

  wrapReleaseData(releaseObject) {
    const releaseGroupObject = this.wrapReleaseGroupData(releaseObject['release-group']);

    const release = {
      id: releaseObject.id,
      uri: `musicbrainz:release:${releaseObject.id}`,
      name: releaseObject['title'],
      status: releaseObject['status'],
      country: releaseObject['country'],
      artists: releaseObject['artist-credit'].map(credit => credit.name),
      genres: releaseGroupObject.genres,
      label: releaseObject['label-info'].length ? releaseObject['label-info'][0].label?.name : null,
      packaging: releaseObject.packaging,
      release_date: new Date(releaseObject.date),
      ntracks: releaseObject.media.reduce((accumulator, object) => {
        return accumulator + object['track-count'];
      }, 0),
      media: releaseObject.media,
      type: releaseGroupObject['type'],
      'release-group': releaseGroupObject,
      //TODO: image link from https://musicbrainz.org/doc/Cover_Art_Archive/API spec
      imageUri: "https://www.cdrom2go.com/content/images/thumbs/016/0168275_usdm-super-blue-cd-r-silver-top-52x.jpeg",  // dummy image so it functions for now.
      getImage(width, height) {
        const min = (val, max) => Math.min(max, val) || max;
        return this.imageUri
          .replace(/(?<=.+\/)\d+x\d+(?=.+$)/g, `${min(width, 1800)}x${min(height, 1800)}`);
      },
    };
    // All recordings are included in the response (not limited to 25), so we can map here.
    release['tracks'] = [];
    releaseObject.media.map((mediaObj) => mediaObj.tracks.forEach(track => release['tracks'].push(this.wrapRecordingData(track.recording, release))));

    return release;
  }

  wrapArtistData(artistObject) {
    return {
      id: artistObject.id,
      uri: `musicbrainz:artist:${artistObject.id}`,
      name: artistObject.name,
      genres: artistObject.genres.map(genre => genre.name),
      nalbums: null,
    };
  }

  createDataProcessor(coreFn, recordType) {
    return async uri => {
      const parsed = this.parseURI(uri);
      const cacheKey = parsed.uri + `:${recordType}`; // Caching based on the provided URI and the resulting record type.
      if (!this.#store.cache.has(cacheKey)) {
        const result = await coreFn(parsed.id);
        this.#store.cache.set(cacheKey, result);
        // Some results hold extra full records, so we can cache them as well.
        if (recordType.toLowerCase() === 'release') {
          if (Array.isArray(result)) {
            result.forEach(release => this.cacheReleaseExtras(release));
          }
          else {
            this.cacheReleaseExtras(result);
          }
        }
      }
      return this.#store.cache.get(cacheKey);
    };
  }

  cacheReleaseExtras(release) {
    // Cache the release-group
    this.#store.cache.set(release['release-group'].uri + 'release-group', release['release-group']);
    // Cache the recordings
    release.tracks.forEach(recording => this.#store.cache.set(recording.uri + 'recording', recording));
    // Cache links for 'recordingsByRelease' and 'releaseGroupByRelease'
    this.#store.cache.set(release.uri + 'recording', release.tracks);
    this.#store.cache.set(release.uri + 'release-group', release['release-group']);
  }

  artistQueue = new AsyncQueue(
    'musicbrainz:artistQueue',
    4,
    this.createDataProcessor(async id => this.wrapArtistData(await this.#store.core.getArtistById(id)),
    "artist"),
  );

  artistReleaseGroupsQueue = new AsyncQueue(
    'musicbrainz:artistReleaseGroupsQueue',
    4,
    this.createDataProcessor(async id => (await this.#store.core.getReleaseGroupsByArtistId(id)).map(releaseGroup => this.wrapReleaseGroupData(releaseGroup)),
    "release-group"),
  );

  releaseGroupReleasesQueue = new AsyncQueue(
    'musicbrainz:releaseGroupReleasesQueue',
    4,
    this.createDataProcessor(async id => (await this.#store.core.getReleasesByReleaseGroupId(id)).map(release => this.wrapReleaseData(release)),
    "release"),
  );

  releaseGroupQueue = new AsyncQueue(
    'musicbrainz:releaseGroupQueue',
    4,
    this.createDataProcessor(async id => this.wrapReleaseGroupData(await this.#store.core.getReleaseGroupById(id)),
    "release-group"),
  );

  releaseQueue = new AsyncQueue(
    'musicbrainz:releaseQueue',
    4,
    this.createDataProcessor(async id => this.wrapReleaseData(await this.#store.core.getReleaseById(id)),
    "release"),
  );

  releaseRecordingsQueue = new AsyncQueue(
    'musicbrainz:releaseRecordingsQueue',
    4,
    this.createDataProcessor(async id => {
      const release = await this.getAlbum(`musicbrainz:release:${id}`);
      return (await this.#store.core.getRecordingsByReleaseId(id)).map(recording => this.wrapRecordingData(recording, release));
    },
    "recording"),
  );

  recordingReleasesQueue = new AsyncQueue(
    'musicbrainz:recordingReleasesQueue',
    4,
    this.createDataProcessor(async id => (await this.#store.core.getReleasesByRecordingId(id)).map(release => this.wrapReleaseData(release)),
    "release"),
  );

  async getTrack(uri, storefront) {
    storefront = storefront || this.#store.defaultStorefront;
    const parsedUri = this.parseURI(uri, storefront);
    const release = await this.getAlbum(await this.findReleaseFromRecording(uri, storefront), storefront);

    return await release.tracks.find(track => track.id === parsedUri.id);
  }

  async getAlbum(uri, storefront) {
    // If the provided uri is for a release-group, we need to choose a release from that group.
    storefront = storefront || this.#store.defaultStorefront;
    const parsedUri = this.parseURI(uri, storefront);
    if (parsedUri.type === 'release-group') {
      uri = await this.findReleaseFromReleaseGroup(uri, storefront);
    }
    return await this.releaseQueue.push(uri);
  }

  async getArtist(uri) {
    return this.artistQueue.push(uri);
  }

  async getAlbumTracks(uri, storefront) {
    // If the provided uri is for a release-group, we need to choose a release from that group.
    const parsedUri = this.parseURI(uri, storefront);
    if (parsedUri.type === 'release-group') {
      uri = await this.findReleaseFromReleaseGroup(uri, storefront);
    }
    return await this.releaseRecordingsQueue.push(uri);
  }

  async getArtistAlbums(uri) {
    return this.artistReleaseGroupsQueue.push(uri);
  }

  arrayFilterNull(array, filter) {
    const result = array.filter(filter);
    return result.length ? result : null;
  }

  async findReleaseFromRecording(uri, storefront) {
    return this.filterReleasesToUri(await this.recordingReleasesQueue.push(uri), storefront);
  }

  async findReleaseFromReleaseGroup(uri, storefront) {
    return this.filterReleasesToUri(await this.releaseGroupReleasesQueue.push(uri), storefront);
  }

  async filterReleasesToUri(releases, storefront) {
    /*
     * Filter logic applied such that if any release matches a rule, that rule applies. If no releases match, the rule is skipped.
     * Rules:
     * - Status 'Official'.
     * - Matching country code/storefront.
     * - Digital release (i.e. no packaging).
     * - Release date is filled.
     *
     * The oldest (therefore most likely original) matching release is selected.
     */

    const officialReleases = this.arrayFilterNull(releases, (release) => release.status === 'Official') || releases;
    const storefrontReleases = this.arrayFilterNull(officialReleases, (release) => release.country?.toLowerCase() === storefront) || officialReleases;
    const digitalReleases = this.arrayFilterNull(storefrontReleases, (release) => release.packaging?.toLowerCase() === 'none') || storefrontReleases;
    const datedReleases = this.arrayFilterNull(digitalReleases, (release) => !isNaN(Number(release.release_date))) || digitalReleases;
    const sortedArray = datedReleases.sort((objA, objB) => Number(objB.release_date) - Number(objA.release_date));
    const firstResult = sortedArray[0];
    return firstResult.uri;
  }
}

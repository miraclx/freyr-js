/* eslint-disable max-classes-per-file, no-underscore-dangle */
const util = require('util');

const got = require('got').default;
const Promise = require('bluebird');
const ytSearch = require('yt-search');
const {StripChar} = require('stripchar');
const youtubedl = require('youtube-dl');

const most = require('../most_polyfill');
const walk = require('../walkr');
const symbols = require('../symbols');
const AsyncQueue = require('../async_queue');

const _ytdlGet = util.promisify(youtubedl.getInfo);

function YouTubeSearchError(message, statusCode, status, body) {
  this.name = 'YouTubeSearchError';
  this.message = message || '';
  if (status) this.status = status;
  if (statusCode) this.statusCode = statusCode;
  if (body) this.body = body;
}

YouTubeSearchError.prototype = Error.prototype;

/**
 * @typedef {(
 *   {
 *     title: string,
 *     type: "Song" | "Video",
 *     artists: string,
 *     album: string,
 *     duration: string,
 *     duration_ms: number,
 *     videoId: string,
 *     playlistId: string,
 *     accuracy: number,
 *     getFeeds: () => Promise<youtubedl.Info>,
 *   }[]
 * )} YouTubeSearchResult
 */

function genAsyncGetFeedsFn(url) {
  const loadFeeds = async () => _ytdlGet(url, ['--socket-timeout=20', '--no-cache-dir']);
  return loadFeeds;
}

class YouTubeMusic {
  static [symbols.meta] = {
    ID: 'yt_music',
    DESC: 'YouTube Music',
    PROPS: {
      isQueryable: false,
      isSearchable: true,
      isSourceable: true,
    },
    BITRATES: [96, 128, 160, 192, 256, 320],
  };

  [symbols.meta] = YouTubeMusic[symbols.meta];

  #store = {
    gotInstance: got.extend({
      headers: {
        'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/80.0.3987.132 Safari/537.36',
      },
    }),
    apiKey: null,
  };

  #request = async function request(url, opts) {
    const response = await this.#store
      .gotInstance(url, opts)
      .catch(err =>
        Promise.reject(
          new YouTubeSearchError(
            err.message,
            err.response && err.response.statusCode,
            err.code,
            err.response && err.response.body,
          ),
        ),
      );
    return response.body;
  };

  #getApiKey = async function getApiKey(force = false) {
    if (this.#store.apiKey && !force) return this.#store.apiKey;
    const body = await this.#request('https://music.youtube.com/', {method: 'get'});
    let match;
    if ((match = (body || '').match(/(?="INNERTUBE_API_KEY":"(.+?)")/)))
      return ([, this.#store.apiKey] = match), this.#store.apiKey;
    throw new YouTubeSearchError('Failed to extract `INNERTUBE_API_KEY`');
  };

  #search = async function search(queryObject, params, tag) {
    /**
     * VideoID Types?
     * OMV: Official Music Video
     * ATV:
     * UGC: User-generated content
     */
    if (typeof queryObject !== 'object') throw new Error('<queryObject> must be an object');
    if (params && typeof params !== 'object') throw new Error('<params>, if defined must be an object');
    const response = await this.#request('https://music.youtube.com/youtubei/v1/search', {
      timeout: 10000,
      method: 'post',
      searchParams: {alt: 'json', key: await this.#getApiKey(), ...params},
      responseType: 'json',
      json: {
        context: {
          client: {
            clientName: 'WEB_REMIX',
            clientVersion: '0.1',
            hl: 'en',
            gl: 'US',
          },
        },
        ...queryObject,
      },
      headers: {
        referer: 'https://music.youtube.com/search',
      },
    });

    const shelf = !('continuationContents' in response)
      ? response.contents.sectionListRenderer.contents.map(section => section.musicShelfRenderer || section)
      : [response.continuationContents.musicShelfContinuation || response.continuationContents.sectionListContinuation];
    return Object.fromEntries(
      shelf.map(layer => {
        const layerName = layer.title && layer.title.runs[0].text;
        return [
          layerName === 'Top result'
            ? 'top'
            : layerName === 'Songs'
            ? 'songs'
            : layerName === 'Videos'
            ? 'videos'
            : layerName === 'Albums'
            ? 'albums'
            : layerName === 'Artists'
            ? 'artists'
            : layerName === 'Playlists'
            ? 'playlists'
            : `other${layerName ? `(${layerName})` : ''}`,
          {
            contents: (layer.contents || []).map(content => {
              content = content.musicResponsiveListItemRenderer;
              const videoId = walk(content, 'videoId');
              if (!videoId) return {};
              const watchEndpoint = {videoId};
              const tags = content.flexColumns.map(obj =>
                obj.musicResponsiveListItemFlexColumnRenderer.text
                  ? obj.musicResponsiveListItemFlexColumnRenderer.text.runs.map(side => side.text).filter(text => text !== ' • ')
                  : undefined,
              ).flat();

              const type = tag || tags.splice(1, 1)[0];
              return type === 'Song'
                ? {
                    title: tags[0],
                    type,
                    artists: tags[1],
                    album: tags[2],
                    duration: tags[3],
                    link: watchEndpoint,
                  }
                : type === 'Video'
                ? {
                    title: tags[0],
                    type,
                    artists: tags[1],
                    views: tags[2],
                    duration: tags[3],
                    link: watchEndpoint,
                  }
                : type === 'Album'
                ? {
                    name: tags[0],
                    type,
                    album_type: type === 'Single' ? 'Album' : type,
                    artists: tags[1],
                    year: tags[2],
                    link: watchEndpoint,
                  }
                : type === 'Artist'
                ? {
                    name: tags[0],
                    type,
                    subscribers: tags[1],
                    link: watchEndpoint,
                  }
                : type === 'Playlist'
                ? {
                    name: tags[0],
                    type,
                    author: tags[1],
                    nb_songs: tags[2],
                    link: watchEndpoint,
                  }
                : {};
            }),
            ...(layerName === 'Top result'
              ? null
              : {
                  loadMore: !layer.continuations
                    ? undefined
                    : async () => {
                        const continuationObject = layer.continuations[0].nextContinuationData;
                        return (
                          await this.#search(
                            {},
                            {
                              icit: continuationObject.clickTrackingParams,
                              continuation: continuationObject.continuation,
                            },
                            tag || layerName.slice(0, -1),
                          )
                        ).other;
                      },
                  expand: !layer.bottomEndpoint
                    ? undefined
                    : async () =>
                        (await this.#search(layer.bottomEndpoint.searchEndpoint, {}, tag || layerName.slice(0, -1))).other,
                }),
          },
        ];
      }),
    );
  };

  /**
   * Search the YouTube Music service for matches
   * @param {string|string[]} [artists] An artist or list of artists
   * @param {string} [track] Track name
   * @param {number} [duration] Duration in milliseconds
   *
   * If `track` is a number, it becomes duration, leaving `track` undefined.
   * If `artists` is a string and `track` is undefined, it becomes `track`, leaving artists empty.
   * If `artists` is non-array but `track` is defined, artists becomes an item in the artists array.
   *
   * @returns {YouTubeSearchResult} YouTubeMusicSearchResults
   */
  async search(artists, track, duration) {
    if (typeof track === 'number') [track, duration] = [, track];
    if (!Array.isArray(artists))
      if (track && artists) artists = [artists];
      else [artists, track] = [[], artists || track];
    if (typeof track !== 'string') throw new Error('<track> must be a valid string');
    if (artists.some(artist => typeof artist !== 'string'))
      throw new Error('<artist>, if defined must be a valid array of strings');
    if (duration && typeof duration !== 'number') throw new Error('<duration>, if defined must be a valid number');

    const results = await this.#search({query: artists.concat(track).join(' ')});
    const strippedTitle = StripChar.RSspecChar(track).toLowerCase();
    const validSections = [
      ...((results.top || {}).contents || []), // top recommended songs
      ...((results.songs || {}).contents || []), // song section
      ...((results.videos || {}).contents || []), // videos section
    ].filter(
      item =>
        item &&
        'title' in item &&
        most(
          StripChar.RSspecChar(item.title)
            .replace(/\s{2,}/g, ' ')
            .toLowerCase()
            .split(' '),
          text => strippedTitle.includes(text),
        ),
    );
    function calculateAccuracyFor(item) {
      let accuracy = 0;
      // get weighted delta from expected duration
      accuracy += 100 - (duration ? Math.abs(duration - item.duration_ms) / duration : 0.5) * 100;
      // if item is a song, bump remaining by 80%, if video, bump up by 70%, anything else, not so much
      accuracy += (cur => ((item.type === 'Song' ? 80 : item.type === 'Video' ? 70 : 10) / 100) * cur)(100 - accuracy);
      // TODO: CALCULATE ACCURACY BY AUTHOR
      return accuracy;
    }
    const classified = Object.values(
      validSections.reduce((final, item) => {
        // prune duplicates
        if (item && 'link' in item && 'videoId' in item.link && !(item.link.videoId in final)) {
          final[item.link.videoId] = {
            title: item.title,
            type: item.type,
            author: item.artists,
            duration: item.duration,
            duration_ms: item.duration.split(':').reduce((acc, time) => 60 * acc + +time) * 1000,
            videoId: item.link.videoId,
            getFeeds: genAsyncGetFeedsFn(item.link.videoId),
          };
          final[item.link.videoId].accuracy = calculateAccuracyFor(final[item.link.videoId]);
        }
        return final;
      }, {}),
      // sort descending by accuracy
    ).sort((a, b) => (a.accuracy > b.accuracy ? -1 : 1));
    return classified;
  }
}

class YouTube {
  static [symbols.meta] = {
    ID: 'youtube',
    DESC: 'YouTube',
    PROPS: {
      isQueryable: false,
      isSearchable: true,
      isSourceable: true,
    },
    BITRATES: [96, 128, 160, 192, 256, 320],
  };

  [symbols.meta] = YouTube[symbols.meta];

  #store = {
    search: util.promisify(ytSearch),
    searchQueue: new AsyncQueue('YouTube:netSearchQueue', 4, async (artists, trackTitle, strippedTitle, xFilters) =>
      (
        await this.#store.search({
          query: [...artists, trackTitle, ...xFilters].join(' '),
          pageStart: 1,
          pageEnd: 2,
        })
      ).videos.reduce(
        (final, item) => {
          const _title = StripChar.RSspecChar(item.title)
            .replace(/\s{2,}/g, ' ')
            .toLowerCase()
            .split(' ');
          if (
            artists.length === 0 ||
            (item &&
              'title' in item &&
              most(artists, keyWord => item.title.toLowerCase().includes(keyWord.toLowerCase())) &&
              most(
                strippedTitle
                  .split(' ')
                  .filter(Boolean)
                  .map(part => part.trim()),
                text => _title.includes(text),
              ) &&
              !/\d+D/i.test(item.title)) // ignore 8d, 16d, etc videos, not original audio
          ) {
            final.highestViews = Math.max(final.highestViews, item.views);
            final.results.push(item);
          }
          return final;
        },
        {xFilters, highestViews: 0, results: []},
      ),
    ),
  };

  /**
   * Search YouTube service for matches
   * @param {string|string[]} [artists] An artist or list of artists
   * @param {string} [track] Track name
   * @param {number} [duration] Duration in milliseconds
   *
   * If `track` is a number, it becomes duration, leaving `track` undefined.
   * If `artists` is a string and `track` is undefined, it becomes `track`, leaving artists empty.
   * If `artists` is non-array but `track` is defined, artists becomes an item in the artists array.
   *
   * @returns {YouTubeSearchResult} YouTubeSearchResults
   */
  async search(artists, track, duration) {
    if (typeof track === 'number') [track, duration] = [, track];
    if (!Array.isArray(artists))
      if (track && artists) artists = [artists];
      else [artists, track] = [[], artists || track];
    if (typeof track !== 'string') throw new Error('<track> must be a valid string');
    if (artists.some(artist => typeof artist !== 'string'))
      throw new Error('<artist>, if defined must be a valid array of strings');
    if (duration && typeof duration !== 'number') throw new Error('<duration>, if defined must be a valid number');

    const strippedTitle = StripChar.RSspecChar(track).toLowerCase();
    let searchResults = await Promise.all(
      (
        await this.#store.searchQueue.push([
          [artists, [track, strippedTitle, ['Official Audio']]],
          [artists, [track, strippedTitle, ['Audio']]],
          [artists, [track, strippedTitle, ['Lyrics']]],
          [artists, [track, strippedTitle, []]],
        ])
      ).map(result => Promise.resolve(result).reflect()),
    );
    if (searchResults.every(result => result.isRejected())) {
      const err = searchResults[searchResults.length - 1].reason();
      throw new YouTubeSearchError(err.message, null, err.code);
    }
    searchResults = searchResults.map(ret => (ret.isFulfilled() ? ret.value() : {}));
    const highestViews = Math.max(...searchResults.map(sources => sources.highestViews));
    function calculateAccuracyFor(item) {
      let accuracy = 0;
      // get weighted delta from expected duration
      accuracy += 100 - (duration ? Math.abs(duration - item.duration.seconds * 1000) / duration : 0.5) * 100;
      // bump accuracy by max of 80% on the basis of highest views
      accuracy += (cur => cur * (80 / 100) * (item.views / highestViews))(100 - accuracy);
      // bump accuracy by 60% if video author matches track author
      accuracy += (cur =>
        most(artists, artist => item.author.name.toLowerCase().includes(artist.toLowerCase())) ? (60 / 100) * cur : 0)(
        100 - accuracy,
      );
      return accuracy;
    }
    const final = {};
    searchResults.forEach(source => {
      if (Array.isArray(source.results))
        source.results.forEach(item => {
          // prune duplicates
          if (item && 'videoId' in item && !(item.videoId in final))
            final[item.videoId] = {
              title: item.title,
              type: item.type,
              author: item.author.name,
              duration: item.duration.timestamp,
              duration_ms: item.duration.seconds * 1000,
              videoId: item.videoId,
              xFilters: source.xFilters,
              accuracy: calculateAccuracyFor(item),
              getFeeds: genAsyncGetFeedsFn(item.videoId),
            };
        });
    });
    return Object.values(final).sort((a, b) => (a.accuracy > b.accuracy ? -1 : 1));
  }
}

module.exports = {YouTube, YouTubeMusic};

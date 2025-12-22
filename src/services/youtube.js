/* eslint-disable max-classes-per-file, no-underscore-dangle */
import util from 'util';

import got from 'got';
import Promise from 'bluebird';
import ytSearch from 'yt-search';
import youtubedl from 'youtube-dl-exec';

import walk from '../walkr.js';
import symbols from '../symbols.js';
import textUtils from '../text_utils.js';
import AsyncQueue from '../async_queue.js';

class YouTubeSearchError extends Error {
  constructor(message, statusCode, status, body) {
    super(message);
    if (status) this.status = status;
    if (statusCode) this.statusCode = statusCode;
    if (body) this.body = body;
  }
}

function _getSearchArgs(artists, track, album, duration) {
  if (typeof track === 'number') [track, duration] = [, track];
  if (typeof album === 'number') [album, duration] = [, album];
  if (!Array.isArray(artists))
    if (track && artists) artists = [artists];
    else [artists, track] = [[], artists || track];
  if (typeof track !== 'string') throw new Error('<track> must be a valid string');
  if (typeof album !== 'string') throw new Error('<album> must be a valid string');
  if (artists.some(artist => typeof artist !== 'string'))
    throw new Error('<artist>, if defined must be a valid array of strings');
  if (duration && typeof duration !== 'number') throw new Error('<duration>, if defined must be a valid number');
  return [artists, track, album, duration];
}

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
  return () =>
    youtubedl(null, {
      '--': [url],
      socketTimeout: 20,
      cacheDir: false,
      dumpSingleJson: true,
      noWarnings: true,
      jsRuntime: "deno",
    });
}

export class YouTubeMusic {
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
    apiConfig: null,
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
    if (response.req.res.url === 'https://music.youtube.com/coming-soon/')
      throw new YouTubeSearchError('YouTube Music is not available in your country');
    return response.body;
  };

  #deriveConfig = async function deriveConfig(force = false) {
    if (this.#store.apiConfig && !force) return this.#store.apiConfig;
    const body = await this.#request('https://music.youtube.com/', {method: 'get'});
    let match;
    if ((match = (body || '').match(/ytcfg\.set\s*\(\s*({.+})\s*\)\s*;/))) {
      this.#store.apiConfig = JSON.parse(match[1]);
      return this.#store.apiConfig;
    }
    throw new YouTubeSearchError('Failed to extract YouTube Music Configuration');
  };

  #YTM_PATHS = {
    PLAY_BUTTON: ['overlay', 'musicItemThumbnailOverlayRenderer', 'content', 'musicPlayButtonRenderer'],
    NAVIGATION_BROWSE_ID: ['navigationEndpoint', 'browseEndpoint', 'browseId'],
    NAVIGATION_VIDEO_ID: ['navigationEndpoint', 'watchEndpoint', 'videoId'],
    NAVIGATION_PLAYLIST_ID: ['navigationEndpoint', 'watchEndpoint', 'playlistId'],
    SECTION_LIST: ['sectionListRenderer', 'contents'],
    TITLE_TEXT: ['title', 'runs', 0, 'text'],
  };

  #search = async function search(queryObject, params) {
    /**
     * VideoID Types?
     * OMV: Official Music Video
     * ATV:
     * UGC: User-generated content
     */
    if (typeof queryObject !== 'object') throw new Error('<queryObject> must be an object');
    if (params && typeof params !== 'object') throw new Error('<params>, if defined must be an object');

    let {INNERTUBE_API_KEY, INNERTUBE_CLIENT_NAME, INNERTUBE_CLIENT_VERSION} = await this.#deriveConfig();

    const response = await this.#request('https://music.youtube.com/youtubei/v1/search', {
      timeout: {request: 10000},
      method: 'post',
      searchParams: {alt: 'json', key: INNERTUBE_API_KEY, ...params},
      responseType: 'json',
      json: {
        context: {
          client: {
            clientName: INNERTUBE_CLIENT_NAME,
            clientVersion: INNERTUBE_CLIENT_VERSION,
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

    const YTM_PATHS = this.#YTM_PATHS;

    const shelf = !('continuationContents' in response)
      ? walk(response, YTM_PATHS.SECTION_LIST).map(section => section.musicShelfRenderer || section)
      : [
          walk(response, 'continuationContents', 'musicShelfContinuation') ||
            walk(response, 'continuationContents', 'sectionListContinuation'),
        ];

    return Object.fromEntries(
      shelf.map(layer => {
        const layerName = walk(layer, YTM_PATHS.TITLE_TEXT);
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

              function getItemRuns(item, index) {
                return walk(item, 'flexColumns', index, 'musicResponsiveListItemFlexColumnRenderer', 'text', 'runs');
              }

              function getItemText(item, index, run_index = 0) {
                return getItemRuns(item, index)[run_index].text;
              }

              const result = {};

              let type = layerName === 'Songs' ? 'song' : getItemText(content, 1).toLowerCase();
              if (type === 'single') type = 'album';

              if (['song', 'video', 'album', 'artist', 'playlist'].includes(type)) result.type = type;

              const runs = getItemRuns(content, 1).filter(item => item.text !== ' • ');
              const navigable = runs
                .filter(item => 'navigationEndpoint' in item)
                .map(item => ({name: item.text, id: walk(item, YTM_PATHS.NAVIGATION_BROWSE_ID)}));

              if (['song', 'video', 'album', 'playlist'].includes(type)) {
                result.title = getItemText(content, 0);
              }

              if (['song', 'video', 'album', 'playlist'].includes(type)) {
                [result.artists, result.album] = navigable.reduce(
                  ([artists, album], item) => {
                    if (item.id.startsWith('UC')) artists.push(item);
                    else album = item;
                    return [artists, album];
                  },
                  [[], null],
                );
              }

              if (['song', 'video'].includes(type))
                result.videoId = walk(content, YTM_PATHS.PLAY_BUTTON, 'playNavigationEndpoint', 'watchEndpoint', 'videoId');

              if (
                ['artist', 'album', 'playlist'].includes(type) &&
                !(result.browseId = walk(content, YTM_PATHS.NAVIGATION_BROWSE_ID))
              ) {
                return {};
              }

              if (type === 'song') {
                result.duration = runs[runs.length - 1].text;
              } else if (type === 'video') {
                delete result.album;
                [result.views, result.duration] = runs.slice(-2).map(item => item.text);
                [result.views] = result.views.split(' ');
              } else if (type === 'album') {
                result.type = runs[0].text.toLowerCase();
                delete result.album;
                result.title = getItemText(content, 0);
                result.year = runs[runs.length - 1].text;
              } else if (type === 'artist') {
                result.artist = getItemText(content, 0);
                [result.subscribers] = runs[runs.length - 1].text.split(' ');
              } else if (type === 'playlist') {
                result.author = result.artists;
                delete result.artists;
                delete result.album;
                result.itemCount = parseInt(runs[runs.length - 1].text.split(' ')[0], 10);
              }

              return result;
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
                          )
                        ).other;
                      },
                  expand: !layer.bottomEndpoint
                    ? undefined
                    : async () => (await this.#search(layer.bottomEndpoint.searchEndpoint, {})).other,
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
   * @param {string} [album] Album name
   * @param {number} [duration] Duration in milliseconds
   *
   * If `track` is a number, it becomes duration, leaving `track` undefined.
   * If `album` is a number, it becomes duration, leaving `album` undefined.
   * If `artists` is a string and `track` is undefined, it becomes `track`, leaving artists empty.
   * If `artists` is non-array but `track` is defined, artists becomes an item in the artists array.
   *
   * @returns {YouTubeSearchResult} YouTubeMusicSearchResults
   */
  async search(artists, track, album, duration) {
    [artists, track, album, duration] = _getSearchArgs(artists, track, album, duration);

    const results = await this.#search({query: [track, album, ...artists].join(' ')});
    const strippedMeta = textUtils.stripText([...track.split(' '), album, ...artists]);
    const validSections = [
      ...((results.top || {}).contents || []), // top recommended songs
      ...((results.songs || {}).contents || []), // song section
      ...((results.videos || {}).contents || []), // videos section
    ]
      .map(
        item =>
          item &&
          'title' in item &&
          ['song', 'video'].includes(item.type) && {
            ...item,
            weight: textUtils.getWeight(
              strippedMeta,
              textUtils.stripText([
                ...item.title.split(' '),
                ...(item.album?.name.split(' ') ?? []),
                ...item.artists.map(artist => artist.name),
              ]),
            ),
          },
      )
      .filter(Boolean);
    function calculateAccuracyFor(item, weight) {
      let accuracy = 0;
      // get weighted delta from expected duration
      accuracy += weight - (duration ? Math.abs(duration - item.duration_ms) / duration : 0.5) * 100;
      // if item is a song, bump remaining by 50%, if video, bump up by 25%, anything else - by 5%
      accuracy += (cur => ((item.type === 'song' ? 50 : item.type === 'video' ? 25 : 5) / 100) * cur)(100 - accuracy);
      // TODO: CALCULATE ACCURACY BY AUTHOR
      return accuracy;
    }
    const classified = Object.values(
      validSections.reduce((final, item) => {
        // prune duplicates
        if (item.weight > 65 && item && 'videoId' in item && !(item.videoId in final)) {
          let cleanItem = {
            title: item.title,
            type: item.type,
            author: item.artists,
            duration: item.duration,
            duration_ms: item.duration.split(':').reduce((acc, time) => 60 * acc + +time) * 1000,
            videoId: item.videoId,
            getFeeds: genAsyncGetFeedsFn(item.videoId),
          };
          if ((cleanItem.accuracy = calculateAccuracyFor(cleanItem, item.weight)) > 80) final[item.videoId] = cleanItem;
        }
        return final;
      }, {}),
      // sort descending by accuracy
    ).sort((a, b) => (a.accuracy > b.accuracy ? -1 : 1));
    return classified;
  }
}

export class YouTube {
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
    searchQueue: new AsyncQueue('YouTube:netSearchQueue', 4, async (strippedMeta, ...xFilters) =>
      (
        await this.#store.search({
          query: [...strippedMeta, ...xFilters].join(' '),
          pageStart: 1,
          pageEnd: 2,
        })
      ).videos.reduce(
        (final, item) => ({
          ...final,
          ...(textUtils.getWeight(strippedMeta, textUtils.stripText([...item.title.split(' '), item.author.name])) > 70
            ? (final.results.push(item),
              {
                highestViews: Math.max(final.highestViews, (item.views = item.views || 0)),
              })
            : {}),
        }),
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
   * If `album` is a number, it becomes duration, leaving `album` undefined.
   * If `artists` is a string and `track` is undefined, it becomes `track`, leaving artists empty.
   * If `artists` is non-array but `track` is defined, artists becomes an item in the artists array.
   *
   * @returns {YouTubeSearchResult} YouTubeSearchResults
   */
  async search(artists, track, album, duration) {
    [artists, track, album, duration] = _getSearchArgs(artists, track, album, duration);

    const strippedArtists = textUtils.stripText(artists);
    const strippedMeta = [...textUtils.stripText(track.split(' ')), ...strippedArtists];
    let searchResults = await Promise.all(
      (
        await this.#store.searchQueue.push([
          [strippedMeta, ['Official Audio']],
          [strippedMeta, ['Audio']],
          [strippedMeta, ['Lyrics']],
          [strippedMeta, []],
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
        textUtils.getWeight(strippedArtists, textUtils.stripText([item.author.name])) >= 80 ? (60 / 100) * cur : 0)(
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

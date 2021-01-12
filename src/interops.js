/* eslint-disable max-classes-per-file */

const PythonInterop = require('./pyinterop');

const core = new PythonInterop();

class Dispatcher {
  #dispatch = async (root, method, ...args) => {
    let count = -1;
    [...args].reverse().some(item => ((count += 1), item !== undefined));
    return core.exec(`${root}:${method}`, ...args.slice(0, -count || Infinity));
  };

  static get = (obj, root, initArgs = [], options = {}) => {
    const init = obj
      .#dispatch(root, '_interop_init', ...initArgs)
      // throw errorCode 2 only if we must be initialized
      .catch(err => (!options.mustInit && err.errorCode === 2) || Promise.reject(err));
    return (...args) => init.then(() => obj.#dispatch(root, ...args));
  };
}

class YouTube extends Dispatcher {
  #dispatcher = Dispatcher.get(this, 'youtube', [{quiet: true}], {mustInit: false});

  lookup(id) {
    return this.#dispatcher('lookup', id);
  }
}

class YouTubeMusic extends Dispatcher {
  #dispatcher = Dispatcher.get(this, 'ytmusic', [], {mustInit: false});

  search(query, filter, limit, ignoreSpelling) {
    return this.#dispatcher('search', query, filter, limit, ignoreSpelling);
  }

  getArtist(channelId) {
    return this.#dispatcher('get_artist', channelId);
  }

  getArtistAlbums(channelId, params) {
    return this.#dispatcher('get_artist_albums', channelId, params);
  }

  getAlbum(browseId) {
    return this.#dispatcher('get_album', browseId);
  }

  getSong(videoId) {
    return this.#dispatcher('get_song', videoId);
  }

  getLyrics(browseId) {
    return this.#dispatcher('get_lyrics', browseId);
  }

  getWatchPlaylist(videoId, playlistId, limit, params) {
    return this.#dispatcher('get_watch_playlist', videoId, playlistId, limit, params);
  }

  getPlaylist(self, playlistId, limit) {
    return this.#dispatcher('get_playlist', playlistId, limit);
  }
}

const closeConnection = () => core.close();

module.exports = {YouTube, YouTubeMusic, closeConnection};

async function main() {
  // eslint-disable-next-line global-require
  const deferrable = require('./deferrable');

  await deferrable(async defer => {
    defer(closeConnection);

    const yt = new YouTube();
    const feeds = await yt.lookup('cuxNuMDet0M');
    console.log(feeds);

    const ytm = new YouTubeMusic();
    const searchResult = await ytm.search('Billie Eilish Therefore I Am');
    console.log(searchResult);

    const watchList = await ytm.getWatchPlaylist('oDn4eKyhSH4');
    const lyrics = await ytm.getLyrics(watchList.lyrics);
    console.log(lyrics);

    const artist = await ytm.getArtist('UCERrDZ8oN0U_n9MphMKERcg');
    console.log(artist);
  });
}

if (require.main === module) main().catch(err => console.error('An error occurred\n', err));

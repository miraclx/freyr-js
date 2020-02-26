/* eslint-disable no-underscore-dangle */
const util = require('util');
const Promise = require('bluebird');
const ytSearch = require('yt-search');

const most = require('./most_polyfill');

class YouTube {
  constructor() {
    this._search = util.promisify(ytSearch);
  }

  async search(artists, trackTitle, xFilters, count = Infinity) {
    return (
      await this._search({
        query: artists
          .concat(trackTitle)
          .concat(xFilters)
          .join(' '),
        pageStart: 1,
        pageEnd: 2,
      })
    ).videos
      .filter(
        video =>
          most(artists, keyWord => video.title.toLowerCase().includes(keyWord.toLowerCase())) &&
          video.title.toLowerCase().includes(trackTitle.toLowerCase()),
      )
      .filter(video => !/\d+D/i.test(video.title))
      .map(v => Object.assign(v, {xFilters}))
      .slice(0, count);
  }

  async get(artists, track, duration) {
    return YouTube.classify(
      (
        await Promise.map(
          [
            [artists, track, ['Official Audio'], 5],
            [artists, track, ['Audio'], 5],
            [artists, track, ['Lyrics'], 5],
            [artists, track, [], 5],
          ],
          query => Promise.resolve(this.search(...query)).reflect(),
        )
      ).map(ret => (ret.isFulfilled() ? ret.value() : [])),
      artists,
      duration,
    );
  }

  static classify(stacks, artists, duration) {
    const highestViews = Math.max(...stacks.map(video => video.views));
    function bumpWith(video, accuracy) {
      return (x => x + (video.views === highestViews ? (60 / 100) * (100 - accuracy) : 0))(
        accuracy +
          (most(artists, artist => video.author.name.toLowerCase().includes(artist.toLowerCase()))
            ? (60 / 100) * (100 - accuracy)
            : 0),
      );
    }
    stacks = Object.values(
      stacks
        .flat()
        .reverse()
        .reduce(
          (o, v) => ({
            ...o,
            [v.videoId]: {
              ...v,
              accuracy: bumpWith(v, ((duration - Math.abs(duration - v.seconds * 1000)) / duration) * 100),
            },
          }),
          {},
        ),
    ).sort((a, b) => (a.accuracy > b.accuracy ? -1 : a.accuracy < b.accuracy ? 1 : 0));
    return stacks[0];
  }
}

module.exports = YouTube;

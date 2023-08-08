import FreyrCore from './src/freyr.js';

let corpus = [
  {
    url: 'https://open.spotify.com/track/127QTOFJsJQp5LbJbu3A1y',
    uri: 'spotify:track:127QTOFJsJQp5LbJbu3A1y',
  },
  {
    url: 'https://open.spotify.com/album/623PL2MBg50Br5dLXC9E9e',
    uri: 'spotify:album:623PL2MBg50Br5dLXC9E9e',
  },
  {
    url: 'https://open.spotify.com/artist/6M2wZ9GZgrQXHCFfjv46we',
    uri: 'spotify:artist:6M2wZ9GZgrQXHCFfjv46we',
  },
  {
    url: 'https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M',
    uri: 'spotify:playlist:37i9dQZF1DXcBWIGoYBM5M',
  },
  {
    url: 'https://music.apple.com/us/album/say-so-feat-nicki-minaj/1510821672?i=1510821685',
    uri: 'apple_music:track:1510821685',
  },
  {
    url: 'https://music.apple.com/us/song/1510821685',
    uri: 'apple_music:track:1510821685',
  },
  {
    url: 'https://music.apple.com/us/album/birds-of-prey-the-album/1493581254',
    uri: 'apple_music:album:1493581254',
  },
  {
    url: 'https://music.apple.com/us/artist/412778295',
    uri: 'apple_music:artist:412778295',
  },
  {
    url: 'https://music.apple.com/us/playlist/todays-hits/pl.f4d106fed2bd41149aaacabb233eb5eb',
    uri: 'apple_music:playlist:pl.f4d106fed2bd41149aaacabb233eb5eb',
  },
  {
    url: 'https://www.deezer.com/en/track/642674232',
    uri: 'deezer:track:642674232',
  },
  {
    url: 'https://www.deezer.com/en/album/99687992',
    uri: 'deezer:album:99687992',
  },
  {
    url: 'https://www.deezer.com/en/artist/5340439',
    uri: 'deezer:artist:5340439',
  },
  {
    url: 'https://www.deezer.com/en/playlist/1963962142',
    uri: 'deezer:playlist:1963962142',
  },
];

function main() {
  for (let item of corpus) {
    for (let key in item) {
      let parsed = FreyrCore.parseURI(item[key]);
      if (parsed) {
        console.log(`⏩┬[ \x1b[36m${item[key]}\x1b[39m ]`);
        if (parsed.uri === item.uri) {
          console.log(`  ├ ✅ asURI -> \x1b[36m${parsed.uri}\x1b[39m`);
        } else {
          console.log(`  ├ ❌ asURI -> \x1b[36m${parsed.uri}\x1b[39m (expected \x1b[33m${item.uri}\x1b[39m)`);
        }
        if (parsed.url === item.url) {
          console.log(`  └ ✅ asURL -> \x1b[36m${parsed.url}\x1b[39m`);
        } else {
          console.log(`  └ ❌ asURL -> \x1b[36m${parsed.url}\x1b[39m (expected \x1b[33m${item.url}\x1b[39m)`);
        }
      } else {
        console.log(`❌─[ \x1b[36m${item[key]}\x1b[39m ]`);
      }
    }

    console.log();
  }
}

main();

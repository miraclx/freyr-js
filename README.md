# FreyrJS

> Versatile Multi-Service Music Downloader with NodeJS

[![NPM Version][npm-image]][npm-url]
[![NPM Downloads][downloads-image]][downloads-url]

[![NPM][npm-image-url]][npm-url]

## Requirements

Make sure to have installed the latest versions of the following

* ffmpeg >= 0.9
  * Windows
    * <https://ffmpeg.zeranoe.com/builds/>
    * set `FFMPEG_PATH` to explicitly specify binary to use
    * otherwise, must be defined within PATH
  * POSIX
    * the pre-included version within the `libav-tools` package should be compatible.
    * else, either;
      * compile from source or fetch a pre-built .deb package at <https://ffmpeg.org/download.html>
      * or for debian, the `ppa:mc3man/trusty-media` PPA provides recent builds.
* youtube-dl@latest
  * automatically fetched by installing this package
  * optionally, you can fetch the source yourself <https://github.com/ytdl-org/youtube-dl> and include in your path
* AtomicParsley >= 0.9.6
  * Windows: <https://chocolatey.org/packages/atomicparsley>
  * Posix: check individual distro package managers mostly as `atomicparsley`

## Installing

Via [NPM][npm]:

``` bash
npm install freyr
```

This installs a CLI binary accessible with the `freyr` command.

``` bash
# Check if the freyr command has been installed and accessible on your path
$ freyr -v
v0.4.5
```

## Binary Documentation

### CLI

``` text
Usage: freyr [options] [query...]
```

Example

``` bash
freyr spotify:track:5FNS5Vj69AhRGJWjhrAd01 https://music.apple.com/us/album/stupid-love/1500499210?i=1500499216
```

Use the `--help` flag to see full usage documentation.

### Configuration

All configuration is to be defined within a `conf.json` file in the root of the project.
This file should be of `JSON` format and is to be structured as such.

* `server`: &lt;object&gt;
  * `hostname`: &lt;string&gt;
  * `port`: &lt;number&gt;
* `services`: &lt;[ServiceConfiguration](#service-configuration): object&gt;

```json
// Example: conf.json
{
  "server": {
    "hostname": "localhost",
    "port": 36346,
    "useHttps": false
  },
  "services": {
    "spotify": {
      "client_id": "e9ac6d6fdb4dfc629d6b5827d18cd829",
      "client_secret": "32e2a7217671b8dbaab471a3e6b13ef3"
    }
  }
}
```

### Service Configuration

#### Spotify

Spotify requires a `client_id` and a `client_secret` that can be gotten from their developer dashboard.

For the purpose of this binary, the script has been pre-authenticated to allow direct access.

If you wish to create and use custom keys, [See [Spotify API Authorization](#spotify-api-authorization)].

##### Spotify API Authorization

1. Sign in to the [Spotify Dashboard](https://developer.spotify.com/dashboard/)
2. Click `CREATE A CLIENT ID` and create an app
3. Now click `Edit Settings`
4. Add `http://localhost:36346/callback` to the Redirect URIs
5. Include the `client_id` and the `client_secret` from the dashboard in the `services` object of the `conf.json` file. [[See Confiuration](#configuration)]
6. You are now ready to authenticate with Spotify!

#### Apple Music

This library already includes a pre-defined developer token that should work at will. This developer token is the default token, extracted off the Apple Music website. While this developer token could expire over time, we'll try to update with the most recent developer token as time goes on.

To create a custom developer token, please refer to the Apple Music documentation on this topic.

##### Apple Music API Authorization

[See [Apple Music](#apple-music)]

#### Deezer

Authentication unrequired. API is freely accessible.

## Development

### Building

Feel free to clone, use in adherance to the [license](#license) and perhaps send pull requests

``` bash
git clone https://github.com/miraclx/freyr-js.git
cd freyr-js
npm install
# hack on code
npm run build
```

## License

[Apache 2.0][license] © **Miraculous Owonubi** ([@miraclx][author-url]) &lt;omiraculous@gmail.com&gt;

[npm]:  https://github.com/npm/cli "The Node Package Manager"
[license]:  LICENSE "Apache 2.0 License"
[author-url]: https://github.com/miraclx

[npm-url]: https://npmjs.org/package/freyr
[npm-image]: https://badgen.net/npm/node/freyr
[npm-image-url]: https://nodei.co/npm/freyr.png?stars&downloads
[downloads-url]: https://npmjs.org/package/freyr
[downloads-image]: https://badgen.net/npm/dm/freyr

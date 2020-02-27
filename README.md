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

## Authorization

Using [libeaes], encrypt your keys JSON format with the service name as the key and the value as the credentials

Encryption Key: `a591337828d2cce184152d010206babb88af3ddc13970eccb89528d6c2885156`

Encrypted file: auth_keys.enc

``` json
{
  "spotify": {
    "client_id": "<CLIENT ID>",
    "client_secret": "<CLIENT SECRET>"
  }
}
```

``` bash
libeaes enc auth_keys.json auth_keys.enc
rm auth_keys.json
```

## Usage

### CLI

``` text
Usage: freyr [options] [query...]
```

Example

``` bash
freyr spotify:track:5FNS5Vj69AhRGJWjhrAd01 https://open.spotify.com/track/1NNnmmBEaId0uoWfvtNd8F
```

Use `--help` to see full usage documentation.

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

[libeaes]: https://github.com/miraclx/libeaes-js

[npm-url]: https://npmjs.org/package/freyr
[npm-image]: https://badgen.net/npm/node/freyr
[npm-image-url]: https://nodei.co/npm/freyr.png?stars&downloads
[downloads-url]: https://npmjs.org/package/freyr
[downloads-image]: https://badgen.net/npm/dm/freyr

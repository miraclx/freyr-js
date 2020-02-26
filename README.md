# FreyrJS

> Versatile Multi-Service Music Downloader with NodeJS

[![NPM Version][npm-image]][npm-url]
[![NPM Downloads][downloads-image]][downloads-url]

[![NPM][npm-image-url]][npm-url]

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

## Usage

### CLI

``` text
Usage: freyr [options] <query...>
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

[npm-url]: https://npmjs.org/package/freyr
[npm-image]: https://badgen.net/npm/node/freyr
[npm-image-url]: https://nodei.co/npm/freyr.png?stars&downloads
[downloads-url]: https://npmjs.org/package/freyr
[downloads-image]: https://badgen.net/npm/dm/freyr

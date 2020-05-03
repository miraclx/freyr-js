# FreyrJS

> Versatile Multi-Service Music Downloader with NodeJS

[![NPM Version][npm-image]][npm-url]
[![NPM Downloads][downloads-image]][downloads-url]

[![NPM][npm-image-url]][npm-url]

## Demo

[![Ascii Demo](https://asciinema.org/a/kM2pEzBT3xJNfHGBb13aRcnup.svg)](https://asciinema.org/a/kM2pEzBT3xJNfHGBb13aRcnup?autoplay=1&speed=2)

(Or as [GIF](media/demo.gif))

## Installation

Ensure all [requirements](#requirements) are satisfied before installing.

``` bash
npm install -g git+https://github.com/miraclx/freyr-js.git

# alternatively, with yarn
yarn global add https://github.com/miraclx/freyr-js.git
```

## Getting Started

### Requirements

<details>
<summary>nodejs >= v12.0.0</summary>

<https://nodejs.org/en/download/>

POSIX: [nvm](https://github.com/nvm-sh/nvm) recommended.

``` bash
# install node with this nvm command
$ nvm install v12
```

</details>

<details>
<summary>ffmpeg >= 0.9</summary>

* Windows + macOS
  * Download: <https://ffmpeg.zeranoe.com/builds/>
  * must be defined within your `PATH`
  * otherwise, set `FFMPEG_PATH` to explicitly specify binary to use
* Linux _(check individual package managers)_
  * Debian: The `ppa:mc3man/trusty-media` PPA provides recent builds
  * Arch Linux: `sudo pacman -S ffmpeg`
  * otherwise, compile from source, fetch a pre-built static binary or package at <https://ffmpeg.org/download.html>

</details>

<details>
<summary>youtube-dl @ latest</summary>

* automatically fetched by installing this package
* optionally, you can fetch the source yourself <https://github.com/ytdl-org/youtube-dl> and include in your `PATH`

</details>

<details>
<summary>AtomicParsley >= 0.9.6</summary>

* Windows:
  * Chocolatey: <https://chocolatey.org/packages/atomicparsley>
  * Manually:
    * Download: <https://bitbucket.org/jonhedgerows/atomicparsley/downloads/AtomicParsley-0.9.6-hg109.9183fff907bf.zip>
    * unzip and place the `AtomicParsley.exe` in your `PATH` or the `bins/windows` folder. Create the folders if unexistent.
* POSIX: _(check individual package managers)_
  * Debian: `sudo apt-get install atomicparsley`
  * Arch Linux: `sudo pacman -S atomicparsley`
  * Build from source:

    ``` bash
    # download the tarball
    $ curl https://bitbucket.org/wez/atomicparsley/get/0.9.6.tar.gz -o wez-atomicparsley-da2f6e4fc120.tar.gz

    # gunzip and untar
    $ tar -xzvf wez-atomicparsley-da2f6e4fc120.tar.gz

    # build
    $ cd wez-atomicparsley-da2f6e4fc120
    $ ./autogen.sh
    $ ./configure
    $ make

    # To install locally (project only)
    $ mkdir -p $PROJECT_DIR/bins/posix # ensure directory exists
    $ cp ./AtomicParsley $PROJECT_DIR/bins/posix

    # To install globally
    $ sudo make install
    ```

</details>

<details>
<summary>(linux) libsecret @ latest</summary>

* Debian: `sudo apt-get install libsecret-1-dev`
* Red Hat-based: `sudo yum install libsecret-devel`
* Arch Linux: `sudo pacman -S libsecret`

</details>

### Usage

``` text
Usage: freyr [options] [query...]
```

[See [Service Support](#service-support)].

#### Download a Spotify track

``` bash
freyr spotify:track:5FNS5Vj69AhRGJWjhrAd01
```

#### Download an Apple Music album

``` bash
freyr https://music.apple.com/us/album/stupid-love/1500499210
```

#### Download a Deezer Artist

``` bash
freyr https://deezer.com/artist/1089097
```

Queries can be collated to be processed at once.

``` bash
freyr query1 query2 ... queryN
```

Or list them, line by line into a file and use the `-i, --input <FILE>` flag.

Use the `--help` flag to see full usage documentation.

### Features

* Multi-service support [See [Service Support](#service-support)]
* Playlist generation (per playlist (default) / per query (optional))
* Batch download from queue file
* Simultaneous chunked downloads (powered by [[libxget-js](https://github.com/miraclx/libxget-js)])
* Efficient concurrency
* Bitrate specification (valid: 96, 128, 160, 192, 256, 320)
* Album art embedding & export
* Proper track organisation i.e `FOLDER/\<Artist Name\>/\<Album Name\>/\<Track Name\>`
* Resilient visual progressbar per track download (powered by [[xprogress](https://github.com/miraclx/xprogress)])
* Stats on runtime completion
  * runtime duration
  * number of successfully processed tracks
  * output directory
  * cover art name
  * total output size
  * total network usage
  * network usage for media
  * network usage for album art
  * output bitrate

### Configuration

<details>
<summary>User / Session specific configuration</summary>

Persistent configuration such as authentication keys and their validity period are stored within a session specific configuration file.

This configuration file resides within the user config directory per-platform. e.g `$HOME/.config/FreyrCLI/d3fault.enc` for Linux.

The JSON-formatted file is encrypted with a 64-character random hex that, in-turn is stored within the [Native Password Node Module](https://github.com/atom/node-keytar).
</details>

<details>
<summary id='project-specific-configuration'>Project specific configuration</summary>

All configuration is to be defined within a `conf.json` file in the root of the project.
This file should be of `JSON` format and is to be structured as such.

Defaults are in the [conf.json](conf.json) file.

* `server`: &lt;object&gt; The server URL configuration same as on an individual services' callback option.
  * `hostname`: &lt;string&gt;
  * `port`: &lt;number&gt;
  * `useHttps`: &lt;boolean&gt;
* `image`: &lt;object|number|string&gt; An object with fields pertaining to an image's properties or a number defining its size. (\<width\>x\<height\> or \<size\> as \<size\>x\<size\>)
  * `width`: &lt;number|string&gt;
  * `height`: &lt;number|string&gt;
* `concurrency`: &lt;object&gt;
  * `queries`: &lt;number&gt; The number of queries to be processed concurrently.
  * `tracks`: &lt;number&gt; The number of tracks to be actively processed in parallel.
  * `trackStage`: &lt;number&gt; The number of tracks to concurrently preprocess before being pushed to the main trackQueue.
  * `downloader`: &lt;number&gt; The number of tracks to be concurrently downloaded in parallel.
  * `encoder`: &lt;number&gt; The total number of tracks to be concurrently undergo encoding.
  * `embedder`: &lt;number&gt; The total number of tracks to be concurrently embedded in parallel.
  * `sources`: &lt;number&gt; The number of tracks whose sources should be concurrently collated.
  * `feeds`: &lt;number&gt; The number of tracks whose source feeds should be concurrently gotten.
* `services`: &lt;[ServiceConfiguration](#service-configuration): object&gt;

<details>
<summary>Example JSON</summary>

```json
{
  "server": {
    "hostname": "localhost",
    "port": 36346,
    "useHttps": false
  },
  "image": {
    "width": 640,
    "height": 640
  },
  "services": {
    "spotify": {
      "client_id": "CLIENT_ID",
      "client_secret": "CLIENT_SECRET",
      "refresh_token": "OPTIONAL_REFRESH_TOKEN"
    },
    "apple_music": {
      "developerToken": "DEVELOPER_TOKEN"
    }
  }
}
```

</details>

</details>

### Service Configuration

The [conf.json](conf.json) file already includes some API tokens for service authentication and should work right out of the box. [See [Project specific configuration](#project-specific-configuration)]

<details>
<summary>Spotify</summary>

* `spotify`: &lt;object&gt;
  * `clientId`: &lt;string&gt;
  * `clientSecret`: &lt;string&gt;
  * `refreshToken`: &lt;string&gt;

Spotify requires a `clientId` and a `clientSecret` that can be gotten from their developer dashboard.

If you wish to create and use custom keys, [See [Spotify API Authorization](#spotify-api-authorization)].

An optional `refreshToken` option can be defined which can be used to authenticate a session without necessarily requesting explicit permissions. The `refreshToken` is already bound to a pre-authenticated account.

An invalid `refreshToken`, when specified, would fallback to requesting account access which in-turn would request re-authentication of the users' account.

#### Spotify API Authorization

1. Sign in to the [Spotify Dashboard](https://developer.spotify.com/dashboard/)
2. Click `CREATE A CLIENT ID` and create an app
3. Now click `Edit Settings`
4. Add `http://localhost:36346/callback` to the Redirect URIs
5. Include the `clientId` and the `clientSecret` from the dashboard in the `spotify` object that is a property of the `services` object of the `conf.json` file. [See [Confiuration](#configuration)]
6. You are now ready to authenticate with Spotify!

</details>

<details>
<summary>Apple Music</summary>

* `apple_music`: &lt;object&gt;
  * `storefront`: &lt;string&gt;
  * `developerToken`: &lt;string&gt;

This library already includes a pre-defined developer token that should work at will. This developer token is the default token, extracted off the Apple Music website. While this developer token could expire over time, we'll try to update with the most recent developer token as time goes on.

To create a custom developer token, please refer to the Apple Music documentation on this topic.

The `storefront` option defines the default storefront to be used in the absence of a specification.

#### Apple Music API Authorization

[See [Apple Music API: Getting Keys and Creating Tokens
](https://developer.apple.com/documentation/applemusicapi/getting_keys_and_creating_tokens)]

After successfully acquiring the developer token, include the `developerToken` to the `apple_music` object that's a property of the `services` object in the `conf.json` file. [See [Confiuration](#configuration)]
</details>

<details>
<summary>Deezer</summary>

Authentication unrequired. API is freely accessible.

</details>

### Return Codes

* 0: OK
* 1: Invalid query
* 2: Invalid flag value
* 3: Error with working directory
* 4: Invalid / Inexistent configuration file
* 5: Network error
* 6: Failed to initialize a freyr instance

## Service Support

| Service | Track | Album | Artist | Playlist |
| :-----: | :---: | :---: | :----: | :------: |
| [Spotify](src/services/spotify.js) |   ✔   |   ✔   |    ✔   |     ✔    |
| [Apple Music](src/services/apple_music.js) |   ✔   |   ✔   |    ✔   |     ✔    |
| [Deezer](src/services/deezer.js) |   ✔   |   ✔   |    ✔   |     ✔    |
| Youtube Music |   ✗   |   ✗   |    ✗   |     ✗    |

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

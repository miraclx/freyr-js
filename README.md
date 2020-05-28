# FreyrJS

> Versatile Multi-Service Music Downloader with NodeJS

<!-- [![NPM Version][npm-image]][npm-url] -->
<!-- [![NPM Downloads][downloads-image]][downloads-url] -->

<!-- [![NPM][npm-image-url]][npm-url] -->

![CodeFactor Grade](https://img.shields.io/codefactor/grade/github/miraclx/freyr-js)
![GitHub top language](https://img.shields.io/github/languages/top/miraclx/freyr-js)
![Snyk Vulnerabilities for GitHub Repo](https://img.shields.io/snyk/vulnerabilities/github/miraclx/freyr-js)
![GitHub last commit](https://img.shields.io/github/last-commit/miraclx/freyr-js)

![GitHub repo size](https://img.shields.io/github/repo-size/miraclx/freyr-js)
![GitHub issues](https://img.shields.io/github/issues/miraclx/freyr-js)
![GitHub](https://img.shields.io/github/license/miraclx/freyr-js)
![NodeJS Version](https://img.shields.io/badge/node-%3e%3D%20v12-green&plastic)

## Demo

[![ASCII Demo](media/demo.gif)](https://asciinema.org/a/kM2pEzBT3xJNfHGBb13aRcnup?autoplay=1&speed=2 "Click to view ASCII")

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
<summary>python >= v3.2</summary>

<https://www.python.org/downloads/>

POSIX: _(check individual package managers)_

* *Debian: `sudo apt-get install atomicparsley`
* *ArchLinux: `sudo pacman -S python`
* Android (Termux): `apt install python`
* _(`*`: should already be preinstalled)_

</details>

<details>
<summary>nodejs >= v12.0.0</summary>

<https://nodejs.org/en/download/>

POSIX: [nvm](https://github.com/nvm-sh/nvm) recommended.

``` bash
# install node with this nvm command
$ nvm install v12
```

Android (Termux): `apt install nodejs`

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
  * Android (Termux): `apt install ffmpeg`
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
  * Android (Termux): `apt install atomicparsley`
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

### Usage

``` text
Usage: freyr [options] [query...]
```

[See [Service Support](#service-support)].

#### Get CLI Help

<details>
<summary> <code>freyr --help</code> </summary>

``` text
freyr v0.7.0 - (c) Miraculous Owonubi <omiraculous@gmail.com>
-------------------------------------------------------------
Usage: freyr [options] [query...]

Versatile Multi-Service Music Downloader with NodeJS

Options:
  -i, --input <FILE>          use URIs found in the specified FILE as queries (file size limit: 1 MiB)
                              (each query on a new line, use '#' for comments, whitespaces ignored)
  -b, --bitrate <N>           set bitrate for audio encoding
                              (valid: 96,128,160,192,256,320) (default: "320k")
  -n, --chunks <N>            number of concurrent chunk streams with which to download (default: 7)
  -t, --tries <N>             set number of retries for each chunk before giving up (`infinite` for infinite) (default: 10)
  -d, --directory <DIR>       save tracks to DIR/.. (default: ".")
  -c, --cover <name>          custom name for the cover art (default: "cover.png")
  --cover-size <size>         preferred cover art dimensions
                              (format: <width>x<height> or <size> as <size>x<size>) (default: "640x640")
  -C, --no-cover              skip saving a cover art
  -z, --concurrency <SPEC>    specify key-value concurrency pairs, repeat to add more options (key omission implies track concurrency)
                              (format: <[key=]value>) (valid: queries,tracks,trackStage,downloader,encoder,embedder)
  -f, --force                 force overwrite of existing files
  -o, --config <file>         use alternative conf file
  -p, --playlist <file>       create playlist for all successfully collated tracks
  -P, --no-playlist           skip creating a playlist file for collections
  -s, --storefront <COUNTRY>  country storefront code
  -x, --filter <SEQ>          filter matches [explicit] (unimplemented)
  -g, --groups <GROUP_TYPE>   filter collections by single/album/appears_on/compilation (unimplemented)
  -T, --no-tree               don't organise tracks in directory structure `[DIR/]<ARTIST>/<ALBUM>/<TRACK>`
  --tags                      tag configuration specification
                              (format: <key=value>) (reserved keys: [exclude, account]) (unimplemented)
  --via-tor                   tunnel downloads through the tor network (unimplemented)
  -D, --downloader <SERVICE>  specify a preferred download source or a `,`-separated preference order
                              (valid: youtube) (default: "youtube")
  --cache-dir <DIR>           specify alternative cache directory (unimplemented) (default: "<tmp>")
  --timeout <N>               network inactivity timeout (ms) (default: 10000)
  --no-stats                  don't show the stats on completion
  --pulsate-bar               show a pulsating bar
  --single-bar                show a single bar for the download, hide chunk-view
                              (default when number of chunks/segments exceed printable space)
  -v, --version               output the version number
  -h, --help                  output usage information
```

</details>

#### Download a Spotify track

<details>
<summary> <code>freyr spotify:track:5FNS5Vj69AhRGJWjhrAd01</code> </summary>

``` text
freyr v0.7.0 - (c) Miraculous Owonubi <omiraculous@gmail.com>
-------------------------------------------------------------
Checking directory permissions...[done]
[spotify:track:5FNS5Vj69AhRGJWjhrAd01]
 [•] Identifying service...[Spotify]
 [•] Checking authenticated user...[unauthenticated]
 [Spotify Login]
  [•] Logging in...[done]
 Detected [track]
 Obtaining track metadata...[done]
  ⯈ Title: Slow Dance
  ⯈ Album: Slow Dance
  ⯈ Artist: AJ Mitchell
  ⯈ Year: 2019
  ⯈ Playtime: 02:58
 [•] Collating...
  • [01 Slow Dance]
     | ⮞ Collating sources...
     |  ⮞ [•] YouTube...[success]
     | ⮞ Awaiting audiofeeds...[done]
     | [✔] Got album art
     | [✔] Got raw track file
     | [•] Post Processing...
 [•] Download Complete
 [•] Embedding Metadata...
  • [✔] 01 Slow Dance
[•] Collation Complete
========== Stats ==========
 [•] Runtime: [59.1s]
 [•] Total tracks: [01]
     ⏩  Skipped: [00]
     ✔  Passed: [01]
     ✗  Failed: [00]
 [•] Output directory: [.]
 [•] Cover Art: cover.png (640x640)
 [•] Total Output size: 7.30 MB
 [•] Total Network Usage: 3.13 MB
     ♫ Media: 3.03 MB
     ▶ Album Art: 106.76 KB
 [•] Output bitrate: 320k
===========================
```

</details>

#### Download an Apple Music album

<details>
<summary> <code> freyr https://music.apple.com/us/album/stupid-love/1500499210 </code> </summary>

``` text
freyr v0.7.0 - (c) Miraculous Owonubi <omiraculous@gmail.com>
-------------------------------------------------------------
Checking directory permissions...[done]
[https://music.apple.com/us/album/stupid-love/1500499210]
 [•] Identifying service...[Apple Music]
 [•] Checking authenticated user...[authenticated]
 Detected [album]
 Obtaining album metadata...[done]
  ⯈ Album Name: Stupid Love
  ⯈ Artist: Lady Gaga
  ⯈ Tracks: 1
  ⯈ Type: Album
  ⯈ Year: 2020
  ⯈ Genres: Pop, Music
 [•] Collating [Stupid Love]...
  [•] Inquiring tracks...[done]
   • [01 Stupid Love]
      | ⮞ Collating sources...
      |  ⮞ [•] YouTube...[success]
      | ⮞ Awaiting audiofeeds...[done]
      | [✔] Got album art
      | [✔] Got raw track file
      | [•] Post Processing...
 [•] Download Complete
 [•] Embedding Metadata...
  • [✔] 01 Stupid Love
[•] Collation Complete
========== Stats ==========
 [•] Runtime: [1m 4.7s]
 [•] Total tracks: [01]
     ⏩  Skipped: [00]
     ✔  Passed: [01]
     ✗  Failed: [00]
 [•] Output directory: [.]
 [•] Cover Art: cover.png (640x640)
 [•] Total Output size: 7.93 MB
 [•] Total Network Usage: 3.30 MB
     ♫ Media: 3.17 MB
     ▶ Album Art: 121.02 KB
 [•] Output bitrate: 320k
===========================
```

</details>

#### Download a Deezer Artist

<details>
<summary> <code> freyr https://www.deezer.com/us/artist/14808825 </code> </summary>

``` text
freyr v0.7.0 - (c) Miraculous Owonubi <omiraculous@gmail.com>
-------------------------------------------------------------
Checking directory permissions...[done]
[https://www.deezer.com/us/artist/14808825]
 [•] Identifying service...[Deezer]
 [•] Checking authenticated user...[authenticated]
 Detected [artist]
 Obtaining artist metadata...[done]
  ⯈ Artist: Mazie
  ⯈ Followers: 2
    > Gathering collections...[done]
 [•] Collating...
  (01) [no friends] (single)
   [•] Inquiring tracks...[done]
    • [01 no friends]
       | ⮞ Collating sources...
       |  ⮞ [•] YouTube...[success]
       | ⮞ Awaiting audiofeeds...[done]
       | [✔] Got album art
       | [✔] Got raw track file
       | [•] Post Processing...
 [•] Download Complete
 [•] Embedding Metadata...
  • [✔] 01 no friends
[•] Collation Complete
========== Stats ==========
 [•] Runtime: [56.2s]
 [•] Total tracks: [01]
     ⏩  Skipped: [00]
     ✔  Passed: [01]
     ✗  Failed: [00]
 [•] Output directory: [.]
 [•] Cover Art: cover.png (640x640)
 [•] Total Output size: 4.36 MB
 [•] Total Network Usage: 1.93 MB
     ♫ Media: 1.82 MB
     ▶ Album Art: 103.21 KB
 [•] Output bitrate: 320k
===========================
```

</details>

#### Batch downloads

##### via Arguments

Queries can be collated to be processed at once.

``` bash
freyr query1 query2 ... queryN
```

##### via Batch File

Queries can be batched into a file and loaded all at once with the `-i, --input <FILE>` flag.
Queries should be on separate lines.

Lines starting with a `#` are treated as comments and ignored. comments can also be inlined with everything following the `#` character ignored.

``` text
# ./queue.txt

# Hailee Steinfeld
https://open.spotify.com/track/5Gu0PDLN4YJeW75PpBSg9p # (track) Let Me Go
https://open.spotify.com/track/7GCVboEDzfL3NKp1NrAgHR # (track) Wrong Direction

# (album) Rina Sawayama
https://open.spotify.com/album/3stadz88XVpHcXnVYMHc4J
```

``` bash
freyr -i ./queue.txt
```

Use the [`--help`](#get-cli-help) flag to see full usage documentation.

#### URIs

Services can be queried with short URIs containing the type and ID for the resource.

<table>
  <thead>
    <tr>
      <th> identifier </th>
      <th> </th>
      <th> type </th>
      <th> </th>
      <th> id </th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td rowspan=4>
        <a href="#service-support"> URI Short Tags </a>
      </td>
      <td rowspan=4> : </td>
      <td> track </td>
      <td rowspan=4> : </td>
      <td rowspan=4> ~ </td>
    </tr>
    <tr>
      <td> album </td>
    </tr>
    <tr>
      <td> artist </td>
    </tr>
    <tr>
      <td> playlist </td>
    </tr>
  </tbody>
</table>

[Examples](#ssue)

### Features

* Multi-service support [See [Service Support](#service-support)]
* Playlist generation (per playlist (default) / per query (optional))
* Batch download from queue file
* Simultaneous chunked downloads (powered by [[libxget-js](https://github.com/miraclx/libxget-js)])
* Efficient concurrency
* Bitrate specification (valid: 96, 128, 160, 192, 256, 320)
* Album art embedding & export
* Proper track organisation i.e `FOLDER/<Artist Name>/<Album Name>/<Track Name>`
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

</details>

<details>
<summary id='project-specific-configuration'>Project specific configuration</summary>

All configuration is to be defined within a `conf.json` file in the root of the project.
This file should be of `JSON` format and is to be structured as such.

Defaults are in the [conf.json](conf.json) file.

* `server`: \<object\> The server URL configuration same as on an individual services' callback option.
  * `hostname`: \<string\>
  * `port`: \<number\>
  * `useHttps`: \<boolean\>
* `image`: \<object|number|string\> An object with fields pertaining to an image's properties or a number defining its size. (\<width\>x\<height\> or \<size\> as \<size\>x\<size\>)
  * `width`: \<number|string\>
  * `height`: \<number|string\>
* `concurrency`: \<object\>
  * `queries`: \<number\> The number of queries to be processed concurrently.
  * `tracks`: \<number\> The number of tracks to be actively processed in parallel.
  * `trackStage`: \<number\> The number of tracks to concurrently preprocess before being pushed to the main trackQueue.
  * `downloader`: \<number\> The number of tracks to be concurrently downloaded in parallel.
  * `encoder`: \<number\> The total number of tracks to be concurrently undergo encoding.
  * `embedder`: \<number\> The total number of tracks to be concurrently embedded in parallel.
  * `sources`: \<number\> The number of tracks whose sources should be concurrently collated.
  * `feeds`: \<number\> The number of tracks whose source feeds should be concurrently gotten.
* `services`: \<[ServiceConfiguration](#service-configuration): object\>
* `dirs`: \<object\>
  * `output`: \<string\> Default download directory. Default: `"."`
* `downloader`: \<object\>
  * `order`: \<array\> Service download sources order.
    * Freyr would check these download sources in the order which they are defined. Failure to get a query from a source would try the next available source.
    * supported: `youtube`
    * default: `[ "youtube" ]`

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

* `spotify`: \<object\>
  * `clientId`: \<string\>
  * `clientSecret`: \<string\>
  * `refreshToken`: \<string\>

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

* `apple_music`: \<object\>
  * `storefront`: \<string\>
  * `developerToken`: \<string\>

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

| Service | Track | Album | Artist | Playlist | [URI Short Tags](#uris) |
| :-----: | :---: | :---: | :----: | :------: | :------------: |
| [Spotify](src/services/spotify.js) |   ✔   |   ✔   |    ✔   |     ✔    | `spotify:` |
| [Apple Music](src/services/apple_music.js) |   ✔   |   ✔   |    ✔   |     ✔    | `apple_music:` |
| [Deezer](src/services/deezer.js) |   ✔   |   ✔   |    ✔   |     ✔    | `deezer:` |
| Youtube Music |   ✗   |   ✗   |    ✗   |     ✗    | ✗ |

<details>
<summary id="ssue"> <strong> Short Service URI Examples </strong> </summary>
  <table>
    <thead>
      <tr>
        <th> Service </th>
        <th> Resource Type </th>
        <th colspan=2> URIS </th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td rowspan=8> Spotify </td>
        <td rowspan=2> track </td>
          <td> URL </td>
          <td> <a href="https://open.spotify.com/track/127QTOFJsJQp5LbJbu3A1y"> https://open.spotify.com/track/127QTOFJsJQp5LbJbu3A1y </a> </td>
        </tr>
        <tr>
          <td> URI </td>
          <td> <code> spotify:track:127QTOFJsJQp5LbJbu3A1y </code> </td>
        </tr>
        <tr>
          <td rowspan=2> album </td>
          <td> URL </td>
          <td> <a href="https://open.spotify.com/album/623PL2MBg50Br5dLXC9E9e"> https://open.spotify.com/album/623PL2MBg50Br5dLXC9E9e </a> </td>
        </tr>
          <tr>
            <td> URI </td>
            <td> <code> spotify:album:623PL2MBg50Br5dLXC9E9e </code> </td>
          </tr>
        <tr>
          <td rowspan=2> artist </td>
          <td> URL </td>
          <td> <a href="https://open.spotify.com/artist/6M2wZ9GZgrQXHCFfjv46we"> https://open.spotify.com/artist/6M2wZ9GZgrQXHCFfjv46we </a> </td>
        </tr>
          <tr>
            <td> URI </td>
            <td> <code> spotify:artist:6M2wZ9GZgrQXHCFfjv46we </code> </td>
          </tr>
        <tr>
          <td rowspan=2> playlist </td>
          <td> URL </td>
          <td> <a href="https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M"> https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M </a> </td>
        </tr>
          <tr>
            <td> URI </td>
            <td> <code> spotify:playlist:37i9dQZF1DXcBWIGoYBM5M </code> </td>
          </tr>
        </tr>
      </tr>
      <tr>
        <td rowspan=8> Apple Music </td>
        <td rowspan=2> track </td>
          <td> URL </td>
          <td> <a href="https://music.apple.com/us/album/say-so-feat-nicki-minaj/1510821672?i=1510821685"> https://music.apple.com/us/album/say-so-feat-nicki-minaj/1510821672?i=1510821685 </a> </td>
        </tr>
        <tr>
          <td> URI </td>
          <td> <code> apple_music:track:1510821685 </code> </td>
        </tr>
        <tr>
          <td rowspan=2> album </td>
          <td> URL </td>
          <td> <a href="https://music.apple.com/us/album/birds-of-prey-the-album/1493581254"> https://music.apple.com/us/album/birds-of-prey-the-album/1493581254 </a> </td>
        </tr>
          <tr>
            <td> URI </td>
            <td> <code> apple_music:album:1493581254 </code> </td>
          </tr>
        <tr>
          <td rowspan=2> artist </td>
          <td> URL </td>
          <td> <a href="https://music.apple.com/us/artist/412778295"> https://music.apple.com/us/artist/412778295 </a> </td>
        </tr>
          <tr>
            <td> URI </td>
            <td> <code> apple_music:artist:412778295 </code> </td>
          </tr>
        <tr>
          <td rowspan=2> playlist </td>
          <td> URL </td>
          <td> <a href="https://music.apple.com/us/playlist/todays-hits/pl.f4d106fed2bd41149aaacabb233eb5eb"> https://music.apple.com/us/playlist/todays-hits/pl.f4d106fed2bd41149aaacabb233eb5eb </a> </td>
        </tr>
          <tr>
            <td> URI </td>
            <td> <code> apple_music:playlist:pl.f4d106fed2bd41149aaacabb233eb5eb </code> </td>
          </tr>
        </tr>
      </tr>
      <tr>
        <td rowspan=8> Deezer </td>
        <td rowspan=2> track </td>
          <td> URL </td>
          <td> <a href="https://www.deezer.com/en/track/642674232"> https://www.deezer.com/en/track/642674232 </a> </td>
        </tr>
        <tr>
          <td> URI </td>
          <td> <code> deezer:track:642674232 </code> </td>
        </tr>
        <tr>
          <td rowspan=2> album </td>
          <td> URL </td>
          <td> <a href="https://www.deezer.com/en/album/99687992"> https://www.deezer.com/en/album/99687992 </a> </td>
        </tr>
          <tr>
            <td> URI </td>
            <td> <code> deezer:album:99687992 </code> </td>
          </tr>
        <tr>
          <td rowspan=2> artist </td>
          <td> URL </td>
          <td> <a href="https://www.deezer.com/en/artist/5340439"> https://www.deezer.com/en/artist/5340439 </a> </td>
        </tr>
          <tr>
            <td> URI </td>
            <td> <code> deezer:artist:5340439 </code> </td>
          </tr>
        <tr>
          <td rowspan=2> playlist </td>
          <td> URL </td>
          <td> <a href="https://www.deezer.com/en/playlist/1963962142"> https://www.deezer.com/en/playlist/1963962142 </a> </td>
        </tr>
          <tr>
            <td> URI </td>
            <td> <code> deezer:playlist:1963962142 </code> </td>
          </tr>
        </tr>
      </tr>
    </tbody>
  </table>

</details>

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

[Apache 2.0][license] © **Miraculous Owonubi** ([@miraclx][author-url]) \<omiraculous@gmail.com\>

[npm]:  https://github.com/npm/cli "The Node Package Manager"
[license]:  LICENSE "Apache 2.0 License"
[author-url]: https://github.com/miraclx

[npm-url]: https://npmjs.org/package/freyr
[npm-image]: https://badgen.net/npm/node/freyr
[npm-image-url]: https://nodei.co/npm/freyr.png?stars&downloads
[downloads-url]: https://npmjs.org/package/freyr
[downloads-image]: https://badgen.net/npm/dm/freyr

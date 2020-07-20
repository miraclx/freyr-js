<h1 align="center">
  <a href="https://github.com/miraclx/freyr-js">
    <img src="https://github.com/miraclx/freyr-js/raw/master/media/logo.gif" alt="FreyrJS - connoisseur of music">
  </a>
  <br> FreyrJS </br>
</h1>

<h4 align="center">
  A versatile, service-agnostic music downloader and manager
</h4>

<div align="center">

# [![GitHub](https://img.shields.io/badge/by-miraclx-gray&plastic)](https://github.com/miraclx) ![CodeFactor Grade](https://img.shields.io/codefactor/grade/github/miraclx/freyr-js) ![GitHub top language](https://img.shields.io/github/languages/top/miraclx/freyr-js) ![Docker Cloud Build Status](https://img.shields.io/docker/cloud/build/freyrcli/freyrjs) ![Docker Cloud Build Status](https://img.shields.io/docker/pulls/freyrcli/freyrjs.svg) ![GitHub](https://img.shields.io/github/license/miraclx/freyr-js) ![NodeJS Version](https://img.shields.io/badge/node-%3e%3D%20v12-green&plastic) ![GitHub repo size](https://img.shields.io/github/repo-size/miraclx/freyr-js) ![GitHub issues](https://img.shields.io/github/issues/miraclx/freyr-js) ![GitHub last commit](https://img.shields.io/github/last-commit/miraclx/freyr-js)

  <sub>Built with ❤︎ by
  <a href="https://github.com/miraclx">Miraculous Owonubi</a>
</div>

## Demo

[![ASCII Demo](https://github.com/miraclx/freyr-js/raw/master/media/demo.gif)](https://asciinema.org/a/kM2pEzBT3xJNfHGBb13aRcnup?autoplay=1&speed=2 "Click to view ASCII")

## Installation

### Manually

Ensure all [requirements](#requirements) are satisfied before installing.

``` bash
npm install -g git+https://github.com/miraclx/freyr-js.git

# alternatively, with yarn
yarn global add https://github.com/miraclx/freyr-js.git
```

### Docker

We provide [officially prebuilt images](https://hub.docker.com/r/freyrcli/freyrjs) (automated builds from this repo).

Pull the image:

``` bash
docker pull freyrcli/freyrjs
```

| Base Image      | Size | Tag |
| :-------------: | :--: |:-------- |
| Alpine (musl) * | ![Docker Image Size (:alpine)](https://img.shields.io/docker/image-size/freyrcli/freyrjs/latest?color=gray&label=%20&logo=docker) | `freyrcli/freyrjs:latest` |
| Arch Linux      | ![Docker Image Size (:archlinux)](https://img.shields.io/docker/image-size/freyrcli/freyrjs/archlinux?color=gray&label=%20&logo=docker) | `freyrcli/freyrjs:archlinux` |

*: default

#### Usage (Docker)

<details>
<summary> Structure </summary>

``` bash
docker run --rm -v $PWD:/data <tag> [options, arguments and queries...]
```

</details>

Example, with the `freyrcli/freyrjs:latest` tag:

``` bash
docker run --rm -v $pwd:/data freyrcli/freyrjs:latest
```

Alternatively, create a handy alias

``` bash
alias freyr='docker run --rm -v $PWD:/data freyrcli/freyrjs:latest'
```

[See [Docker Development](#docker-development)]

## Getting Started

### Requirements

As an alternative to setting up freyr and its dependencies on your host system, consider the [Docker installation method](#docker) for a containerized experience.

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
Usage: freyr [options] [subcommand]
```

[See [Service Support](#service-support)].

#### Get CLI Help

<details>
<summary> <code>freyr get --help</code> </summary>

``` text
    ____
   / __/_______  __  _______
  / /_/ ___/ _ \/ / / / ___/
 / __/ /  /  __/ /_/ / /
/_/ /_/   \___/\__, /_/
              /____/ v0.1.0

freyr v0.1.0 - (c) Miraculous Owonubi <omiraculous@gmail.com>
-------------------------------------------------------------
Usage: freyr get [options] [query...]

Download music tracks from queries

Options:
  -i, --input <FILE>           use URIs found in the specified FILE as queries (file size limit: 1 MiB)
                               (each query on a new line, use '#' for comments, whitespaces ignored)
                               (example: `-i queue.txt`)
  -b, --bitrate <N>            set audio quality / bitrate for audio encoding
                               (valid: 96,128,160,192,256,320) (default: "320k")
  -n, --chunks <N>             number of concurrent chunk streams with which to download (default: 7)
  -r, --retries <N>            set number of retries for each chunk before giving up
                               (`infinite` for infinite) (default: 10)
  -t, --meta-retries <N>       set number of retries for collating track feeds (`infinite` for infinite) (default: 5)
  -d, --directory <DIR>        save tracks to DIR/..
  -c, --cover <NAME>           custom name for the cover art (default: "cover.png")
  --cover-size <SIZE>          preferred cover art dimensions
                               (format: <width>x<height> or <size> as <size>x<size>) (default: "640x640")
  -C, --no-cover               skip saving a cover art
  -x, --format <FORMAT>        preferred audio output format (to export) (unimplemented)
                               (valid: mp3,m4a,flac) (default: "m4a")
  -D, --downloader <SERVICE>   specify a preferred download source or a `,`-separated preference order
                               (valid: youtube,yt_music) (default: "yt_music")
  -l, --filter <MATCH>         filter matches off patterns (repeatable and optionally `,`-separated) (unimplemented)
                               (value ommision implies `true` if applicable)
                               (format: <key=value>) (example: title="when we all fall asleep*",type=album)
                               See `freyr help filter` for more information
  -z, --concurrency <SPEC>     key-value concurrency pairs (repeatable and optionally `,`-separated)
                               (format: <[key=]value>) (key omission implies track concurrency)
                               (valid(key): queries,tracks,trackStage,downloader,encoder,embedder)
                               (example: `queries=2,downloader=4` processes 2 CLI queries,
                               downloads at most 4 tracks concurrently)
  --gapless                    set the gapless playback flag for all tracks
  -f, --force                  force overwrite of existing files
  -o, --config <FILE>          specify alternative configuration file
  -p, --playlist <FILENAME>    create playlist for all successfully collated tracks
  -P, --no-playlist            skip creating a playlist file for collections
  --playlist-dir <DIR>         directory to save playlist file to, if any, (default: tracks base directory)
  --playlist-noappend          do not append to the playlist file, if any exists
  --playlist-noescape          do not escape invalid characters within playlist entries
  --playlist-namespace <SPEC>  namespace to prefix on each track entry, relative to tracks base directory
                               useful for, but not limited to custom (file:// or http://) entries
                               (example, you can prefix with a HTTP domain path: `http://webpage.com/music`)
  --playlist-force-append      force append collection tracks to the playlist file
  -s, --storefront <COUNTRY>   country storefront code (example: us,uk,ru)
  -T, --no-tree                don't organise tracks in directory structure `[DIR/]<ARTIST>/<ALBUM>/<TRACK>`
  --tags                       tag configuration specification (repeatable and optionally `,`-separated) (unimplemented)
                               (format: <key=value>) (reserved keys: [exclude, account])
  --via-tor                    tunnel network traffic through the tor network (unimplemented)
  --cache-dir <DIR>            specify alternative cache directory, `<tmp>` for tempdir
  -m, --mem-cache <SIZE>       max size of bytes to be cached in-memory for each download chunk
  --no-mem-cache               disable in-memory chunk caching (restricts to sequential download)
  --timeout <N>                network inactivity timeout (ms) (default: 10000)
  --no-auth                    skip authentication procedure
  --no-browser                 disable auto-launching of user browser
  --no-net-check               disable internet connection check
  --ffmpeg <PATH>              explicit path to the ffmpeg binary
  --youtube-dl <PATH>          explicit path to the youtube-dl binary
  --atomic-parsley <PATH>      explicit path to the atomic-parsley binary
  --no-stats                   don't show the stats on completion
  --pulsate-bar                show a pulsating bar
  --single-bar                 show a single bar for the download, hide chunk-view
                               (default when number of chunks/segments exceed printable space)
  -h, --help                   show this help information

Environment Variables:
  SHOW_DEBUG_STACK             show extended debug information
  FFMPEG_PATH                  custom ffmpeg path, alternatively use `--ffmpeg`
  YOUTUBE_DL_PATH              custom youtube-dl path, alternatively use `--youtube-dl`
  ATOMIC_PARSLEY_PATH          custom AtomicParsley path, alternatively use `--atomic-parsley`

Info:
  When downloading playlists, the tracks are downloaded individually into
  their respective folders. However, a m3u8 playlist file is generated in
  the base directory with the name of the playlist that lists the tracks
```

</details>

#### Download a Spotify track

<details>
<summary> <code>freyr spotify:track:5FNS5Vj69AhRGJWjhrAd01</code> </summary>

``` text
    ____
   / __/_______  __  _______
  / /_/ ___/ _ \/ / / / ___/
 / __/ /  /  __/ /_/ / /
/_/ /_/   \___/\__, /_/
              /____/ v0.1.0

freyr v0.1.0 - (c) Miraculous Owonubi <omiraculous@gmail.com>
-------------------------------------------------------------
Checking directory permissions...[done]
[spotify:track:5FNS5Vj69AhRGJWjhrAd01]
 [•] Identifying service...[Spotify]
 [•] Checking authentication...[unauthenticated]
 [Spotify Login]
  [•] Logging in...[done]
 Detected [track]
 Obtaining track metadata...[done]
  ➤ Title: Slow Dance
  ➤ Album: Slow Dance
  ➤ Artist: AJ Mitchell
  ➤ Year: 2019
  ➤ Playtime: 02:58
 [•] Collating...
 • [01 Slow Dance]
    | ➤ Collating sources...
    |  ➤ [•] YouTube Music...[success, found 1 source]
    | ➤ Awaiting audiofeeds...[done]
    | [✓] Got album art
    | [✓] Got raw track file
    | [•] Post Processing...
 [•] Download Complete
 [•] Embedding Metadata...
  • [✓] 01 Slow Dance
[•] Collation Complete
========== Stats ==========
 [•] Runtime: [31.7s]
 [•] Total queries: [01]
 [•] Total tracks: [01]
     » Skipped: [00]
     ✓ Passed:  [01]
     ✕ Failed:  [00]
 [•] Output directory: [.]
 [•] Cover Art: cover.png (640x640)
 [•] Total Output size: 7.30 MB
 [•] Total Network Usage: 3.12 MB
     ♫ Media: 3.02 MB
     ➤ Album Art: 106.76 KB
 [•] Output bitrate: 320k
===========================
```

</details>

#### Download an Apple Music album

<details>
<summary> <code> freyr https://music.apple.com/us/album/im-sorry-im-not-sorry-ep/1491795443 </code> </summary>

``` text
    ____
   / __/_______  __  _______
  / /_/ ___/ _ \/ / / / ___/
 / __/ /  /  __/ /_/ / /
/_/ /_/   \___/\__, /_/
              /____/ v0.1.0

freyr v0.1.0 - (c) Miraculous Owonubi <omiraculous@gmail.com>
-------------------------------------------------------------
Checking directory permissions...[done]
[https://music.apple.com/us/album/im-sorry-im-not-sorry-ep/1491795443]
 [•] Identifying service...[Apple Music]
 [•] Checking authentication...[authenticated]
 Detected [album]
 Obtaining album metadata...[done]
  ➤ Album Name: I'm Sorry, I'm Not Sorry
  ➤ Artist: Sody
  ➤ Tracks: 4
  ➤ Type: Album
  ➤ Year: 2020
  ➤ Genres: Singer/Songwriter, Music
 [•] Collating [I'm Sorry, I'm Not Sorry]...
  [•] Inquiring tracks...[done]
   • [01 What We Had]
      | ➤ Collating sources...
      |  ➤ [•] YouTube Music...[success, found 4 sources]
      | ➤ Awaiting audiofeeds...[done]
      | [✓] Got album art
      | [✓] Got raw track file
      | [•] Post Processing...
   • [02 Reason To Stay]
      | ➤ Collating sources...
      |  ➤ [•] YouTube Music...[success, found 6 sources]
      | ➤ Awaiting audiofeeds...[done]
      | [✓] Got album art
      | [✓] Got raw track file
      | [•] Post Processing...
   • [03 Nothing Ever Changes]
      | ➤ Collating sources...
      |  ➤ [•] YouTube Music...[success, found 4 sources]
      | ➤ Awaiting audiofeeds...[done]
      | [✓] Got album art
      | [✓] Got raw track file
      | [•] Post Processing...
   • [04 Love's a Waste]
      | ➤ Collating sources...
      |  ➤ [•] YouTube Music...[success, found 4 sources]
      | ➤ Awaiting audiofeeds...[done]
      | [✓] Got album art
      | [✓] Got raw track file
      | [•] Post Processing...
 [•] Download Complete
 [•] Embedding Metadata...
  • [✓] 01 What We Had
  • [✓] 02 Reason To Stay
  • [✓] 03 Nothing Ever Changes
  • [✓] 04 Love's a Waste
[•] Collation Complete
========== Stats ==========
 [•] Runtime: [2m 2.3s]
 [•] Total queries: [01]
 [•] Total tracks: [04]
     » Skipped: [00]
     ✓ Passed:  [04]
     ✕ Failed:  [00]
 [•] Output directory: [.]
 [•] Cover Art: cover.png (640x640)
 [•] Total Output size: 29.79 MB
 [•] Total Network Usage: 13.35 MB
     ♫ Media: 12.73 MB
     ➤ Album Art: 619.43 KB
 [•] Output bitrate: 320k
===========================
```

</details>

#### Download a Deezer Artist

<details>
<summary> <code> freyr https://www.deezer.com/us/artist/14808825 </code> </summary>

``` text
    ____
   / __/_______  __  _______
  / /_/ ___/ _ \/ / / / ___/
 / __/ /  /  __/ /_/ / /
/_/ /_/   \___/\__, /_/
              /____/ v0.1.0

freyr v0.1.0 - (c) Miraculous Owonubi <omiraculous@gmail.com>
-------------------------------------------------------------
Checking directory permissions...[done]
[https://www.deezer.com/us/artist/14808825]
 [•] Identifying service...[Deezer]
 [•] Checking authentication...[authenticated]
 Detected [artist]
 Obtaining artist metadata...[done]
  ➤ Artist: Mazie
  ➤ Followers: 6
  > Gathering collections...[done]
 [•] Collating...
  (01) [i think i wanna be alone] (single)
   [•] Inquiring tracks...[done]
    • [01 i think i wanna be alone]
       | ➤ Collating sources...
       |  ➤ [•] YouTube Music...[success, found 2 sources]
       | ➤ Awaiting audiofeeds...[done]
       | [✓] Got album art
       | [✓] Got raw track file
       | [•] Post Processing...
  (02) [no friends] (single)
   [•] Inquiring tracks...[done]
    • [01 no friends]
       | ➤ Collating sources...
       |  ➤ [•] YouTube Music...[success, found 4 sources]
       | ➤ Awaiting audiofeeds...[done]
       | [✓] Got album art
       | [✓] Got raw track file
       | [•] Post Processing...
 [•] Download Complete
 [•] Embedding Metadata...
  • [✓] 01 i think i wanna be alone
  • [✓] 01 no friends
[•] Collation Complete
========== Stats ==========
 [•] Runtime: [54.6s]
 [•] Total queries: [01]
 [•] Total tracks: [02]
     » Skipped: [00]
     ✓ Passed:  [02]
     ✕ Failed:  [00]
 [•] Output directory: [.]
 [•] Cover Art: cover.png (640x640)
 [•] Total Output size: 8.47 MB
 [•] Total Network Usage: 3.66 MB
     ♫ Media: 3.50 MB
     ➤ Album Art: 157.16 KB
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
* `concurrency`: \<object\>
  * `queries`: \<number\> The number of queries to be processed concurrently.
  * `tracks`: \<number\> The number of tracks to be actively processed in parallel.
  * `trackStage`: \<number\> The number of tracks to concurrently preprocess before being pushed to the main trackQueue.
  * `downloader`: \<number\> The number of tracks to be concurrently downloaded in parallel.
  * `encoder`: \<number\> The total number of tracks to be concurrently undergo encoding.
  * `embedder`: \<number\> The total number of tracks to be concurrently embedded in parallel.
* `opts`: \<object\>
  * `netCheck`: \<boolean\> Whether or not to check network access at program start.
  * `attemptAuth`: \<boolean\> Whether or not to process authentication.
  * `autoOpenBrowser`: \<boolean\> Whether or not to automatically open user browser.
* `filters`: \<[FilterRules](#filterrules)[]\> Filter rules each track must match to be downloaded.
* `dirs`: \<object\>
  * `output`: \<string\> Default download directory. Default: `"."`
  * `cache`: \<string\> Default temp download directory. Default: `"<tmp>"`
* `playlist`: \<object\>
  * `always`: \<boolean\> Always create playlists for collections and non-collections alike.
  * `append`: \<boolean\> Append non-collection tracks onto the playlist file.
  * `escape`: \<boolean\> Escape `#` characters within playlist entries paths.
  * `forceAppend`: \<boolean\> Force append collection tracks.
  * `dir`: \<string\> Default playlist save directory.
  * `namespace`: \<string\> Prefix namespace to prepend to track paths.
* `image`: \<object|number|string\> An object with fields pertaining to an image's properties or a number defining its size. (\<width\>x\<height\> or \<size\> as \<size\>x\<size\>)
  * `width`: \<number|string\>
  * `height`: \<number|string\>
* `downloader`: \<object\>
  * `memCache`: \<boolean\> Whether or not to use in-memory caching for download chunks.
  * `cacheSize`: \<number\> Maximum size of bytes to be cached per download.
  * `order`: \<array\> Service download sources order.
    * Freyr would check these download sources in the order which they are defined. Failure to get a query from a source would try the next available source.
    * supported: `youtube`, `yt_music`
    * default: `[ "yt_music", "youtube" ]`
* `services`: \<[ServiceConfiguration](#service-configuration): object\>

#### FilterRules

| key            | glob-matching |   description   | examples |
| -------------- | :-----------: | --------------- | -------- |
| `id`           |      yes      | ID              | `id=1497949287` |
| `uri`          |      yes      | URI             | `uri="spotify:+(track|album):*"` |
| `title`        |      yes      | Track title     | `title="all*good girls*hell"` |
| `album`        |      yes      | Track album     | `album="when we*fall*do we go*"` |
| `artist`       |      yes      | Match an artist | `artist="Billie*"` |   |
| `trackn`       |       no      | Match a track number range | `trackn="2..5"`, `trackn="4..=5"` |
| `type`         |       no      | `album` \| `compilation` | `type=compilation` |
| `duration`     |       no      | Track duration | `duration="3s.."`, `duration="2:30..3:00"`, `duration="..=3m"` |
| `explicit`     |       no      | `true` \| `false` \| `inoffensive` | `explicit=true`, `explicit=inoffensive` |
| `album_artist` |      yes      | Album artist | `album_artist="Billie Eilish"` |
| `isrc`         |      yes      | Track ISRC   | `isrc=USUM71900766` |
| `label`        |      yes      | Record label | `label="*Interscope*"` |
| `year`         |       no      | Release year | `year=2019`, `year=2018..2020` |
| `diskn`        |       no      | Disk number  | `diskn=1` |
| `ntracks`      |       no      | Number of tracks in the album | `ntracks=10..=14` |

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
* 3: Invalid / Inexistent configuration file
* 4: Network error
* 5: Error with working directory
* 6: Failed to initialize a freyr instance
* 7: An error occurred checking dependency paths

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

### Manually Building

Feel free to clone and use in adherance to the [license](#license). Pull requests are very much welcome.

``` bash
git clone https://github.com/miraclx/freyr-js.git
cd freyr-js
npm install

# don't forget to link to register the freyr command
npm link
```

### Docker Development

To facilitate development and experimentation through Docker, Dockerfiles are provided in the `docker/` folder for your convenience.

| Base Image OS | Average Build Network Usage | Average Disk Usage | File |
| :-----------: | :--------: | :-------: | :---------------------------: |
| Alpine (musl) | ~ 80 MB    | ~ 210 MB  | [`docker/Dockerfile.alpine`](https://github.com/miraclx/freyr-js/raw/master/docker/Dockerfile.alpine)    |
| Arch Linux    | ~ 200 MB   | ~ 1.04 GB | [`docker/Dockerfile.archlinux`](https://github.com/miraclx/freyr-js/raw/master/docker/Dockerfile.archlinux) |

``` bash
# building with default dockerfile (alpine)
git clone https://github.com/miraclx/freyr-js.git freyr
cd freyr
docker build -t freyr-dev:latest .

# alternatively, you can use any other dockerfile
docker build -t freyr-dev:archlinux -f docker/Dockerfile.archlinux .
```

Afterwards, you can drop into the container by explicitly defining the entrypoint

``` bash
docker run -it --entrypoint bash freyr-dev:latest

# Alternatively, create a handy alias
alias freyrd='docker run -it --entrypoint bash freyr-dev:latest'
```

Optionally, you can use these interesting flags to customize the experience.

* `-h freyr-dev` sets the container hostname to `freyr-dev`
* `-m 1G` sets the container memory limit
* `-v $PWD:/data` mounts the current working directory to `/data` within the container.
* `--cpus 2` limits the container to using 2 CPU cores

The freyr source would be available in the `/freyr` directory within the container along with a globally registered command `freyr` for calling the script.

For more information and documentation about docker, please refer to its official website:

* <https://www.docker.com/>
* <https://docs.docker.com/>

## License

[Apache 2.0][license] © **Miraculous Owonubi** ([@miraclx][author-url]) \<omiraculous@gmail.com\>

[license]:  LICENSE "Apache 2.0 License"
[author-url]: https://github.com/miraclx

<!-- [npm-url]: https://npmjs.org/package/freyr
[npm-image]: https://badgen.net/npm/node/freyr
[npm-image-url]: https://nodei.co/npm/freyr.png?stars&downloads
[downloads-url]: https://npmjs.org/package/freyr
[downloads-image]: https://badgen.net/npm/dm/freyr -->

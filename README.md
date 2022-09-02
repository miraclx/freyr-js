<!-- markdownlint-disable MD001 MD007 MD023 MD041 MD051 -->

<div align="center">
  <a href="https://github.com/miraclx/freyr-js">
    <img src="https://github.com/miraclx/freyr-js/raw/master/media/logo.gif" alt="FreyrJS - connoisseur of music">
  </a>

  # Freyr

  <h4>
    Download songs from Spotify, Apple Music and Deezer.
  </h4>

  [![GitHub](https://img.shields.io/badge/by-miraclx-gray&plastic)](https://github.com/miraclx)
  [![CodeFactor Grade](https://www.codefactor.io/repository/github/miraclx/freyr-js/badge/master)](https://www.codefactor.io/repository/github/miraclx/freyr-js/overview/master)
  [![License](https://img.shields.io/github/license/miraclx/freyr-js)](https://github.com/miraclx/freyr-js)
  [![CI checks](https://github.com/miraclx/freyr-js/actions/workflows/tests.yml/badge.svg)](https://github.com/miraclx/freyr-js/actions/workflows/tests.yml)
  [![Docker Cloud Build Status](https://img.shields.io/docker/cloud/build/freyrcli/freyrjs)](https://hub.docker.com/r/freyrcli/freyrjs/builds)

  [![NPM Downloads](https://badgen.net/npm/dm/freyr)](https://www.npmjs.com/package/freyr)
  [![Docker Cloud Pull Status](https://img.shields.io/docker/pulls/freyrcli/freyrjs.svg)](https://hub.docker.com/r/freyrcli/freyrjs)
  [![NodeJS Version](https://img.shields.io/badge/node-%3E%3D%20v14-brightgreen)](https://github.com/miraclx/freyr-js)
  [![Python Version](https://img.shields.io/badge/python-%3E%3D%20v3.2-blue)](https://github.com/miraclx/freyr-js)

  [![Total Lines Of Code](https://tokei.rs/b1/github/miraclx/freyr-js?category=code)](https://github.com/miraclx/freyr-js)
  [![GitHub top language](https://img.shields.io/github/languages/top/miraclx/freyr-js)](https://github.com/miraclx/freyr-js)
  [![GitHub repo size](https://img.shields.io/github/repo-size/miraclx/freyr-js)](https://github.com/miraclx/freyr-js)

  <sub>Built with ❤︎ by
  <a href="https://github.com/miraclx">Miraculous Owonubi</a>

</div>

## Demo

[![ASCII Demo](https://github.com/miraclx/freyr-js/raw/master/media/demo.gif)](https://asciinema.org/a/KH5xyBq9G8Wf5Dyvj6AfqXwYr?autoplay=1 "Click to view ASCII")

## Overview

### What freyr does

Depending on the URLs you provide freyr, it will;

1. Extract track metadata (`title`, `album`, `artist`, etc.) from the streaming service (Spotify if you provide a Spotify URL).
2. Then, it queries sources (e.g. YouTube), classifies the results to find you the best sounding, most accurate audio and downloads that in the raw format.
3. Next, it processes each track, encoding them in an [Apple AAC](https://en.wikipedia.org/wiki/Advanced_Audio_Coding) format (`.m4a` file extension) at a bitrate of `320kbps` for high quality.
4. Then, it embeds all the metadata and the album art into each track.
5. And finally, it organizes all the files into a structured library ([example](https://miraclx.github.io/freyr-demo-library/)).

### Metadata Availability

Here's a list of the metadata that freyr can extract from each streaming service:

|      Meta      | Spotify | Apple Music | Deezer |
| :------------: | :-----: | :---------: | :----: |
| `Title`        |   ✔   |     ✔     |   ✔  |
| `Artist`       |   ✔   |     ✔     |   ✔  |
| `Composer`     |   ✗   |     ✔     |   ✔  |
| `Album`        |   ✔   |     ✔     |   ✔  |
| `Genre`        |   ✗   |     ✔     |   ✔  |
| `Track Number` |   ✔   |     ✔     |   ✔  |
| `Disk Number`  |   ✔   |     ✔     |   ✔  |
| `Release Date` |   ✔   |     ✔     |   ✔  |
| `Rating`       |   ✔   |     ✔     |   ✔  |
| `Album Artist` |   ✔   |     ✔     |   ✔  |
| `ISRC`         |   ✔   |     ✔     |   ✔  |
| `Label`        |   ✔   |     ✔     |   ✔  |
| `Copyright`    |   ✔   |     ✔     |   ✗  |
| `Cover Art`    |   ✔   |     ✔     |   ✔  |

## Support the project

#### Donate via

[![Patreon Donation](https://img.shields.io/badge/Patreon-donate-f96854?logo=patreon)](https://patreon.com/miraclx)
[![Liberapay receiving](https://img.shields.io/badge/Liberapay-donate-f6c915?logo=liberapay)](https://liberapay.com/miraclx)
[![Ko-fi Donation](https://img.shields.io/badge/-donate-ff5e5b?logo=Ko-fi&label=Ko-fi)](https://ko-fi.com/miraclx)

#### Crypto

- Via Coinbase (`BTC`, `ETH`, `USDC`, `LTC`, `DAI`, `BCH`):

  - Support us with [`$5`](https://commerce.coinbase.com/checkout/96849d29-e051-4855-8bac-97f3f2e1a7a8) | [`$10`](https://commerce.coinbase.com/checkout/c8901c03-217a-475a-a764-98cdc6f561e9) | [`$15`](https://commerce.coinbase.com/checkout/e9be7d37-1ee7-4cc6-9daf-fde68c0697cc) | [`$20`](https://commerce.coinbase.com/checkout/4254e8a5-2071-445c-a0bd-c43a4e0d09b0)
  - Donate [anything you want](https://commerce.coinbase.com/checkout/466d703a-fbd7-41c9-8366-9bdd3e240755)

- Or Directly:

  - [![BTC](https://img.shields.io/badge/-Bitcoin-5b5b5b?logo=bitcoin)](https://explorer.btc.com/btc/address/bc1qqe5y9kw7ewne8njdces8e4ajx5u7zhfftdvl33): `bc1qqe5y9kw7ewne8njdces8e4ajx5u7zhfftdvl33`
  - [![XLM](https://img.shields.io/badge/-Stellar-5b5b5b?logo=stellar)](https://keybase.io/miraclx): `GB6GPPXXJTQ6EFYQQ4PFA4WEAT5G2DIDILOEDLYH76743UUVDDU4KOWY`
  - [![ZEC](https://img.shields.io/badge/-Zcash-5b5b5b?logo=cash-app&logoColor=ecb127)](https://keybase.io/miraclx): `zs10awcwm4uwpjr3mxxdwe03fda0j0zn95s4hu3qxlvhfajjw8es98ftmpaava7zh735x9s22pan0l`

## Installation

### Manually

<details>
<summary id="requirements"> Requirements </summary>

  <sub> _Hey there, you might want to consider a cleaner and straight-forward installation method, without having to manually setup the requirements. If so, checkout the [Docker installation method](#docker)_ </sub>

  <details>
  <summary>python >= v3.2</summary>

  Download for your individual platforms here <https://www.python.org/downloads/>

  Linux: _(check individual package managers)_

  - Debian: `sudo apt-get install python3.6`
  - Arch Linux: `sudo pacman -S python`
  - Android (Termux): `apt install python`
  - Alpine Linux: `sudo apk add python3`

  </details>

  <details>
  <summary>nodejs >= v14.0.0</summary>

  Download for your individual platforms here <https://nodejs.org/en/download/>

  macOS + Linux: [nvm](https://github.com/nvm-sh/nvm) recommended.

  ```bash
  # install node with this nvm command
  # freyr works with a minimum of v14
  $ nvm install --lts
  ```

  - Android (Termux): `apt install nodejs`
  - Alpine Linux: `sudo apk add nodejs`

  </details>

  <details>
  <summary>AtomicParsley >= (v0.9.6 | 20200701)</summary>

  First, download the latest release for your individual platforms here <https://github.com/wez/atomicparsley/releases/latest>

  Then;

  - Windows:
    - unzip and place the `AtomicParsley.exe` in your `PATH`.
    - or the `bins/windows` folder of this project directory. Create the folder(s) if they don't exist.
  - Linux + macOS _(the brew package isn't recommended)_:
    - unzip and place the `AtomicParsley` in your `PATH`.
    - or the `bins/posix` folder of this project directory. Create the folder(s) if they don't exist.
  - Alternatively:
    - Debian: `sudo apt-get install atomicparsley`
    - Arch Linux: `sudo pacman -S atomicparsley`
    - Android (Termux): `apt install atomicparsley`
    - Build from source: See [wez/AtomicParsley](https://github.com/wez/atomicparsley)

  </details>

  > _Please note that [YouTube Music](https://music.youtube.com/) must be available in your region for freyr to successfully work, this is because freyr sources raw audio from [YouTube Music](https://music.youtube.com/)._

  ---
</details>

First start by ensuring all requirements listed above are satisfied. Thereafter, you can use either of these options to install freyr:

- [NPM](https://github.com/npm/cli): `npm install -g freyr`
- [Yarn](https://github.com/yarnpkg/yarn): `yarn global add freyr`

- <details>
  <summary>Or you can build from source</summary>

  ```bash
  git clone https://github.com/miraclx/freyr-js.git freyr
  cd freyr
  ```

  | % | NPM | Yarn |
  | - | --- | ---- |
  | pull dependencies | `npm install` | `yarn install` |
  | install globally | `npm link` | `yarn link` |

  </details>

### Docker

For convenience, we provide [officially prebuilt images](https://hub.docker.com/r/freyrcli/freyrjs/tags?name=latest) (automated builds from this repo) so you can skip the setup and build process and get right into it.

Image Size: [![Docker Image Size](https://img.shields.io/docker/image-size/freyrcli/freyrjs/latest?color=gray&label=%20&logo=docker)](https://hub.docker.com/r/freyrcli/freyrjs/tags?name=latest)

#### Usage (docker)

```bash
docker run -it --rm -v $PWD:/data freyrcli/freyrjs [options, arguments and queries...]
```

You can also create a handy alias to skip remembering that whole line everytime

```bash
alias freyr='docker run -it --rm -v $PWD:/data freyrcli/freyrjs'
```

> The `-v $PWD:/data` part sets the working directory for freyr to the current working directory.
> For example, you can use `-v ~/Music/freyr:/data` to set the work directory and consequently, default save location to `~/Music/freyr`.
>
> Please ensure the folder on the host already exists, create it if not. Otherwise, docker autocreates the folder as root and that causes unpleasant `Permission Denied` issues when you run freyr.

[See [Docker Development](#docker-development)]

## Getting Started

### Usage

```text
Usage: freyr [options] [query...]
Usage: freyr [options] [subcommand]
```

[See [Service Support](#service-support)].

#### Show freyr help and list subcommands

`freyr --help`

#### Get CLI Help

*The `get` subcommand is implicit and default.

```text
Usage: freyr [options] get [options] [query...]
Usage: freyr [options] [query...]
```

<details>
<summary> <code>freyr get --help</code> </summary>

<!-- editorconfig-checker-disable -->
```console
    ____
   / __/_______  __  _______
  / /_/ ___/ _ \/ / / / ___/
 / __/ /  /  __/ /_/ / /
/_/ /_/   \___/\__, /_/
              /____/ v0.8.1

freyr - (c) Miraculous Owonubi <omiraculous@gmail.com>
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
  -c, --cover <NAME>           custom name for the cover art, excluding the extension (default: "cover")
  --cover-size <SIZE>          preferred cover art dimensions
                               (format: <width>x<height> or <size> as <size>x<size>) (default: "640x640")
  -C, --no-cover               skip saving a cover art
  -x, --format <FORMAT>        preferred audio output format (to export) (unimplemented)
                               (valid: mp3,m4a,flac) (default: "m4a")
  -D, --downloader <SERVICE>   specify a preferred download source or a `,`-separated preference order
                               (valid: youtube,yt_music) (default: "yt_music")
  -l, --filter <MATCH>         filter matches off patterns (repeatable and optionally `,`-separated)
                               (value omission implies `true` if applicable)
                               (format: <key=value>) (example: title="when we all fall asleep*",type=album)
                               See `freyr help filter` for more information
  -L, --filter-case            enable case sensitivity for glob matches on the filters
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
  --atomic-parsley <PATH>      explicit path to the atomic-parsley binary
  --no-stats                   don't show the stats on completion
  --pulsate-bar                show a pulsating bar
  --single-bar                 show a single bar for the download, hide chunk-view
                               (default when number of chunks/segments exceed printable space)
  -h, --help                   show this help information

Environment Variables:
  SHOW_DEBUG_STACK             show extended debug information
  ATOMIC_PARSLEY_PATH          custom AtomicParsley path, alternatively use `--atomic-parsley`

Info:
  When downloading playlists, the tracks are downloaded individually into
  their respective folders. However, a m3u8 playlist file is generated in
  the base directory with the name of the playlist that lists the tracks
```
<!-- editorconfig-checker-enable -->

</details>

#### Download a Spotify track

<details>
<summary> <code>freyr spotify:track:5FNS5Vj69AhRGJWjhrAd01</code> </summary>

<!-- editorconfig-checker-disable -->
```console
    ____
   / __/_______  __  _______
  / /_/ ___/ _ \/ / / / ___/
 / __/ /  /  __/ /_/ / /
/_/ /_/   \___/\__, /_/
              /____/ v0.8.1

freyr - (c) Miraculous Owonubi <omiraculous@gmail.com>
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
============ Stats ============
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
===============================
```
<!-- editorconfig-checker-enable -->

</details>

#### Download an Apple Music album

<details>
<summary> <code> freyr https://music.apple.com/us/album/im-sorry-im-not-sorry-ep/1491795443 </code> </summary>

<!-- editorconfig-checker-disable -->
```console
    ____
   / __/_______  __  _______
  / /_/ ___/ _ \/ / / / ___/
 / __/ /  /  __/ /_/ / /
/_/ /_/   \___/\__, /_/
              /____/ v0.8.1

freyr - (c) Miraculous Owonubi <omiraculous@gmail.com>
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
============ Stats ============
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
===============================
```
<!-- editorconfig-checker-enable -->

</details>

#### Download a Deezer Artist

<details>
<summary> <code> freyr https://www.deezer.com/us/artist/14808825 </code> </summary>

<!-- editorconfig-checker-disable -->
```console
    ____
   / __/_______  __  _______
  / /_/ ___/ _ \/ / / / ___/
 / __/ /  /  __/ /_/ / /
/_/ /_/   \___/\__, /_/
              /____/ v0.8.1

freyr - (c) Miraculous Owonubi <omiraculous@gmail.com>
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
============ Stats ============
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
===============================
```
<!-- editorconfig-checker-enable -->

</details>

#### Batch downloads

##### via Arguments

Queries can be collated to be processed at once.

```bash
freyr query1 query2 ... queryN
```

##### via Batch File

Queries can be batched into a file and loaded all at once with the `-i, --input <FILE>` flag.
Queries should be on separate lines.

Lines starting with a `#` are treated as comments and ignored. comments can also be inlined with everything following the `#` character ignored.

```text
# ./queue.txt

# Hailee Steinfeld
https://open.spotify.com/track/5Gu0PDLN4YJeW75PpBSg9p # (track) Let Me Go
https://open.spotify.com/track/7GCVboEDzfL3NKp1NrAgHR # (track) Wrong Direction

# (album) Rina Sawayama
https://open.spotify.com/album/3stadz88XVpHcXnVYMHc4J
```

```bash
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

Use the `urify` subcommand to parse betweeen URIs and its equivalent URL representation, and vice-versa.
Creating freyr-compatible queue output.

<details>
<summary> <code> freyr urify https://open.spotify.com/album/2D23kwwoy2JpZVuJwzE42B --no-header --no-logo --no-tag </code> </summary>

```text
spotify:album:2D23kwwoy2JpZVuJwzE42B
[+] Urify complete
```

</details>

<details>
<summary> <code> freyr urify -i queue_of_urls.txt -o queue_of_uris.txt --no-header --no-logo </code> </summary>

```text
[+] Urify complete
Successfully written to [queue_of_uris.txt]
```

</details>

[Examples](#ssue)

### Features

- Multi-service support [See [Service Support](#service-support)]
- Playlist generation (per playlist (default) / per query (optional))
- Batch download from queue file
- Simultaneous chunked downloads (powered by [[libxget-js](https://github.com/miraclx/libxget-js)])
- Efficient concurrency
- Bitrate specification (valid: 96, 128, 160, 192, 256, 320)
- Album art embedding & export
- Proper track organisation i.e `FOLDER/<Artist Name>/<Album Name>/<Track Name>` ([example](https://miraclx.github.io/freyr-demo-library/))
- Resilient visual progressbar per track download (powered by [[xprogress](https://github.com/miraclx/xprogress)])
- Stats on runtime completion
  - runtime duration
  - number of successfully processed tracks
  - output directory
  - cover art name
  - total output size
  - total network usage
  - network usage for media
  - network usage for album art
  - output bitrate

### Configuration

<details>
<summary>User / Session specific configuration</summary>

Persistent configuration such as authentication keys and their validity period are stored within a session specific configuration file.

This configuration file resides within the user config directory per-platform. e.g `$HOME/.config/FreyrCLI/d3fault.x4p` for Linux.

</details>

<details>
<summary id='project-specific-configuration'>Project specific configuration</summary>

All configuration is to be defined within a `conf.json` file in the root of the project.
This file should be of `JSON` format and is to be structured as such.

Defaults are in the [conf.json](https://github.com/miraclx/freyr-js/blob/master/conf.json) file.

- `server`: \<object\> The server URL configuration same as on an individual services' callback option.
  - `hostname`: \<string\>
  - `port`: \<number\>
  - `useHttps`: \<boolean\>
- `concurrency`: \<object\>
  - `queries`: \<number\> The number of queries to be processed concurrently.
  - `tracks`: \<number\> The number of tracks to be actively processed in parallel.
  - `trackStage`: \<number\> The number of tracks to concurrently preprocess before being pushed to the main trackQueue.
  - `downloader`: \<number\> The number of tracks to be concurrently downloaded in parallel.
  - `encoder`: \<number\> The total number of tracks to be concurrently undergo encoding.
  - `embedder`: \<number\> The total number of tracks to be concurrently embedded in parallel.
- `opts`: \<object\>
  - `netCheck`: \<boolean\> Whether or not to check network access at program start.
  - `attemptAuth`: \<boolean\> Whether or not to process authentication.
  - `autoOpenBrowser`: \<boolean\> Whether or not to automatically open user browser.
- `filters`: \<[FilterRules](#filterrules)[]\> Filter rules each track must match to be downloaded.
- `dirs`: \<object\>
  - `output`: \<string\> Default download directory. Default: `"."`
  - `cache`: \<string\> Default temp download directory. Default: `"<tmp>"`
- `playlist`: \<object\>
  - `always`: \<boolean\> Always create playlists for collections and non-collections alike.
  - `append`: \<boolean\> Append non-collection tracks onto the playlist file.
  - `escape`: \<boolean\> Escape `#` characters within playlist entries paths.
  - `forceAppend`: \<boolean\> Force append collection tracks.
  - `dir`: \<string\> Default playlist save directory.
  - `namespace`: \<string\> Prefix namespace to prepend to track paths.
- `image`: \<object|number|string\> An object with fields pertaining to an image's properties or a number defining its size. (\<width\>x\<height\> or \<size\> as \<size\>x\<size\>)
  - `width`: \<number|string\>
  - `height`: \<number|string\>
- `downloader`: \<object\>
  - `memCache`: \<boolean\> Whether or not to use in-memory caching for download chunks.
  - `cacheSize`: \<number\> Maximum size of bytes to be cached per download.
  - `order`: \<array\> Service download sources order.
    - Freyr would check these download sources in the order which they are defined. Failure to get a query from a source would try the next available source.
    - supported: `youtube`, `yt_music`
    - default: `[ "yt_music", "youtube" ]`
- `services`: \<[ServiceConfiguration](#service-configuration): object\>

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
    },
    "deezer": {
      "retries": 5
    }
  }
}
```

</details>

</details>

### Service Configuration

The [conf.json](https://github.com/miraclx/freyr-js/blob/master/conf.json) file already includes some API tokens for service authentication and should work right out of the box. [See [Project specific configuration](#project-specific-configuration)]

<details>
<summary>Spotify</summary>

- `spotify`: \<object\>
  - `clientId`: \<string\>
  - `clientSecret`: \<string\>
  - `refreshToken`: \<string\>

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

- `apple_music`: \<object\>
  - `storefront`: \<string\>
  - `developerToken`: \<string\>

This library already includes a predefined developer token that should work at will. This developer token is the default token, extracted off the Apple Music site. While this developer token could expire over time, we'll try to update with the most recent developer token as time goes on.

To create a custom developer token, please refer to the Apple Music documentation on this topic.

The `storefront` option defines the default storefront to be used in the absence of a specification.

#### Apple Music API Authorization

[See [Apple Music API: Getting Keys and Creating Tokens
](https://developer.apple.com/documentation/applemusicapi/getting_keys_and_creating_tokens)]

After successfully acquiring the developer token, include the `developerToken` to the `apple_music` object that's a property of the `services` object in the `conf.json` file. [See [Confiuration](#configuration)]
</details>

<details>
<summary>Deezer</summary>

- `deezer`: \<object\>
  - `retries`: \<number\>

Authentication unrequired. API is freely accessible.

Because of the 50 requests / 5 seconds limit enforced on an IP-basis for Deezer's API [See [#32](https://github.com/miraclx/freyr-js/issues/6)],
occasionally a `Quota limit exceeded` error would be thrown by the API server.

To combat this, freyr employs request batching, managed delays and finally, retries when things go awry.

You can configure how many retries you want freyr to make before accepting failure.

</details>

### Return Codes

- 0: OK
- 1: Invalid query
- 2: Invalid flag value
- 3: Invalid / Inexistent configuration file
- 4: Network error
- 5: Error with working directory
- 6: Failed to initialize a freyr instance
- 7: An error occurred checking dependency paths

### FilterRules

Filter rules each to be matched against the tracks involved in any operation.

Used as values to the `-l, --filter` flag or as key-value pairs in the `filters` array of the [configuration file](#project-specific-configuration).

| key            |     syntax    |   description   | examples |
| -------------- | :-----------: | --------------- | -------- |
| `id`           |      glob     | Resource ID     | `id=1497949287`, `id=*149` |
| `uri`          |      glob     | Resource URI    | `uri="*:+(track\|album):*"` |
| `title`        |      glob     | Track title     | `title="all*good girls*hell"` |
| `album`        |      glob     | Track album     | `album="when we*fall*do we go*"` |
| `artist`       |      glob     | Match an artist | `artist="Billie*"` |   |
| `trackn`       | [Numeric Range](#ranges) | Match a track number range | `trackn="2..5"`, `trackn="4..=5"` |
| `type`         |     Static    | `album` \| `single` \| `compilation` | `type=single` |
| `duration`     |  [Timed Range](#timed-ranges)  | Track duration | `duration="3s.."`, `duration="2:30..3:00"`, `duration="..=3m"` |
| `explicit`     |     Static    | `true` \| `false` \| `inoffensive` | `explicit=true`, `explicit=inoffensive` |
| `album_artist` |      glob     | Album artist | `album_artist="Billie Eilish"` |
| `isrc`         |      glob     | Track ISRC   | `isrc=USUM71900766` |
| `label`        |      glob     | Record label | `label="*Interscope*"` |
| `year`         | [Numeric Range](#ranges) | Release year | `year=2019`, `year=2018..2020` |
| `diskn`        | [Numeric Range](#ranges) | Disk number  | `diskn=1` |
| `ntracks`      | [Numeric Range](#ranges) | Number of tracks in the album | `ntracks=10..=14` |

#### Ranges

Syntax: `[a][..][[=]b]`

| Spec    | Match            | Representation |
| ------- | ---------------- | -------------- |
| `..`    | `-∞ ... ∞`       | `x`            |
| `3..7`  | `3, 4, 5, 6`     | `7 > x ≥ 3`    |
| `3..=7` | `3, 4, 5, 6, 7`  | `7 ≥ x ≥ 3`    |
| `..3`   | `-∞ ... 0, 1, 2` | `3 > x`        |
| `..=3`  | `-∞ ... 1, 2, 3` | `3 ≥ x`        |
| `5..`   | `5, 6, 7 ... ∞`  | `x ≥ 5`        |

#### Timed Ranges

Examples: `duration=60s..=3:40`

| Metric  | Values                   |
| ------- | ------------------------ |
| Seconds | `30`, `30s`, `00:30`     |
| Minutes | `120`, `120s`, `02:00`   |
| Hours   | `5400`, `5400s`, `01:30` |

#### Previewing filter representation

To preview filter rules specification, use the `filter` subcommand.

<details>
<summary> <code> freyr filter title="all*good girls*hell",artist="*eilish",trackn="4..=5" --no-header --no-logo </code> </summary>

```text
[
  {
    "query": "*",
    "filters": {
      "title": "all*good girls*hell",
      "artist": "*eilish",
      "trackn": "4..=5"
    }
  }
]
```

</details>

## Service Support

| Service | Track | Album | Artist | Playlist | [URI Short Tags](#uris) |
| :-----: | :---: | :---: | :----: | :------: | :------------: |
| [Spotify](https://github.com/miraclx/freyr-js/blob/master/src/services/spotify.js) |   ✔   |   ✔   |    ✔   |     ✔    | `spotify:` |
| [Apple Music](https://github.com/miraclx/freyr-js/blob/master/src/services/apple_music.js) |   ✔   |   ✔   |    ✔   |     ✔    | `apple_music:` |
| [Deezer](https://github.com/miraclx/freyr-js/blob/master/src/services/deezer.js) |   ✔   |   ✔   |    ✔   |     ✔    | `deezer:` |
| YouTube Music (See [#6](https://github.com/miraclx/freyr-js/issues/6)) |   ✗   |   ✗   |    ✗   |     ✗    | ✗ |
| Tidal (See [#33](https://github.com/miraclx/freyr-js/issues/33)) |   ✗   |   ✗   |    ✗   |     ✗    | ✗ |

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

```bash
git clone https://github.com/miraclx/freyr-js.git freyr
cd freyr
```

- If using [NPM](https://github.com/npm/cli):

  ```bash
  npm install

  # to have access to the freyr command globally
  npm link
  ```

- If using [Yarn](https://github.com/yarnpkg/yarn):

  ```bash
  yarn install

  # to have access to the freyr command globally
  yarn link
  ```

### Testing

Freyr comes bundled with a lightweight test suite. See [TEST.md](https://github.com/miraclx/freyr-js/blob/master/TEST.md) for instructions on how to run it.

### Docker Development

With docker, you can drop into a sandbox that has all the dependencies you need. Without needing to mess around with your host system or install any weird dependencies.

First, you need to either build a local docker image or submit a PR and use the corresponding auto-generated image.

#### Building A Local Image

The default provided [Dockerfile](https://github.com/miraclx/freyr-js/raw/master/Dockerfile) builds minimal alpine images. Average build network usage is ~ 80 MB and disk usage is ~ 180 MB.

```bash
git clone https://github.com/miraclx/freyr-js.git freyr
cd freyr
docker build -t freyr-dev .
```

#### Working With Remote Images

An alternative to building the docker image locally is to use a remote image. By default, all PRs submitted to this repository get an equivalently tagged docker image for testing.

For example, the PR #214 has a docker image called `freyrcli/freyrjs-git:pr-214`. And it stays updated with the current state of the branch.

You can then pull the development image for use locally.

```bash
docker pull freyrcli/freyrjs-git:pr-214
```

---

Once you have a built development image locally, you're ready to go. You can drop into the container by explicitly defining the entrypoint

```bash
docker run -it --entrypoint bash freyr-dev

# Alternatively, create a handy alias
alias freyrsh='docker run -it --entrypoint bash freyr-dev'
```

*: don't forget to replace `freyr-dev` with the appropriate image name if you pulled one of the auto-generated remote images.

Optionally, you can use these interesting flags to customize the experience.

- `-h freyr-dev` sets the container hostname to `freyr-dev`
- `-m 1G` sets the container memory limit
- `-v $PWD:/data` mounts the current working directory to `/data` within the container.
- `--cpus 2` limits the container to using 2 CPU cores

The freyr source would be available in the `/freyr` directory within the container along with a globally registered command `freyr` for calling the script.

For more information and documentation about docker, please refer to its official site:

- <https://www.docker.com/>
- <https://docs.docker.com/>

## License

[Apache 2.0][license] © **Miraculous Owonubi** ([@miraclx][author-url]) \<omiraculous@gmail.com\>

[license]:  LICENSE "Apache 2.0 License"
[author-url]: https://github.com/miraclx

<!-- [npm-url]: https://npmjs.org/package/freyr
[npm-image]: https://badgen.net/npm/node/freyr
[npm-image-url]: https://nodei.co/npm/freyr.png?stars&downloads
[downloads-url]: https://npmjs.org/package/freyr
[downloads-image]: https://badgen.net/npm/dm/freyr -->

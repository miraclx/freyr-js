#!/usr/bin/env node
/* eslint-disable no-underscore-dangle, consistent-return, camelcase */
const fs = require('fs');
const tmp = require('tmp');
const open = require('open');
const xget = require('libxget');
const xpath = require('path');
const ffmpeg = require('fluent-ffmpeg');
const merge2 = require('merge2');
const mkdirp = require('mkdirp');
const xbytes = require('xbytes');
const libeaes = require('libeaes');
const Promise = require('bluebird');
const cStringd = require('stringd-colors');
const isOnline = require('is-online');
const prettyMs = require('pretty-ms');
const commander = require('commander');
const TimeFormat = require('hh-mm-ss');
const ProgressBar = require('xprogress');
const {spawn, spawnSync} = require('child_process');

const FreyrCore = require('./src/freyr');
const AuthServer = require('./src/cli_server');
const StackLogger = require('./src/stack_logger');
const packageJson = require('./package.json');

function parseMeta(params) {
  return Object.entries(params)
    .map(([key, value]) =>
      Array.isArray(value) ? value.map(tx => [`--${key}`, ...(Array.isArray(tx) ? tx : [tx])]) : [`--${key}`, value],
    )
    .flat(Infinity);
}

function extendPathOnEnv(path) {
  return {...process.env, PATH: [process.env.PATH, path].join(process.platform === 'win32' ? ';' : ':')};
}

function check_bin_is_existent(bin, path) {
  const isWin = process.platform === 'win32';
  const command = isWin ? 'where' : 'which';
  const {status} = spawnSync(command, [bin], {
    env: extendPathOnEnv(path),
  });
  if ([127, null].includes(status)) throw Error(`Unable to locate the command [${command}] within your PATH`);
  return status === 0;
}

function atomicParsley(file, args, cb) {
  const err = new Error('Unable to find AtomicParsley. Please install.');
  const isWin = process.platform === 'win32';
  const path = xpath.relative(__dirname, xpath.join('./bins', isWin ? 'windows' : 'posix'));
  if (!check_bin_is_existent('AtomicParsley', path))
    if (typeof file === 'boolean') throw err;
    else return cb(err);

  if (typeof file === 'string')
    spawn('AtomicParsley', [file, ...parseMeta(args), '--overWrite'], {env: extendPathOnEnv(path)}).on('close', cb);
}

function getRetryMessage({index, retryCount, maxRetries, bytesRead, totalBytes, lastErr}) {
  return cStringd(
    [
      ':{color(red)}{⯈}:{color:close(red)} ',
      `:{color(cyan)}@${index + 1}:{color:close(cyan)}`,
      `{:{color(yellow)}${retryCount}:{color:close(yellow)}${
        Number.isFinite(maxRetries) ? `/:{color(yellow)}${maxRetries}:{color:close(yellow)}` : ''
      }}: `,
      `[:{color(yellow)}${lastErr.code}:{color:close(yellow)}] `,
      `(:{color(cyan)}${
        Number.isFinite(totalBytes) ? `${bytesRead}`.padStart(`${totalBytes}`.length, ' ') : bytesRead
      }:{color:close(cyan)}${Number.isFinite(totalBytes) ? `/:{color(cyan)}${totalBytes}:{color:close(cyan)}` : ''})`,
    ].join(''),
  );
}

function prePadNum(val, total, min = 2) {
  return `${val}`.padStart(Math.max(`${total}`.length, min), '0');
}

function prepProgressGen(options) {
  return (size, slots, opts, indentLen) => {
    const forceFirst = options.singleBar || slots.length === 1 || slots.length > 20;
    return ProgressBar.stream(size, slots, {
      forceFirst,
      length: 47,
      pulsate: options.pulsateBar || !Number.isFinite(size),
      bar: {separator: '|'},
      // eslint-disable-next-line prettier/prettier
      template: [
        ':{indent} [:{bullet}] :{label} :{flipper}',
        ':{indent}  | :{bullet} :{tag}',
        ':{bars}'
      ],
      clean: true,
      flipper: [...Array(10)].map((...[, i]) => `:{color}${':{bullet}'.repeat(i + 1)}:{color:close}`),
      label: 'Downloading',
      variables: {
        bullet: '\u2022',
        bars: ({total}) =>
          (Number.isFinite(total) && !forceFirst
            ? [':{indent}  | [:{bar:complete}] [:3{percentage}%] [:{speed}] (:{eta})', ':{indent}  | [:{bar}] [:{size}]']
            : [`:{indent}  | [:{bar}]${Number.isFinite(total) ? ' [:3{percentage}%]' : ''} [:{speed}] (:{eta}) [:{size}]`]
          ).join('\n'),
        size: (stack, _size, total) => ((total = stack.total), `${stack.size()}${total !== Infinity ? `/:{size:total}` : ''}`),
        frag_v: ({frag_i, frag_ct}) => prePadNum(frag_i, frag_ct),
        indent: ` `.repeat(indentLen),
        ...opts,
      },
    });
  };
}

async function processPromise(px, logger, {pre, post, err, xerr} = {}) {
  if (pre) logger.print(pre);
  const rex = await Promise.resolve(typeof px === 'function' ? px() : px).reflect();
  if (rex.isRejected())
    logger.write(...(err ? [err, '\n'] : [`(failed%s)\n`, rex.reason() ? `: [${rex.reason().message}]` : '']));
  else if (xerr && (!rex.value() || rex.value().err)) logger.write(`${xerr}\n`);
  else logger.write(`${post || '[done]'}\n`);
  return rex.isFulfilled() ? rex.value() : null;
}

function CHECK_FLAG_IS_NUM(variable, flagref, untype) {
  // eslint-disable-next-line valid-typeof
  if (typeof variable !== untype)
    if (!(parseFloat(variable).toString() === variable && parseFloat(variable) >= 0))
      throw new Error(`\`${flagref}\` if specified, must be given a valid positive \`${untype}\` datatype`);
    else variable = parseInt(variable, 10);
  return variable;
}

function CHECK_BIT_RATE_VAL(bitrate_arg) {
  const bitrate = (match => (match ? match[1] : ''))((bitrate_arg || '').match(/^(\d+)(?:k(?:b(?:it)?)?(?:ps|\/s)?)?$/i));
  const valids = [96, 128, 160, 192, 256, 320];
  if (!(bitrate && valids.includes(+bitrate)))
    throw new Error(`Invalid bitrate specification: [${bitrate_arg}]. Bitrate should be either of [${valids.join(', ')}]`);
  return `${bitrate}k`;
}

function PROCESS_INPUT_ARG(input_arg) {
  if (!input_arg) return [];
  if (!fs.existsSync(input_arg)) throw new Error(`Input file [${input_arg}] is inexistent`);
  const stat = fs.statSync(input_arg);
  if (stat.size > 1048576) throw new Error(`Input file [${input_arg}] is beyond the maximum 1 MiB size limit`);
  if (!stat.isFile()) throw new Error(`Input file [${input_arg}] is not a file`);
  const contents = fs
    .readFileSync(input_arg)
    .toString()
    .split('\n')
    .map(line => line.trim()) // Trim whitespaces
    .filter(line => !!line && /^(?!\s*#)/.test(line)) // Ignore empty lines or lines that start with comments
    .map(line => line.replace(/#.*$/, '').trim()); // Ignore comments at the end of lines
  return contents;
}

async function init(queries, options) {
  const initTimeStamp = Date.now();
  const stackLogger = new StackLogger({indentSize: 1});
  if (!(await isOnline())) stackLogger.error('\x1b[31m[!]\x1b[0m Failed To Detect An Internet Connection'), process.exit(2);
  if (!Array.isArray(queries)) stackLogger.error('\x1b[31m[i]\x1b[0m Please enter a valid Query'), process.exit(2);

  const AuthKeys = JSON.parse(
    libeaes.decrypt(fs.readFileSync('./auth_keys.enc'), 'a591337828d2cce184152d010206babb88af3ddc13970eccb89528d6c2885156'),
  );

  const freyrCore = new FreyrCore(AuthKeys, AuthServer);
  await freyrCore.init();

  const progressGen = prepProgressGen(options);

  try {
    atomicParsley(true);
    options.tries = CHECK_FLAG_IS_NUM(
      `${options.tries}`.toLowerCase() === 'infinite' ? Infinity : options.tries,
      '-t, --tries',
      'number',
    );
    options.cover = options.cover && xpath.basename(options.cover);
    options.chunks = CHECK_FLAG_IS_NUM(options.chunks, '-n, --chunks', 'number');
    options.bitrate = CHECK_BIT_RATE_VAL(options.bitrate);
    options.input = PROCESS_INPUT_ARG(options.input);
  } catch (er) {
    stackLogger.error('\x1b[31m[i]\x1b[0m', er.message);
    process.exit(1);
  }

  const BASE_DIRECTORY = xpath.relative('.', options.directoryPrefix || '.') || '.';

  if (
    (await processPromise(Promise.promisify(fs.access)(BASE_DIRECTORY, fs.constants.F_OK), stackLogger, {
      pre: 'Checking directory permissions...',
      post: '[done]',
    })) === null
  )
    process.exit(3);

  function createPlaylist(stats, logger, directory, filename, playlistTitle) {
    if (options.playlist) {
      const validStats = stats.flat(Infinity).filter(Boolean);
      if (validStats.length) {
        logger.print('[\u2022] Creating playlist...');
        const playlistFile = xpath.join(directory, `${filename}.m3u8`);
        const plStream = fs.createWriteStream(playlistFile, {encoding: 'utf8'});
        plStream.write('#EXTM3U\n');
        if (playlistTitle) plStream.write(`#PLAYLIST:${playlistTitle}\n`);
        validStats.forEach(({meta: {name, artists, duration}, outputFile}) =>
          plStream.write(`\n#EXTINF:${Math.round(duration / 1e3)},${artists[0]} - ${name}\n${outputFile}\n`),
        );
        plStream.close();
        logger.write('[done]\n');
        logger.log(`[\u2022] Playlist file: [${playlistFile}]`);
      }
    } else logger.log(`[\u2022] Skipped playlist creation`);
  }

  async function processTrackFeed(collationLogger, service, meta) {
    const trackFileName = `${prePadNum(meta.track_number, meta.total_tracks, 2)} ${meta.name}`;
    const trackLogger = collationLogger.log(`\u2022 [${trackFileName}]`);
    trackLogger.indent += 2;
    const outFileName = `${trackFileName}.m4a`;
    const outFileDir = xpath.join(BASE_DIRECTORY, ...(options.tree ? [meta.artists[0], meta.album] : []));
    const outFilePath = xpath.join(outFileDir, outFileName);
    if (fs.existsSync(outFilePath)) {
      if (options.force) trackLogger.log('| [\u2022] Track exists. Overwriting...');
      else {
        trackLogger.log('| [\u2717] Track exists. Skipping...');
        return {meta, trackFileName};
      }
    }
    const albumObject = await processPromise(service.getAlbum(meta.album_uri), trackLogger, {
      pre: '| \u2b9e Requesting album data...',
    });
    if (!albumObject) return {meta, trackFileName};
    const trackFeats = await processPromise(service.getExtraTrackProps(meta.id), trackLogger, {
      pre: '| \u2b9e Requesting track feats...',
    });
    if (!trackFeats) return {meta, trackFileName};
    const audioSource = await processPromise(freyrCore.getYoutubeSource(meta), trackLogger, {
      pre: '| \u2b9e Awaiting stream source...',
      xerr: '[zero sources found]',
    });
    if (!audioSource) return {meta, trackFileName};
    const audioFeeds = await processPromise(freyrCore.getYoutubeStream(audioSource), trackLogger, {
      pre: '| \u2b9e Awaiting audiofeeds...',
      xerr: '[Unable to retrieve stream]',
    });
    if (!audioFeeds || audioFeeds.err) return {meta, err: audioFeeds.err, trackFileName};
    return new Promise((res, rej) => {
      const feedMeta = audioFeeds.formats.sort((meta1, meta2) => (meta1.abr > meta2.abr ? -1 : meta1.abr < meta2.abr ? 1 : 0))[0];
      const file = tmp.fileSync({template: 'fr3yrcli-XXXXXX.x4a'});
      const imageFile = tmp.fileSync({template: 'fr3yrcli-XXXXXX.x4i'});
      ({label: meta.label, genres: meta.genres, copyrights: meta.copyrights} = albumObject);
      ({tempo: meta.tempo} = trackFeats);
      const getAudioFeedStream =
        feedMeta.protocol !== 'http_dash_segments'
          ? () => {
              const req = xget(feedMeta.url, {chunks: options.chunks, size: feedMeta.size || null, retries: options.tries})
                .on(
                  'error',
                  err => (
                    trackLogger.log(`| [\u2717] Failed to get raw media stream: ${err.code}`),
                    (err = {err, meta, trackFileName}),
                    rej(err)
                  ),
                )
                .with('progressBar', ({size, chunkStack}) =>
                  progressGen(
                    size,
                    chunkStack.map(chunk => chunk.size),
                    {tag: `[‘${trackFileName}’]`},
                    trackLogger.indent,
                  ),
                )
                .use('progressBar', (dataSlice, store) => store.get('progressBar').next(dataSlice.size))
                .on('retry', data => data.store.get('progressBar').print(trackLogger.getText(`| ${getRetryMessage(data)}`)))
                .on('end', () => req.store.get('progressBar').end(''));
              return req;
            }
          : () => {
              const parsed_fragments = feedMeta.fragments.map(({path}) => ({
                url: `${feedMeta.fragment_base_url}${path}`,
                ...(([, min, max]) => ({min: +min, max: +max, size: +max - +min + 1}))(path.match(/range\/(\d+)-(\d+)$/)),
              }));
              const barGen = progressGen(
                parsed_fragments.reduce((total, {size}) => total + size, 0),
                parsed_fragments.map(({size}) => size),
                {tag: `[‘${trackFileName}’] (fragment: [:{frag_v}/:{frag_ct}])`},
                trackLogger.indent,
              );
              const nextFragmentStream = ((i = -1, frag) => () =>
                (frag = parsed_fragments[(i += 1)])
                  ? xget(frag.url, {chunks: 2, retries: options.retries})
                      .on('retry', data => barGen.print(trackLogger.getText(`| ${getRetryMessage(data)}`)))
                      .on(
                        'error',
                        err => (
                          (err.segment_index = i),
                          barGen.end(trackLogger.getText(`| [\u2717] Segment error while getting raw media: ${err.code}\n`)),
                          (err = {err, meta, trackFileName}),
                          rej(err)
                        ),
                      )
                      .pipe(barGen.next(frag.size, {variables: {frag_i: i + 1, frag_ct: parsed_fragments.length}}))
                  : null)();
              const merged = merge2({end: false})
                .once('resume', () => merged.add(nextFragmentStream()))
                .on('queueDrain', next => ((next = nextFragmentStream()) ? merged.add(next) : merged.end()))
                .once('end', () => barGen.end(''));
              return merged;
            };

      const imageFeed = xget(meta.image, {chunks: options.chunks, retries: options.tries})
        .with('progressBar', ({size, chunkStack}) =>
          progressGen(
            size,
            chunkStack.map(chunk => chunk.size),
            {tag: '[Retrieving album art]...'},
            trackLogger.indent,
          ),
        )
        .use('progressBar', (dataSlice, store) => store.get('progressBar').next(dataSlice.size))
        .on('end', () => imageFeed.store.get('progressBar').end(trackLogger.getText(`| [\u2714] Got album art\n`)))
        .on(
          'error',
          err => (trackLogger.log('| [\u2717] Failed to get album art'), (err = {err, meta, trackFileName}), rej(err)),
        );
      const imageFileStream = fs.createWriteStream(imageFile.name);
      imageFeed.pipe(imageFileStream).on('finish', () => {
        const audioStream = getAudioFeedStream();
        const audioFileStream = fs.createWriteStream(file.name);
        audioStream.pipe(audioFileStream).on('finish', () => {
          trackLogger.log(`| [\u2714] Got raw track file`);
          trackLogger.log(`| [\u2022] Asynchronously encoding...`);
          res({
            meta,
            outFileDir,
            outFileName,
            outFilePath,
            trackFileName,
            netBytesRead: {
              image: imageFileStream.bytesWritten,
              media: audioFileStream.bytesWritten,
            },
            promise:
              // eslint-disable-next-line no-shadow
              new Promise((res, rej) => {
                mkdirp(outFileDir)
                  .then(() => {
                    const wroteImage =
                      !!options.cover &&
                      (outArtPath =>
                        !(fs.existsSync(outArtPath) && !fs.statSync(outArtPath).isFile()) &&
                        (fs.copyFileSync(imageFile.name, outArtPath), true))(xpath.join(outFileDir, options.cover));
                    ffmpeg()
                      .addInput(file.name)
                      .audioBitrate(options.bitrate)
                      .audioFrequency(44100)
                      .noVideo()
                      .setDuration(TimeFormat.fromMs(meta.duration, 'hh:mm:ss.sss'))
                      .toFormat('ipod')
                      .saveToFile(outFilePath)
                      .on('error', err => rej(((err._code = 2), err)))
                      .on('end', () => {
                        file.removeCallback();
                        atomicParsley(
                          outFilePath,
                          {
                            title: meta.name,
                            artist: meta.artists[0],
                            albumArtist: meta.album_artist,
                            album: meta.album,
                            disk: `${meta.disc_number}/${meta.disc_number}`,
                            artwork: imageFile.name,
                            year: new Date(meta.release_date).toISOString().split('T')[0],
                            encodingTool: 'fr3yrcl1',
                            tracknum: `${meta.track_number}/${meta.total_tracks}`,
                            bpm: meta.tempo,
                            encodedBy: 'd3vc0dr',
                            Rating: meta.explicit ? 'explicit' : 'clean',
                            // composer:
                            advisory: meta.explicit ? 'Explicit Content' : 'Inoffensive',
                            stik: 'Normal',
                            genre: (meta.genres || [])[0] || '',
                            rDNSatom: [
                              ['CD', 'name=LABEL', 'domain=com.apple.iTunes'],
                              [meta.isrc, 'name=ISRC', 'domain=com.apple.iTunes'],
                              [meta.label, 'name=LABEL', 'domain=com.apple.iTunes'],
                              ...meta.artists.map(artist => [artist, 'name=ARTISTS', 'domain=com.apple.iTunes']),
                            ],
                            apID: 'cli@freyr.git',
                            gapless: false,
                            copyright: meta.copyrights.find(({type}) => type === 'P').text,
                            purchaseDate: 'timestamp',
                            comment: `URI: ${meta.uri}\nYouTube Stream ID: ${audioFeeds.id}`,
                          },
                          err => (imageFile.removeCallback(), err ? rej(((err._code = 3), err)) : res({wroteImage})),
                        );
                      });
                  })
                  .catch(err => rej(((err._code = 1), err)));
              }),
          });
        });
      });
    }).reflect();
  }

  // eslint-disable-next-line consistent-return
  const queriesStat = await Promise.mapSeries(options.input.concat(queries), async query => {
    const queryLogger = stackLogger.log(`[${query}]`);
    queryLogger.print('[\u2022] Identifying service...');
    const service = freyrCore.identifyService(query);
    if (!service) {
      queryLogger.write('failed\n');
      queryLogger.log(`\x1b[33m[i]\x1b[0m Invalid query`);
      return;
    }
    queryLogger.write(`[${service.DESC}]\n`);
    const authLogger = queryLogger.print('[\u2022] Checking authenticated user...');
    async function coreAuth(loginLogger) {
      const authStack = service.newAuth();
      const url = await authStack.getUrl;
      await processPromise(open(url), loginLogger, {pre: `[\u2022] Attempting to open [ ${url} ] within browser...`});
      const data = await processPromise(authStack.userToAuth(), loginLogger, {
        pre: '[\u2022] Awaiting user authentication...',
      });
      if (!data) return false;
      freyrCore.config.set(`services.${service.ID}.expiry`, data.expiry);
      freyrCore.config.set(`services.${service.ID}.refresh_token`, data.refresh_token);
      return !!data.refresh_token;
    }
    if (service.isAuthed()) authLogger.write('[authenticated]\n');
    else {
      authLogger.write(service.hasOnceAuthed() ? '[expired]\n' : '[unauthenticated]\n');
      const config = freyrCore.config.get(`services.${service.ID}`);
      const loginLogger = queryLogger.log(`[${service.DESC} Login]`);
      config.refresh_token
        ? (await processPromise(service.login(config), loginLogger, {pre: '[\u2022] Logging in...'})) ||
          (await coreAuth(loginLogger))
        : await coreAuth(loginLogger);
    }
    if (!service.isAuthed()) {
      queryLogger.log('[\u2717] Failed to authenticate client!');
      return;
    }
    const contentType = service.identifyType(query);
    queryLogger.log(`Detected [${contentType}]`);
    const metaLogger = queryLogger.print(`Obtaining metadata...`);
    const meta = await processPromise(
      contentType === 'track'
        ? service.getTrack(query)
        : contentType === 'artist'
        ? service.getArtist(query)
        : contentType === 'album'
        ? service.getAlbum(query)
        : service.getPlaylist(query),
      queryLogger,
    );
    if (!meta) return;
    let rxPromise;
    let collection;
    let collationLogger;
    if (contentType === 'track') {
      metaLogger.log(`\u2bc8 Title: ${meta.name}`);
      metaLogger.log(`\u2bc8 Album: ${meta.album}`);
      metaLogger.log(`\u2bc8 Artist: ${meta.album_artist}`);
      metaLogger.log(`\u2bc8 Year: ${new Date(meta.release_date).getFullYear()}`);
      metaLogger.log(`\u2bc8 Playtime: ${TimeFormat.fromMs(meta.duration, 'mm:ss').match(/(\d{2}:\d{2}).+/)[1]}`);
      collationLogger = queryLogger.log('[\u2022] Collating...');
      rxPromise = Promise.mapSeries([meta], track => processTrackFeed(collationLogger, service, track));
    } else if (contentType === 'album') {
      metaLogger.log(`\u2bc8 Album Name: ${meta.name}`);
      metaLogger.log(`\u2bc8 Artist: ${meta.artists[0]}`);
      metaLogger.log(`\u2bc8 Year: ${new Date(meta.release_date).getFullYear()}`);
      metaLogger.log(`\u2bc8 Tracks: ${meta.total_tracks}`);
      collationLogger = queryLogger.log(`[\u2022] Collating [${meta.name}]...`);
      rxPromise = Promise.mapSeries(meta.tracks, track => processTrackFeed(collationLogger, service, track));
    } else if (contentType === 'artist') {
      const artistLogger = metaLogger.log(`\u2bc8 Artist: ${meta.name}`);
      metaLogger.log(`\u2bc8 Genres: ${meta.genres.join(', ')}`);
      const albumsStack = await processPromise(service.getArtistAlbums(meta.uri), artistLogger, {
        pre: ' > Gathering collections...',
      });
      if (!albumsStack) return;
      artistLogger.print(' > Sorting collections...');
      const {albums, singles} = albumsStack.reduce((tx, v) => (tx[`${v.type}s`].items.push(v), tx), {
        singles: {desc: 'Singles & EPs', items: []},
        albums: {desc: 'Albums', items: []},
      });
      artistLogger.write('[done]\n');
      metaLogger.log(`\u2bc8 ${[albums, singles].map(stack => `${stack.desc}: ${stack.items.length}`).join(', ')}`);
      collationLogger = queryLogger.log(`[\u2022] Collating...`);
      rxPromise = Promise.mapSeries([albums, singles], async stack => {
        if (!stack.items.length) return;
        const cxLogger = collationLogger.log(`[\u2022] ${stack.desc}`);
        return Promise.mapSeries(stack.items, async (album, index) => {
          const albumLogger = cxLogger.log(`${prePadNum(index + 1, stack.items.length)} [${album.name}]`);
          const albumObject = await processPromise(service.getAlbum(album.uri), albumLogger, {
            pre: `[\u2022] Getting album information...`,
          });
          if (!albumObject) return;
          albumLogger.indent += 1;
          return Promise.mapSeries(albumObject.tracks, track => processTrackFeed(albumLogger, service, track));
        });
      });
    } else if (contentType === 'playlist') {
      metaLogger.log(`\u2bc8 Playlist Name: ${meta.name}`);
      metaLogger.log(`\u2bc8 By: ${meta.owner_name}`);
      if (meta.description) metaLogger.log(`\u2bc8 Description: ${meta.description}`);
      metaLogger.log(`\u2bc8 Type: ${meta.public ? 'Public' : 'Private'}`);
      metaLogger.log(`\u2bc8 Followers: ${`${meta.followers}`.replace(/(\d)(?=(\d{3})+$)/g, '$1,')}`);
      metaLogger.log(`\u2bc8 Tracks: ${meta.tracks.length}`);
      collationLogger = queryLogger.log(`[\u2022] Collating...`);
      collection = meta;
      rxPromise = Promise.mapSeries(meta.tracks, track => processTrackFeed(collationLogger, service, track));
    }
    const qList = (await rxPromise).flat(Infinity).filter(Boolean);
    queryLogger.log('[\u2022] Download Complete');
    if (!qList.length) return;
    const embedLogger = queryLogger.log('[\u2022] Embedding Metadata...');
    const stats = await Promise.mapSeries(qList, async trackMeta => {
      const trackSlice =
        trackMeta.value && trackMeta.reason ? (trackMeta.isFulfilled() ? trackMeta.value() : trackMeta.reason()) : trackMeta;
      const refName = `${trackSlice.trackFileName}${collection ? ` ‒ ${trackSlice.meta.artists.join(', ')}` : ''}`;
      if (!trackSlice.promise) {
        embedLogger.error(`\u2022 [\u2717] ${refName}${trackSlice.err ? ` [${trackSlice.err}]` : ''}`);
        return;
      }
      const encoderInspector = await trackSlice.promise.reflect();
      if (encoderInspector.isFulfilled())
        embedLogger.log(
          `\u2022 [\u2714] ${refName}${
            !!options.cover && !encoderInspector.value().wroteImage ? ' [(i) unable to write cover art]' : ''
          }`,
        );
      else {
        const err = encoderInspector.reason();
        const reason =
          err._code === 1
            ? `Error creating directory`
            : err._code === 2
            ? `Error encoding audio`
            : err._code === 3
            ? `Error embedding metadata`
            : `That's weird, I don't know what happened`;
        embedLogger.error(`\u2022 [\u2717] ${refName} [${trackSlice.meta.uri}] (failed: [${reason}])`);
      }
      return {
        meta: trackSlice.meta,
        outputFile: trackSlice.outFilePath,
        netBytesRead: trackSlice.netBytesRead,
        fileSize: encoderInspector.isFulfilled() ? fs.statSync(trackSlice.outFilePath).size : 0,
      };
    });
    if (collection)
      createPlaylist(
        stats,
        queryLogger,
        BASE_DIRECTORY,
        `${meta.name}${meta.owner_name ? `-${meta.owner_name}` : ''}`,
        `${meta.name}${meta.owner_name ? ` by ${meta.owner_name}` : ''}`,
        true,
      );
    stackLogger.log('[\u2022] Collation Complete');
    return stats;
  });
  const validQueriesStat = queriesStat.flat(Infinity).filter(Boolean);
  if (options.playlist && typeof options.playlist === 'string')
    createPlaylist(validQueriesStat, stackLogger, BASE_DIRECTORY, options.playlist);
  const stats = validQueriesStat.reduce(
    (tx, cx) => {
      if (cx) {
        tx.outSize += cx.fileSize;
        tx.mediaSize += cx.netBytesRead.media;
        tx.imageSize += cx.netBytesRead.image;
        tx.netSize += cx.netBytesRead.media + cx.netBytesRead.image;
      }
      return tx;
    },
    {outSize: 0, mediaSize: 0, imageSize: 0, netSize: 0},
  );
  if (options.stats) {
    stackLogger.log('========== Stats ==========');
    stackLogger.log(` [\u2022] Runtime: [${prettyMs(Date.now() - initTimeStamp)}]`);
    stackLogger.log(` [\u2022] Total tracks: [${prePadNum(validQueriesStat.length, 10)}]`);
    stackLogger.log(` [\u2022] Output directory: [${BASE_DIRECTORY}]`);
    stackLogger.log(` [\u2022] Cover Art: ${options.cover}`);
    stackLogger.log(` [\u2022] Output size: ${xbytes(stats.outSize)}`);
    stackLogger.log(` [\u2022] Network Usage: ${xbytes(stats.netSize)}`);
    stackLogger.log(`   \u2022 Media: ${xbytes(stats.mediaSize)}`);
    stackLogger.log(`   \u2022 Album Art: ${xbytes(stats.imageSize)}`);
    stackLogger.log(` [\u2022] Output bitrate: ${options.bitrate}`);
    stackLogger.log('===========================');
  }
}

function processArgs(query, args) {
  init(query, args).catch(err => console.error('unmanaged cli error>', err));
}

const command = commander
  .name('freyr')
  .usage('[options] [query...]')
  .arguments('[query...]')
  .description(packageJson.description)
  .option('-i, --input <FILE>', 'use URIs found in the specified FILE (size limit: 1 MiB)')
  .option('-b, --bitrate <N>', 'set bitrate for audio encoding\n(valid: [96, 128, 160, 192, 256, 320])', '320k')
  .option('-d, --directory-prefix <PREFIX>', 'save tracks to PREFIX/..', '.')
  .option('-c, --cover <name>', 'custom name for the cover art', 'cover.png')
  .option('-C, --no-cover', 'skip saving a cover art')
  .option('-n, --chunks <N>', 'number of concurrent chunk streams with which to download', 7)
  .option('-t, --tries <N>', 'set number of retries for each chunk before giving up (`infinite` for infinite)', 10)
  .option('-f, --force', 'force overwrite of existing files')
  .option('-p, --playlist <file>', 'create playlist for all successfully collated tracks')
  .option('-P, --no-playlist', 'skip creating a playlist file for collections')
  .option('-f, --filter <SEQ>', 'filter matches (unimplemented)')
  .option('-g, --groups <GROUP_TYPE>', 'filter collections by single/album/appears_on/compilation (unimplemented)')
  .option('-T, --no-tree', "don't organise tracks in format [PREFIX/]<ARTIST>/<ALBUM>/<TRACK>")
  .option('--no-stats', "don't show the stats on completion")
  .option('--pulsate-bar', 'show a pulsating bar')
  .option('--single-bar', 'show a single bar for the download, hide chunk-view\n[default when n(chunks) exceed printable space]')
  .version(`v${packageJson.version}`, '-v, --version')
  .action(processArgs);

function main(argv) {
  if (!argv.includes('-v')) {
    const credits = `freyr v${packageJson.version} - (c) ${packageJson.author}`;
    console.log(credits);
    console.log('-'.repeat(credits.length));
    if (
      (props => props.args.length === 2 && props.unknown.length === 0)(command.parseOptions(argv)) &&
      !['-i', '--input'].some(flag => argv.includes(flag))
    )
      return commander.outputHelp();
  }
  command.parse(argv);
}

main(process.argv);

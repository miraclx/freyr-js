#!/usr/bin/env node
/* eslint-disable no-underscore-dangle, consistent-return, camelcase, prefer-promise-reject-errors */
const fs = require('fs');
const xpath = require('path');
const {spawn, spawnSync} = require('child_process');

const tmp = require('tmp');
const Conf = require('conf');
const open = require('open');
const xget = require('libxget');
const ffmpeg = require('fluent-ffmpeg');
const lodash = require('lodash');
const merge2 = require('merge2');
const mkdirp = require('mkdirp');
const xbytes = require('xbytes');
const Promise = require('bluebird');
const cStringd = require('stringd-colors');
const isOnline = require('is-online');
const prettyMs = require('pretty-ms');
const commander = require('commander');
const TimeFormat = require('hh-mm-ss');
const ProgressBar = require('xprogress');
const countryData = require('country-data');
const {isBinaryFile} = require('isbinaryfile');

const symbols = require('./src/symbols');
const pFlatten = require('./src/p_flatten');
const FreyrCore = require('./src/freyr');
const AuthServer = require('./src/cli_server');
const AsyncQueue = require('./src/async_queue');
const StackLogger = require('./src/stack_logger');
const packageJson = require('./package.json');

function parseMeta(params) {
  return Object.entries(params)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) =>
      Array.isArray(value) ? value.map(tx => (tx ? [`--${key}`, ...(Array.isArray(tx) ? tx : [tx])] : '')) : [`--${key}`, value],
    )
    .flat(Infinity);
}

function extendPathOnEnv(path) {
  return {...process.env, PATH: [process.env.PATH, path].join(process.platform === 'win32' ? ';' : ':')};
}

function ensureBinExtIfWindows(isWin, command) {
  return command.replace(/(\.exe)?$/, isWin ? '.exe' : '$1');
}

function check_bin_is_existent(bin, path) {
  const isWin = process.platform === 'win32';
  const command = isWin ? 'where' : 'which';
  const {status} = spawnSync(ensureBinExtIfWindows(isWin, command), [bin], {env: extendPathOnEnv(path)});
  if ([127, null].includes(status)) throw Error(`Unable to locate the command [${command}] within your PATH`);
  return status === 0;
}

function atomicParsley(file, args, cb) {
  const err = new Error('Unable to find an executable AtomicParsley binary. Please install.');
  const isWin = process.platform === 'win32';
  const path = xpath.relative(__dirname, xpath.join('./bins', isWin ? 'windows' : 'posix'));
  if (!check_bin_is_existent('AtomicParsley', path))
    if (typeof file === 'boolean') throw err;
    else return cb(err);

  if (typeof file === 'string')
    spawn(ensureBinExtIfWindows(isWin, 'AtomicParsley'), [file, ...parseMeta(args), '--overWrite'], {
      env: extendPathOnEnv(path),
    }).on('close', cb);
}

function getRetryMessage({meta, ref, retryCount, maxRetries, bytesRead, totalBytes, lastErr}) {
  return cStringd(
    [
      ':{color(red)}{⯈}:{color:close(red)} ',
      `:{color(cyan)}@${meta ? 'meta' : ref}:{color:close(cyan)}`,
      `{:{color(yellow)}${retryCount}:{color:close(yellow)}${
        Number.isFinite(maxRetries) ? `/:{color(yellow)}${maxRetries}:{color:close(yellow)}` : ''
      }}: `,
      lastErr
        ? `${lastErr.code ? `[:{color(yellow)}${lastErr.code}:{color:close(yellow)}] ` : ''}(:{color(yellow)}${lastErr.message ||
            lastErr}:{color:close(yellow)}) `
        : '',
      totalBytes
        ? `(:{color(cyan)}${
            Number.isFinite(totalBytes) ? `${bytesRead}`.padStart(`${totalBytes}`.length, ' ') : bytesRead
          }:{color:close(cyan)}${Number.isFinite(totalBytes) ? `/:{color(cyan)}${totalBytes}:{color:close(cyan)}` : ''})`
        : '',
    ].join(''),
  );
}

function prePadNum(val, total, min = 2) {
  return `${val}`.padStart(Math.max(`${total}`.length, min), '0');
}

function prepProgressGen(options) {
  return (size, slots, opts, indentLen, isFragment) => {
    const forceFirst = options.singleBar || slots.length === 1 || slots.length > 20;
    return ProgressBar.stream(size, slots, {
      forceFirst,
      length: 47,
      pulsate: options.pulsateBar || !Number.isFinite(size),
      bar: {separator: '|'},
      // eslint-disable-next-line prettier/prettier
      template: [
        ':{indent} [:{bullet}] :{label} :{flipper}',
        ':{indent}  | :{bullet} :{_tag}',
        ':{bars}'
      ],
      clean: true,
      flipper: [...Array(10)].map((...[, i]) => `:{color}${':{bullet}'.repeat(i + 1)}:{color:close}`),
      label: 'Downloading',
      variables: {
        _tag: `:{tag} (${isFragment ? 'fragments' : 'chunks'}: ${slots.length})`,
        bullet: '\u2022',
        bars: ({total}) =>
          (Number.isFinite(total) && !forceFirst
            ? [':{indent}  | [:{bar:complete}] [:3{percentage}%] [:{speed}] (:{eta})', ':{indent}  | [:{bar}] [:{size}]']
            : [`:{indent}  | [:{bar}]${Number.isFinite(total) ? ' [:3{percentage}%]' : ''} [:{speed}] (:{eta}) [:{size}]`]
          ).join('\n'),
        size: (stack, _size, total) => ((total = stack.total), `${stack.size()}${total !== Infinity ? `/:{size:total}` : ''}`),
        indent: ` `.repeat(indentLen),
        ...opts,
      },
    });
  };
}

async function processPromise(px, logger, {pre, post, err, xerr} = {}) {
  if (pre) logger.print(pre);
  const rex = await Promise.resolve(typeof px === 'function' ? px() : px).reflect();
  if (rex.isRejected() && err !== false)
    logger.write(
      ...(err
        ? [typeof err === 'function' ? err(rex.reason()) : err, '\n']
        : [`(failed%s)\n`, (_err => (_err ? `: [${_err.message || _err}]` : ''))(rex.reason())]),
    );
  else if (xerr && (!rex.value() || rex.value().err)) logger.write(`${xerr}\n`);
  else if (post !== false) logger.write(`${post || '[done]'}\n`);
  return rex.isFulfilled() ? rex.value() : null;
}

const VALIDS = {
  bitrates: FreyrCore.getBitrates(),
  downloaders: FreyrCore.getEngineMetas()
    .filter(meta => meta.PROPS.isSourceable)
    .map(meta => meta.ID),
  concurrency: ['queries', 'tracks', 'trackStage', 'downoloader', 'encoder', 'embedder'],
};

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
  if (!(bitrate && VALIDS.bitrates.includes(+bitrate)))
    throw new Error(
      `Invalid bitrate specification: [${bitrate_arg}]. Bitrate should be either of [${VALIDS.bitrates.join(', ')}]`,
    );
  return `${bitrate}k`;
}

async function PROCESS_INPUT_FILE(input_arg, type, allowBinary = false) {
  if (!fs.existsSync(input_arg)) throw new Error(`${type} file [${input_arg}] is inexistent`);
  const stat = fs.statSync(input_arg);
  if (stat.size > 1048576) throw new Error(`${type} file [${input_arg}] is beyond the maximum 1 MiB size limit`);
  if (!stat.isFile()) throw new Error(`${type} file [${input_arg}] is not a file`);
  if (!allowBinary && (await isBinaryFile(input_arg, stat.size)))
    throw new Error(`${type} file [${input_arg}] cannot be a binary file`);
  return input_arg;
}

async function PROCESS_INPUT_ARG(input_arg) {
  if (!input_arg) return [];
  await PROCESS_INPUT_FILE(input_arg, 'Input', false);
  const contents = fs
    .readFileSync(input_arg)
    .toString()
    .split('\n')
    .map(line => line.trim()) // Trim whitespaces
    .filter(line => !!line && /^(?!\s*#)/.test(line)) // Ignore empty lines or lines that start with comments
    .map(line => line.replace(/#.*$/, '').trim()); // Ignore comments at the end of lines
  return contents;
}

async function PROCESS_CONFIG_ARG(config_arg) {
  const local_config = xpath.join(__dirname, 'conf.json');
  if (!config_arg) return local_config;
  return PROCESS_INPUT_FILE(config_arg, 'Config', false);
}

function PROCESS_IMAGE_SIZE(value) {
  if (!['string', 'number'].includes(typeof value)) value = `${value.width}x${value.height}`;
  let parts = value.toString().split(/(?<=\d+)x(?=\d+)/);
  if (parts.some(part => parseInt(part, 10).toString() !== part)) return false;
  parts = parts.map(part => parseInt(part, 10));
  return {width: parts[0], height: parts[1] || parts[0]};
}

function PROCESS_DOWNLOADER_ORDER(value, throwEr) {
  if (!Array.isArray(value)) return throwEr();
  return value.filter(Boolean).map(item => (!VALIDS.downloaders.includes(item) ? throwEr(item) : item));
}

async function init(queries, options) {
  const initTimeStamp = Date.now();
  const stackLogger = new StackLogger({indentSize: 1});
  if (!(await isOnline())) stackLogger.error('\x1b[31m[!]\x1b[0m Failed To Detect An Internet Connection'), process.exit(5);
  if (!((Array.isArray(queries) && queries.length > 0) || options.input))
    stackLogger.error('\x1b[31m[i]\x1b[0m Please enter a valid query'), process.exit(1);

  try {
    atomicParsley(true);
    options.tries = CHECK_FLAG_IS_NUM(
      `${options.tries}`.toLowerCase() === 'infinite' ? Infinity : options.tries,
      '-t, --tries',
      'number',
    );
    options.cover = options.cover && xpath.basename(options.cover);
    options.chunks = CHECK_FLAG_IS_NUM(options.chunks, '-n, --chunks', 'number');
    options.timeout = CHECK_FLAG_IS_NUM(options.timeout, '--timeout', 'number');
    options.bitrate = CHECK_BIT_RATE_VAL(options.bitrate);
    options.input = await PROCESS_INPUT_ARG(options.input);
    options.config = await PROCESS_CONFIG_ARG(options.config);
    options.concurrency = Object.fromEntries(
      (options.concurrency || [])
        .map(item => (([k, v]) => (v ? [k, v] : ['tracks', k]))(item.split('=')))
        .map(([k, v]) => {
          if (!VALIDS.concurrency.includes(k))
            throw Error(`key identifier for the \`-z, --concurrency\` flag must be valid. found [key: ${k}]`);
          return [k, CHECK_FLAG_IS_NUM(v, '-z, --concurrency', 'number')];
        }),
    );
    if (options.storefront) {
      const data = countryData.lookup.countries({alpha2: options.storefront.toUpperCase()});
      if (data.length) options.storefront = data[0].alpha2.toLowerCase();
      else throw new Error('Country specification with the `--storefront` option is invalid');
    }

    if (options.coverSize) {
      const err = new Error(
        `Invalid \`--cover-size\` specification [${options.coverSize}]. (expected: <width>x<height> or <size> as <size>x<size>)`,
      );
      if (!(options.coverSize = PROCESS_IMAGE_SIZE(options.coverSize))) throw err;
    }

    options.downloader = PROCESS_DOWNLOADER_ORDER((options.downloader || '').split(','), item => {
      throw new Error(`downloader specification within the \`--downloader\` must be valid. found [${item}]`);
    });
  } catch (err) {
    stackLogger.error('\x1b[31m[i]\x1b[0m', err.message || err);
    process.exit(2);
  }

  let Config = {
    server: {
      hostname: 'localhost',
      port: 36346,
      useHttps: false,
    },
    image: {
      width: 640,
      height: 640,
    },
    concurrency: {
      queries: 1,
      tracks: 1,
      trackStage: 6,
      requests: 4,
      downloader: 4,
      encoder: 6,
      embedder: 10,
    },
    downloader: {
      order: ['youtube'],
    },
  };
  try {
    if (fs.existsSync(options.config)) {
      Config = lodash.mergeWith(Config, JSON.parse(fs.readFileSync(options.config)), (a, b, k) =>
        k === 'order' && [a, b].every(Array.isArray) ? b.concat(a) : undefined,
      );
    } else {
      stackLogger.error(`\x1b[31m[!]\x1b[0m Configuration file [${xpath.relative('.', options.config)}] not found`);
      process.exit(4);
    }
    const errMessage = new Error(`[key: image, value: ${JSON.stringify(Config.image)}]`);
    if (!(Config.image = PROCESS_IMAGE_SIZE(Config.image))) throw errMessage;
    Config.downloader.order = PROCESS_DOWNLOADER_ORDER(Config.downloader.order, item => {
      if (item) throw new Error(`Downloader order within the config file must be valid. found [${item}]`);
      throw new Error(`Downloader order must be an array of strings`);
    });
  } catch (err) {
    stackLogger.error(`\x1b[31m[!]\x1b[0m Configuration file [conf.json] wrongly formatted`);
    stackLogger.error(err.message || err);
    process.exit(4);
  }

  let freyrCore;
  try {
    freyrCore = new FreyrCore(Config.services, AuthServer, Config.server);
  } catch (err) {
    stackLogger.error(`\x1b[31m[!]\x1b[0m Failed to initialize a Freyr Instance`);
    stackLogger.error(err.message || err);
    process.exit(6);
  }

  const schema = {
    services: {
      type: 'object',
      additionalProperties: false,
      default: {},
      properties: {},
    },
  };
  freyrCore.engines.forEach(engine => {
    schema.services.default[engine[symbols.meta].ID] = {};
    schema.services.properties[engine[symbols.meta].ID] = {
      type: 'object',
      additionalProperties: false,
      properties: engine.propSchema || {},
    };
  });
  const freyrCoreConfig = new Conf({
    projectName: 'FreyrCLI',
    projectSuffix: '',
    configName: 'd3fault',
    fileExtension: 'enc',
    schema,
  });

  const progressGen = prepProgressGen(options);

  Config.image = lodash.merge(Config.image, options.coverSize);
  Config.concurrency = lodash.merge(Config.concurrency, options.concurrency);
  Config.downloader.order = Array.from(new Set(options.downloader.concat(Config.downloader.order)));
  const sourceStack = freyrCore.sortSources(Config.downloader.order);

  const BASE_DIRECTORY = (path => (xpath.isAbsolute(path) ? path : xpath.relative('.', path || '.') || '.'))(options.directory);

  if (!fs.existsSync(BASE_DIRECTORY))
    stackLogger.error(`\x1b[31m[!]\x1b[0m Working directory [${BASE_DIRECTORY}] isn't existent`), process.exit(3);

  if (
    (await processPromise(Promise.promisify(fs.access)(BASE_DIRECTORY, fs.constants.F_OK), stackLogger, {
      pre: 'Checking directory permissions...',
      post: '[done]',
    })) === null
  )
    process.exit(3);

  function createPlaylist(stats, logger, directory, filename, playlistTitle) {
    if (options.playlist) {
      const validStats = stats.filter(stat => !stat.code);
      if (validStats.length) {
        logger.print('[\u2022] Creating playlist...');
        const playlistFile = xpath.join(directory, `${filename}.m3u8`);
        const plStream = fs.createWriteStream(playlistFile, {encoding: 'utf8'});
        plStream.write('#EXTM3U\n');
        if (playlistTitle) plStream.write(`#PLAYLIST:${playlistTitle}\n`);
        validStats.forEach(({meta: {track: {name, artists, duration}, outFilePath}}) =>
          plStream.write(
            `\n#EXTINF:${Math.round(duration / 1e3)},${artists[0]} - ${name}\n${xpath.relative(directory, outFilePath)}\n`,
          ),
        );
        plStream.close();
        logger.write('[done]\n');
        logger.log(`[\u2022] Playlist file: [${playlistFile}]`);
      }
    } else logger.log(`[\u2022] Skipped playlist creation`);
  }

  function downloadToStream({urlOrFragments, writeStream, logger, opts}) {
    opts = {tag: '', successMessage: '', failureMessage: '', retryMessage: '', ...opts};
    [opts.tag, opts.errorHandler, opts.retryMessage, opts.failureMessage, opts.successMessage] = [
      opts.tag,
      opts.errorHandler,
      opts.retryMessage,
      opts.failureMessage,
      opts.successMessage,
    ].map(val => (typeof val === 'function' || val === false ? val : () => val));
    return new Promise((res, rej) => {
      let completed = false;
      if (!Array.isArray(urlOrFragments)) {
        const feed = xget(urlOrFragments, {chunks: options.chunks, retries: options.tries, timeout: options.timeout})
          .with('progressBar', urlMeta =>
            progressGen(
              urlMeta.size,
              urlMeta.chunkStack.map(chunk => chunk.size),
              {tag: opts.tag(urlMeta)},
              logger.indent,
              false,
            ),
          )
          .use('progressBar', (dataSlice, store) => store.get('progressBar').next(dataSlice.next))
          .on('end', () => {
            if (feed.store.has('progressBar')) feed.store.get('progressBar').end(opts.successMessage(), '\n');
            else logger.log(opts.successMessage());
          })
          .on('retry', data => {
            if (opts.retryMessage !== false) {
              if (feed.store.has('progressBar'))
                data.store.get('progressBar').print(opts.retryMessage({ref: data.index + 1, ...data}));
              else logger.log(opts.retryMessage(data));
            }
          })
          .once('error', err => {
            if (completed) return;
            err = Object(err);
            if (feed.store.has('progressBar')) feed.store.get('progressBar').end(opts.failureMessage(err), '\n');
            else logger.log(opts.failureMessage(err));
            opts.errorHandler(err);
            rej(err);
          });
        feed.pipe(writeStream).on('finish', () => ((completed = true), res(writeStream.bytesWritten)));
      } else {
        const barGen = progressGen(
          urlOrFragments.reduce((total, fragment) => total + fragment.size, 0),
          urlOrFragments.map(fragment => fragment.size),
          {tag: opts.tag()},
          logger.indent,
          true,
        );

        let has_erred = false;

        merge2(
          ...urlOrFragments.map((frag, i) => {
            const feed = xget(frag.url, {chunks: 1, retries: options.tries, timeout: options.timeout})
              .on('retry', data => {
                if (opts.retryMessage !== false) barGen.print(opts.retryMessage({ref: `${i}[${data.index + 1}]`, ...data}));
              })
              .once('error', err => {
                if (completed) return;
                if (has_erred) return feed.destroy();
                err = Object(err);
                has_erred = true;
                err.segment_index = i;
                barGen.end(opts.failureMessage(err), '\n');
                opts.errorHandler(err);
                rej(err);
              });
            return feed.pipe(barGen.next(frag.size));
          }),
        )
          .once('end', () => barGen.end(opts.successMessage(), '\n'))
          .pipe(writeStream)
          .on('finish', () => ((completed = true), res(writeStream.bytesWritten)));
      }
    });
  }

  const downloadQueue = new AsyncQueue(
    'cli:downloadQueue',
    Config.concurrency.downloader,
    async ({track, meta, feedMeta, trackLogger}) => {
      const imageFile = tmp.fileSync({template: 'fr3yrcli-XXXXXX.x4i'});
      const imageBytesWritten = await downloadToStream({
        urlOrFragments: track.getImage(Config.image.width, Config.image.height),
        writeStream: fs.createWriteStream(imageFile.name),
        logger: trackLogger,
        opts: {
          tag: '[Retrieving album art]...',
          errorHandler: () => imageFile.removeCallback(),
          retryMessage: data => trackLogger.getText(`| ${getRetryMessage(data)}`),
          failureMessage: err =>
            trackLogger.getText(`| [\u2717] Failed to get album art${err ? ` [${err.code || err.message}]` : ''}`),
          successMessage: trackLogger.getText(`| [\u2714] Got album art`),
        },
      }).catch(err => Promise.reject({err, code: 3}));
      const rawAudio = tmp.fileSync({template: 'fr3yrcli-XXXXXX.x4a'});
      const audioBytesWritten = await downloadToStream(
        lodash.merge(
          {
            writeStream: fs.createWriteStream(rawAudio.name),
            logger: trackLogger,
            opts: {
              tag: `[‘${meta.trackName}’]`,
              errorHandler: () => rawAudio.removeCallback(),
              retryMessage: data => trackLogger.getText(`| ${getRetryMessage(data)}`),
              successMessage: trackLogger.getText('| [\u2714] Got raw track file'),
            },
          },
          feedMeta.protocol !== 'http_dash_segments'
            ? {
                urlOrFragments: feedMeta.url,
                opts: {
                  failureMessage: err =>
                    trackLogger.getText(`| [\u2717] Failed to get raw media stream${err ? ` [${err.code || err.message}]` : ''}`),
                },
              }
            : {
                urlOrFragments: feedMeta.fragments.map(({path}) => ({
                  url: `${feedMeta.fragment_base_url}${path}`,
                  ...(([, min, max]) => ({min: +min, max: +max, size: +max - +min + 1}))(path.match(/range\/(\d+)-(\d+)$/)),
                })),
                opts: {
                  failureMessage: err =>
                    trackLogger.getText(
                      `| [\u2717] Segment error while getting raw media${err ? ` [${err.code || err.message}]` : ''}`,
                    ),
                },
              },
        ),
      ).catch(err => Promise.reject({err, code: 4}));
      return {
        image: {file: imageFile, bytesWritten: imageBytesWritten},
        audio: {file: rawAudio, bytesWritten: audioBytesWritten},
      };
    },
  );

  const embedQueue = new AsyncQueue(
    'cli:postprocessor:embedQueue',
    Config.concurrency.embedder,
    async ({track, meta, files, audioSource}) => {
      return Promise.promisify(atomicParsley)(meta.outFilePath, {
        title: track.name,
        artist: track.artists[0],
        albumArtist: track.album_artist,
        album: track.album,
        disk: `${track.disc_number}/${track.disc_number}`,
        artwork: files.image.file.name,
        year: new Date(track.release_date).toISOString().split('T')[0],
        encodingTool: 'fr3yrcl1',
        tracknum: `${track.track_number}/${track.total_tracks}`,
        encodedBy: 'd3vc0dr',
        advisory: track.explicit ? 'explicit' : 'clean',
        composer: track.composers,
        Rating: track.explicit ? 'Explicit Content' : 'Inoffensive',
        stik: 'Normal',
        genre: (track.genres || [])[0],
        rDNSatom: [
          ['CD', 'name=MEDIA', 'domain=com.apple.iTunes'],
          [track.isrc, 'name=ISRC', 'domain=com.apple.iTunes'],
          [track.label, 'name=LABEL', 'domain=com.apple.iTunes'],
          [meta.service.DESC, 'name=SOURCE', 'domain=com.apple.iTunes'],
          ...track.artists.map(artist => [artist, 'name=ARTISTS', 'domain=com.apple.iTunes']),
        ],
        apID: 'cli@freyr.git',
        compilation: track.compilation,
        copyright: track.copyrights.sort(({type}) => (type === 'P' ? -1 : 1))[0].text,
        purchaseDate: 'timestamp',
        comment: `URI: ${track.uri}\nYouTube Stream ID: ${audioSource.videoId}`,
      })
        .finally(() => files.image.file.removeCallback())
        .catch(err => Promise.reject({err, code: 8}));
    },
  );

  const encodeQueue = new AsyncQueue(
    'cli:postprocessor:encodeQueue',
    Config.concurrency.encoder,
    async ({track, meta, files}) => {
      return new Promise((res, rej) =>
        ffmpeg()
          .addInput(files.audio.file.name)
          .audioBitrate(options.bitrate)
          .audioFrequency(44100)
          .noVideo()
          .setDuration(TimeFormat.fromMs(track.duration, 'hh:mm:ss.sss'))
          .toFormat('ipod')
          .saveToFile(meta.outFilePath)
          .on('error', err => rej({err, code: 7}))
          .on('end', res),
      ).finally(() => files.audio.file.removeCallback());
    },
  );

  const postProcessor = new AsyncQueue('cli:postProcessor', 4, async ({track, meta, files, audioSource}) => {
    await mkdirp(meta.outFileDir).catch(err => Promise.reject({err, code: 6}));
    const wroteImage =
      !!options.cover &&
      (outArtPath =>
        !(fs.existsSync(outArtPath) && !fs.statSync(outArtPath).isFile()) &&
        (fs.copyFileSync(files.image.file.name, outArtPath), true))(xpath.join(meta.outFileDir, options.cover));
    await encodeQueue.push({track, meta, files});
    await embedQueue.push({track, meta, files, audioSource});
    return {wroteImage, finalSize: fs.statSync(meta.outFilePath).size};
  });

  function buildSourceCollectorFor(track, selector) {
    async function handleSource(iterator) {
      const result = {service: null, sources: null};
      if ((result.service = iterator.next().value)) {
        result.sources = Promise.resolve(
          result.service.get(track.artists, track.name.replace(/\s*\((((feat|ft).)|with).+\)/, ''), track.duration),
        ).then(sources => {
          if ([undefined, null].includes(sources)) throw new Error(`incompatible response. recieved [${sources}]`);
          const source = (
            selector ||
            (results => {
              try {
                return results[0];
              } catch {
                throw new Error(`error while extracting feed from source, try defining a <selector>. recieved [${results}]`);
              }
            })
          )(sources);
          if ([undefined, null].includes(source)) throw new Error(`incompatible source response. recieved: [${source}]`);
          if (!('getFeeds' in source)) throw new Error(`service provided no means for source to collect feeds`);
          const feeds = source.getFeeds();
          if ([undefined, null].includes(feeds)) throw new Error(`service returned no valid feeds for source`);
          return {sources, source, feeds};
        });
        result.results = result.sources.catch(() => ({next: handleSource(iterator)}));
      }
      return result;
    }

    async function collect_contained(process, handler) {
      process = await process;
      if (!process.sources) return;
      await handler(process.service, process.sources);
      const results = await process.results;
      if (results.next) return collect_contained(results.next, handler);
      return results;
    }

    const process = handleSource(sourceStack.values());
    return async handler => collect_contained(process, handler);
  }

  const trackQueue = new AsyncQueue('cli:trackQueue', Config.concurrency.tracks, async ({track, meta, props}) => {
    const trackLogger = props.logger.log(`\u2022 [${meta.trackName}]`);
    trackLogger.indent += 2;
    if (props.fileExists) {
      if (!props.processTrack) {
        trackLogger.log('| [\u2717] Track exists. Skipping...');
        return {meta, code: 0};
      }
      trackLogger.log('| [\u2022] Track exists. Overwriting...');
    }
    trackLogger.log('| \u2b9e Collating sources...');
    const audioSource = await props.collectSources((service, sources) =>
      processPromise(sources, trackLogger, {
        pre: `|  \u2b9e [\u2022] ${service[symbols.meta].DESC}...`,
        xerr: '[Unable to retrieve stream]',
        post: '[success]',
      }),
    );
    if (!audioSource) return {meta, code: 1};
    const audioFeeds = await processPromise(audioSource.feeds, trackLogger, {
      pre: '| \u2b9e Awaiting audiofeeds...',
      xerr: '[Unable to retrieve stream]',
    });
    if (!audioFeeds || audioFeeds.err) return {meta, err: audioFeeds.err, code: 2};

    const feedMeta = audioFeeds.formats.sort((meta1, meta2) => (meta1.abr > meta2.abr ? -1 : meta1.abr < meta2.abr ? 1 : 0))[0];
    const files = await downloadQueue
      .push({track, meta, feedMeta, trackLogger})
      .catch(errObject => Promise.reject({meta, code: 5, ...(errObject.code ? errObject : {err: errObject})}));
    trackLogger.log(`| [\u2022] Post Processing...`);
    return {
      files,
      postprocess: postProcessor
        .push({track, meta, files, audioSource})
        .catch(errObject => Promise.resolve({code: 9, ...errObject})),
    };
  });

  const trackBroker = new AsyncQueue(
    'cli:trackBroker',
    Config.concurrency.trackStage,
    async (track, {logger, service, isPlaylist}) => {
      track = await track;
      const outFileDir = xpath.join(BASE_DIRECTORY, ...(options.tree ? [track.album_artist, track.album] : []));
      const trackName = `${prePadNum(track.track_number, track.total_tracks, 2)} ${track.name}${
        isPlaylist || (track.compilation && track.album_artist === 'Various Artists') ? ` \u2012 ${track.artists.join(', ')}` : ''
      }`;
      const outFileName = `${trackName}.m4a`;
      const outFilePath = xpath.join(outFileDir, outFileName);
      const fileExists = fs.existsSync(outFilePath);
      const processTrack = !fileExists || options.force;
      let collectSources;
      if (processTrack) collectSources = buildSourceCollectorFor(track, results => results[0]);
      const meta = {trackName, outFileDir, outFilePath, track, service};
      return trackQueue
        .push({track, meta, props: {collectSources, fileExists, processTrack, logger}})
        .then(trackObject => ({...trackObject, meta}))
        .catch(errObject => Promise.resolve({meta, code: 10, ...errObject}));
    },
  );

  async function trackHandler(query, {service, queryLogger}) {
    const logger = queryLogger.print(`Obtaining track metadata...`);
    const track = await processPromise(service.getTrack(query, options.storefront), queryLogger);
    if (!track) return Promise.reject();
    logger.log(`\u2bc8 Title: ${track.name}`);
    logger.log(`\u2bc8 Album: ${track.album}`);
    logger.log(`\u2bc8 Artist: ${track.album_artist}`);
    logger.log(`\u2bc8 Year: ${new Date(track.release_date).getFullYear()}`);
    logger.log(`\u2bc8 Playtime: ${TimeFormat.fromMs(track.duration, 'mm:ss').match(/(\d{2}:\d{2})(.+)?/)[1]}`);
    const collationLogger = queryLogger.log('[\u2022] Collating...');
    return {
      meta: track,
      isCollection: false,
      tracks: trackBroker.push([track], {
        logger: collationLogger,
        service,
        isPlaylist: false,
      }),
    };
  }
  async function albumHandler(query, {service, queryLogger}) {
    const logger = queryLogger.print(`Obtaining album metadata...`);
    const album = await processPromise(service.getAlbum(query, options.storefront), queryLogger);
    if (!album) return Promise.reject();
    logger.log(`\u2bc8 Album Name: ${album.name}`);
    logger.log(`\u2bc8 Artist: ${album.artists[0]}`);
    logger.log(`\u2bc8 Tracks: ${album.ntracks}`);
    logger.log(`\u2bc8 Type: ${album.type === 'compilation' ? 'Compilation' : 'Album'}`);
    logger.log(`\u2bc8 Year: ${new Date(album.release_date).getFullYear()}`);
    if (album.genres.length) logger.log(`\u2bc8 Genres: ${album.genres.join(', ')}`);
    const collationLogger = queryLogger.log(`[\u2022] Collating [${album.name}]...`);
    const tracks = await processPromise(service.getAlbumTracks(album.uri), collationLogger, {
      pre: '[\u2022] Inquiring tracks...',
    });
    collationLogger.indent += 1;
    return {
      meta: album,
      isCollection: album.type === 'collection',
      tracks: trackBroker.push(tracks, {
        logger: collationLogger,
        service,
        isPlaylist: false,
      }),
    };
  }
  async function artistHandler(query, {service, queryLogger}) {
    const logger = queryLogger.print(`Obtaining artist metadata...`);
    const artist = await processPromise(service.getArtist(query, options.storefront), queryLogger);
    if (!artist) return Promise.reject();
    const artistLogger = logger.log(`\u2bc8 Artist: ${artist.name}`);
    if (artist.followers) logger.log(`\u2bc8 Followers: ${`${artist.followers}`.replace(/(\d)(?=(\d{3})+$)/g, '$1,')}`);
    if (artist.genres && artist.genres.length) logger.log(`\u2bc8 Genres: ${artist.genres.join(', ')}`);
    const albumsStack = await processPromise(service.getArtistAlbums(artist.uri), artistLogger, {
      pre: ' > Gathering collections...',
    });
    if (!albumsStack) return;
    artistLogger.print(' > Sorting collections...');
    const {albums, singles, compilations} = albumsStack.reduce((tx, v) => (tx[`${v.type}s`].items.push(v), tx), {
      albums: {desc: 'Albums', items: []},
      singles: {desc: 'Singles & EPs', items: []},
      compilations: {desc: 'Compilations', items: []},
    });
    artistLogger.write('[done]\n');
    logger.log(`\u2bc8 ${[albums, singles, compilations].map(stack => `${stack.desc}: ${stack.items.length}`).join(', ')}`);
    const collationLogger = queryLogger.log(`[\u2022] Collating...`);
    return Promise.mapSeries([albums, singles, compilations], async stack => {
      if (!stack.items.length) return;
      const cxLogger = collationLogger.log(`[\u2022] ${stack.desc}`);
      cxLogger.indent += 1;
      return Promise.mapSeries(stack.items, async ({uri}, index) => {
        const album = await service.getAlbum(uri);
        const albumLogger = cxLogger.log(`(${prePadNum(index + 1, stack.items.length)}) [${album.name}]`);
        const tracks = await processPromise(service.getAlbumTracks(album.uri), albumLogger, {
          pre: '[\u2022] Inquiring tracks...',
        });
        if (tracks && !tracks.length) return;
        albumLogger.indent += 1;
        return {
          meta: album,
          isCollection: album.type === 'collection',
          tracks: trackBroker.push(tracks, {
            logger: albumLogger,
            service,
            isPlaylist: false,
          }),
        };
      });
    });
  }
  async function playlistHandler(query, {service, queryLogger}) {
    const logger = queryLogger.print(`Obtaining playlist metadata...`);
    const playlist = await processPromise(service.getPlaylist(query, options.storefront), queryLogger);
    if (!playlist) return Promise.reject();
    logger.log(`\u2bc8 Playlist Name: ${playlist.name}`);
    logger.log(`\u2bc8 By: ${playlist.owner_name}`);
    if (playlist.description) logger.log(`\u2bc8 Description: ${playlist.description}`);
    logger.log(`\u2bc8 Type: ${playlist.type}`);
    if (playlist.followers) logger.log(`\u2bc8 Followers: ${`${playlist.followers}`.replace(/(\d)(?=(\d{3})+$)/g, '$1,')}`);
    logger.log(`\u2bc8 Tracks: ${playlist.ntracks}`);
    const collationLogger = queryLogger.log(`[\u2022] Collating...`);
    const tracks = await processPromise(service.getPlaylistTracks(playlist.uri), collationLogger, {
      pre: '[\u2022] Inquiring tracks...',
    });
    collationLogger.indent += 1;
    return {
      meta: playlist,
      isCollection: false,
      tracks: trackBroker.push(tracks, {
        logger: collationLogger,
        service,
        isPlaylist: true,
      }),
    };
  }

  const queryQueue = new AsyncQueue('cli:queryQueue', Config.concurrency.queries, async query => {
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
      await processPromise(authStack.userToAuth(), loginLogger, {
        pre: '[\u2022] Awaiting user authentication...',
      });
    }
    if (service.isAuthed()) authLogger.write('[authenticated]\n');
    else {
      authLogger.write(service.hasOnceAuthed() ? '[expired]\n' : '[unauthenticated]\n');
      const config = freyrCoreConfig.get(`services.${service[symbols.meta].ID}`);
      const loginLogger = queryLogger.log(`[${service[symbols.meta].DESC} Login]`);
      service.canTryLogin(config)
        ? (await processPromise(service.login(config), loginLogger, {pre: '[\u2022] Logging in...'})) ||
          (await coreAuth(loginLogger))
        : await coreAuth(loginLogger);
    }
    if (!service.isAuthed()) {
      queryLogger.log('[\u2717] Failed to authenticate client!');
      return;
    }
    if (service.hasProps()) freyrCoreConfig.set(`services.${service[symbols.meta].ID}`, service.getProps());
    const contentType = service.identifyType(query);
    queryLogger.log(`Detected [${contentType}]`);
    const queryStats = await (contentType === 'track'
      ? trackHandler
      : contentType === 'album'
      ? albumHandler
      : contentType === 'artist'
      ? artistHandler
      : playlistHandler)(query, {service, queryLogger}).catch(err => {
      queryLogger.error(
        `\x1b[31m[i]\x1b[0m An error occurred while processing the query${err ? ` (${err.message || err})` : ''}`,
      );
      return Promise.resolve();
    });
    if (!queryStats) return null;
    const source = queryStats.meta;
    const trackStats = await pFlatten(queryStats.tracks);
    queryLogger.log('[\u2022] Download Complete');
    const embedLogger = queryLogger.log('[\u2022] Embedding Metadata...');
    await Promise.mapSeries(trackStats, async trackStat => {
      if (trackStat.postprocess) {
        trackStat.postprocess = await trackStat.postprocess;
        if ('code' in trackStat.postprocess) {
          trackStat.code = trackStat.postprocess.code;
          trackStat.err = trackStat.postprocess.err;
        }
      }
      if (trackStat.code) {
        const reason =
          trackStat.code === 1
            ? 'Zero sources found'
            : trackStat.code === 2
            ? 'Error while retrieving sources'
            : trackStat.code === 3
            ? 'Error downloading album art'
            : trackStat.code === 4
            ? 'Error downloading raw audio'
            : trackStat.code === 5
            ? 'Unknown Download Error'
            : trackStat.code === 6
            ? 'Error ensuring directory integrity'
            : trackStat.code === 7
            ? 'Error while encoding audio'
            : trackStat.code === 8
            ? 'Failed while embedding metadata'
            : trackStat.code === 9
            ? 'Unknown postprocessing error'
            : 'Unknown track processing error';
        embedLogger.error(
          `\u2022 [\u2717] ${trackStat.meta.trackName} [${trackStat.meta.track.uri}] (failed: ${reason}${
            trackStat.err ? ` [${trackStat.err.message || trackStat.err}]` : ''
          })`,
        );
      } else if (trackStat.code === 0) embedLogger.log(`\u2022 [\u23e9] ${trackStat.meta.trackName} (skipped: [Exists])`);
      else
        embedLogger.log(
          `\u2022 [\u2714] ${trackStat.meta.trackName}${
            !!options.cover && !trackStat.postprocess.wroteImage ? ' [(i) unable to write cover art]' : ''
          }`,
        );
    });
    if (queryStats.isCollection)
      createPlaylist(
        trackStats,
        queryLogger,
        BASE_DIRECTORY,
        `${source.name}${source.owner_name ? `-${source.owner_name}` : ''}`,
        `${source.name}${source.owner_name ? ` by ${source.owner_name}` : ''}`,
      );
    stackLogger.log('[\u2022] Collation Complete');
    return trackStats;
  });
  const trackStats = (await pFlatten(queryQueue.push([...options.input, ...queries]))).filter(Boolean);
  if (options.playlist && typeof options.playlist === 'string')
    createPlaylist(trackStats, stackLogger, BASE_DIRECTORY, options.playlist);
  const finalStats = trackStats.reduce(
    (total, current) => {
      if (current.postprocess && current.postprocess.finalSize) {
        total.outSize += current.postprocess.finalSize;
      }
      if (current.files) {
        const audio = current.files.audio ? current.files.audio.bytesWritten : 0;
        const image = current.files.image ? current.files.image.bytesWritten : 0;
        total.netSize += audio + image;
        total.mediaSize += audio;
        total.imageSize += image;
      }
      if (current.code === 0) total.skipped += 1;
      else if (!('code' in current)) total.passed += 1;
      else total.failed += 1;
      return total;
    },
    {outSize: 0, mediaSize: 0, imageSize: 0, netSize: 0, passed: 0, failed: 0, skipped: 0},
  );
  if (options.stats) {
    stackLogger.log('========== Stats ==========');
    stackLogger.log(` [\u2022] Runtime: [${prettyMs(Date.now() - initTimeStamp)}]`);
    stackLogger.log(` [\u2022] Total tracks: [${prePadNum(trackStats.length, 10)}]`);
    stackLogger.log(`     \u23e9  Skipped: [${prePadNum(finalStats.skipped, 10)}]`);
    stackLogger.log(`     \u2714  Passed: [${prePadNum(finalStats.passed, 10)}]`);
    stackLogger.log(`     \u2717  Failed: [${prePadNum(finalStats.failed, 10)}]`);
    stackLogger.log(` [\u2022] Output directory: [${BASE_DIRECTORY}]`);
    stackLogger.log(` [\u2022] Cover Art: ${options.cover} (${Config.image.height}x${Config.image.width})`);
    stackLogger.log(` [\u2022] Total Output size: ${xbytes(finalStats.outSize)}`);
    stackLogger.log(` [\u2022] Total Network Usage: ${xbytes(finalStats.netSize)}`);
    stackLogger.log(`     \u266b Media: ${xbytes(finalStats.mediaSize)}`);
    stackLogger.log(`     \u25b6 Album Art: ${xbytes(finalStats.imageSize)}`);
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
  .option('-b, --bitrate <N>', `set bitrate for audio encoding\n(valid: ${VALIDS.bitrates})`, '320k')
  .option('-n, --chunks <N>', 'number of concurrent chunk streams with which to download', 7)
  .option('-t, --tries <N>', 'set number of retries for each chunk before giving up (`infinite` for infinite)', 10)
  .option('-d, --directory <DIR>', 'save tracks to DIR/..', '.')
  .option('-c, --cover <name>', 'custom name for the cover art', 'cover.png')
  .option(
    '--cover-size <size>',
    'preferred cover art dimensions\n(format: <width>x<height> or <size> as <size>x<size>)',
    '640x640',
  )
  .option('-C, --no-cover', 'skip saving a cover art')
  .option(
    '-z, --concurrency <SPEC>',
    `specify key-value concurrency pairs, repeat to add more options (key omission implies track concurrency)\n(format: <[key=]value>) (valid: ${VALIDS.concurrency})`,
    (spec, stack) => (stack || []).concat(spec.split(',')),
  )
  .option('-f, --force', 'force overwrite of existing files')
  .option('-o, --config <file>', 'use alternative conf file')
  .option('-p, --playlist <file>', 'create playlist for all successfully collated tracks')
  .option('-P, --no-playlist', 'skip creating a playlist file for collections')
  .option('-s, --storefront <COUNTRY>', 'country storefront code')
  .option('-x, --filter <SEQ>', 'filter matches [explicit] (unimplemented)')
  .option('-g, --groups <GROUP_TYPE>', 'filter collections by single/album/appears_on/compilation (unimplemented)')
  .option('-T, --no-tree', "don't organise tracks in directory structure `[DIR/]<ARTIST>/<ALBUM>/<TRACK>`")
  .option('--tags', 'tag configuration specification\n(format: <key=value>) (reserved keys: [exclude, account]) (unimplemented)')
  .option('--via-tor', 'tunnel downloads through the tor network (unimplemented)')
  .option(
    '-D, --downloader <SERVICE>',
    `specify a preferred download source or a \`,\`-separated preference order (valid: ${VALIDS.downloaders})`,
    'youtube',
  )
  .option('--cache-dir <DIR>', 'specify alternative cache directory (unimplemented)', '<tmp>')
  .option('--timeout <N>', 'network inactivity timeout (ms)', 10000)
  .option('--no-stats', "don't show the stats on completion")
  .option('--pulsate-bar', 'show a pulsating bar')
  .option(
    '--single-bar',
    'show a single bar for the download, hide chunk-view\n(default when number of chunks/segments exceed printable space)',
  )
  .version(`v${packageJson.version}`, '-v, --version')
  .action(processArgs);

function main(argv) {
  if (!argv.includes('-v')) {
    const credits = `freyr v${packageJson.version} - (c) ${packageJson.author.name} <${packageJson.author.email}>`;
    console.log(credits);
    console.log('-'.repeat(credits.length));
    if (argv.length === 2) return commander.outputHelp();
  }
  command.parse(argv);
}

main(process.argv);

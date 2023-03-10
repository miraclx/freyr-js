#!/usr/bin/env node
/* eslint-disable consistent-return, camelcase, prefer-promise-reject-errors */
import xurl from 'url';
import util from 'util';
import xpath from 'path';
import crypto from 'crypto';
import {spawn, spawnSync} from 'child_process';
import {promises as fs, constants as fs_constants, createReadStream, createWriteStream} from 'fs';

import Conf from 'conf';
import open from 'open';
import xget from 'libxget';
import merge2 from 'merge2';
import mkdirp from 'mkdirp';
import xbytes from 'xbytes';
import Promise from 'bluebird';
import cachedir from 'cachedir';
import cStringd from 'stringd-colors';
import prettyMs from 'pretty-ms';
import minimatch from 'minimatch';
import filenamify from 'filenamify';
import TimeFormat from 'hh-mm-ss';
import ProgressBar from 'xprogress';
import countryData from 'country-data';
import {publicIp} from 'public-ip';
import {isBinaryFile} from 'isbinaryfile';
import {fileTypeFromFile} from 'file-type';
import {program as commander} from 'commander';
import {decode as entityDecode} from 'html-entities';
import {createFFmpeg, fetchFile} from '@ffmpeg/ffmpeg';

import _merge from 'lodash.merge';
import _mergeWith from 'lodash.mergewith';

import symbols from './src/symbols.js';
import fileMgr from './src/file_mgr.js';
import pFlatten from './src/p_flatten.js';
import FreyrCore from './src/freyr.js';
import AuthServer from './src/cli_server.js';
import AsyncQueue from './src/async_queue.js';
import parseRange from './src/parse_range.js';
import StackLogger from './src/stack_logger.js';
import streamUtils from './src/stream_utils.js';
import parseSearchFilter from './src/filter_parser.js';

const maybeStat = path => fs.stat(path).catch(() => false);

const __dirname = xurl.fileURLToPath(new URL('.', import.meta.url));

async function pTimeout(timeout, fn) {
  let timeoutSignal = Symbol('TimedOutSignal');
  let f = fn();
  let result = await Promise.race([f, Promise.delay(timeout, timeoutSignal)]);
  if (result == timeoutSignal) {
    if (typeof f.cancel == 'function') f.cancel();
    throw new Error('Promise timed out');
  }
  return result;
}

async function pRetry(tries, fn) {
  let result;
  for (let _ in Array.apply(null, {length: tries})) {
    try {
      result = await fn();
    } catch (err) {
      (result = Promise.reject(err)).catch(() => {});
    }
  }
  return result;
}

async function isOnline() {
  try {
    let _publicIp = await pRetry(2, () =>
      pTimeout(2000, async ip => {
        if ((ip = await publicIp({onlyHttps: true})) == undefined) throw new Error('unable to get public ip');
        return ip;
      }),
    );
    return true;
  } catch {
    return false;
  }
}

function parseMeta(params) {
  return Object.entries(params || {})
    .filter(([, value]) => ![undefined, null].includes(value))
    .map(([key, value]) =>
      Array.isArray(value) ? value.map(tx => (tx ? [`--${key}`, ...(Array.isArray(tx) ? tx : [tx])] : '')) : [`--${key}`, value],
    )
    .flat(Infinity);
}

function extendPathOnEnv(path) {
  return {
    ...process.env,
    PATH: [process.env.PATH, path].join(process.platform === 'win32' ? ';' : ':'),
  };
}

function ensureBinExtIfWindows(isWin, command) {
  return command.replace(/(\.exe)?$/, isWin ? '.exe' : '$1');
}

function check_bin_is_existent(bin, path) {
  const isWin = process.platform === 'win32';
  const command = isWin ? 'where' : 'which';
  const {status} = spawnSync(ensureBinExtIfWindows(isWin, command), [bin], {
    env: extendPathOnEnv(path),
  });
  if ([127, null].includes(status)) throw Error(`Unable to locate the command [${command}] within your PATH`);
  return status === 0;
}

function wrapCliInterface(binaryNames, binaryPath) {
  binaryNames = Array.isArray(binaryNames) ? binaryNames : [binaryNames];
  const isWin = process.platform === 'win32';
  const path = xpath.join(__dirname, 'bins', isWin ? 'windows' : 'posix');

  if (!binaryPath) {
    for (let name of binaryNames) {
      if (!check_bin_is_existent(name, path)) continue;
      binaryPath = ensureBinExtIfWindows(isWin, name);
      break;
    }
    if (!binaryPath)
      throw new Error(
        `Unable to find an executable named ${(a =>
          [a.slice(0, -1).join(', '), ...a.slice(-1)].filter(e => e != '').join(' or '))(binaryNames)}. Please install.`,
      );
  }
  return (file, args, cb) => {
    if (typeof file === 'string')
      spawn(binaryPath, [file, ...parseMeta(args)], {
        env: extendPathOnEnv(path),
      }).on('close', cb);
  };
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
        ? `${lastErr.code ? `[:{color(yellow)}${lastErr.code}:{color:close(yellow)}] ` : ''}(:{color(yellow)}${
            lastErr.message || lastErr
          }:{color:close(yellow)}) `
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
        ":{indent} [:{bullet}] :{label} :{flipper}",
        ":{indent}  | :{bullet} :{_tag}",
        ":{bars}",
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

/**
 * Concise promise handler for ensuring proper core method dispatches and logging
 *
 * **Handlers**:
 *  * `onInit`: printed before the promise is awaited
 *  * `onErr`: printed if the promise was rejected
 *  * `noVal`: printed if a successfully resolved promise returned a null-ish value
 *  * `arrIsEmpty`: printed if a successfully resolved promise returned an empty array or if an array contains only null-ish values
 *  * `onPass`: printed only if the promise successfully fulfilled with a proper value
 *
 * In the event that any handler is `true`, its default printer would be used
 * Except in the case of `onInit` and `onPass` whose default printer would be called even if a handler isn't specified
 *
 * If a handler's value is a function, its return value would only be printed if it is an array.
 * Otherwise, `processPromise` assumes that you took care of the printing.
 * @param {() => Promise<any>|Promise<any>} promise Promise to be awaited on
 * @param {StackLogger} logger Logger to be used
 * @param {{
 *   onInit: string | boolean | (() => any[] | boolean);
 *   onErr: string | boolean | (() => any[] | boolean);
 *   noVal: string | boolean | (() => any[] | boolean);
 *   arrIsEmpty: string | boolean | (() => any[] | boolean);
 *   onPass: string | boolean | (() => any[] | boolean);
 * }} messageHandlers State logging handlers
 */
async function processPromise(promise, logger, messageHandlers) {
  /**
   * TODO: Add retry functionality
   * ? Checking...(failed)
   * ?  [2/4] Retrying...(failed)
   * ?  [3/4] Retrying...(failed)
   * ?  [4/4] Retrying...(done)
   */
  if (!messageHandlers) messageHandlers = {};
  const isNdef = v => [undefined, null].includes(v);
  function handleResultOf(value, msg, defaultHandler) {
    if (msg === true || isNdef(msg)) msg = defaultHandler;
    if (isNdef(msg)) return;
    if (typeof msg === 'function') {
      value = msg(value, logger);
      if (Array.isArray(value)) logger.write(...value);
      else if (typeof value === 'string') logger.write(value);
    } else logger.print(msg);
  }

  // formerly .pre
  if (messageHandlers.onInit !== false) handleResultOf(null, messageHandlers.onInit);
  const result = await Promise.resolve(typeof promise === 'function' ? promise() : promise).reflect();
  if (result.isRejected()) {
    // formerly .err
    if (messageHandlers.onErr !== false)
      handleResultOf(result.reason(), messageHandlers.onErr, reason => [
        '(failed%s)',
        reason
          ? `: [${
              'SHOW_DEBUG_STACK' in process.env ? util.formatWithOptions({colors: true}, reason) : reason['message'] || reason
            }]`
          : '',
        '\n',
      ]);
    return null;
  }
  const value = result.value();

  // formerly .xerr
  if (messageHandlers.noVal && (!value || value.err)) handleResultOf(value, messageHandlers.noVal, () => ['(no data)', '\n']);
  // formerly .aerr
  else if (
    messageHandlers.arrIsEmpty &&
    Array.isArray(value) &&
    (value.length === 0 || value.every(item => [undefined, null].some(item)))
  )
    handleResultOf(value, messageHandlers.arrIsEmpty, () => ['(array contains no data)', '\n']);
  // formerly .post
  else if (messageHandlers.onPass !== false) handleResultOf(value, messageHandlers.onPass, () => ['[done]', '\n']);
  return value;
}

const VALIDS = {
  sources: FreyrCore.getEngineMetas()
    .filter(meta => meta.PROPS.isSourceable)
    .map(meta => meta.ID),
  bitrates: FreyrCore.getBitrates(),
  concurrency: ['queries', 'tracks', 'trackStage', 'downloader', 'encoder', 'embedder'],
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

async function PROCESS_INPUT_FILE(input_arg, type, allowBinary = false, stat) {
  if (!(stat = await maybeStat(input_arg))) throw new Error(`${type} file [${input_arg}] is inexistent`);
  if (stat.size > 1048576) throw new Error(`${type} file [${input_arg}] is beyond the maximum 1 MiB size limit`);
  if (!stat.isFile()) throw new Error(`${type} file [${input_arg}] is not a file`);
  if (!allowBinary && (await isBinaryFile(input_arg, stat.size)))
    throw new Error(`${type} file [${input_arg}] cannot be a binary file`);
  return input_arg;
}

function PARSE_INPUT_LINES(lines) {
  return lines
    .map(line => line.toString().trim()) // Trim whitespaces
    .filter(line => !!line && /^(?!\s*#)/.test(line)) // Ignore empty lines or lines that start with comments
    .map(line => line.replace(/#.*$/, '').trim()) // Ignore comments at the end of lines
    .flatMap(line => line.split(' '));
}

async function PROCESS_INPUT_ARG(input_arg) {
  if (!input_arg) return [];
  const inputSource = input_arg === '-' ? process.stdin : createReadStream(await PROCESS_INPUT_FILE(input_arg, 'Input', false));
  const lines = await streamUtils
    .collectBuffers(inputSource.pipe(streamUtils.buildSplitter(['\n', '\r\n'])), {
      max: 1048576, // 1 MiB size limit
      timeout: 15000, // Timeout read op after 15 seconds
    })
    .catch(er => {
      if (er.code === 1) throw new Error(`Input stream is beyond the maximum 1 MiB size limit`);
      if (er.code === 2) throw new Error(`Input stream read timed out after 15 seconds`);
    });
  return PARSE_INPUT_LINES(lines);
}

function PROCESS_IMAGE_SIZE(value) {
  if (!['string', 'number'].includes(typeof value)) value = `${value.width}x${value.height}`;
  let parts = value.toString().split(/(?<=\d+)x(?=\d+)/);
  if (parts.some(part => parseInt(part, 10).toString() !== part)) return false;
  parts = parts.map(part => parseInt(part, 10));
  return {width: parts[0], height: parts[1] || parts[0]};
}

function PROCESS_DOWNLOADER_SOURCES(value, throwEr) {
  if (!Array.isArray(value)) return throwEr();
  return value
    .filter(Boolean)
    .map(item => (!VALIDS.sources.includes(item.startsWith('!') ? item.slice(1) : item) ? throwEr(item) : item));
}

const [RULE_DEFAULTS, RULE_HANDLERS] = [
  ['id', 'uri', 'album', 'album_artist', 'isrc', 'label'],
  {
    title(spec, object, props) {
      if (!('name' in object)) return;
      return minimatch(object.name, spec, {nocase: !props.filterCase});
    },
    type(spec, object) {
      if (spec && !['album', 'single', 'compilation'].includes(spec)) throw new Error(`Invalid rule specification: \`${spec}\``);
      if (!('compilation' in object)) return;
      return spec === object.album_type;
    },
    artist(spec, object, props) {
      if (!('artists' in object)) return;
      return object.artists.some(artist => minimatch(artist, spec, {nocase: !props.filterCase}));
    },
    ntracks(spec, object) {
      const parsed = parseRange.num(spec, true);
      if (!('total_tracks' in object)) return;
      return parsed.check(object.total_tracks);
    },
    trackn(spec, object) {
      const parsed = parseRange.num(spec, true);
      if (!('track_number' in object)) return;
      return parsed.check(object.track_number);
    },
    duration(spec, object) {
      const parsed = parseRange.time(spec, true);
      if (!('duration' in object)) return;
      return parsed.check(object.duration);
    },
    year(spec, object) {
      const parsed = parseRange.num(spec, true);
      if (!('release_date' in object)) return;
      return parsed.check(new Date(object.release_date).getFullYear());
    },
    diskn(spec, object) {
      const parsed = parseRange.num(spec, true);
      if (!('track_number' in object)) return;
      return parsed.check(object.disc_number);
    },
    explicit(spec, object) {
      if (spec && !['true', 'false', 'inoffensive'].includes(spec)) throw new Error(`Invalid rule specification: \`${spec}\``);
      if (!('contentRating' in object)) return;
      return object.contentRating === (spec === 'true' ? 'explicit' : spec === 'false' ? 'clean' : undefined);
    },
  },
];

function CHECK_FILTER_FIELDS(arrayOfFields, props = {}) {
  // use different rules to indicate "OR", not "AND"
  const coreHandler = (rules, trackObject, error = null) => {
    for (let ruleObject of rules) {
      try {
        Object.entries(ruleObject).forEach(([rule, value]) => {
          try {
            const status = (
              RULE_HANDLERS[rule] ||
              ((spec, object) => {
                if (!(rule in object)) return;
                return minimatch(`${object[rule]}`, spec, {
                  nocase: !props.filterCase,
                });
              })
            )(value, trackObject, props);
            if (status !== undefined && !status) throw new Error(`expected \`${value}\``);
          } catch (reason) {
            throw new Error(`<${rule}>, ${reason.message}`);
          }
        });
        return {status: true, reason: null};
      } catch (reason) {
        error = reason;
      }
    }
    if (error) return {status: false, reason: error};
    return {status: true, reason: null};
  };
  const chk = rules => {
    rules
      .reduce((a, r) => a.concat(Object.keys(r)), [])
      .forEach(rule => {
        if (!(rule in RULE_HANDLERS || RULE_DEFAULTS.includes(rule))) throw new Error(`Invalid filter rule: [${rule}]`);
      });
    return rules;
  };
  const rules = chk((arrayOfFields || []).reduce((a, v) => a.concat(parseSearchFilter(v).filters), []));
  const handler = (trackObject = {}) => coreHandler(rules, trackObject);
  handler.extend = _rules => {
    if (!Array.isArray(_rules)) throw new TypeError('Filter rules must be a valid array');
    rules.push(...chk(_rules));
    return handler;
  };
  return handler;
}

async function init(packageJson, queries, options) {
  const initTimeStamp = Date.now();
  const stackLogger = new StackLogger({indentSize: 1, autoTick: false});
  if (!((Array.isArray(queries) && queries.length > 0) || options.input))
    stackLogger.error('\x1b[31m[i]\x1b[0m Please enter a valid query'), process.exit(1);

  try {
    options.retries = CHECK_FLAG_IS_NUM(
      `${options.retries}`.toLowerCase() === 'infinite' ? Infinity : options.retries,
      '-r, --retries',
      'number',
    );
    options.metaRetries = CHECK_FLAG_IS_NUM(
      `${options.metaRetries}`.toLowerCase() === 'infinite' ? Infinity : options.metaRetries,
      '-t, --meta-tries',
      'number',
    );
    options.cover = options.cover && xpath.basename(options.cover);
    options.chunks = CHECK_FLAG_IS_NUM(options.chunks, '-n, --chunks', 'number');
    options.timeout = CHECK_FLAG_IS_NUM(options.timeout, '--timeout', 'number');
    options.bitrate = CHECK_BIT_RATE_VAL(options.bitrate);
    options.input = await PROCESS_INPUT_ARG(options.input);
    if (options.config) options.config = await PROCESS_INPUT_FILE(options.config, 'Config', false);
    if (options.memCache) options.memCache = CHECK_FLAG_IS_NUM(options.memCache, '--mem-cache', 'number');
    options.filter = CHECK_FILTER_FIELDS(options.filter, {
      filterCase: options.filterCase,
    });
    options.concurrency = Object.fromEntries(
      (options.concurrency || [])
        .map(item => (([k, v]) => (v ? [k, v] : ['tracks', k]))(item.split('=')))
        .map(([k, v]) => {
          if (!VALIDS.concurrency.includes(k))
            throw Error(`Key identifier for the \`-z, --concurrency\` flag must be valid. found [key: ${k}]`);
          return [k, CHECK_FLAG_IS_NUM(v, '-z, --concurrency', 'number')];
        }),
    );
    if (options.storefront) {
      const data = countryData.lookup.countries({
        alpha2: options.storefront.toUpperCase(),
      });
      if (data.length) options.storefront = data[0].alpha2.toLowerCase();
      else throw new Error('Country specification with the `--storefront` option is invalid');
    }

    if (options.coverSize) {
      const err = new Error(
        `Invalid \`--cover-size\` specification [${options.coverSize}]. (expected: <width>x<height> or <size> as <size>x<size>)`,
      );
      if (!(options.coverSize = PROCESS_IMAGE_SIZE(options.coverSize))) throw err;
    }

    options.sources = PROCESS_DOWNLOADER_SOURCES((options.sources || '').split(','), item => {
      throw new Error(`Source specification within the \`--sources\` arg must be valid. found [${item}]`);
    });

    if (options.rmCache && typeof options.rmCache !== 'boolean')
      throw new Error(`Invalid value for \`--rm-cache\`. found [${options.rmCache}]`);
  } catch (err) {
    stackLogger.error('\x1b[31m[i]\x1b[0m', err.message || err);
    process.exit(2);
  }

  const schema = {
    config: {
      type: 'object',
      additionalProperties: false,
      properties: {
        server: {
          type: 'object',
          properties: {
            hostname: {type: 'string'},
            port: {type: 'integer'},
            useHttps: {type: 'boolean'},
          },
        },
        opts: {
          type: 'object',
          properties: {
            netCheck: {type: 'boolean'},
            attemptAuth: {type: 'boolean'},
            autoOpenBrowser: {type: 'boolean'},
          },
        },
        dirs: {
          type: 'object',
          properties: {
            output: {type: 'string'},
            check: {
              type: 'array',
              items: {type: 'string'},
            },
            cache: {
              type: 'object',
              properties: {
                path: {type: 'string'},
                keep: {type: 'boolean'},
              },
            },
          },
        },
        playlist: {
          type: 'object',
          properties: {
            always: {type: 'boolean'},
            append: {type: 'boolean'},
            escape: {type: 'boolean'},
            forceAppend: {type: 'boolean'},
            // directory to write playlist to
            dir: {type: 'string'},
            // namespace to prefix playlist entries with
            namespace: {type: 'string'},
          },
        },
        image: {
          type: 'object',
          properties: {
            width: {type: 'integer'},
            height: {type: 'integer'},
          },
        },
        filters: {
          type: 'array',
          items: {type: 'string'},
        },
        concurrency: {
          type: 'object',
          properties: {
            queries: {type: 'integer'}, // always create playlists for queries
            tracks: {type: 'integer'}, // append to end of file for regular queries
            trackStage: {type: 'integer'}, // whether or not to escape invalid characters
            downloader: {type: 'integer'}, // whether or not to forcefully append collections as well
            encoder: {type: 'integer'}, // directory to write playlist to
            embedder: {type: 'integer'}, // namespace to prefix playlist entries with
          },
        },
        downloader: {
          type: 'object',
          properties: {
            memCache: {type: 'boolean'},
            cacheSize: {type: 'integer'},
            sources: {
              type: 'array',
              items: {type: 'string'},
            },
          },
        },
      },
    },
    services: {
      type: 'object',
      additionalProperties: false,
      default: {},
      properties: {},
    },
  };
  FreyrCore.ENGINES.forEach(engine => {
    schema.services.default[engine[symbols.meta].ID] = {};
    schema.services.properties[engine[symbols.meta].ID] = {
      type: 'object',
      additionalProperties: false,
      properties: engine[symbols.meta].PROP_SCHEMA || {},
    };
  });

  let Config = JSON.parse(await fs.readFile(xpath.join(__dirname, 'conf.json')));

  let schemaDefault = _merge({}, Config);
  delete schemaDefault['services'];
  schema.config.default = schemaDefault;

  const freyrCoreConfig = new Conf({
    projectName: 'FreyrCLI',
    projectSuffix: '',
    configName: 'd3fault',
    fileExtension: 'x4p',
    schema,
    serialize: v => JSON.stringify(v, null, 2),
  });

  let configStack = [Config, freyrCoreConfig.get('config')];

  try {
    if (options.config)
      if (await maybeStat(options.config)) {
        configStack.push(JSON.parse(await fs.readFile(options.config)));
      } else {
        stackLogger.error(`\x1b[31m[!]\x1b[0m Configuration file [${xpath.relative('.', options.config)}] not found`);
        process.exit(3);
      }
    const errMessage = new Error(`[key: image, value: ${JSON.stringify(Config.image)}]`);
    if (!(Config.image = PROCESS_IMAGE_SIZE(Config.image))) throw errMessage;
    Config.downloader.sources = PROCESS_DOWNLOADER_SOURCES(Config.downloader.sources, item => {
      if (item) throw new Error(`Download sources within the config file must be valid. found [${item}]`);
      throw new Error(`Download sources must be an array of strings`);
    });
    options.filter.extend(Config.filters);
  } catch (err) {
    stackLogger.error(`\x1b[31m[!]\x1b[0m Configuration file [${options.config}] wrongly formatted`);
    stackLogger.error(err.message || err);
    process.exit(3);
  }

  Config = _mergeWith(...configStack, (a, b, k) =>
    ['sources', 'check'].includes(k) && [a, b].every(Array.isArray) ? Array.from(new Set(b.concat(a))) : undefined,
  );

  Config.image = _merge(Config.image, options.coverSize);
  Config.concurrency = _merge(Config.concurrency, options.concurrency);
  Config.dirs = _mergeWith(
    Config.dirs,
    {
      output: options.directory,
      check: options.checkDir,
      cache: {
        path: options.cacheDir,
        keep: !options.rmCache,
      },
    },
    (a, b, k) => (k === 'check' && [a, b].every(Array.isArray) ? a.concat(b) : undefined),
  );
  Config.opts = _merge(Config.opts, {
    netCheck: options.netCheck,
    attemptAuth: options.auth,
    autoOpenBrowser: options.browser,
  });
  Config.playlist = _merge(Config.playlist, {
    always: !!options.playlist,
    append: !options.playlistNoappend,
    escape: !options.playlistNoescape,
    forceAppend: options.playlistForceAppend,
    dir: options.playlistDir,
    namespace: options.playlistNamespace,
  });
  Config.downloader = _mergeWith(
    Config.downloader,
    {
      memCache: options.memCache !== undefined ? !!options.memCache : undefined,
      cacheSize: options.memCache,
      sources: options.sources,
    },
    (a, b, k) => (k === 'sources' && [a, b].every(Array.isArray) ? Array.from(new Set(b.concat(a))) : undefined),
  );

  if (Config.opts.netCheck && !(await isOnline()))
    stackLogger.error('\x1b[31m[!]\x1b[0m Failed To Detect An Internet Connection'), process.exit(4);

  const BASE_DIRECTORY = (path => (xpath.isAbsolute(path) ? path : xpath.relative('.', path || '.') || '.'))(Config.dirs.output);

  if (!(await maybeStat(BASE_DIRECTORY)))
    stackLogger.error(`\x1b[31m[!]\x1b[0m Working directory [${BASE_DIRECTORY}] doesn't exist`), process.exit(5);

  if (
    (await processPromise(fs.access(BASE_DIRECTORY, fs_constants.W_OK), stackLogger, {
      onInit: 'Checking directory permissions...',
    })) === null
  )
    process.exit(5);

  const CHECK_DIRECTORIES = Array.from(
    new Set((Config.dirs.check || []).map(path => (xpath.isAbsolute(path) ? path : xpath.relative('.', path || '.') || '.'))),
  );

  for (let checkDir of CHECK_DIRECTORIES)
    if (!(await maybeStat(checkDir)))
      stackLogger.error(`\x1b[31m[!]\x1b[0m Check Directory [${checkDir}] doesn't exist`), process.exit(5);

  if (!CHECK_DIRECTORIES.includes(BASE_DIRECTORY)) CHECK_DIRECTORIES.unshift(BASE_DIRECTORY);

  Config.dirs.cache.path =
    Config.dirs.cache.path === '<tmp>'
      ? undefined
      : Config.dirs.cache.path === '<cache>'
      ? cachedir('FreyrCLI')
      : Config.dirs.cache.path;

  let freyrCore;
  try {
    freyrCore = new FreyrCore(Config.services, AuthServer, Config.server);
  } catch (err) {
    stackLogger.error(`\x1b[31m[!]\x1b[0m Failed to initialize a Freyr Instance`);
    stackLogger.error(err.message || err);
    process.exit(6);
  }

  const sourceStack = freyrCore.sortSources(
    ...Config.downloader.sources.reduce(
      (a, b) => (b.startsWith('!') ? [a[0], a[1].concat(b.slice(1))] : [a[0].concat(b), a[1]]),
      [[], []],
    ),
  );

  let atomicParsley;

  try {
    if (options.atomicParsley) {
      if (!(await maybeStat(options.atomicParsley)))
        throw new Error(`\x1b[31mAtomicParsley\x1b[0m: Binary not found [${options.atomicParsley}]`);
      if (!(await isBinaryFile(options.atomicParsley)))
        stackLogger.warn('\x1b[33mAtomicParsley\x1b[0m: Detected non-binary file, trying anyways...');
    }
    atomicParsley = wrapCliInterface(['AtomicParsley', 'atomicparsley'], options.atomicParsley);
  } catch (err) {
    stackLogger.error(err.message);
    process.exit(7);
  }

  async function createPlaylist(header, stats, logger, filename, playlistTitle, shouldAppend) {
    if (options.playlist !== false) {
      const validStats = stats.filter(stat => (stat[symbols.errorCode] === 0 ? stat.complete : !stat[symbols.errorCode]));
      if (validStats.length) {
        logger.print('[\u2022] Creating playlist...');
        const playlistFile = xpath.join(
          Config.playlist.dir || BASE_DIRECTORY,
          `${filenamify(filename, {replacement: '_'})}.m3u8`,
        );
        const isNew = !(await maybeStat(playlistFile).then(({size}) => size)) || !(!options.playlistNoappend || shouldAppend);
        const plStream = createWriteStream(playlistFile, {
          encoding: 'utf8',
          flags: !isNew ? 'a' : 'w',
        });
        if (isNew) {
          plStream.write('#EXTM3U\n');
          if (playlistTitle) plStream.write(`#${playlistTitle.replace(/\n/gm, '\n# ')}\n`);
          if (header) plStream.write(`#${header}\n`);
        }
        let {namespace} = Config.playlist;
        namespace = namespace ? xurl.format(xurl.parse(namespace)).concat('/') : '';
        validStats.forEach(
          ({
            meta: {
              track: {uri, name, artists, duration},
              service,
              outFile,
            },
          }) =>
            plStream.write(
              [
                '',
                `#${service[symbols.meta].DESC} URI: ${uri}`,
                `#EXTINF:${Math.round(duration / 1e3)},${artists[0]} - ${name}`,
                `${namespace.concat(
                  (entry => (!Config.playlist.escape ? entry : encodeURI(entry).replace(/#/g, '%23')))(
                    xpath.relative(BASE_DIRECTORY, outFile.path),
                  ),
                )}`,
                '',
              ].join('\n'),
            ),
        );
        plStream.close();
        logger.write('[done]\n');
        logger.log(`[\u2022] Playlist file: [${playlistFile}]`);
      }
    } else logger.log(`[\u2022] Skipped playlist creation`);
  }

  let progressGen;
  if (options.bar) progressGen = prepProgressGen(options);

  function downloadToStream({urlOrFragments, outputFile, logger, opts}) {
    opts = {
      tag: '',
      successMessage: '',
      failureMessage: '',
      retryMessage: '',
      ...opts,
    };
    [opts.tag, opts.retryMessage, opts.failureMessage, opts.successMessage, opts.altMessage] = [
      opts.tag,
      opts.retryMessage,
      opts.failureMessage,
      opts.successMessage,
      opts.altMessage,
    ].map(val => (typeof val === 'function' || val === false ? val : () => val));
    return new Promise((res, rej) => {
      let completed = false;
      if (!Array.isArray(urlOrFragments)) {
        const feed = xget(urlOrFragments, {
          auto: false,
          cache: Config.downloader.memCache,
          chunks: options.chunks,
          retries: options.retries,
          timeout: options.timeout,
          cacheSize: Config.downloader.cacheSize,
        })
          .on('end', () => {
            if (feed.store.has('progressBar')) feed.store.get('progressBar').end(opts.successMessage(), '\n');
            else {
              if (!options.bar) logger.write('\x1b[G\x1b[K');
              logger.write(opts.successMessage(), '\n');
            }
          })
          .on('retry', data => {
            if (opts.retryMessage !== false) {
              if (feed.store.has('progressBar'))
                data.store.get('progressBar').print(opts.retryMessage({ref: data.index + 1, ...data}));
              else {
                if (!options.bar) logger.write('\x1b[G\x1b[K');
                logger.write(opts.retryMessage({ref: data.index + 1, ...data}), '\n');
              }
            }
          })
          .once('error', err => {
            if (completed) return;
            err = Object(err);
            if (feed.store.has('progressBar')) feed.store.get('progressBar').end(opts.failureMessage(err), '\n');
            else {
              if (!options.bar) logger.write('\x1b[G\x1b[K');
              logger.write(opts.failureMessage(err), '\n');
            }
            rej(err);
          });

        if (options.bar) {
          feed
            .with('progressBar', urlMeta =>
              progressGen(
                urlMeta.size,
                urlMeta.chunkStack.map(chunk => chunk.size),
                {tag: opts.tag(urlMeta)},
                logger.indentation(),
                false,
              ),
            )
            .use('progressBar', (dataSlice, store) => store.get('progressBar').next(dataSlice.next));
        } else feed.on('loaded', () => logger.write(opts.altMessage()));

        feed.setHeadHandler(async ({acceptsRanges}) => {
          let [offset, writeStream] = [];
          if (acceptsRanges) await maybeStat(outputFile.path).then(({size}) => (offset = size));
          if (offset) {
            opts.resumeHandler(offset);
            writeStream = createWriteStream(null, {
              fd: outputFile.handle,
              flags: 'a',
            });
          } else
            writeStream = createWriteStream(null, {
              fd: outputFile.handle,
              flags: 'w',
            });
          feed.pipe(writeStream).on('finish', () => ((completed = true), res(writeStream.bytesWritten)));
          return offset;
        });
        feed.start();
      } else {
        let barGen;
        if (options.bar) {
          barGen = progressGen(
            urlOrFragments.reduce((total, fragment) => total + fragment.size, 0),
            urlOrFragments.map(fragment => fragment.size),
            {tag: opts.tag()},
            logger.indentation(),
            true,
          );
        } else logger.write(opts.altMessage());

        let has_erred = false;
        const writeStream = createWriteStream(null, {
          fd: outputFile.handle,
          flags: 'w',
        });

        merge2(
          ...urlOrFragments.map((frag, i) => {
            const feed = xget(frag.url, {
              cache: Config.downloader.memCache,
              chunks: 1,
              retries: options.retries,
              timeout: options.timeout,
              cacheSize: Config.downloader.cacheSize,
            })
              .on('retry', data => {
                if (opts.retryMessage !== false) {
                  data = opts.retryMessage({
                    ref: `${i}[${data.index + 1}]`,
                    ...data,
                  });
                  if (options.bar) barGen.print(data);
                  else {
                    logger.write('\x1b[G\x1b[K');
                    logger.write(data, '\n');
                  }
                }
              })
              .once('error', err => {
                if (completed) return;
                if (has_erred) return feed.destroy();
                err = Object(err);
                has_erred = true;
                err.segment_index = i;
                if (options.bar) barGen.end(opts.failureMessage(err), '\n');
                else {
                  logger.write('\x1b[G\x1b[K');
                  logger.write(opts.failureMessage(err), '\n');
                }
                rej(err);
              });
            return !options.bar ? feed : feed.pipe(barGen.next(frag.size));
          }),
        )
          .once('end', () => {
            if (options.bar) barGen.end(opts.successMessage(), '\n');
            else {
              logger.write('\x1b[G\x1b[K');
              logger.write(opts.successMessage(), '\n');
            }
          })
          .pipe(writeStream)
          .on('finish', () => ((completed = true), res(writeStream.bytesWritten)));
        // TODO: support resumption of segmented resources
        // TODO: retry fragments?
      }
    });
  }

  const downloadQueue = new AsyncQueue(
    'cli:downloadQueue',
    Config.concurrency.downloader,
    async ({track, meta, feedMeta, trackLogger}) => {
      const baseCacheDir = Config.dirs.cache.path || 'fr3yrcach3';
      let imageFile;
      let imageBytesWritten = 0;
      try {
        imageFile = await fileMgr({
          filename: `freyrcli-${meta.fingerprint}.x4i`,
          tmpdir: !Config.dirs.cache.path,
          dirname: baseCacheDir,
          keep: true,
        }).writeOnce(async imageFile => {
          try {
            imageBytesWritten = await downloadToStream({
              urlOrFragments: track.getImage(Config.image.width, Config.image.height),
              outputFile: imageFile,
              logger: trackLogger,
              opts: {
                tag: '[Retrieving album art]...',
                retryMessage: data => trackLogger.getText(`| ${getRetryMessage(data)}`),
                resumeHandler: offset =>
                  trackLogger.log(cStringd(`| :{color(yellow)}{i}:{color:close(yellow)} Resuming at ${offset}`)),
                failureMessage: err =>
                  trackLogger.getText(`| [\u2715] Failed to get album art${err ? ` [${err.code || err.message}]` : ''}`),
                successMessage: trackLogger.getText(`| [\u2713] Got album art`),
                altMessage: trackLogger.getText('| \u27a4 Downloading album art...'),
              },
            });
          } catch (err) {
            await imageFile.remove();
            throw err;
          }
        });
      } catch (err) {
        throw {err, [symbols.errorCode]: 3};
      }

      let rawAudio;
      let audioBytesWritten = 0;
      try {
        rawAudio = await fileMgr({
          filename: `freyrcli-${meta.fingerprint}.x4a`,
          tmpdir: !Config.dirs.cache.path,
          dirname: baseCacheDir,
          keep: true,
        }).writeOnce(async rawAudio => {
          try {
            audioBytesWritten = await downloadToStream(
              _merge(
                {
                  outputFile: rawAudio,
                  logger: trackLogger,
                  opts: {
                    tag: `[‘${meta.trackName}’]`,
                    retryMessage: data => trackLogger.getText(`| ${getRetryMessage(data)}`),
                    resumeHandler: offset =>
                      trackLogger.log(cStringd(`| :{color(yellow)}{i}:{color:close(yellow)} Resuming at ${offset}`)),
                    successMessage: trackLogger.getText('| [\u2713] Got raw track file'),
                    altMessage: trackLogger.getText('| \u27a4 Downloading track...'),
                  },
                },
                feedMeta.protocol !== 'http_dash_segments'
                  ? {
                      urlOrFragments: feedMeta.url,
                      opts: {
                        failureMessage: err =>
                          trackLogger.getText(
                            `| [\u2715] Failed to get raw media stream${err ? ` [${err.code || err.message}]` : ''}`,
                          ),
                      },
                    }
                  : {
                      urlOrFragments: feedMeta.fragments.map(({url, path}) => ({
                        url: url ?? `${feedMeta.fragment_base_url}${path}`,
                        ...(([, min, max]) => ({
                          min: +min,
                          max: +max,
                          size: +max - +min + 1,
                        }))(path?.match(/range\/(\d+)-(\d+)$/) ?? url.match(/range=(\d+)-(\d+)$/)),
                      })),
                      opts: {
                        failureMessage: err =>
                          trackLogger.getText(
                            `| [\u2715] Segment error while getting raw media${err ? ` [${err.code || err.message}]` : ''}`,
                          ),
                      },
                    },
              ),
            );
          } catch (err) {
            await rawAudio.remove();
            throw err;
          }
        });
      } catch (err) {
        throw {err, [symbols.errorCode]: 4};
      }

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
      try {
        await Promise.promisify(atomicParsley)(meta.outFile.path, {
          overWrite: '', // overwrite the file

          title: track.name, // ©nam
          artist: track.artists[0], // ©ART
          composer: track.composers, // ©wrt
          album: track.album, // ©alb
          genre: (genre => (genre ? genre.concat(' ') : ''))((track.genres || [])[0]), // ©gen | gnre
          tracknum: `${track.track_number}/${track.total_tracks}`, // trkn
          disk: `${track.disc_number}/${track.disc_number}`, // disk
          year: new Date(track.release_date).toISOString().split('T')[0], // ©day
          compilation: track.compilation, // ©cpil
          gapless: options.gapless, // pgap
          rDNSatom: [
            // ----
            ['Digital Media', 'name=MEDIA', 'domain=com.apple.iTunes'],
            [track.isrc, 'name=ISRC', 'domain=com.apple.iTunes'],
            [track.artists[0], 'name=ARTISTS', 'domain=com.apple.iTunes'],
            [track.label, 'name=LABEL', 'domain=com.apple.iTunes'],
            [`${meta.service[symbols.meta].DESC}: ${track.uri}`, 'name=SOURCE', 'domain=com.apple.iTunes'],
            [
              `${audioSource.service[symbols.meta].DESC}: ${audioSource.source.videoId}`,
              'name=PROVIDER',
              'domain=com.apple.iTunes',
            ],
          ],
          advisory: ['explicit', 'clean'].includes(track.contentRating) // rtng
            ? track.contentRating
            : track.contentRating === true
            ? 'explicit'
            : 'Inoffensive',
          stik: 'Normal', // stik
          // geID: 0, // geID: genreID. See `AtomicParsley --genre-list`
          // sfID: 0, // ~~~~: store front ID
          // cnID: 0, // cnID: catalog ID
          albumArtist: track.album_artist, // aART
          // ownr? <owner>
          purchaseDate: 'timestamp', // purd
          apID: 'cli@freyr.git', // apID
          copyright: track.copyrights.sort(({type}) => (type === 'P' ? -1 : 1))[0].text, // cprt
          encodingTool: `freyr-js cli v${packageJson.version}`, // ©too
          encodedBy: 'd3vc0dr', // ©enc
          artwork: files.image.file.path, // covr
          // sortOrder: [
          //   ['name', 'NAME'], // sonm
          //   ['album', 'NAME'], // soal
          //   ['artist', 'NAME'], // soar
          //   ['albumartist', 'NAME'], // soaa
          // ],
        });
      } catch (err) {
        throw {err, [symbols.errorCode]: 8};
      }
    },
  );

  delete globalThis.fetch;

  const encodeQueue = new AsyncQueue(
    'cli:postprocessor:encodeQueue',
    Config.concurrency.encoder,
    AsyncQueue.provision(
      async (cleanup, resource) => {
        if (cleanup) return resource.exit();
        let ffmpeg = createFFmpeg({log: false});
        await ffmpeg.load();
        return ffmpeg;
      },
      async (ffmpeg, {track, meta, files}) => {
        let infile = xpath.basename(files.audio.file.path);
        let outfile = xpath.basename(files.audio.file.path.replace(/\.x4a$/, '.m4a'));
        try {
          ffmpeg.FS('writeFile', infile, await fetchFile(files.audio.file.path));
          await ffmpeg.run(
            '-i',
            infile,
            '-acodec',
            'aac',
            '-b:a',
            options.bitrate,
            '-ar',
            '44100',
            '-vn',
            '-t',
            TimeFormat.fromMs(track.duration, 'hh:mm:ss.sss'),
            '-f',
            'ipod',
            '-aac_pns',
            '0',
            outfile,
          );
          await fs.writeFile(meta.outFile.handle, ffmpeg.FS('readFile', outfile));
        } catch (err) {
          throw {err, [symbols.errorCode]: 7};
        }
      },
    ),
  );

  const postProcessor = new AsyncQueue(
    'cli:postProcessor',
    Math.max(Config.concurrency.encoder, Config.concurrency.embedder),
    async ({track, meta, files, audioSource}) => {
      await mkdirp(xpath.dirname(meta.outFile.path)).catch(err => Promise.reject({err, [symbols.errorCode]: 6}));
      const wroteImage =
        !!options.cover &&
        (await (async outArtPath =>
          (await maybeStat(outArtPath).then(stat => stat && stat.isFile())) ||
          (await fs.copyFile(files.image.file.path, outArtPath), true))(
          xpath.join(xpath.dirname(meta.outFile.path), `${options.cover}.${(await fileTypeFromFile(files.image.file.path)).ext}`),
        ));
      await fileMgr({
        path: meta.outFile.path,
      }).writeOnce(async audioFile => {
        meta.outFile = audioFile;
        try {
          await encodeQueue.push({track, meta, files});
          await embedQueue.push({track, meta, files, audioSource});
        } catch (err) {
          await audioFile.remove();
          throw err;
        }
      });
      return {wroteImage, finalSize: (await fs.stat(meta.outFile.path)).size};
    },
  );

  function buildSourceCollectorFor(track, selector) {
    async function handleSource(iterator, lastErr) {
      const result = {service: null, sources: null, lastErr};
      if ((result.service = iterator.next().value)) {
        result.sources = Promise.resolve(
          result.service.search(track.artists, track.name.replace(/\s*\((((feat|ft).)|with).+\)/, ''), track.duration),
        ).then(sources => {
          if ([undefined, null].includes(sources)) throw new Error(`incompatible source response. recieved [${sources}]`);
          // arrays returned from service source calls should have at least one item
          if (Array.isArray(sources) && sources.length === 0) throw new Error('Zero sources found');
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
          if ([undefined, null].includes(source)) throw new Error(`incompatible response item. recieved: [${source}]`);
          if (!('getFeeds' in source)) throw new Error(`service provided no means for source to collect feeds`);
          let feedTries = 1;
          const getFeeds = () =>
            source.getFeeds().catch(err => ((feedTries += 1) <= options.metaRetries ? getFeeds() : Promise.reject(err)));
          const feeds = getFeeds();
          Promise.resolve(feeds).catch(() => {}); // diffuse feeds result, in case of an asynchronous promise rejection
          if ([undefined, null].includes(feeds)) throw new Error(`service returned no valid feeds for source`);
          return {sources, source, feeds, service: result.service};
        });
        result.results = result.sources.catch(err => ({
          next: handleSource(iterator, err),
        }));
      }
      return result;
    }

    async function collect_contained(process, handler) {
      process = await process;
      if (!process.sources) return {err: process.lastErr};
      await handler(process.service, process.sources);
      const results = await process.results;
      if (results.next) return collect_contained(results.next, handler);
      return results;
    }

    const process = handleSource(sourceStack.values());
    return async handler => collect_contained(process, handler);
  }

  const trackQueue = new AsyncQueue('cli:trackQueue', Config.concurrency.tracks, async ({track, meta, props}) => {
    const trackLogger = props.logger.log(`\u2022 [${meta.trackName}]`).tick(3);
    const filterStat = options.filter(track, false);
    if (!filterStat.status) {
      trackLogger.log("| [\u2022] Didn't match filter. Skipping...");
      return {
        meta,
        [symbols.errorCode]: 0,
        skip_reason: `filtered out: ${filterStat.reason.message}`,
        complete: false,
      };
    }

    if (props.fileExists) {
      let otherLocations = props.fileExistsIn.filter(path => path !== meta.outFile.path);
      let outputFilePathExists = props.fileExistsIn.includes(meta.outFile.path);
      let prefix = outputFilePathExists ? 'Also ' : '';
      if (!props.processTrack) {
        trackLogger.log('| [\u00bb] Track exists. Skipping...');
        if (otherLocations.length === 1) trackLogger.log(`| [\u00bb] ${prefix}Found In: ${otherLocations[0]}`);
        else if (otherLocations.length > 1) {
          trackLogger.log(`| [\u00bb] ${prefix}Found In:`);
          for (let path of otherLocations) trackLogger.log(`| [\u00bb]  - ${path}`);
        }
        return {
          meta,
          [symbols.errorCode]: 0,
          skip_reason: 'exists',
          complete: outputFilePathExists,
        };
      }
      trackLogger.log(`| [\u2022] Track exists. ${outputFilePathExists ? 'Overwriting' : 'Recreating'}...`);
      if (otherLocations.length === 1) trackLogger.log(`| [\u2022] ${prefix}Found In: ${otherLocations[0]}`);
      else if (otherLocations.length > 1) {
        trackLogger.log(`| [\u2022] ${prefix}Found In:`);
        for (let path of otherLocations) trackLogger.log(`| [\u2022]  - ${path}`);
      }
    }
    trackLogger.log('| \u27a4 Collating sources...');
    const audioSource = await props.collectSources((service, sourcesPromise) =>
      processPromise(sourcesPromise, trackLogger, {
        onInit: `|  \u27a4 [\u2022] ${service[symbols.meta].DESC}...`,
        arrIsEmpty: () => '[Unable to gather sources]\n',
        onPass: ({sources}) => `[success, found ${sources.length} source${sources.length === 1 ? '' : 's'}]\n`,
      }),
    );
    if ('err' in audioSource) return {meta, [symbols.errorCode]: 1, err: audioSource.err}; // zero sources found
    const audioFeeds = await processPromise(audioSource.feeds, trackLogger, {
      onInit: '| \u27a4 Awaiting audiofeeds...',
      noVal: () => '[Unable to collect source feeds]\n',
    });
    if (!audioFeeds || audioFeeds.err) return {meta, err: (audioFeeds || {}).err, [symbols.errorCode]: 2};

    const [feedMeta] = audioFeeds.formats
      .filter(meta => 'abr' in meta && !('vbr' in meta))
      .sort((meta1, meta2) => meta2.abr - meta1.abr);

    meta.fingerprint = crypto.createHash('md5').update(`${audioSource.source.videoId} ${feedMeta.format_id}`).digest('hex');
    const files = await downloadQueue.push({track, meta, feedMeta, trackLogger}).catch(errObject =>
      Promise.reject({
        meta,
        [symbols.errorCode]: 5,
        ...(symbols.errorCode in errObject ? errObject : {err: errObject}),
      }),
    );
    trackLogger.log(`| [\u2022] Post Processing...`);
    return {
      files,
      postprocess: postProcessor.push({track, meta, files, audioSource}).catch(errObject => ({
        [symbols.errorCode]: 9,
        ...(symbols.errorCode in errObject ? errObject : {err: errObject}),
      })),
    };
  });

  const trackBroker = new AsyncQueue(
    'cli:trackBroker',
    Config.concurrency.trackStage,
    async (track, {logger, service, isPlaylist}) => {
      try {
        if (!(track = await track)) throw new Error('no data recieved from track');
      } catch (err) {
        return {[symbols.errorCode]: -1, err};
      }
      if ((track[symbols.errorStack] || {}).code === 1)
        return {
          [symbols.errorCode]: -1,
          err: new Error("local-typed tracks aren't supported"),
          meta: {track: {uri: track[symbols.errorStack].uri}},
        };
      const trackBaseName = `${prePadNum(track.track_number, track.total_tracks, 2)} ${track.name}`;
      const trackName = trackBaseName.concat(
        isPlaylist || (track.compilation && track.album_artist === 'Various Artists')
          ? ` \u2012 ${track.artists.join(', ')}`
          : '',
      );
      const outFileName = `${filenamify(trackBaseName, {
        replacement: '_',
      })}.m4a`;
      const trackPath = xpath.join(
        ...(options.tree ? [track.album_artist, track.album].map(name => filenamify(name, {replacement: '_'})) : []),
      );
      const outFilePath = xpath.join(BASE_DIRECTORY, trackPath, outFileName);
      const fileExistsIn = (
        await Promise.all(
          CHECK_DIRECTORIES.map(dir => xpath.join(dir, trackPath, outFileName)).map(async path => [
            path,
            !!(await maybeStat(xpath.join(path))),
          ]),
        )
      ).flatMap(([dir, exists]) => (exists ? [dir] : []));
      let fileExists = !!fileExistsIn.length;
      const processTrack = !fileExists || options.force;
      let collectSources;
      if (processTrack) collectSources = buildSourceCollectorFor(track, results => results[0]);
      const meta = {
        trackName,
        outFile: {path: outFilePath},
        track,
        service,
      };
      return trackQueue
        .push({
          track,
          meta,
          props: {
            collectSources,
            fileExists,
            fileExistsIn,
            processTrack,
            logger,
          },
        })
        .then(trackObject => ({...trackObject, meta}))
        .catch(errObject => ({
          meta,
          [symbols.errorCode]: 10,
          ...errObject,
        }));
    },
  );

  async function trackHandler(query, {service, queryLogger}) {
    const logger = queryLogger.print(`Obtaining track metadata...`).tick();
    const track = await processPromise(service.getTrack(query, options.storefront), logger, {noVal: true});
    if (!track) return Promise.reject();
    logger.log(`\u27a4 Title: ${track.name}`);
    logger.log(`\u27a4 Album: ${track.album}`);
    logger.log(`\u27a4 Artist: ${track.album_artist}`);
    logger.log(`\u27a4 Year: ${new Date(track.release_date).getFullYear()}`);
    logger.log(`\u27a4 Playtime: ${TimeFormat.fromMs(track.duration, 'mm:ss').match(/(\d{2}:\d{2})(.+)?/)[1]}`);
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
    const logger = queryLogger.print(`Obtaining album metadata...`).tick();
    const album = await processPromise(service.getAlbum(query, options.storefront), logger, {noVal: true});
    if (!album) return Promise.reject();
    logger.log(`\u27a4 Album Name: ${album.name}`);
    logger.log(`\u27a4 Artist: ${album.artists[0]}`);
    logger.log(`\u27a4 Tracks: ${album.ntracks}`);
    logger.log(`\u27a4 Type: ${album.type === 'compilation' ? 'Compilation' : 'Album'}`);
    logger.log(`\u27a4 Year: ${new Date(album.release_date).getFullYear()}`);
    if (album.genres.length) logger.log(`\u27a4 Genres: ${album.genres.join(', ')}`);
    const collationLogger = queryLogger.log(`[\u2022] Collating [${album.name}]...`).tick();
    const tracks = await processPromise(service.getAlbumTracks(album.uri, options.storefront), collationLogger, {
      onInit: '[\u2022] Inquiring tracks...',
    });
    if (!tracks) throw new Error('Failed to collect album tracks');
    if (!tracks.length) return;
    return {
      meta: album,
      isCollection: album.type === 'compilation',
      tracks: trackBroker.push(tracks, {
        logger: collationLogger.tick(),
        service,
        isPlaylist: false,
      }),
    };
  }
  async function artistHandler(query, {service, queryLogger}) {
    const logger = queryLogger.print(`Obtaining artist metadata...`).tick();
    const artist = await processPromise(service.getArtist(query, options.storefront), logger, {noVal: true});
    if (!artist) return Promise.reject();
    logger.log(`\u27a4 Artist: ${artist.name}`);
    if (artist.followers) logger.log(`\u27a4 Followers: ${`${artist.followers}`.replace(/(\d)(?=(\d{3})+$)/g, '$1,')}`);
    if (artist.genres && artist.genres.length) logger.log(`\u27a4 Genres: ${artist.genres.join(', ')}`);
    const albumsStack = await processPromise(service.getArtistAlbums(artist.uri, options.storefront), logger, {
      onInit: '> Gathering collections...',
    });
    if (!albumsStack) return;
    const collationLogger = queryLogger.log(`[\u2022] Collating...`).tick();
    return Promise.mapSeries(albumsStack, async ({uri}, index) => {
      const album = await service.getAlbum(uri, options.storefront);
      const albumLogger = collationLogger
        .log(`(${prePadNum(index + 1, albumsStack.length)}) [${album.name}] (${album.type})`)
        .tick();
      const tracks = await processPromise(service.getAlbumTracks(album.uri, options.storefront), albumLogger, {
        onInit: '[\u2022] Inquiring tracks...',
      });
      if (!(tracks && tracks.length)) return;
      return {
        meta: album,
        isCollection: album.type === 'collection',
        tracks: await Promise.all(
          trackBroker.push(tracks, {
            logger: albumLogger.tick(),
            service,
            isPlaylist: false,
          }),
        ),
      };
    });
  }
  async function playlistHandler(query, {service, queryLogger}) {
    const logger = queryLogger.print(`Obtaining playlist metadata...`).tick();
    const playlist = await processPromise(service.getPlaylist(query, options.storefront), logger, {noVal: true});
    if (!playlist) return Promise.reject();
    logger.log(`\u27a4 Playlist Name: ${playlist.name}`);
    logger.log(`\u27a4 By: ${playlist.owner_name}`);
    if (playlist.description)
      logger.log(`\u27a4 Description: ${entityDecode(playlist.description.replace(/(<([^>]+)>)/gi, ''))}`);
    logger.log(`\u27a4 Type: ${playlist.type}`);
    if (playlist.followers) logger.log(`\u27a4 Followers: ${`${playlist.followers}`.replace(/(\d)(?=(\d{3})+$)/g, '$1,')}`);
    logger.log(`\u27a4 Tracks: ${playlist.ntracks}`);
    const collationLogger = queryLogger.log(`[\u2022] Collating...`).tick();
    const tracks = await processPromise(service.getPlaylistTracks(playlist.uri, options.storefront), collationLogger, {
      onInit: '[\u2022] Inquiring tracks...',
    });
    if (!tracks) throw new Error('Failed to collect playlist tracks');
    if (!tracks.length) return;
    return {
      meta: playlist,
      isCollection: true,
      tracks: trackBroker.push(tracks, {
        logger: collationLogger.tick(),
        service,
        isPlaylist: true,
      }),
    };
  }

  const authQueue = new AsyncQueue('cli:authQueue', 1, async (service, logger) => {
    async function coreAuth(loginLogger) {
      if (!Config.opts.attemptAuth) return;
      const authHandler = service.newAuth();
      const url = await authHandler.getUrl;
      if (Config.opts.autoOpenBrowser)
        await processPromise(open(url), loginLogger, {
          onInit: `[\u2022] Attempting to open [ ${url} ] within browser...`,
        });
      else loginLogger.log(`[\u2022] Open [ ${url} ] in a browser to proceed with authentication`);
      await processPromise(authHandler.userToAuth(), loginLogger, {
        onInit: '[\u2022] Awaiting user authentication...',
      });
    }
    service.loadConfig(freyrCoreConfig.get(`services.${service[symbols.meta].ID}`));
    if (service.isAuthed()) logger.write('[authenticated]\n');
    else {
      logger.write(service.hasOnceAuthed() ? '[expired]\n' : '[unauthenticated]\n');
      const loginLogger = logger.log(`[${service[symbols.meta].DESC} Login]`).tick();
      service.canTryLogin()
        ? (await processPromise(service.login(), loginLogger, {
            onInit: '[\u2022] Logging in...',
          })) || (await coreAuth(loginLogger))
        : await coreAuth(loginLogger);
    }
    return service.isAuthed();
  });

  const queryQueue = new AsyncQueue('cli:queryQueue', Config.concurrency.queries, async query => {
    const queryLogger = stackLogger.log(`[${query}]`).tick();
    const service = await processPromise(freyrCore.identifyService(query), queryLogger, {
      onInit: '[\u2022] Identifying service...',
      noVal: () => '(failed: \x1b[33mInvalid Query\x1b[0m)\n',
      onPass: engine => `[${engine[symbols.meta].DESC}]\n`,
    });
    if (!service) return;
    const isAuthenticated = !!(await processPromise(authQueue.push(service, queryLogger), queryLogger, {
      onInit: '[\u2022] Checking authentication...',
      noVal: () => '[\u2715] Failed to authenticate client!\n',
      onPass: false,
    }));
    if (!isAuthenticated) return;
    if (service.hasProps()) freyrCoreConfig.set(`services.${service[symbols.meta].ID}`, service.getProps());
    const contentType = service.identifyType(query);
    queryLogger.log(`Detected [${contentType}]`);
    let queryStats = await pFlatten(
      (contentType === 'track'
        ? trackHandler
        : contentType === 'album'
        ? albumHandler
        : contentType === 'artist'
        ? artistHandler
        : playlistHandler)(query, {service, queryLogger})
        .then(stats => (Array.isArray(stats) ? stats : [stats]))
        .catch(err =>
          queryLogger.error(
            `\x1b[31m[i]\x1b[0m An error occurred while processing the query${err ? ` (${err.message || err})` : ''}`,
          ),
        ),
    );
    if (queryStats.length === 0) return null;
    queryStats = (
      await Promise.mapSeries(queryStats.flat(), async item => {
        if (!item) return;
        await Promise.all(item.tracks);
        return item;
      })
    ).filter(Boolean);
    queryLogger.log('[\u2022] Download Complete');
    const embedLogger = queryLogger.log('[\u2022] Embedding Metadata...').tick();

    const allTrackStats = await Promise.mapSeries(queryStats, async queryStat => {
      const source = queryStat.meta;
      const trackStats = await pFlatten(queryStat.tracks);
      await Promise.mapSeries(trackStats, async trackStat => {
        if (trackStat.postprocess) {
          trackStat.postprocess = await trackStat.postprocess;
          if (symbols.errorCode in trackStat.postprocess) {
            trackStat[symbols.errorCode] = trackStat.postprocess[symbols.errorCode];
            trackStat.err = trackStat.postprocess.err;
          }
        }
        if (trackStat[symbols.errorCode]) {
          const reason =
            trackStat[symbols.errorCode] === -1
              ? 'Failed getting track data'
              : trackStat[symbols.errorCode] === 1
              ? 'Failed collecting sources'
              : trackStat[symbols.errorCode] === 2
              ? 'Error while collecting sources feeds'
              : trackStat[symbols.errorCode] === 3
              ? 'Error downloading album art'
              : trackStat[symbols.errorCode] === 4
              ? 'Error downloading raw audio'
              : trackStat[symbols.errorCode] === 5
              ? 'Unknown Download Error'
              : trackStat[symbols.errorCode] === 6
              ? 'Error ensuring directory integrity'
              : trackStat[symbols.errorCode] === 7
              ? 'Error while encoding audio'
              : trackStat[symbols.errorCode] === 8
              ? 'Failed while embedding metadata'
              : trackStat[symbols.errorCode] === 9
              ? 'Unexpected postprocessing error'
              : 'Unexpected track processing error';
          embedLogger.error(
            `\u2022 [\u2715] ${trackStat.meta && trackStat.meta.trackName ? `${trackStat.meta.trackName}` : '<unknown track>'}${
              trackStat.meta && trackStat.meta.track.uri ? ` [${trackStat.meta.track.uri}]` : ''
            } (failed:${reason ? ` ${reason}` : ''}${
              trackStat.err
                ? ` [${
                    'SHOW_DEBUG_STACK' in process.env
                      ? util.formatWithOptions({colors: true}, trackStat.err)
                      : trackStat.err['message'] || trackStat.err
                  }]`
                : ''
            })`,
          );
        } else if (trackStat[symbols.errorCode] === 0)
          embedLogger.log(`\u2022 [\u00bb] ${trackStat.meta.trackName} (skipped: ${trackStat.skip_reason})`);
        else
          embedLogger.log(
            `\u2022 [\u2713] ${trackStat.meta.trackName}${
              !!options.cover && !trackStat.postprocess.wroteImage ? ' [(i) unable to write cover art]' : ''
            }`,
          );
      });
      if (queryStat.isCollection)
        await createPlaylist(
          `Collection URI: ${source.uri}`,
          trackStats,
          queryLogger,
          `${source.name}${source.owner_name ? `-${source.owner_name}` : ''}`,
          `Playlist: ${source.name}${source.owner_name ? ` by ${source.owner_name}` : ''}`,
          Config.playlist.forceAppend,
        );
      return trackStats;
    }).then(trackStats => trackStats.flat());

    stackLogger.log('[\u2022] Collation Complete');
    return allTrackStats;
  });
  const totalQueries = [...options.input, ...queries];
  const trackStats = (await pFlatten(queryQueue.push(totalQueries))).filter(Boolean);
  if ((options.playlist && typeof options.playlist === 'string') || Config.playlist.always)
    await createPlaylist(
      null,
      trackStats,
      stackLogger,
      options.playlist,
      `Queries:\n${totalQueries.join('\n')}`,
      Config.playlist.append,
    );
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
      if (current[symbols.errorCode] === 0)
        if (current.complete) total.passed += 1;
        else total.skipped += 1;
      else if (!(symbols.errorCode in current)) (total.new += 1), (total.passed += 1);
      else total.failed += 1;
      return total;
    },
    {
      outSize: 0,
      mediaSize: 0,
      imageSize: 0,
      netSize: 0,
      passed: 0,
      new: 0,
      failed: 0,
      skipped: 0,
    },
  );
  if (options.stats) {
    stackLogger.log('============ Stats ============');
    stackLogger.log(` [\u2022] Runtime: [${prettyMs(Date.now() - initTimeStamp)}]`);
    stackLogger.log(` [\u2022] Total queries: [${prePadNum(totalQueries.length, 10)}]`);
    stackLogger.log(` [\u2022] Total tracks: [${prePadNum(trackStats.length, 10)}]`);
    stackLogger.log(`     \u00bb Skipped: [${prePadNum(finalStats.skipped, 10)}]`);
    stackLogger.log(
      `     \u2713 Passed:  [${prePadNum(finalStats.passed, 10)}]${
        finalStats.passed > finalStats.new ? ` (new: ${prePadNum(finalStats.new, 10)})` : ''
      }`,
    );
    stackLogger.log(`     \u2715 Failed:  [${prePadNum(finalStats.failed, 10)}]`);
    stackLogger.log(` [\u2022] Output directory: [${BASE_DIRECTORY}]`);
    stackLogger.log(` [\u2022] Total Output size: ${xbytes(finalStats.outSize)}`);
    stackLogger.log(` [\u2022] Total Network Usage: ${xbytes(finalStats.netSize)}`);
    stackLogger.log(`     \u266b Media: ${xbytes(finalStats.mediaSize)}`);
    stackLogger.log(`     \u27a4 Album Art: ${xbytes(finalStats.imageSize)}`);
    stackLogger.log(` [\u2022] Output bitrate: ${options.bitrate}`);
    stackLogger.log('===============================');
  }
  await fileMgr.garbageCollect({keep: Config.dirs.cache.keep});
  await encodeQueue.cleanup();
}

function prepCli(packageJson) {
  const program = commander
    .addHelpCommand(true)
    .storeOptionsAsProperties(true)
    .name('freyr')
    .description(packageJson.description)
    .option('--no-logo', 'hide startup logo')
    .option('--no-header', 'hide startup header')
    .version(`v${packageJson.version}`, '-v, --version')
    .helpOption('-h, --help', 'show this help information')
    .addHelpCommand('help [command]', 'show this help information or for any subcommand')
    .on('--help', () => {
      console.log('');
      console.log('Info:');
      console.log('  The `get` subcommand is implicit and default');
      console.log('   $ freyr spotify:artist:6M2wZ9GZgrQXHCFfjv46we');
      console.log('     # is equivalent to');
      console.log('   $ freyr get spotify:artist:6M2wZ9GZgrQXHCFfjv46we');
    });

  program
    .command('get', {isDefault: true})
    .arguments('[query...]')
    .description('Download music tracks from queries')
    .option(
      '-i, --input <FILE>',
      [
        'use URIs found in the specified FILE as queries (file size limit: 1 MiB)',
        "(each query on a new line, use '#' for comments, whitespaces ignored)",
        '(example: `-i queue.txt`)',
      ].join('\n'),
    )
    .option(
      '-b, --bitrate <N>',
      ['set audio quality / bitrate for audio encoding', `(valid: ${VALIDS.bitrates})`].join('\n'),
      '320k',
    )
    .option('-n, --chunks <N>', 'number of concurrent chunk streams with which to download', 7)
    .option('-r, --retries <N>', 'set number of retries for each chunk before giving up (`infinite` for infinite)', 10)
    .option('-t, --meta-retries <N>', 'set number of retries for collating track feeds (`infinite` for infinite)', 5)
    .option('-d, --directory <DIR>', 'save tracks to DIR/..')
    .option(
      '-D, --check-dir <DIR>',
      [
        'check if tracks already exist in another DIR (repeatable, optionally comma-separated)',
        '(useful if you maintain multiple libraries)',
        '(example: `-D dir1 -D dir2 -D dir3,dir4`)',
      ].join('\n'),
      (spec, stack) => (stack || []).concat(spec.split(',')),
    )
    .option('-c, --cover <NAME>', 'custom name for the cover art, excluding the extension', 'cover')
    .option(
      '--cover-size <SIZE>',
      ['preferred cover art dimensions', '(format: <width>x<height> or <size> as <size>x<size>)'].join('\n'),
      '640x640',
    )
    .option('-C, --no-cover', 'skip saving a cover art')
    /* Unimplemented Feature
    .option(
      '-x, --format <FORMAT>',
      ['preferred audio output format (to export) (unimplemented)', '(valid: mp3,m4a,flac)'].join('\n'),
      'm4a',
    )
    */
    .option(
      '-S, --sources <SERVICE>',
      [
        'specify a preferred audio source or a `,`-separated preference order',
        `(valid: ${VALIDS.sources}) (prefix with \`!\` to exclude)`,
      ].join('\n'),
      'yt_music',
    )
    .option(
      '-l, --filter <MATCH>',
      [
        'filter matches off patterns (repeatable and optionally `,`-separated)',
        '(value omission implies `true` if applicable)',
        '(format: <key=value>) (example: title="when we all fall asleep*",type=album)',
        'See `freyr help filter` for more information',
      ].join('\n'),
      (spec, stack) => (stack || []).concat(spec),
    )
    .option('-L, --filter-case', 'enable case sensitivity for glob matches on the filters')
    .option(
      '-z, --concurrency <SPEC>',
      [
        'key-value concurrency pairs (repeatable and optionally `,`-separated)',
        '(format: <[key=]value>) (key omission implies track concurrency)',
        `(valid(key): ${VALIDS.concurrency})`,
        '(example: `queries=2,downloader=4` processes 2 CLI queries, downloads at most 4 tracks concurrently)',
      ].join('\n'),
      (spec, stack) => (stack || []).concat(spec.split(',')),
    )
    .option('--gapless', 'set the gapless playback flag for all tracks')
    .option('-f, --force', 'force overwrite of existing files')
    .option('-o, --config <FILE>', 'specify alternative configuration file')
    .option('-p, --playlist <FILENAME>', 'create playlist for all successfully collated tracks')
    .option('-P, --no-playlist', 'skip creating a playlist file for collections')
    .option('--playlist-dir <DIR>', 'directory to save playlist file to, if any, (default: tracks base directory)')
    .option('--playlist-noappend', 'do not append to the playlist file, if any exists')
    .option('--playlist-noescape', 'do not escape invalid characters within playlist entries')
    .option(
      '--playlist-namespace <SPEC>',
      [
        'namespace to prefix on each track entry, relative to tracks base directory',
        'useful for, but not limited to custom (file:// or http://) entries',
        '(example, you can prefix with a HTTP domain path: `http://webpage.com/music`)',
      ].join('\n'),
    )
    .option('--playlist-force-append', 'force append collection tracks to the playlist file')
    .option('-s, --storefront <COUNTRY>', 'country storefront code (example: us,uk,ru)')
    .option('-T, --no-tree', "don't organise tracks in directory structure `[DIR/]<ARTIST>/<ALBUM>/<TRACK>`")
    /* Unimplemented Feature
    .option(
      '--tags',
      [
        'tag configuration specification (repeatable and optionally `,`-separated) (unimplemented)',
        '(format: <key=value>) (reserved keys: [exclude, account])',
      ].join('\n'),
      (spec, stack) => (stack || []).concat(spec.split(',')),
    )
    */
    /* Unimplemented Feature
    .option('--via-tor', 'tunnel network traffic through the tor network (unimplemented)')
    */
    .option('--cache-dir <DIR>', 'specify alternative cache directory\n`<tmp>` for tempdir, `<cache>` for system cache')
    .option('--rm-cache [RM]', 'remove original downloaded files in cache directory (default: false)', v =>
      ['true', '1', 'yes', 'y'].includes(v) ? true : ['false', '0', 'no', 'n'].includes(v) ? false : v,
    )
    .option('-m, --mem-cache <SIZE>', 'max size of bytes to be cached in-memory for each download chunk')
    .option('--no-mem-cache', 'disable in-memory chunk caching (restricts to sequential download)')
    .option('--timeout <N>', 'network inactivity timeout (ms)', 10000)
    .option('--no-auth', 'skip authentication procedure')
    .option('--no-browser', 'disable auto-launching of user browser')
    .option('--no-net-check', 'disable internet connection check')
    .option('--no-bar', 'disable the progress bar')
    .option('--atomic-parsley <PATH>', 'explicit path to the atomic-parsley binary')
    .option('--no-stats', "don't show the stats on completion")
    .option('--pulsate-bar', 'show a pulsating bar')
    .option(
      '--single-bar',
      [
        'show a single bar for the download, hide chunk-view',
        '(default when number of chunks/segments exceed printable space)',
      ].join('\n'),
    )
    .action((...args) => init(packageJson, ...args))
    .on('--help', () => {
      console.log('');
      console.log('Environment Variables:');
      console.log('  SHOW_DEBUG_STACK             show extended debug information');
      console.log('  ATOMIC_PARSLEY_PATH          custom AtomicParsley path, alternatively use `--atomic-parsley`');
      console.log('');
      console.log('Info:');
      console.log('  When downloading playlists, the tracks are downloaded individually into');
      console.log('  their respective folders. However, a m3u8 playlist file is generated in');
      console.log('  the base directory with the name of the playlist that lists the tracks');
    });

  /* Unimplemented Feature
  program
    .command('serve', {hidden: true})
    .arguments('[port]')
    .description('Launch freyr server on an HTTP interface (unimplemented)', {
      port: 'specify alternative port [default: 3797]',
    })
    .option('-b, --bind <ADDRESS>', 'address to bind to')
    .option('-d, --directory <DIR>', 'working directory')
    .option('-c, --config <FILE>', 'configuration file')
    .option('-t, --tmp <DIR>', 'temporary directory for unprocessed artifacts', '<tmp>')
    .option('-a, --archive <WHEN>', 'when to pack file(s) in an archive (valid: auto,always,never))', 'auto')
    .option('-z, --compression [algorithm]', 'compression algorithm to use (valid: gzip,lz4)', 'gzip')
    .option('-Z, --no-compression', 'disable compression altogether')
    .option('--no-cache', 'disable file caching')
    .action(() => {
      throw Error('Unimplemented: [CLI:serve]');
    });
  */

  /* Unimplemented Feature
  const program_context = program
    .command('context', {hidden: true})
    .description('Create and manage music contexts (unimplemented)')
    .action(() => {
      throw Error('Unimplemented: [CLI:context]');
    });
  */

  /* Unimplemented Feature
  program_context
    .command('new')
    .arguments('<name>')
    .description('create a new music context (unimplemented)')
    .option('-k, --pass <KEY>', 'encrypted password for the context, if any')
    .option('--no-pass', 'do not ask for a key to encrypt the context')
    .action(() => {
      throw Error('Unimplemented: [CLI:context new]');
    });
  */

  /* Unimplemented Feature
  program
    .command('search', {hidden: true})
    .description('Search for and optionally download music interactively (unimplemented)')
    .option('-q, --query <PATTERN>', 'non-interactive search filter pattern to be matched')
    .option('-n, --max <MAX>', 'return a maximum of MAX match results')
    .option('-o, --output <FILE>', 'save search results in a batch file for later instead of autodownload')
    .option('-p, --pretty', 'include whitespaces and commented metadata in search result output')
    .option(
      '-l, --filter <PATTERN>',
      'key-value constraints that all search results must match (repeatable and optionally `,`-separated)',
      (spec, stack) => (stack || []).concat(spec),
    )
    .option('-L, --filter-case', 'enable case sensitivity for glob matches on the filters (unimplemented)')
    .option('--profile <PROFILE>', 'configuration context with which to process the search and download')
    .action((_args, _cmd) => {
      throw Error('Unimplemented: [CLI:search]');
    })
    .on('--help', () => {
      console.log('');
      console.log('Info:');
      console.log('  See `freyr help filter` for more information on constructing filter PATTERNs');
      console.log('');
      console.log('  Optionally, args and options provided after `--` are passed as options to the freyr download interface');
      console.log('  Options like `--profile` share its value with the downloader');
      console.log('');
      console.log('Examples:');
      console.log('  # search interactively and download afterwards with custom download flags');
      console.log('  $ freyr search -- -d ~/Music');
      console.log('');
      console.log('  # search non-interactively and download afterwards');
      console.log("  $ freyr search --query 'billie eilish @ type=album, title=*was older, duration=3s.., explicit=false'");
      console.log('');
      console.log('  # search interactively, save a maximum of 5 results to file and download later');
      console.log('  $ freyr search -n 5 -o queue.txt');
      console.log('  $ freyr -i queue.txt');
    });
  */

  const program_filter = program
    .command('filter')
    .arguments('[pattern...]')
    .description('Process filter patterns to preview JSON representation')
    .option('-c, --condensed', 'condense JSON output', false)
    .action((patterns, args) => {
      if (!patterns.length) return program_filter.outputHelp();
      console.log(JSON.stringify(patterns.map(parseSearchFilter), null, args.condensed ? 0 : 2));
    })
    .on('--help', () => {
      console.log('');
      console.log('Format:');
      console.log('  [query@]key1=value,key2=value');
      console.log('');
      console.log('  > testquery@key1=value1,key2 = some value2, key3=" some value3 "');
      console.log('  is equivalent to');
      console.log(`  > {
  >   "query": "testquery",
  >   "filters": {
  >     "key1": "value1",
  >     "key2": "some value2",
  >     "key3": " some value3 "
  >   }
  > }`);
      console.log('');
      console.log('  A pattern is a query-filter pair separated by `@`');
      console.log('  Wherever the query is absent, `*` is implied, matching all (although discouraged)');
      console.log('  The filter is a string of key-value constraints separated by `,`');
      console.log('  The key and value constraints themselves are separated by `=`');
      console.log('  Filter values can also be wildcard matches');
      console.log('  Whitespacing is optional as well as using (" or \') for strings');
      console.log('');
      console.log('  Use {} to escape either of these reserved delimiters');
      console.log('  ({@} for @) ({,} for ,) ({=} for =) ({{}} for {}) ({"} for ") etc.');
      console.log('');
      console.log('Examples:');
      console.log("  # match anything starting with 'Justi' and ending with 'ber'");
      console.log("  $ freyr filter 'Justi*ber'");
      console.log('');
      console.log("  # filter artists matching the name 'Dua Lipa' and any album with 9 or more tracks from 'Billie Eilish'");
      console.log('  $ freyr filter artist="Dua Lipa" \'artist = Billie Eilish, type = album, ntracks = 9..\'');
      console.log('');
      console.log("  # filter non-explicit tracks from 'Billie Eilish' ending with 'To Die'");
      console.log('  # whose duration is between 1:30 and 3:00 minutes');
      console.log("  $ freyr filter 'artist = Billie Eilish, title = *To Die, duration = 1:30..3:00, explicit = false'");
    });

  /* Unimplemented Feature
  const config = program
    .command('profile', {hidden: true})
    .description('Manage profile configuration contexts storing persistent user configs and auth keys (unimplemented)')
    .on('--help', () => {
      console.log('');
      console.log('Examples:');
      console.log('  $ freyr profile new test');
      console.log('    ? Enter an encryption key: **********');
      console.log('  /home/miraclx/.config/FreyrCLI/test.x4p');
      console.log('');
      console.log('  # unless unencrypted, will ask to decrypt profile');
      console.log('  $ freyr --profile test deezer:playlist:1963962142');
      console.log('    ? Enter an encryption key: **********');
      console.log('  [...]');
    });
  */

  /* Unimplemented Feature
  config
    .command('new')
    .arguments('<name>')
    .description('create a new profile context (unimplemented)')
    .option('-k, --pass <KEY>', 'encrypted password for the new profile')
    .option('--no-pass', 'do not ask for a key to encrypt the config')
    .action(() => {
      throw Error('Unimplemented: [CLI:profiles new]');
    });
  */

  /* Unimplemented Feature
  config
    .command('get')
    .arguments('<name>')
    .description('return the raw configuration content for the profile, decrypts if necessary (unimplemented)')
    .option('-k, --pass <KEY>', 'encrypted password for the profile, if any')
    .option(
      '-p, --pretty [SPEC]',
      'pretty print the JSON output. (key omission implies space indentation)\n(format(SPEC): <[key=]value>) (valid(key): space,tab)',
      'space=2',
    )
    .action(() => {
      throw Error('Unimplemented: [CLI:profiles get]');
    });
  */

  /* Unimplemented Feature
  config
    .command('remove')
    .alias('rm')
    .arguments('<name>')
    .description('deletes the profile context, decrypts if necessary (unimplemented)')
    .option('-k, --pass <KEY>', 'encrypted password for the profile, if any')
    .action(() => {
      throw Error('Unimplemented: [CLI:profiles reset]');
    });
  */

  /* Unimplemented Feature
  config
    .command('reset')
    .alias('rs')
    .arguments('<name>')
    .description('resets the profile context, decrypts if necessary (unimplemented)')
    .option('-k, --pass <KEY>', 'encrypted password for the profile, if any')
    .action(() => {
      throw Error('Unimplemented: [CLI:profiles reset]');
    });
  */

  /* Unimplemented Feature
  config
    .command('unset')
    .alias('un')
    .arguments('<name> <field>')
    .description('unsets a field within the profile context, decrypts if necessary (unimplemented)')
    .option('-k, --pass <KEY>', 'encrypted password for the profile, if any')
    .action(() => {
      throw Error('Unimplemented: [CLI:profiles unset]');
    });
  */

  /* Unimplemented Feature
  config
    .command('list')
    .alias('ls')
    .description('list all available profiles (unimplemented)')
    .option('--raw', 'return raw JSON output')
    .action(() => {
      throw Error('Unimplemented: [CLI:profiles list]');
    });
  */

  program
    .command('urify')
    .arguments('[urls...]')
    .description('Convert service URLs to uniform freyr compatible URIs')
    .option('-u, --url', 'unify output in service-specific URL representations')
    .option(
      '-i, --input <FILE>',
      [
        'get URLs from a batch file, comments with `#` are expunged',
        '`-` reads from stdin, if unpiped, drops to interactive (Ctrl+D to exit)',
        'if piped, stdin has preference over FILE',
      ].join('\n'),
    )
    .option('-o, --output <FILE>', 'write to file as opposed to stdout')
    .option('-t, --no-tag', 'skip comments with info or meta for each entry')
    .action(async (urls, args) => {
      const output = args.output ? createWriteStream(args.output) : process.stdout;
      // eslint-disable-next-line no-shadow
      async function urify(urls) {
        urls.forEach(url => {
          const parsed = FreyrCore.parseURI(url);
          const uri = parsed && parsed[args.url ? 'url' : 'uri'];
          if (args.tag) !uri ? output.write(`# invalid: ${url}\n`) : output.write(`# ${url}\n`);
          if (!uri) return;
          output.write(`${uri}\n`);
        });
      }
      if (urls.length === 0 && process.stdin.isTTY && !args.input) args.input = '-';
      await urify(urls)
        .then(async () => {
          if ((process.stdin.isTTY && args.input !== '-') || !process.stdin.isTTY)
            await urify(await PROCESS_INPUT_ARG(!process.stdin.isTTY ? '-' : args.input));
          else if (process.stdin.isTTY && args.input === '-') {
            console.error('\x1b[32m[\u2022]\x1b[0m Stdin tty open');
            await new Promise((res, rej) =>
              process.stdin
                .on('data', data => urify(PARSE_INPUT_LINES([data.toString()])))
                .on('error', rej)
                .on('close', res),
            );
          }
        })
        .then(() => {
          console.error('\x1b[32m[+]\x1b[0m Urify complete');
          if (args.output) console.error(`Successfully written to [${args.output}]`);
          if (output !== process.stdout) output.end();
        });
    })
    .on('--help', () => {
      console.log('');
      console.log('Examples:');
      console.log('  $ freyr urify -t https://open.spotify.com/album/2D23kwwoy2JpZVuJwzE42B');
      console.log('  spotify:album:2D23kwwoy2JpZVuJwzE42B');
      console.log('');
      console.log('  $ freyr urify -t https://music.apple.com/us/album/say-so-feat-nicki-minaj/1510821672?i=1510821685');
      console.log('  apple_music:track:1510821685');
      console.log('');
      console.log(
        [
          '  $ echo https://www.deezer.com/en/artist/5340439 \\',
          '         https://music.apple.com/us/playlist/todays-hits/pl.f4d106fed2bd41149aaacabb233eb5eb \\',
          '      | freyr urify -t',
        ].join('\n'),
      );
      console.log('  deezer:artist:5340439');
      console.log('  apple_music:playlist:pl.f4d106fed2bd41149aaacabb233eb5eb');
    });

  return program;
}

async function main(argv) {
  let packageJson = JSON.parse((await fs.readFile(xpath.join(__dirname, 'package.json'))).toString());

  let {program} = prepCli(packageJson);

  if (!(argv.includes('-v') || argv.includes('--version'))) {
    const showBanner = !argv.includes('--no-logo');
    const showHeader = !argv.includes('--no-header');
    if (showBanner) {
      // eslint-disable-next-line global-require
      const {default: banner} = await import('./banner.js'); // require banner only when needed
      console.log(banner.join('\n').concat(` v${packageJson.version}\n`));
    }
    if (showHeader) {
      const credits = `freyr - (c) ${packageJson.author.name} <${packageJson.author.email}>`;
      console.log([credits, '-'.repeat(credits.length)].join('\n'));
    }
    if (argv.length === 2 + (!showHeader ? 1 : 0) + (!showBanner ? 1 : 0)) return program.outputHelp();
  }
  try {
    await program.parseAsync(argv);
  } catch (err) {
    console.error(
      `\x1b[31m[!] Fatal Error\x1b[0m: ${
        typeof err === 'undefined'
          ? '[uncaught]'
          : 'SHOW_DEBUG_STACK' in err
          ? util.formatWithOptions({colors: true}, err)
          : err['message']
      }`,
    );
  }
}

main(process.argv);

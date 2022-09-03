import url from 'url';
import util from 'util';
import {tmpdir} from 'os';
import {randomBytes} from 'crypto';
import {PassThrough} from 'stream';
import {spawn} from 'child_process';
import {relative, join, resolve} from 'path';
import {promises as fs, constants as fs_constants, createWriteStream} from 'fs';

import fileMgr from '../src/file_mgr.js';

const maybeStat = path => fs.stat(path).catch(() => false);

const __dirname = url.fileURLToPath(new URL('.', import.meta.url));

function sed(fn) {
  return new PassThrough({
    write(chunk, _, cb) {
      this.buf = Buffer.concat([this.buf || Buffer.alloc(0), chunk]);
      let eol;
      while (~(eol = this.buf.indexOf(0x0a))) {
        this.push(fn(this.buf.slice(0, eol + 1)));
        this.buf = this.buf.slice(eol + 1);
      }
      cb(null);
    },
    final(cb) {
      this.push(this.buf);
      cb();
    },
  });
}

function tee(stream1, stream2) {
  let stream = new PassThrough();
  stream.pipe(stream1);
  stream.pipe(stream2);
  return stream;
}

async function pRetry(tries, fn) {
  let result,
    rawErr,
    abortSymbol = Symbol('RetryAbort');
  for (let [i] of Array.apply(null, {length: tries}).entries()) {
    try {
      return await fn(i + 1, rawErr, () => {
        throw abortSymbol;
      });
    } catch (err) {
      if (err === abortSymbol) break;
      (result = Promise.reject((rawErr = err))).catch(() => {});
    }
  }
  return result;
}

function short_path(path) {
  let a = resolve(path);
  let b = relative(process.cwd(), path);
  if (!['..', '/'].some(c => b.startsWith(c))) b = `./${b}`;
  return a.length < b.length ? a : b;
}

const default_stage = join(tmpdir(), 'freyr-test');

async function run_tests(suite, args, i) {
  let docker_image;
  if (~(i = args.indexOf('--docker')) && !(docker_image = args.splice(i, 2)[1]))
    throw new Error('`--docker` requires an image name');
  let stage_name = randomBytes(6).toString('hex');
  if (~(i = args.indexOf('--name')) && !(stage_name = args.splice(i, 2)[1])) throw new Error('`--name` requires a stage name');
  let stage_path = default_stage;
  if (~(i = args.indexOf('--stage')) && !(stage_path = args.splice(i, 2)[1])) throw new Error('`--stage` requires a path');
  stage_path = resolve(join(stage_path, stage_name));
  let force, clean;
  if ((force = !!~(i = args.indexOf('--force')))) args.splice(i, 1);
  if ((clean = !!~(i = args.indexOf('--clean')))) args.splice(i, 1);
  if (await maybeStat(stage_path))
    if (!force) throw new Error(`stage path [${stage_path}] already exists`);
    else if (clean) await fs.rm(stage_path, {recursive: true});

  let is_gha = 'GITHUB_ACTIONS' in process.env && process.env['GITHUB_ACTIONS'] === 'true';

  let tests = args;
  if (~(i = args.indexOf('--all'))) args.splice(i, 1), (tests = Object.keys(suite));
  let invalidArg;
  if ((invalidArg = args.find(arg => arg.startsWith('-')))) throw new Error(`Invalid argument: ${invalidArg}`);

  if (!tests.length) return noService;

  for (let [i, test] of tests.entries()) {
    let [service, type] = test.split('.');
    if (!(service in suite)) throw new Error(`Invalid service: ${service}`);
    if (!type) {
      tests.splice(i + 1, 0, ...Object.keys(suite[service]).map(type => `${test}.${type}`));
      continue;
    }

    let {uri, filter = [], expect} = suite[service][type];

    let test_stage_path = join(stage_path, test);

    let preargs = ['--no-logo', '--no-header', '--no-bar'];
    if (is_gha) preargs.push('--no-auth');
    let child_args = [...preargs, ...filter.map(f => `--filter=${f}`)];

    let unmetExpectations = new Error('One or more expectations failed');

    await pRetry(3, async (attempt, lastErr, abort) => {
      if (attempt > 1 && lastErr !== unmetExpectations) abort();

      let logFile = await fileMgr({
        filename: `${service}-${type}-${attempt}.log`,
        tmpdir: test_stage_path,
        keep: true,
        mode: fs_constants.W_OK,
      });

      logFile.stream = createWriteStream(null, {fd: logFile.handle});

      let logline = line => `│ ${line}`;

      let raw_stdout = tee(logFile.stream, process.stdout);
      let stdout = sed(logline);
      stdout.pipe(raw_stdout);

      let raw_stderr = tee(logFile.stream, process.stderr);
      let stderr = sed(logline);
      stderr.pipe(raw_stderr);

      stdout.log = (...args) => void stdout.write(util.formatWithOptions({colors: true}, ...args, '\n'));
      stderr.log = (...args) => void stderr.write(util.formatWithOptions({colors: true}, ...args, '\n'));

      if (attempt > 1)
        if (is_gha) console.log(`::warning::[${attempt}/3] Download failed, retrying..`);
        else console.log(`\x1b[33m[${attempt}/3] Download failed, retrying..\x1b[0m`);
      console.log(`Log File: ${logFile.path}`);

      let top_bar = `┌──> ${`[${attempt}/3] ${service} ${type} `.padEnd(56, '─')}┐`;
      if (is_gha) console.log(`::group::${top_bar}`);
      else raw_stdout.write(`${top_bar}\n`);

      let child, handler;

      if (!docker_image) {
        child = spawn(
          'node',
          [short_path(join(__dirname, '..', 'cli.js')), ...child_args, '--directory', short_path(test_stage_path), uri],
          {...process.env, SHOW_DEBUG_STACK: 1},
        );
      } else {
        let child_id = `${test}.${stage_name}`;
        let extra_docker_args = process.env['DOCKER_ARGS'] ? process.env['DOCKER_ARGS'].split(' ') : [];
        child = spawn('docker', [
          'run',
          ...extra_docker_args,
          '--rm',
          '--interactive',
          '--log-driver=none',
          '--name',
          child_id,
          '--network',
          'host',
          '--volume',
          `${test_stage_path}:/data`,
          '--env',
          'SHOW_DEBUG_STACK=1',
          docker_image,
          ...child_args,
          uri,
        ]);
        process.on('SIGINT', (handler = () => (spawn('docker', ['kill', child_id]), process.off('SIGINT', handler))));
      }

      stdout.log(`\n$ ${child.spawnargs.join(' ')}\n`);

      let childErrors = [];
      child.on('error', err => childErrors.push(err));

      let logs = [];

      for (let [i, o] of [
        [child.stdout, stdout],
        [child.stderr, stderr],
      ])
        i.on('data', data => {
          let line = data.toString();
          let pos;
          if (~(pos = line.indexOf('\x1b[G'))) line = line.slice(0, pos + 3) + logline(line.slice(pos + 3));
          logs.push(line);
          o.write(line);
        });

      await new Promise((res, rej) => {
        child.on('close', (code, err) => {
          if (docker_image) {
            process.off('SIGINT', handler);
            if (code === 137) process.exit(130);
          }
          if (code !== 0) err = new Error(`child process exited with code ${code}`);
          else if (childErrors.length) err = childErrors.shift();
          if (!err) res();
          else {
            err.code = code;
            if (childErrors.length) err[errorCauses] = childErrors;
            rej(err);
          }
        });
      });

      if (is_gha && (i = logs.findIndex(line => line.includes('[•] Embedding Metadata')))) {
        console.log(`::group::├──> ${`[${attempt}/3] View Download Status `.padEnd(56, '─')}┤`);
        for (let line of logs
          .slice(i)
          .join('')
          .split('\n')
          .filter(line => line.trim().length))
          console.log(`│ ${line}`);
        console.log('::endgroup::');
      }

      let ml = expect.reduce((a, v) => Math.max(a, v.length), 0);
      if (is_gha) console.log(`::group::├──> ${`[${attempt}/3] Verifying... `.padEnd(56, '─')}┤`);
      else raw_stdout.write(`├──> ${`[${attempt}/3] Verifying... `.padEnd(56, '─')}┤\n`);
      let as_expected = true;
      for (let expected of expect) {
        stdout.write(`• \x1b[33m${expected.padEnd(ml + 2, ' ')}\x1b[0m `);
        let this_passed;
        if ((this_passed = logs.some(line => line.match(new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')))))
          stdout.log('\x1b[32m(matched)\x1b[0m');
        else stdout.log('\x1b[31m(failed to match)\x1b[0m');
        as_expected &&= this_passed;
      }
      if (is_gha) console.log('::endgroup::');
      if (is_gha) console.log(`::group::└${'─'.repeat(top_bar.length - 2)}┘\n::endgroup::`);
      else raw_stdout.write(`└${'─'.repeat(top_bar.length - 2)}┘\n`);

      if (!as_expected) throw unmetExpectations;
    });
  }
}

let errorCauses = Symbol('ErrorCauses');
let noService = Symbol('noService');

async function main(args) {
  let suite, test_suite, i;

  if (~(i = args.indexOf('--suite')) && !(test_suite = args.splice(i, 2)[1])) throw new Error('`--suite` requires a file path');

  suite = JSON.parse(await fs.readFile(test_suite || join(__dirname, 'default.json')));

  if (!['-h', '--help'].some(args.includes.bind(args))) {
    try {
      if (noService !== (await run_tests(suite, args))) return;
    } catch (err) {
      console.error('An error occurred!');
      if (errorCauses in err) {
        let causes = err[errorCauses];
        delete err[errorCauses];
        console.error('', err);
        for (let cause of causes) console.error('', cause);
      } else console.error('', err);
      process.exit(1);
    }
  }

  console.log('freyr-test');
  console.log('----------');
  console.log('Usage: freyr-test [options] [<SERVICE>[.<TYPE>]...]');
  console.log();
  console.log('Utility for testing the Freyr CLI');
  console.log();
  console.log('Options:');
  console.log();
  console.log(`  SERVICE                 ${Object.keys(suite).join(' / ')}`);
  console.log(`  TYPE                    ${[...new Set(Object.values(suite).flatMap(s => Object.keys(s)))].join(' / ')}`);
  console.log();
  console.log('  --all                   run all tests');
  console.log('  --suite <SUITE>         use a specific test suite (json)');
  console.log('  --docker <IMAGE>        run tests in a docker container');
  console.log('  --name <NAME>           name for this test run (defaults to a random hex string)');
  console.log(`  --stage <PATH>          directory to stage this test (default: ${default_stage})`);
  console.log('  --force                 allow reusing existing stages');
  console.log('  --clean                 (when --force is used) clean existing stage before reusing it');
  console.log('  --help                  show this help message');
  console.log();
  console.log('Enviroment Variables:');
  console.log();
  console.log('  DOCKER_ARGS             arguments to pass to `docker run`');
  console.log();
  console.log('Example:');
  console.log();
  console.log('  $ freyr-test --all');
  console.log('      runs all tests');
  console.log();
  console.log('  $ freyr-test spotify');
  console.log('      runs all Spotify tests');
  console.log();
  console.log('  $ freyr-test apple_music.album');
  console.log('      tests downloading an Apple Music album');
  console.log();
  console.log('  $ freyr-test spotify.track deezer.artist');
  console.log('      tests downloading a Spotify track and Deezer artist');
  console.log();
  console.log('  $ freyr-test spotify.track --stage ./stage --name test-run');
  console.log('      downloads the Spotify test track in ./stage/test-run/spotify.track with logs');
}

function _start() {
  main(process.argv.slice(2));
}

_start();

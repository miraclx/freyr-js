import fs from 'fs';
import url from 'url';
import path from 'path';
import util from 'util';
import {randomUUID} from 'crypto';
import {PassThrough} from 'stream';
import {spawn} from 'child_process';

import fileMgr from '../src/file_mgr.js';

const __dirname = url.fileURLToPath(new URL('.', import.meta.url));

function sed(fn) {
  return new PassThrough({
    write(chunk, _, cb) {
      this.buf = Buffer.concat([(this.buf ||= Buffer.alloc(0)), chunk]);
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
      result = await fn(i + 1, rawErr, () => {
        throw abortSymbol;
      });
    } catch (err) {
      if (err === abortSymbol) break;
      (result = Promise.reject((rawErr = err))).catch(() => {});
    }
  }
  return result;
}

async function run_tests(stage, args) {
  let is_gha, docker_image, i;
  if ((docker_image = !!~(i = args.indexOf('--docker'))) && !(docker_image = args.splice(i, 2)[1]))
    throw new Error('`--docker` requires an image name');
  if ((is_gha = !!~(i = args.indexOf('--gha')))) args.splice(i, 1);
  if (~(i = args.indexOf('--all'))) args = Object.keys(stage);
  let invalidArg;
  if ((invalidArg = args.find(arg => arg.startsWith('-')))) throw new Error(`Invalid argument: ${invalidArg}`);

  for (let [i, arg] of args.entries()) {
    let [service, type] = arg.split('.');
    if (!(service in stage)) throw new Error(`Invalid service: ${service}`);
    if (!type) {
      args.splice(i + 1, 0, ...Object.keys(stage[service]).map(type => `${arg}.${type}`));
      continue;
    }

    let {uri, filter = [], expect} = stage[service][type];

    let child_args = ['--no-logo', '--no-header', '--no-bar', uri, ...filter.map(f => `--filter=${f}`)];

    let unmetExpectations = new Error('One or more expectations failed');

    let child_id = randomUUID();

    await pRetry(3, async (attempt, lastErr, abort) => {
      if (attempt > 1 && lastErr !== unmetExpectations) abort();

      let logFile = await fileMgr({
        filename: `${service}-${type}-${attempt}.log`,
        dirname: path.join('freyr-test', child_id),
        keep: true,
        mode: fs.constants.W_OK,
      });

      logFile.stream = fs.createWriteStream(null, {fd: logFile.fd});

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
      console.log(`Log File: ${logFile.name}`);

      let top_bar = `┌────────────────── [${attempt} / 3] ${service} ${type} ───────────────────┐`;
      if (is_gha) console.log(`::group::${top_bar}`);
      else raw_stdout.write(`${top_bar}\n`);

      let child, handler;

      if (!docker_image) {
        child = spawn('node', [path.join(__dirname, '..', 'cli.js'), ...child_args]);
      } else {
        let extra_docker_args = process.env['DOCKER_ARGS'] ? process.env['DOCKER_ARGS'].split(' ') : [];
        child = spawn('docker', [
          'run',
          ...extra_docker_args,
          '--rm',
          '-i',
          '--log-driver=none',
          '--name',
          child_id,
          docker_image,
          ...child_args,
        ]);
        process.on('SIGINT', (handler = () => (spawn('docker', ['kill', child_id]), process.off('SIGINT', handler))));
      }

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
        console.log(`::group::├───────── [${attempt} / 3] View Download Status ─────────`);
        for (let line of logs
          .slice(i)
          .join('')
          .split('\n')
          .filter(line => line.trim().length))
          console.log(`│ ${line}`);
        console.log('::endgroup::');
      }

      let ml = expect.reduce((a, v) => Math.max(a, v.length), 0);
      if (is_gha) console.log('::group::├────────────── Verifying ───────────────');
      else raw_stdout.write('├────────────── Verifying ───────────────\n');
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
      raw_stdout.write(`└${'─'.repeat(top_bar.length - 2)}┘\n`);

      if (!as_expected) throw unmetExpectations;
    });
  }
}

let errorCauses = Symbol('ErrorCauses');

function main() {
  let args = process.argv.slice(2);
  if (!args.length || args.includes('--help') || args.includes('-h')) {
    console.log('freyr-test');
    console.log('----------');
    console.log('Usage: freyr-test [options] [<SERVICE>[.<TYPE>]...]');
    console.log();
    console.log('Utility for testing the Freyr CLI');
    console.log();
    console.log('Options:');
    console.log();
    console.log('  SERVICE                 spotify / apple_music / deezer');
    console.log('  TYPE                    track / album / artist / playlist');
    console.log();
    console.log('  --all                   run all tests');
    console.log('  --docker <IMAGE>        run tests in a docker container');
    console.log('  --gha                   run in GitHub Actions environment');
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
    return;
  }

  let stage = JSON.parse(fs.readFileSync(path.join(__dirname, 'cases.json')));

  run_tests(stage, args).catch(err => {
    console.error('An error occurred!');
    if (errorCauses in err) {
      let causes = err[errorCauses];
      delete err[errorCauses];
      console.error('', err);
      for (let cause of causes) console.error('', cause);
    } else console.error('', err);
    process.exit(1);
  });
}

main();

const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const {promisify} = require('util');

const xget = require('libxget');
const axios = require('axios');
const stringd = require('stringd');
const unzipper = require('unzipper');
const xprogress = require('xprogress');

const mkdir = promisify(fs.mkdir);
const rmdir = promisify(fs.rmdir);
const exists = promisify(fs.exists);

function genProgressBar(fileName, urlMeta, indent) {
  return xprogress.stream(
    urlMeta.size,
    urlMeta.chunkStack.map(chunk => chunk.size),
    {
      bar: {separator: '|'},
      template: [
        ':{indent}[:{label} :{fileName}] :{flipper}',
        ':{indent} [:{bar:complete}] [:3{percentage}%] [:{speed}] (:{eta})',
        ':{indent} [:{bar}] [:{size}]',
      ],
      clean: true,
      flipper: [...Array(10)].map((...[, i]) => `:{color}${'\u2022'.repeat(i + 1)}:{color:close}`),
      label: 'Downloading',
      variables: {
        fileName,
        size: (stack, _size, total) => ((total = stack.total), `${stack.size()}${total !== Infinity ? `/:{size:total}` : ''}`),
        indent: ' '.repeat(indent),
      },
    },
  );
}

function dl(fileName, url, indent) {
  const feed = xget(url, {timeout: 5000})
    .with('progressBar', urlMeta => genProgressBar(fileName, urlMeta, indent))
    .use('progressBar', (dataSlice, store) => store.get('progressBar').next(dataSlice.size))
    .on('end', () => feed.store.get('progressBar').end(`:{indent}\x1b[36m[\u2713]\x1b[0m Successfully Downloaded ${fileName}\n`))
    .on('retry', data => {
      const msg = `:{indent} \x1b[33m(i)\x1b[0m [${data.meta ? 'meta' : data.index}]{${data.retryCount}/${data.maxRetries}} [${
        data.lastErr.code
      }] (${data.lastErr}), retrying...`;
      if (data.store.has('progressBar')) data.store.get('progressBar').print(msg);
      else console.log(stringd(msg, {indent: ' '.repeat(indent)}));
    })
    .on('error', err => {
      const msg =
        'index' in err ? `:{indent}\x1b[31m[!]\x1b[0m An error occurred [${err && (err.message || err.stack)}]` : `${err}`;
      if (feed.store.has('progressBar')) feed.store.get('progressBar').print(msg);
      else console.log(stringd(msg, {indent: ' '.repeat(indent)}));
    });
  return feed;
}

function promisifyStream(stream, fn) {
  return new Promise((res, rej) => fn(stream, res, rej));
}

async function $do(entryMsg, indent, fn) {
  if (typeof indent === 'function') [fn, indent] = [indent, fn];
  indent = indent || 0;
  process.stdout.write(`${' '.repeat(indent)}\x1b[36m[•]\x1b[0m ${entryMsg}...`);
  const result = await fn();
  console.log('[\x1b[32mdone\x1b[0m]');
  return result;
}

async function init(pkgs, shouldCleanup) {
  const TEMPDIR = (_path => {
    while (!_path || fs.existsSync(_path)) _path = path.join(os.tmpdir(), `freyrsetup-${crypto.randomBytes(4).toString('hex')}`);
    return _path;
  })();

  const STAGEDIR = path.join(__dirname, 'interoper_pkgs');

  await $do('Creating temp dir', () => mkdir(TEMPDIR));
  if (!(await exists(STAGEDIR))) await $do('Creating package stage', () => mkdir(STAGEDIR));

  console.log(' ( tempdir ) =', TEMPDIR);
  console.log(' (  stage  ) =', STAGEDIR);

  console.log(`Packages`);
  await Object.entries(pkgs)
    .map(([name, opts]) => [name, {skip: 0, rootEntries: 0, ...opts}])
    .reduce(
      (former, [name, {url, skip, module, rootEntries}]) =>
        (async () => {
          await former;
          console.log(` • [${name}]`);
          const indent = 4;
          url = typeof url === 'function' ? await url(indent) : url;
          const rawFile = path.join(TEMPDIR, `raw@${name}`);
          await promisifyStream(dl(name, url, indent).pipe(fs.createWriteStream(rawFile)), (stream, res, rej) =>
            stream.on('error', rej).on('finish', res),
          );
          const moduleStage = path.join(STAGEDIR, module);
          if (await exists(moduleStage))
            await $do(`Resetting module stage for ${name}`, indent, () => rmdir(moduleStage, {recursive: true}));
          await $do(`Parsing and staging ${name}`, indent, async () => {
            const zip = fs.createReadStream(rawFile, {start: skip}).pipe(unzipper.Parse({forceStream: true}));
            // eslint-disable-next-line no-restricted-syntax
            for await (const entry of zip) {
              const {path: file, type} = entry;
              if (type !== 'Directory') {
                const pathStruct = file.split(path.sep).slice(rootEntries);
                if (pathStruct[0] === module) {
                  const outPath = path.join(STAGEDIR, ...pathStruct);
                  await mkdir(path.dirname(outPath), {recursive: true});
                  await promisifyStream(entry.pipe(fs.createWriteStream(outPath)), (stream, res, rej) =>
                    stream.on('error', rej).on('finish', res),
                  );
                  // eslint-disable-next-line no-continue
                  continue;
                }
              }
              entry.autodrain();
            }
          });
        })(),
      null,
    );

  if (shouldCleanup) await $do('Cleaning up', () => rmdir(TEMPDIR, {recursive: true}));
  else console.log('\x1b[33m[i]\x1b[0m Skipped tempdir cleanup');
}

const interoperPackages = {
  youtube_dl: {
    url: 'https://yt-dl.org/downloads/latest/youtube-dl',
    skip: 22, // skip first 22 bytes: env hashbang
    module: 'youtube_dl',
  },
  ytmusicapi: {
    url: async indent =>
      /* get the latest release url */
      (
        await $do('Querying latest version of ytmusicapi', indent, () =>
          axios.get('https://api.github.com/repos/sigma67/ytmusicapi/releases/latest'),
        )
      ).data.zipball_url,
    module: 'ytmusicapi',
    rootEntries: 1, // root entries to remove when unzipping
  },
};

function hasflags(args, ...flags) {
  return flags
    .map((flag, index) => ((index = args.indexOf(flag)) !== -1 && args.splice(index, 1), index))
    .some(index => index !== -1);
}

function main() {
  const args = process.argv.slice(2);
  const showHelp = hasflags(args, '-h', '--help');
  const shouldList = hasflags(args, '-l', '--list');
  const shouldCleanup = !hasflags(args, '-C', '--no-cleanup');

  if (showHelp) {
    console.log('freyr_setup_interop (c) 2020 Miraculous Owonubi');
    console.log('Setup inter-operational python dependencies for freyr-js');
    console.log();
    console.log('Usage: node setup.js [-h] [-l] [-C] [module...]');
    console.log();
    console.log(' Options');
    console.log('   -l, --list         print list of installable modules');
    console.log('   -C, --no-cleanup   skip cleaning up temporary files after working');
    console.log('   -h, --help         show help information');
    console.log('   module             optional name of module(s) to install');
    console.log();
    console.log(' Without any arguments, this sets up all installable modules');
    return;
  }

  const pkgEntries = Object.entries(interoperPackages);
  const pkgs = Object.fromEntries(pkgEntries.filter(([name]) => !args.length || args.includes(name)));

  if (shouldList) {
    pkgEntries.forEach(([name]) => console.log(`${name}${args.length && name in pkgs ? ' (*)' : ''}`));
    return;
  }

  init(pkgs, shouldCleanup).catch(err => console.log('An error occurred\n', err));
}

main();

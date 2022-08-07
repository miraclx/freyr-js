import fs from 'fs';
import {join} from 'path';
import {tmpdir} from 'os';
import {promisify} from 'util';

import tmp from 'tmp';
import mkdirp from 'mkdirp';
import esMain from 'es-main';

const removeCallbacks = [];

const open = promisify(fs.open);
const close = promisify(fs.close);
const exists = promisify(fs.exists);
const unlink = promisify(fs.unlink);

function garbageCollector() {
  while (removeCallbacks.length) removeCallbacks.shift()();
  process.removeListener('exit', garbageCollector);
}

let hookedUpListeners = false;
function hookupListeners() {
  if (!hookedUpListeners) {
    hookedUpListeners = true;
    process.addListener('exit', garbageCollector);
  }
}

export default async function genFile(opts) {
  opts = opts || {};
  if (opts.filename) {
    opts.tmpdir = opts.tmpdir || tmpdir();
    if (!(await exists(opts.tmpdir))) throw new Error('tmpdir does not exist');
    const dir = join(opts.tmpdir, opts.dirname || '.');
    await mkdirp(dir);
    const path = join(dir, opts.filename);
    const fd = await open(path, fs.constants.O_CREAT | opts.mode);
    hookupListeners();
    let closed = false;
    const garbageHandler = () => {
      if (closed) return;
      fs.closeSync(fd);
      closed = true;
      if (!opts.keep) fs.unlinkSync(path);
    };
    removeCallbacks.unshift(garbageHandler);
    return {
      fd,
      name: path,
      removeCallback: async () => {
        if (closed) return;
        await close(fd);
        closed = true;
        await unlink(path);
        removeCallbacks.splice(removeCallbacks.indexOf(garbageHandler), 1);
      },
    };
  }
  return new Promise((res, rej) =>
    tmp.file(opts, (err, name, fd, removeCallback) => (err ? rej(err) : res({fd, name, removeCallback}))),
  );
}

async function test() {
  const filename = 'freyr_mgr_temp_file';
  async function testMgr() {
    const file = await genFile({filename});
    console.log('mgr>', file);
    file.removeCallback();
  }
  async function testTmp() {
    const file = await genFile({name: filename});
    console.log('tmp>', file);
    file.removeCallback();
  }
  await testMgr();
  await testTmp();
}

if (esMain(import.meta)) test().catch(err => console.error('cli>', err));

import {join} from 'path';
import {tmpdir} from 'os';
import {promises as fs, constants as fs_constants} from 'fs';

import tmp from 'tmp';
import mkdirp from 'mkdirp';
import esMain from 'es-main';

const removeCallbacks = [];

function garbageCollector() {
  while (removeCallbacks.length) removeCallbacks.pop()();
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
    const dir = join(opts.tmpdir, opts.dirname || '.');
    await mkdirp(dir);
    const path = join(dir, opts.filename);
    const fd = await fs.open(path, fs_constants.O_CREAT | opts.mode);
    hookupListeners();
    let closed = false;
    const garbageHandler = async keep => {
      if (closed) return;
      await fd.close();
      closed = true;
      if (!keep) await fs.unlink(path);
    };
    removeCallbacks.push(garbageHandler.bind(opts.keep));
    return {
      fd,
      path,
      removeCallback: async () => {
        await garbageHandler(false);
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

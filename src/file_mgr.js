import {join, resolve, dirname} from 'path';
import {tmpdir} from 'os';
import {createHash} from 'crypto';
import {promises as fs, constants as fs_constants} from 'fs';

import mkdirp from 'mkdirp';
import esMain from 'es-main';

const openfiles = {};
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
  let mode = fs_constants.O_CREAT | opts.mode;
  const path = resolve(join('tmpdir' in opts ? opts['tmpdir'] : tmpdir(), opts.dirname || '.', opts.filename));
  let id = createHash('md5').update(`Ξ${mode}${path}`).digest('hex');
  let file = openfiles[id];
  if (!file) {
    await mkdirp(dirname(path));
    file = openfiles[id] = {
      path,
      handle: await fs.open(path, mode),
      refs: 1,
      closed: false,
      keep: false,
    };
  } else file.refs += 1;
  hookupListeners();
  const garbageHandler = async keep => {
    file.keep ||= keep !== undefined ? keep : opts.keep;
    if ((file.refs = Math.max(0, file.refs - 1))) return;
    if (file.closed) return;
    file.closed = true;
    delete openfiles[id];
    await file.handle.close();
    if (!file.keep) await fs.unlink(path);
  };
  removeCallbacks.push(garbageHandler);
  return {
    path,
    handle: file.handle,
    removeCallback: async () => {
      await garbageHandler(false);
      removeCallbacks.splice(removeCallbacks.indexOf(garbageHandler), 1);
    },
  };
}

async function test() {
  const filename = 'freyr_mgr_temp_file';
  async function testMgr(args) {
    const file = await genFile({filename, ...args});
    console.log('mgr>', file);
    return file;
  }
  let a = await testMgr();
  let b = await testMgr();
  await testMgr({keep: true});
  let d = await testMgr();
  a.removeCallback();
  b.removeCallback();
  // c.removeCallback(); // calling this would negate the keep directive
  d.removeCallback();
}

if (esMain(import.meta)) test().catch(err => console.error('cli>', err));

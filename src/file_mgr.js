import {join, resolve, dirname} from 'path';
import {tmpdir} from 'os';
import {createHash, randomBytes} from 'crypto';
import {promises as fs, constants as fs_constants} from 'fs';

import mkdirp from 'mkdirp';
import esMain from 'es-main';

import symbols from './symbols.js';

const openfiles = {};
const removeCallbacks = [];

function garbageCollector(args) {
  while (removeCallbacks.length) removeCallbacks.pop()(args);
}

let hookedUpListeners = false;
function hookupListeners() {
  if (!hookedUpListeners) {
    hookedUpListeners = true;
    let fn = () => (garbageCollector(), process.removeListener('exit', fn));
    process.addListener('exit', fn);
  }
}

export function forgetAll() {
  garbageCollector({forget: true});
}

export default function genFile(opts) {
  let inner = async mode => {
    if ('tmpdir' in opts && opts.path) throw new Error('Cannot specify path and tmpdir');
    opts = Object.assign({path: null, filename: null, dirname: null, tmpdir: true, keep: false}, opts);
    if (opts.path && (opts.filename || opts.dirname)) throw new Error('Cannot specify path and either filename or dirname');
    if (!(opts.path || opts.filename)) opts.filename = crypto.randomBytes(8).toString('hex');
    if (opts.tmpdir)
      if (opts.dirname) opts.dirname = join(tmpdir(), opts.dirname);
      else opts.dirname = tmpdir();
    if (!opts.path)
      if (opts.filename && opts.dirname) opts.path = join(opts.dirname, opts.filename);
      else throw new Error('Unable to determine file path');
    mode = fs_constants.O_CREAT | mode;
    const path = resolve(opts.path);
    let id = createHash('md5').update(`Ξ${mode}${path}`).digest('hex');
    let file = openfiles[id];
    if (!file) {
      await mkdirp(dirname(path));
      file = openfiles[id] = {path, handle: null, refs: 1, closed: true, keep: false, writer: null};
    } else file.refs += 1;
    if (file.closed) [file.closed, file.handle] = [false, await fs.open(path, mode)];
    hookupListeners();
    const garbageHandler = async ({keep, forget = false} = {}) => {
      file.keep ||= keep !== undefined ? keep : opts.keep;
      if ((file.refs = Math.max(0, file.refs - 1))) return;
      if (file.closed) return;
      let handle = file.handle;
      delete file.handle;
      file.closed = true;
      if (forget) delete openfiles[id];
      await handle.close();
      if (!file.keep) await fs.unlink(path);
    };
    removeCallbacks.push(garbageHandler);
    return {
      [symbols.fileId]: id,
      path,
      handle: file.handle,
      removeCallback: async args => {
        await garbageHandler({...args, keep: false});
        removeCallbacks.splice(removeCallbacks.indexOf(garbageHandler), 1);
      },
    };
  };
  let methods = {
    read: () => inner(fs_constants.O_RDONLY),
    /** File will be written to once, unless forcefully forgotten. */
    writeOnce: async writerGen => {
      let fileRef = await inner(fs_constants.O_WRONLY);
      let file = openfiles[fileRef[symbols.fileId]];
      await (file.writer ||= fileRef.writer = writerGen(fileRef));
      return fileRef;
    },
    open: inner,
    write: () => Promise.reject(new Error('not yet implemented')),
  };
  let used = false;
  return Object.fromEntries(
    Object.entries(methods).map(([name, fn]) => [
      name,
      async (...args) => {
        if (used) throw new Error(`A FileReference can only be used once`);
        used = true;
        return await fn(...args);
      },
    ]),
  );
}

async function test() {
  const filename = 'freyr_mgr_temp_file';
  async function testMgr(args) {
    const file = await genFile({filename, ...args}).read();
    console.log('mgr>', file);
    return file;
  }
  let a = await testMgr();
  let b = await testMgr();
  let _c = await testMgr({keep: true});
  let d = await testMgr();
  a.removeCallback();
  b.removeCallback();
  // _c.removeCallback(); // calling this would negate the keep directive
  d.removeCallback();
}

if (esMain(import.meta)) test().catch(err => console.error('cli>', err));

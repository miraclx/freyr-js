const {join} = require('path');
const {promisify} = require('util');
const {Transform} = require('stream');
const {randomBytes} = require('crypto');
const {EventEmitter} = require('events');
const {spawn, execFile} = require('child_process');

function getUniqOn(size, map, handler, uniq) {
  while (!uniq || map.has(uniq)) uniq = randomBytes(size).toString('hex');
  if (handler) handler(uniq);
  return uniq;
}

function JSONParser(stack) {
  return new Transform({
    readableObjectMode: true,
    write(chunk, _, callback, index) {
      stack.buffer = stack.buffer || Buffer.alloc(0);
      while ((index = chunk.indexOf('\n')) !== -1) {
        this.push(JSON.parse(Buffer.concat([stack.buffer, chunk.slice(0, index)]).toString()));
        [chunk, stack.buffer] = [chunk.slice(index + 1), Buffer.alloc(0)];
      }
      stack.buffer = Buffer.concat([stack.buffer, chunk]);
      callback();
    },
  });
}

class PythonInterop extends EventEmitter {
  static #interopErrorSymbol = Symbol('PyInterop Named Pipe');

  static getErrorSourceIndex(error) {
    return {recv: 1, send: 0}[error[this.#interopErrorSymbol]];
  }

  #core = {
    record: new Map(),
    exitSecret: randomBytes(10).toString('hex'),
    bufferStack: {},
    streams: {in: null, out: null},
  };

  #hasLaunched = false;

  constructor() {
    super();
    // find the first command whose python version is at least v3.8
    const pythonVersions = ['python', 'python3', 'python3.8', 'python3.9']
      .reduce((stack, cmd, prev) => {
        return stack.concat([
          (prev = stack.pop()),
          Promise.resolve(prev)
            .catch(() => {}) // silence previous run errors, but wait for completion
            .then(() =>
              promisify(execFile)(cmd, ['-c', 'import sys;print(list(sys.version_info)[:3])'])
                .then(({stdout}) => ({cmd, ver: JSON.parse(stdout)}))
                .catch(err => (err.code === 'ENOENT' ? null : Promise.reject(err))),
            ),
        ]);
      }, [])
      .slice(1); // prune the first undefined item
    Promise.all(pythonVersions)
      // eslint-disable-next-line consistent-return
      .then(cmds => {
        const best = cmds
          .filter(res => !!res && res.ver >= [3, 8, 0]) // at least python version 3.8.0
          .sort(({ver: a}, {ver: b}) => (a > b ? -1 : 0))
          .shift();
        if (!best) {
          const er = 'No compatible python interpreter found, please make sure python>=v3.8 is installed and in your path';
          return Promise.reject(new Error(er));
        }
        this.emit('interpreter', {...best});
        ([this.#core.streams.in, this.#core.streams.out] = [
          ...(this.#core.proc = spawn(best.cmd, [join(__dirname, 'main.py'), this.#core.exitSecret], {
            stdio: ['inherit', 'inherit', 'inherit', 'pipe', 'pipe'],
          })
            .on('spawn', () => ((this.#hasLaunched = true), this.emit('ready')))
            .on('exit', () => this.emit('exit'))).stdio,
        ].slice(3, 5))
          .map((pipe, index) =>
            pipe.on('error', err =>
              this.emit('error', ((err[PythonInterop.#interopErrorSymbol] = index ? 'send' : 'recv'), err)),
            ),
          )[0]
          .pipe(JSONParser(this.#core.bufferStack))
          .on('data', this.#dataHandler.bind(this));
      })
      .catch(err => this.emit('error', err));
  }

  #dataHandler = function dataHandler(data) {
    const {qID, payload} = {payload: null, ...data};
    this.#core.record.get(qID)(
      !data.error
        ? null
        : (error => {
            const err = new Error(`${error.type}: ${error.message}`);
            err.stack = [
              err.stack,
              ...['----- Python Traceback -----', ...error.traceback.split('\n')].map(line => `    ${line}`),
            ].join('\n');
            return err;
          })(data.error),
      JSON.parse(payload),
    );
  };

  #execHandler = function execHandler(path, data, handler) {
    data = {
      qID: getUniqOn(8, this.#core.record, id =>
        this.#core.record.set(id, (error, result) => {
          this.#core.record.delete(id);
          handler(error, result);
        }),
      ),
      payload: {path, data},
    };
    this.#write(data);
  };

  #write = data => {
    this.#hasLaunched
      ? this.#core.streams.out.write(`${JSON.stringify(data)}\n`)
      : this.on('ready', this.#write.bind(this, data));
  };

  exec(path, ...args) {
    return new Promise((res, rej, err) => {
      if (!this.#stillRunning()) err = new Error("PythonInterop: can't send message, peer has shut down");
      else if (this.#closeRequested) err = new Error("PythonInterop: can't send message, peer shutting down...");
      else return this.#execHandler(path, args, (_err, data) => (_err ? rej(_err) : res(data)));
      return rej(err);
    });
  }

  #closeRequested = false;

  get closeRequested() {
    return this.#closeRequested;
  }

  #close = () => {
    this.#closeRequested = true;
    this.#write({C4NCL0S3: this.#core.exitSecret});
    this.emit('closeRequested');
  };

  #stillRunning = () => !this.#hasLaunched || this.#core.proc.exitCode === null;

  #canClose = () => !this.#closeRequested && this.#stillRunning();

  close() {
    return new Promise(res => (this.#canClose() ? this.on('exit', res).#close() : res()));
  }
}

module.exports = PythonInterop;

async function main() {
  // eslint-disable-next-line global-require
  const deferrable = require('../deferrable');

  await deferrable(async defer => {
    const core = new PythonInterop();

    const closeCore = defer(() => core.close());

    const a = core.exec('math:add', 1, 2, 3);
    const b = core.exec('math:add', 1, 2, 4);
    console.log('1 + 2 + 3 =', await a);
    console.log('1 + 2 + 4 =', await b);

    const c = core.exec('math:factorial', 100);
    const d = core.exec('math:factorial', 100);
    console.log('100! =', BigInt(await c));
    console.log('100! =', BigInt(await d));

    console.time('e');
    const e = core.exec('utils:sleep', 4);
    console.time('f');
    const f = core.exec('utils:sleep', 4);
    await e;
    console.timeEnd('e');
    await f;
    console.timeEnd('f');

    console.log((await core.exec('utils:current_thread')).name);
    console.log((await core.exec('utils:current_thread')).name);
    console.log((await core.exec('utils:current_thread')).name);
    console.log((await core.exec('utils:current_thread')).name);

    console.log(await core.exec('youtube:lookup', 'cuxNuMDet0M'));

    console.log(await core.exec('ytmusic:search', 'Billie Eilish Therefore I Am'));

    await closeCore();
  });
}

if (require.main === module) main().catch(err => console.error('An error occurred\n', err));

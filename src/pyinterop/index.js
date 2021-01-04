const {join} = require('path');
const {spawn} = require('child_process');
const {Transform} = require('stream');
const {randomBytes} = require('crypto');

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

class PythonInterop {
  #core = {
    record: new Map(),
    exitSecret: randomBytes(10).toString('hex'),
    bufferStack: {},
    streams: {in: null, out: null},
  };

  constructor() {
    this.#core.proc = spawn('python', [join(__dirname, 'main.py'), this.#core.exitSecret], {
      stdio: ['inherit', 'inherit', 'inherit', 'pipe', 'pipe'],
    });
    [this.#core.streams.in, this.#core.streams.out] = [...this.#core.proc.stdio].slice(3);
    this.#core.streams.in.pipe(JSONParser(this.#core.bufferStack)).on('data', this.#dataHandler.bind(this));
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
    this.#core.streams.out.write(`${JSON.stringify(data)}\n`);
  };

  exec(path, ...args) {
    return new Promise((res, rej) => this.#execHandler(path, args, (err, data) => (err ? rej(err) : res(data))));
  }

  #closeRequested = false;

  #close = () => {
    this.#closeRequested = true;
    return this.#core.streams.out.write(`{"C4NCL0S3":"${this.#core.exitSecret}"}\n`);
  };

  #canClose = () => !this.#closeRequested && this.#core.proc.exitCode === null;

  close() {
    return this.#canClose() && this.#close();
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

    console.log(await core.exec('youtube:lookup', 'cuxNuMDet0M'));

    console.log(await core.exec('ytmusic:search', 'Billie Eilish Therefore I Am'));

    closeCore();
  });
}

if (require.main === module) main().catch(err => console.error('An error occurred\n', err));

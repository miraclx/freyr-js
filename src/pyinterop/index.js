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
  };

  constructor() {
    (this.#core.proc = spawn('python', [join(__dirname, 'main.py'), this.#core.exitSecret], {stdio: 'pipe'})).stdout
      .pipe(JSONParser(this.#core.bufferStack))
      .on('data', this.#dataHandler.bind(this));
  }

  #dataHandler = function dataHandler(data) {
    const {qID, payload} = data;
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
    this.#core.proc.stdin.write(`${JSON.stringify(data)}\n`);
  };

  exec(path, ...args) {
    return new Promise((res, rej) => this.#execHandler(path, args, (err, data) => (err ? rej(err) : res(data))));
  }

  #close = () => this.#core.proc.stdin.write(`{"C4NCL0S3":"${this.#core.exitSecret}"}\n`);

  close() {
    this.#close();
  }
}

async function main() {
  const core = new PythonInterop();

  const a = core.exec('add', 1, 2, 3);
  const b = core.exec('add', 1, 2, 4);
  console.log('1 + 2 + 3 =', await a);
  console.log('1 + 2 + 4 =', await b);

  const c = core.exec('factorial', 100);
  const d = core.exec('factorial', 100);
  console.log('100!', BigInt(await c));
  console.log('100!', BigInt(await d));

  console.log(await core.exec('youtube:lookup', 'cuxNuMDet0M'));

  core.close();
}

main().catch(err => console.error('An error occurred\n', err));

/* eslint-disable func-names, prefer-spread */
import async from 'async';

function insulate(items) {
  Promise.allSettled(Array.isArray(items) ? items : [items]);
  return items;
}

const IsProvisionedProxy = Symbol('IsProvisionedProxy');
const ResourceDropSignal = Symbol('ResourceDropSignal');

export default class AsyncQueue {
  static debugStack = Symbol('AsyncQueueStack');

  #store = {
    name: null,
    queue: null,
  };

  /**
   * Creates an async queue with a defined `concurrency`.
   * Tasks added to the `queue` are processed in parallel (up to the `concurrency` limit).
   * If all available `worker`s are in progress, tasks are queued until one becomes available.
   * Once a `worker` completes a `task`, its promise handle is fulfilled.
   * @param {string} [name] A string identifier for better error handling
   * @param {number} [concurrency=1] An integer for determining how many cuncurrent operations to execute in parallel
   * @param {(data, args) => void} worker An async function for processing a queued task (default: method executor)
   * @example
   * const q = new AsyncQueue("queue0", 3);
   *
   * q.push(() => Promise.delay(5000, 'a')).then(console.log);
   * q.push(() => Promise.delay(2000, 'b')).then(console.log);
   * q.push(() => Promise.delay(3000, 'c')).then(console.log);
   * q.push(() => Promise.delay(500, 'd')).then(console.log);
   *
   * // [?] Result
   * // b
   * // d
   * // c
   * // a
   */
  constructor(name, concurrency, worker) {
    if (typeof name === 'number') [name, concurrency] = [concurrency, name];
    if (typeof name === 'function') [name, worker] = [worker, name];
    if (typeof concurrency === 'function') [concurrency, worker] = [worker, concurrency];
    if (typeof concurrency === 'string') [concurrency, name] = [name, concurrency];
    if (name !== undefined && typeof name !== 'string') throw Error('the <name> parameter, if specified must be a `string`');
    if (concurrency !== undefined && typeof concurrency !== 'number')
      throw TypeError('the <concurrency> argument, if specified must be a `number`');
    if (worker !== undefined && typeof worker !== 'function')
      throw TypeError('the <worker> argument, if specified must be a `function`');
    this.#store.name = name || 'AsyncQueue';
    this.#store.worker = worker;
    this.#store.queue = async.queue(({data, args}, cb) => {
      (async () => (worker ? worker(data, ...args) : typeof data === 'function' ? data.apply(null, args) : data))()
        .then(res => cb(null, res))
        .catch(err => {
          err = Object(err);
          if (!err[AsyncQueue.debugStack])
            Object.defineProperty(err, AsyncQueue.debugStack, {
              value: [],
              configurable: false,
              writable: false,
              enumerable: true,
            });
          err[AsyncQueue.debugStack].push({queueName: this.#store.name, sourceTask: data, sourceArgs: args});
          cb(err);
        });
    }, concurrency || 1);
  }

  static provision(genFn, worker) {
    let resources = [];
    let fn = async (...args) => {
      let resource = resources.shift() || (await genFn());
      if (args[0] === ResourceDropSignal) return void (resources = []);
      try {
        return await worker(resource, ...args);
      } finally {
        resources.push(resource);
      }
    };
    fn[IsProvisionedProxy] = true;
    return fn;
  }

  #_register = (objects, meta, handler) => {
    const promises = (Array.isArray(objects) ? objects : [[objects, meta]]).map(objectBlocks => {
      const [data, args] = Array.isArray(objectBlocks) ? objectBlocks : [objectBlocks, meta];
      return insulate(
        this.#store.queue[handler]({
          data: insulate(data),
          args: insulate(args !== undefined ? (Array.isArray(args) ? args : [args]) : []),
        }),
      );
    });
    return Array.isArray(objects) ? promises : promises[0];
  };

  /**
   * Add a new `task` to the queue. Return a promise that fulfils on completion and rejects if an error occurs.
   * A second argument `meta` can define any additional data to be processed along with it.
   * The default worker, for example is a method executor, with this, the second argument can serve as an array of arguments.
   * The `objects` argument can be an array of tasks or an array of tasks and their arguments.
   * `q.push(task)`, `q.push(task, args)`, `q.push([task1, task2])`, `q.push([[task1, args], [task2, args]])`
   * @typedef {() => any} ExecFn
   * @param {ExecFn|ExecFn[]|Array<[ExecFn, any]>} objects
   * @param {any} meta
   * @returns {Promise<any>}
   * @example
   * const q = new AsyncQueue("queue1", 3);
   *
   * q.push([
   *   [(t, v) => Promise.delay(t, v), [2500, 1]],
   *   [(t, v) => Promise.delay(t, v), [1500, 2]],
   *   [(t, v) => Promise.delay(t, v), [2000, 3]],
   * ]).map(item => item.then(val => console.log('item>', val)));
   *
   * // [?] Result
   * // item> 2
   * // item> 3
   * // item> 1
   *
   * const q2 = new AsyncQueue("multiplier", 4, t => Promise.delay(2000, [t, t ** 2]));
   * q2.push([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]).map(item =>
   *   item.then(([val, srq]) => console.log(`${val}^2 = ${srq}`))
   * );
   *
   * // [?] Result
   * // 1^2 = 1
   * // 2^2 = 4
   * // 3^2 = 9
   * // 4^2 = 16
   * // 5^2 = 25
   * // 6^2 = 36
   * // 7^2 = 49
   * // 8^2 = 64
   * // 9^2 = 81
   * // 10^2 = 100
   */
  push(objects, meta) {
    return this.#_register(objects, meta, 'pushAsync');
  }

  /**
   * Like `this.push()` but adds a task to the front of the queue
   * @typedef {() => any} ExecFn
   * @param {ExecFn|ExecFn[]|Array<[ExecFn, any]>} objects
   * @param {any} meta
   * @returns {Promise<any>}
   */
  unshift(objects, meta) {
    return this.#_register(objects, meta, 'unshiftAsync');
  }

  /**
   * Pause the processing of tasks until `resume()` is called.
   */
  pause() {
    this.#store.queue.pause();
  }

  /**
   * Resume task processing when the queue is paused.
   */
  resume() {
    this.#store.queue.resume();
  }

  /**
   * Return the number of tasks waiting to be processed
   */
  length() {
    return this.#store.queue.length();
  }

  /**
   * Clear pending tasks and forces the queue to go idle.
   * The queue should not be pushed back to after this method call.
   */
  abort() {
    this.#store.queue.kill();
    if (this.#store.worker && this.#store.worker[IsProvisionedProxy]) this.#store.worker(ResourceDropSignal);
  }

  /**
   * Return the number of tasks currently being processed.
   */
  running() {
    return this.#store.queue.running();
  }

  /**
   * Get / Set the number of active workers.
   */
  get concurrency() {
    return this.#store.queue.concurrency;
  }

  set concurrency(concurrency) {
    this.#store.queue.concurrency = concurrency;
  }

  /**
   * Boolean for checking if the queue is paused.
   */
  get paused() {
    return this.#store.queue.paused;
  }

  /**
   * a boolean indicating whether or not any items have been pushed and processed by the queue.
   */
  get started() {
    return this.#store.queue.started();
  }

  /**
   * a boolean indicating whether or not items are waiting to be processed.
   */
  get idle() {
    return this.#store.queue.idle();
  }
}

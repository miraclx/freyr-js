/* eslint-disable func-names, prefer-spread */
const async = require('async');

const get = (store => self => {
  if (!store.has(self)) store.set(self, {});
  return store.get(self);
})(new WeakMap());

function insulate(items) {
  Promise.allSettled(Array.isArray(items) ? items : [items]);
  return items;
}

class AsyncQueue {
  static debugStack = (get(this).debugStack = Symbol('AsyncQueueStack'));

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
    get(this).name = name || 'AsyncQueue';
    get(this).queue = async.queue(({data, args}, cb) => {
      (async () =>
        worker
          ? worker(data, args)
          : typeof data === 'function'
          ? data.apply(null, args ? (Array.isArray(args) ? args : [args]) : [])
          : data)()
        .then(res => cb(null, res))
        .catch(err => {
          err = Object(err);
          if (!err[get(this.constructor).debugStack])
            Object.defineProperty(err, get(this.constructor).debugStack, {
              value: [],
              configurable: false,
              writable: false,
              enumerable: true,
            });
          err[get(this.constructor).debugStack].push({queueName: get(this).name, sourceTask: data});
          cb(err);
        });
    }, concurrency || 1);
  }

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
    const promises = (Array.isArray(objects) ? objects : [[objects, meta]]).map(objectBlocks => {
      const [data, args] = Array.isArray(objectBlocks) ? objectBlocks : [objectBlocks, []];
      return get(this).queue.pushAsync({data, args});
    });
    return Array.isArray(objects) ? promises : promises[0];
  }

  /**
   * Pause the processing of tasks until `resume()` is called.
   */
  pause() {
    get(this).queue.pause();
  }

  /**
   * Resume task processing when the queue is paused.
   */
  resume() {
    get(this).queue.resume();
  }

  /**
   * Return the number of tasks waiting to be processed
   */
  length() {
    get(this).queue.length();
  }

  /**
   * Clear pending tasks and forces the queue to go idle.
   * The queue should not be pushed back to after this method call.
   */
  abort() {
    get(this).queue.kill();
  }

  /**
   * Return the number of tasks currently being processed.
   */
  running() {
    return get(this).queue.running();
  }

  /**
   * Get / Set the number of active workers.
   */
  get concurrency() {
    return get(this).queue.concurrency;
  }

  set concurrency(concurrency) {
    get(this).queue.concurrency = concurrency;
  }

  /**
   * Boolean for checking if the queue is paused.
   */
  get paused() {
    return get(this).queue.paused;
  }

  /**
   * a boolean indicating whether or not any items have been pushed and processed by the queue.
   */
  get started() {
    return get(this).queue.started();
  }

  /**
   * a boolean indicating whether or not items are waiting to be processed.
   */
  get idle() {
    return get(this).queue.idle();
  }
}
module.exports = AsyncQueue;

/* eslint-disable no-underscore-dangle */
const fs = require('fs');
const tty = require('tty');
const util = require('util');

function isActivelyWritable(stream) {
  return (
    stream &&
    [stream.on, stream.once, stream.pipe, stream.write].every(slot => typeof slot === 'function') &&
    !(
      stream._writableState.ended ||
      stream._writableState.closed ||
      (typeof stream.destroyed === 'function' ? stream.destroyed() : stream.destroyed)
    )
  );
}

function getPersistentStream(store, prop = null, isTTY = false) {
  // if persistence is allowed and one active stream exists, return that
  // else, if stored stream is active, return that
  // else, if prop is active, return that
  // else, test stdout and stderr for activity
  // else, create forced tty. Store if persistence is allowed
  const devices = [
    [store.cache ? getPersistentStream.persist : null, true], // if you want persistence, forward any created device
    [store.output, store.isTTY],
    [prop, isTTY],
    [process.stdout, true],
    [process.stderr, true],
  ];
  let [device] =
    devices.find(
      ([output, shouldBeTTY]) =>
        output && isActivelyWritable(output) && (!shouldBeTTY || (output instanceof tty.WriteStream && output.isTTY)),
    ) || [];
  if (!device) {
    // create persistent tty if neither options are writable or valid TTYs
    device = new tty.WriteStream(fs.openSync('/dev/tty', 'w'));
    store.output = device;
    store.isTTY = true;
    if (store.cache) getPersistentStream.persist = device;
  }
  return device;
}

class StackLogger {
  #store = {
    output: null, // custom stream to write to. stdout, stderr or forced tty
    isTTY: null, // whether or not the specified custom stream should be an actual TTY
    cache: false, // whether or not to cache custom-created persisted tty, if any
    indent: 0, // indentation for this instance
    indentSize: 0, // indentation for next instance from ours
    indentor: ' ', // indentation character
    autoTick: false, // whether or not to auto tick printers
  };

  /**
   * Create stacking loggers by means of indentation
   * @param {{}} [opts] Options
   * @param {NodeJS.WritableStream} [opts.output] Optional output stream to write to.
   * @param {boolean} [opts.isTTY] Whether or not the output stream can be expected to be a TTY
   * @param {boolean} [opts.cache] Whether or not to cache custom-created TTYs.
   * @param {number} [opts.indent] Indentation from 0 for this instance.
   * @param {any} [opts.indentor] Indentation fill for indentation range.
   * @param {number} [opts.indentSize] Size for subsequent instances created from self.
   * @param {boolean} [opts.autoTick] Whether or not to auto tick printers.
   */
  constructor(opts) {
    opts = opts || {};
    this.#store.isTTY = opts.isTTY || false;
    this.#store.persist = opts.persist || false;
    this.#store.output = opts.output;
    this.#store.indent = opts.indent && typeof opts.indent === 'number' ? opts.indent : 0;
    this.#store.indentor = opts.indentor || ' ';
    this.#store.indentSize = opts.indentSize && typeof opts.indentSize === 'number' ? opts.indentSize : 2;
    this.#store.autoTick = typeof opts.autoTick === 'boolean' ? opts.autoTick : true;
  }

  /**
   * Get/Set the current instance's indentation
   * @param {number} [value] New indentation
   */
  indentation(val) {
    if (val && typeof val === 'number') this.#store.indent = val;
    return this.#store.indent;
  }

  /**
   * Get/Set the current instance's indentation
   * @param {any} [indentor] The new indentor
   */
  indentor(indentor) {
    if (indentor) this.#store.indentor = indentor;
    return this.#store.indentor;
  }

  /**
   * Get/Set the currently held indentSize
   * @param {number} [size] New indentSize
   */
  indentSize(size) {
    if (size && typeof size === 'number') this.#store.indentSize = size;
    return this.#store.indentSize;
  }

  /**
   * Opts to extend self with
   * @param {{}} [opts] Options
   * @param {NodeJS.WritableStream} [opts.isTTY] Optional output stream to write to.
   * @param {boolean} [opts.isTTY] Whether or not the output stream can be expected to be a TTY
   * @param {boolean} [opts.cache] Whether or not to cache custom-created TTYs.
   * @param {number} [opts.indent] Indentation from 0 for this instance.
   * @param {any} [opts.indentor] Indentation fill for indentation range.
   * @param {number} [opts.indentSize] Size for subsequent instances created from self.
   */
  extend(opts) {
    return new StackLogger({...this.#store, ...(typeof opts === 'object' ? opts : {})});
  }

  /**
   * Create a logger instance whose indentation is extended from the former
   * If `indent` is omitted, it will autoTick with `opts.indentSize`
   * If `indentSize` is omitted, it will not increment and use `this`
   * @param {number} [indent] Size to add to self's `indentation`
   * @param {number} [indentSize] Size to add to self's `indentSize`
   */
  tick(indent, indentSize) {
    return this.extend({
      indent: this.#store.indent + (typeof indent === 'number' ? indent : this.#store.indentSize),
      indentSize: this.#store.indentSize + (typeof indentSize === 'number' ? indent : 0),
    });
  }

  /**
   * Write messages. Optionally to the specified stream.
   * @param {any[]} content Messages to be written
   * @param {NodeJS.ReadableStream} [stream] Fallback stream to be written to
   * @param {boolean} [isTTY] Whether or not fallback stream is expected to be a TTY (default: `false`)
   */
  _write(content, stream, isTTY = false) {
    const out = getPersistentStream(this.#store, stream, isTTY);
    out.write(content);
  }

  /**
   * Write raw text to the output device
   * * Adds no indentation and no EOL
   * * Returns self without extending indentation
   * @param {...any} msgs Messages to write out
   */
  write(...msgs) {
    this._write(this.getText(0, msgs), process.stdout, true);
    return this;
  }

  /**
   * Write raw text to the output device
   * * Adds indentation but no EOL
   * * Returns a stacklogger with extended indentation if `opts.autoTick` else `this`
   * @param {...any} msgs Messages to write out
   */
  print(...msgs) {
    this._write(this.getText(this.#store.indent, msgs), process.stdout, true);
    return this.#store.autoTick ? this.tick(this.#store.indentSize) : this;
  }

  /**
   * Write primarily to stdout with an EOL
   * * Adds indentation and EOL
   * * Returns a stacklogger with extended indentation if `opts.autoTick` else `this`
   * @param {...any} msgs Messages to write out
   */
  log(...msgs) {
    this._write(this.getText(this.#store.indent, msgs).concat('\n'), process.stdout, true);
    return this.#store.autoTick ? this.tick(this.#store.indentSize) : this;
  }

  /**
   * Write primarily to stderr with an EOL
   * * Adds indentation and EOL
   * * Returns a stacklogger with extended indentation if `opts.autoTick` else `this`
   * @param {...any} msgs Messages to write out
   */
  error(...msgs) {
    this._write(this.getText(this.#store.indent, msgs).concat('\n'), process.stderr, true);
    return this.#store.autoTick ? this.tick(this.#store.indentSize) : this;
  }

  /**
   * Write primarily to stderr with an EOL
   * * Adds indentation and EOL
   * * Returns a stacklogger with extended indentation if `opts.autoTick` else `this`
   * @param {...any} msgs Messages to write out
   */
  warn(...msgs) {
    this._write(this.getText(this.#store.indent, msgs).concat('\n'), process.stderr, true);
    return this.#store.autoTick ? this.tick(this.#store.indentSize) : this;
  }

  /**
   * Generate formated text with proper indentation
   * @param {number} [indent] Proper indentation
   * @param {string|string[]} [msgs] Message(s) to be written
   */
  getText(indent, msgs) {
    if (typeof indent === 'object' && !Array.isArray(indent)) ({msgs, indent} = indent);
    if (Array.isArray(indent)) [msgs, indent] = [indent, msgs];
    if (typeof indent === 'string') [msgs, indent] = [[indent], msgs];
    indent = typeof indent !== 'number' ? this.#store.indent : indent;
    msgs = Array.isArray(msgs) ? msgs : [msgs];
    msgs = indent
      ? [this.#store.indentor.repeat(indent).concat(util.formatWithOptions({color: true}, msgs[0])), ...msgs.slice(1)]
      : msgs;
    return util.formatWithOptions({colors: true}, ...msgs);
  }
}

module.exports = StackLogger;

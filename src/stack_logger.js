/* eslint-disable no-underscore-dangle */
const fs = require('fs');
const tty = require('tty');
const util = require('util');

function getPersistentStdout() {
  const self = getPersistentStdout;
  self.stdout =
    self.stdout && self.stdout.isTTY
      ? self.stdout
      : process.stdout.isTTY
      ? process.stdout
      : process.stderr.isTTY
      ? process.stderr
      : new tty.WriteStream(fs.openSync('/dev/tty', 'w'));
  return self.stdout;
}

class StackLogger {
  constructor(opts) {
    opts = opts || {};
    this.__persistent = opts.persist ? (typeof opts.persist === 'boolean' ? getPersistentStdout() : opts.persist) : null;
    this.indent = opts.indent && typeof opts.indent === 'number' ? opts.indent : 0;
    this.indentor = opts.indentor || ' ';
    this.indentSize = opts.indentSize && typeof opts.indentSize === 'number' ? opts.indentSize : 2;
    this.was_print = opts.was_print;
  }

  getText(indent, msgs) {
    if (typeof indent === 'object' && !Array.isArray(indent)) ({msgs, indent} = indent);
    if (Array.isArray(indent)) [msgs, indent] = [indent, msgs];
    if (typeof indent === 'string') [msgs, indent] = [[indent], this.indent];
    if (!(typeof indent === 'number' && msgs)) throw new Error('Arg value parse error');
    msgs = indent ? [this.indentor.repeat(indent - 1), ...msgs] : msgs;
    return util.formatWithOptions({colors: true}, ...msgs);
  }

  __print(device, indent, msgs) {
    (this.__persistent || device).write(this.getText(msgs, indent));
  }

  _print(device, opts, msgs) {
    this.__print(device, typeof opts.indent !== 'number' ? this.indent : opts.indent, msgs);
    return new StackLogger({
      persist: this.__persistent,
      indent: this.indent + this.indentSize,
      indentor: this.indentor,
      indentSize: this.indentSize,
      ...opts,
    });
  }

  write(...msgs) {
    return this._print(process.stdout, {indent: 0}, msgs);
  }

  print(...msgs) {
    return this._print(process.stdout, {}, msgs);
  }

  log(...msgs) {
    return this._print(process.stdout, {}, [...msgs, '\n']);
  }

  error(...msgs) {
    return this._print(process.stderr, {}, [...msgs, '\n']);
  }

  warn(...msgs) {
    return this._print(process.stderr, {}, [...msgs, '\n']);
  }
}

module.exports = StackLogger;

(function main(params) {
  const logger = new StackLogger();
  logger.log('hey');
  logger.log('Yo');
  logger
    .log('10')
    .log(10)
    .log('yo');
  const x = logger.print('a');
  x.print('f');
  console.log('hey');
  const f = x.log('Whats up?');
  f.write('10')
    .write('name')
    .log();
  logger.print('Entering stage...');
  logger.log('done');
});

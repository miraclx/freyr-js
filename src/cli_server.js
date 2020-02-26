/* eslint-disable no-underscore-dangle */
const cors = require('cors');
const util = require('util');
const crypto = require('crypto');
const events = require('events');
const express = require('express');
const stringd = require('stringd');
const cookieParser = require('cookie-parser');

function wrapHTML(opts) {
  return stringd(
    Buffer.from(
      'PHN0eWxlPgogIC5ib3ggewogICAgYm9yZGVyOiBub25lOwogICAgYm94LXNoYWRvdzogMHB4IDBweCA2MHB4IDEwcHggZ3JleTsKICAgIGhlaWdodDogMjAwcHg7CiAgICB3aWR0aDogNDB2aDsKICAgIHBhZGRpbmc6IDEwcHg7CiAgICBiYWNrZ3JvdW5kLWNvbG9yOiByZ2JhKDk0LCA5MSwgMTIxLCAwLjgpOwogICAgYm9yZGVyLXJhZGl1czogMTRweDsKICAgIHRleHQtYWxpZ246IGNlbnRlcjsKICB9CgogIC5jZW50ZXItdiB7CiAgICBtYXJnaW46IDA7CiAgICBwb3NpdGlvbjogYWJzb2x1dGU7CiAgICB0b3A6IDQwJTsKICAgIGxlZnQ6IDUwJTsKICAgIHRyYW5zZm9ybTogdHJhbnNsYXRlKC01MCUsIC01MCUpOwogIH0KPC9zdHlsZT4KCjxkaXYgY2xhc3M9ImJveCBjZW50ZXItdiBjZW50ZXItaCI+CiAgPGgxPkZyZXlyQ0xJPC9oMT4KICA8aHIgd2lkdGg9IjQ1JSIgLz4KICA8Yj46e3NlcnZpY2V9PC9iPgogIDxociB3aWR0aD0iODAlIiAvPgogIDxoMyBzdHlsZT0iY29sb3I6Ontjb2xvcn07Ij46e21zZ308L2gzPgogIFlvdSBjYW4gY2xvc2UgdGhpcyB0YWIKPC9kaXY+',
      'base64',
    ).toString('ascii'),
    opts,
  );
}

class AuthServer extends events.EventEmitter {
  constructor(serviceName) {
    super();
    this._port = 36346;
    this.serviceName = serviceName;
    this.stateKey = 'auth_state';
    this.base_url = `http://localhost:${this._port}`;
    this.callback_route = '/callback';
    this.express_app = express()
      .use(cors())
      .use(cookieParser());
  }

  getRedirectURL() {
    return `${this.base_url}${this.callback_route}`;
  }

  async init(gFn) {
    this.express_app
      .get('/', (req, res) => {
        const state = crypto.randomBytes(8).toString('hex');
        res.cookie(this.stateKey, state);
        res.redirect(gFn(state));
      })
      .get(this.callback_route, (req, res) => {
        const code = req.query.code || null;
        const state = req.query.state || null;
        const storedState = req.cookies ? req.cookies[this.stateKey] : null;
        res.clearCookie(this.stateKey);
        if (code == null || state === null || state !== storedState)
          res.send(wrapHTML({service: this.serviceName, color: '#d0190c', msg: 'Authentication Failed'}));
        else res.send(wrapHTML({service: this.serviceName, color: '#1ae822;', msg: 'Successfully Authenticated'}));
        this.emit('code', code);
      });
    await util.promisify(this.express_app.listen.bind(this.express_app))(this._port);
    return this.base_url;
  }

  async getCode() {
    const [code] = await events.once(this, 'code');
    return code;
  }
}

module.exports = AuthServer;

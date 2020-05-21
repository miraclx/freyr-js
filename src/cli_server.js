/* eslint-disable no-underscore-dangle */
const crypto = require('crypto');
const events = require('events');

const cors = require('cors');
const express = require('express');
const stringd = require('stringd');
const cookieParser = require('cookie-parser');

function wrapHTML(opts) {
  return stringd(
    `<style>
    .box {
      border: none;
      box-shadow: 0px 0px 60px 10px grey;
      height: 200px;
      width: 40vh;
      padding: 10px;
      background-color: rgba(94, 91, 121, 0.8);
      border-radius: 14px;
      text-align: center;
    }
  
    .center-v {
      margin: 0;
      position: absolute;
      top: 40%;
      left: 50%;
      transform: translate(-50%, -50%);
    }
  </style>
  
  <div class="box center-v center-h">
    <h1>FreyrCLI</h1>
    <hr width="45%" />
    <b>:{service}</b>
    <hr width="80%" />
    <h3 style="color::{color};">:{msg}</h3>
    You can close this tab
  </div>`,
    opts,
  );
}

class AuthServer extends events.EventEmitter {
  constructor(opts) {
    super();
    this._port = opts.port || 36346;
    this._hostname = opts.hostname || 'localhost';
    this.serviceName = opts.serviceName;
    this.stateKey = 'auth_state';
    this.base_url = `http${opts.useHttps ? 's' : ''}://${this._hostname}:${this._port}`;
    this.callback_route = '/callback';
    this.express_app = express()
      .use(cors())
      .use(cookieParser());
  }

  getRedirectURL() {
    return `${this.base_url}${this.callback_route}`;
  }

  async init(gFn) {
    return new Promise(resolve => {
      const server = this.express_app
        .get('/', (_req, res) => {
          const state = crypto.randomBytes(8).toString('hex');
          res.cookie(this.stateKey, state);
          res.redirect(gFn(state));
        })
        .get(this.callback_route, (req, res) => {
          const code = req.query.code || null;
          const state = req.query.state || null;
          const storedState = req.cookies ? req.cookies[this.stateKey] : null;
          res.clearCookie(this.stateKey);
          if (code == null || state === null || state !== storedState) {
            res.end(wrapHTML({service: this.serviceName, color: '#d0190c', msg: 'Authentication Failed'}));
            return;
          }
          res.end(wrapHTML({service: this.serviceName, color: '#1ae822;', msg: 'Successfully Authenticated'}));
          server.close();
          this.emit('code', code);
        })
        .listen(this._port, this._hostname, () => resolve(this.base_url));
    });
  }

  async getCode() {
    const [code] = await events.once(this, 'code');
    return code;
  }
}

module.exports = AuthServer;

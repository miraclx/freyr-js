import crypto from 'crypto';
import events from 'events';

import cors from 'cors';
import express from 'express';
import stringd from 'stringd';
import cookieParser from 'cookie-parser';

function wrapHTML(opts) {
  return stringd(
    `<!DOCTYPE html>
    <html>
    <head>
      <title> FreyrCLI </title>
      <meta name="viewport" content="width=device-width, initial-scale=1.0">

      <style>
        body {
          color: #fff;
          font-family: "Open Sans", "Helvetica Neue", Helvetica, Arial, sans-serif;
        }

        h1 {
          margin: 0.8rem;
        }

        .box {
          box-shadow: 0px 0px 90px 10px #858181;
          width: 40vh;
          padding: 10px;
          background-image: linear-gradient(120deg, #155799, #159957);
          border-radius: 14px;
          text-align: center;
        }

        .center-v {
          margin: 0;
          position: absolute;
          top: 45%;
          left: 50%;
          transform: translate(-50%, -50%);
        }
      </style>
    </head>

    <body>
      <div class="box center-v">
        <h1>FreyrCLI</h1>
        <hr width="45%" />
        <b>:{service}</b>
        <hr width="80%" />
        <h3 style="color::{color};">:{msg}</h3>
        You can close this tab
      </div>
    </body>
    </html>`,
    opts,
  );
}

export default class AuthServer extends events.EventEmitter {
  #store = {
    port: null,
    hostname: null,
    serviceName: null,
    baseUrl: null,
    callbackRoute: null,
    express: null,
  };

  constructor(opts) {
    super();
    this.#store.port = opts.port || 36346;
    this.#store.hostname = opts.hostname || 'localhost';
    this.#store.serviceName = opts.serviceName;
    this.#store.stateKey = 'auth_state';
    this.#store.baseUrl = `http${opts.useHttps ? 's' : ''}://${this.#store.hostname}:${this.#store.port}`;
    this.#store.callbackRoute = '/callback';
    this.#store.express = express().use(cors()).use(cookieParser());
  }

  getRedirectURL() {
    return `${this.#store.baseUrl}${this.#store.callbackRoute}`;
  }

  async init(gFn) {
    return new Promise(resolve => {
      const server = this.#store.express
        .get('/', (_req, res) => {
          const state = crypto.randomBytes(8).toString('hex');
          res.cookie(this.#store.stateKey, state);
          res.redirect(gFn(state));
        })
        .get(this.#store.callbackRoute, (req, res) => {
          const code = req.query.code || null;
          const state = req.query.state || null;
          const storedState = req.cookies ? req.cookies[this.#store.stateKey] : null;
          res.clearCookie(this.#store.stateKey);
          if (code == null || state === null || state !== storedState) {
            res.end(wrapHTML({service: this.#store.serviceName, color: '#d0190c', msg: 'Authentication Failed'}));
            return;
          }
          res.end(wrapHTML({service: this.#store.serviceName, color: '#1ae822;', msg: 'Successfully Authenticated'}));
          server.close();
          this.emit('code', code);
        })
        .listen(this.#store.port, this.#store.hostname, () => resolve(this.#store.baseUrl));
    });
  }

  async getCode() {
    const [code] = await events.once(this, 'code');
    return code;
  }
}

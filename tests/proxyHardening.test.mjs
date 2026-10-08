import test from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import handler from '../api/proxy.js';

function mockResponse() {
  const headers = {};
  return {
    headers, statusCode: 200, payload: Buffer.alloc(0),
    setHeader(name, value) { headers[name.toLowerCase()] = value; },
    end(value) { this.payload = Buffer.from(value || ''); return this; },
  };
}
function request({ path = 'products', method = 'GET', headers = {}, body } = {}) {
  const req = Readable.from(body ? [Buffer.from(body)] : []);
  Object.assign(req, { method, headers: { host: 'myapp.vercel.app', ...headers }, query: { path }, url: `/api/proxy?path=${encodeURIComponent(path)}` });
  return req;
}

const withEnvironment = async (url, work) => {
  const prev = process.env.ZENIX_BACKEND_URL;
  if (url == null) delete process.env.ZENIX_BACKEND_URL;
  else process.env.ZENIX_BACKEND_URL = url;
  try { await work(); } finally {
    if (prev === undefined) delete process.env.ZENIX_BACKEND_URL;
    else process.env.ZENIX_BACKEND_URL = prev;
  }
};

test('proxy ignores untrusted forwarding headers and keeps cookies', async () => {
  await withEnvironment('https://pos.example.test', async () => {
    const previous = globalThis.fetch;
    let observed;
    globalThis.fetch = async (url, opts) => {
      observed = { url, opts };
      return new Response('{"ok":true}', { status: 200, headers: {'content-type':'application/json', 'set-cookie':'zenix_session=abc; HttpOnly; Secure'} });
    };
    try {
      const res = mockResponse();
      await handler(request({ path: 'auth/login', method: 'POST', headers: {
        'x-forwarded-for': '192.0.2.7', 'x-zenix-client': 'web', 'content-type': 'application/json',
      }, body: '{"username":"test"}' }), res);
      assert.equal(res.statusCode, 200);
      assert.equal(observed.url, 'https://pos.example.test/api/auth/login');
      assert.equal(observed.opts.headers.has('x-forwarded-for'), false, 'client must not spoof its origin IP');
      assert.equal(observed.opts.headers.get('x-forwarded-host'), 'myapp.vercel.app');
      assert.ok(observed.opts.signal instanceof AbortSignal, 'upstream must have a timeout');
      assert.match(String(res.headers['set-cookie']), /zenix_session=abc/);
      assert.equal(observed.opts.body.toString(), '{"username":"test"}');
    } finally { globalThis.fetch = previous; }
  });
});

test('proxy rejects unsafe or invalid backend configuration without calling fetch', async () => {
  const original = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => { calls++; throw new Error('should not call fetch'); };
  try {
    for (const url of ['', 'https://user:pass@pos.example.test', 'https://pos.example.test/foo', 'ftp://pos.example.test', 'http://pos.example.test']) {
      await withEnvironment(url, async () => {
        const res = mockResponse();
        await handler(request(), res);
        assert.equal(res.statusCode, 503, url);
      });
    }
    assert.equal(calls, 0);
  } finally { globalThis.fetch = original; }
});

test('proxy rejects path traversal and encoded separators', async () => {
  await withEnvironment('https://pos.example.test', async () => {
    const original = globalThis.fetch;
    let calls = 0;
    globalThis.fetch = async () => { calls++; return new Response('oops'); };
    try {
      for (const path of ['../admin', 'products/%2e%2e/other', 'products%2fadmin', 'products?authorization=evil']) {
        const res = mockResponse();
        await handler(request({ path }), res);
        assert.equal(res.statusCode, 400, path);
      }
      assert.equal(calls, 0);
    } finally { globalThis.fetch = original; }
  });
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {previewBackendOrigin} from '../api/proxy.js';
import {previewBuildDefines} from '../vite.config.js';
test('preview never falls back to production API; explicit staging target must differ',()=>{
 assert.equal(previewBackendOrigin({VERCEL_ENV:'preview',ZENIX_BACKEND_URL:'https://prod.example'}),null);
 assert.equal(previewBackendOrigin({VERCEL_ENV:'preview',ZENIX_BACKEND_URL:'https://prod.example',ZENIX_STAGING_BACKEND_URL:'https://prod.example/'}),null);
 assert.equal(previewBackendOrigin({VERCEL_ENV:'preview',ZENIX_BACKEND_URL:'https://prod.example',ZENIX_STAGING_BACKEND_URL:'https://stage.example'}),'https://stage.example');
 assert.equal(previewBackendOrigin({VERCEL_ENV:'production',ZENIX_BACKEND_URL:'https://prod.example'}),'https://prod.example');
 assert.equal(previewBackendOrigin({ZENIX_BACKEND_URL:'http://127.0.0.1:4400'}),'http://127.0.0.1:4400');
});
test('preview browser cannot bypass proxy through an inherited production VITE_API_URL',()=>{
 assert.deepEqual(previewBuildDefines({VERCEL_ENV:'preview',VITE_API_URL:'https://prod.example'}),{'import.meta.env.VITE_API_URL':'""'});
 assert.deepEqual(previewBuildDefines({VERCEL_ENV:'production'}),{});
});

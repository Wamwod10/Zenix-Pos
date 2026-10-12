import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../src/services/apiClient.js', import.meta.url), 'utf8')
  .replace('import { createRequestCoordinator } from "./requestCoordinator";', 'const createRequestCoordinator=()=>({});')
  .replace('import.meta.env.VITE_API_URL', '""');
const { apiRequest } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);

test('registration errors explain the next step without trusting arbitrary server messages', async () => {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async () => new Response(JSON.stringify({ok:false,error:{code:'DUPLICATE',message:'Bu kirish nomi allaqachon mavjud'}}), {status:409});
    await assert.rejects(apiRequest('/api/auth/register',{method:'POST',body:{}}), error => error.code==='USERNAME_EXISTS' && /Boshqa kirish nomi/.test(error.message));
    for (const [code, status, expected] of [
      ['TRIAL_ALREADY_USED', 409, /Pullik tarif/],
      ['USERNAME_EXISTS', 409, /Boshqa kirish nomi/],
      ['REGISTRATION_RATE_LIMITED', 429, /Birozdan keyin/],
      ['OTP_REQUIRED', 400, /SMS/],
      ['SMS_UNAVAILABLE', 503, /SMS xizmati/],
      ['UNRECOGNIZED', 503, /Serverda vaqtinchalik/],
    ]) {
      globalThis.fetch = async () => new Response(JSON.stringify({ok:false,error:{code,message:'internal-secret'}}), {status});
      await assert.rejects(apiRequest('/api/auth/register', {method:'POST',body:{}}), error => {
        assert.equal(error.code, code);
        assert.equal(error.status, status);
        assert.match(error.message, expected);
        assert.doesNotMatch(error.message, /internal-secret/);
        return true;
      });
    }
  } finally { globalThis.fetch = originalFetch; }
});

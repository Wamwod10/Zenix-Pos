import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
test('dashboard top products retain the actual unit',async()=>{
  const s=await readFile(new URL('../src/pages/dashboard/Dashboard.jsx',import.meta.url),'utf8');
  assert.doesNotMatch(s,/\{item\.qty\} dona/);
  assert.match(s,/unit:item\.unit/);
});
test('Telegram setting saves are serialized and errors remain visible',async()=>{
  const s=await readFile(new URL('../src/pages/settings/Settings.jsx',import.meta.url),'utf8');
  const change=s.slice(s.indexOf('const changeTelegramSetting='),s.indexOf('const testTelegram='));
  assert.match(change,/setTelegramBusy\(true\)/);
  assert.match(change,/finally\{setTelegramBusy\(false\);telegramSavePending.current=false\}/);
  assert.match(change,/settings:\{\[key\]:value\}/);
});

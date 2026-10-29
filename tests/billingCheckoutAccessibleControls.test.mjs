import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

test('Billing checkout icon controls have contextual accessible names',()=>{
 const source=readFileSync(new URL('../src/pages/billing/Billing.jsx',import.meta.url),'utf8');
 const expected=[
  'aria-label="Orqaga" title="Orqaga" onClick={back}',
  'aria-label="Qo‘shimcha filiallar sonini kamaytirish"',
  'aria-label="Qo‘shimcha filiallar sonini oshirish"',
  'aria-label={copied==="card"?"Karta raqami nusxalandi":"Karta raqamini nusxalash"}',
  'aria-label={copied==="amount"?"To‘lov summasi nusxalandi":"To‘lov summasini nusxalash"}',
 ];
 for(const label of expected)assert.ok(source.includes(label),`Missing checkout label: ${label}`);
 assert.ok(source.includes('type="button" aria-label={copied==="card"'), 'card copy must not accidentally submit a form');
 assert.ok(source.includes('type="button" aria-label={copied==="amount"'), 'amount copy must not accidentally submit a form');
});

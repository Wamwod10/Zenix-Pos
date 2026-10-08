import test from 'node:test';
import assert from 'node:assert/strict';
import { extractDocxTextFromXml, parseDocxTableRowsFromXml } from '../src/services/documentImportService.js';

const cell=value=>`<w:tc><w:p><w:r><w:t>${value}</w:t></w:r></w:p></w:tc>`;
const row=(...values)=>`<w:tr>${values.map(cell).join('')}</w:tr>`;

test('DOCX table keeps product, quantity and purchase price in the same row',()=>{
 const xml=`<w:document><w:body><w:p><w:r><w:t>Ta'minotchi: ABC</w:t></w:r></w:p><w:tbl>${row('Mahsulot','Miqdor','Tannarx')}${row('Coca-Cola 1L','24','8500')}${row('Fanta 1L','12','8300')}</w:tbl></w:body></w:document>`;
 const text=extractDocxTextFromXml(xml);
 assert.match(text,/Coca-Cola 1L 24 8500/);
 assert.match(text,/Fanta 1L 12 8300/);
 const result={rows:parseDocxTableRowsFromXml(xml)};
 assert.equal(result.rows.length,2);
 assert.deepEqual(result.rows.map(x=>x.qty),['24','12']);
 assert.deepEqual(result.rows.map(x=>x.costPrice),['8500','8300']);
 assert.ok(result.rows.every(row=>row.confidence==='review'&&row.missing.includes('DOCX jadvalini tekshiring')));
});

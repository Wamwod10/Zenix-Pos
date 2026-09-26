import test from 'node:test';
import assert from 'node:assert/strict';
import { parseLooseDocumentText } from '../src/services/documentImportService.js';

test('loose inventory text extracts document metadata conservatively',()=>{
  const parsed=parseLooseDocumentText(`
Ta'minotchi: ABC Distribution
Nakladnoy №458
Coca-Cola 1L 24 dona x 8 500
Fanta 1L 12 dona x 8 300
Jami: 303 600
To'langan: 200 000
Qarz: 103 600
  `);
  assert.equal(parsed.meta.supplier,'ABC Distribution');
  assert.equal(parsed.meta.invoiceNo,'458');
  assert.equal(parsed.meta.total,303600);
  assert.equal(parsed.meta.paid,200000);
  assert.equal(parsed.meta.debt,103600);
  assert.equal(parsed.rows.length,2);
  assert.equal(parsed.rows[0].name,'Coca-Cola 1L');
  assert.equal(parsed.rows[0].qty,'24');
  assert.equal(parsed.rows[0].costPrice,'8500');
});

test('loose inventory text never invents stock rows without explicit quantity',()=>{
  const parsed=parseLooseDocumentText(`Mahsulotlar: Coca-Cola, Fanta, Snickers. Jami 500 000 so'm.`);
  assert.equal(parsed.rows.length,0);
});

test('structured JSON import maps common product fields without inventing quantities',async()=>{
  const { parseStructuredJsonText, detectImportKind }=await import('../src/services/documentImportService.js');
  assert.equal(detectImportKind({name:'kirim.json',type:'application/json'}),'structured');
  assert.equal(detectImportKind({name:'kirim.tsv',type:'text/tab-separated-values'}),'spreadsheet');
  const parsed=parseStructuredJsonText(JSON.stringify({
    supplier:{name:'ABC Distribution'},invoiceNo:'INV-458',date:'2026-09-24',total:303600,paid:200000,debt:103600,
    items:[
      {name:'Coca-Cola 1L',quantity:24,costPrice:8500,sellPrice:12000,barcode:'4780012345678'},
      {name:'Fanta 1L',costPrice:8300},
    ],
  }));
  assert.equal(parsed.rows.length,1);
  assert.equal(parsed.rows[0].name,'Coca-Cola 1L');
  assert.equal(parsed.rows[0].qty,'24');
  assert.equal(parsed.rows[0].costPrice,'8500');
  assert.equal(parsed.rows[0].sellPrice,'12000');
  assert.equal(parsed.meta.supplier,'ABC Distribution');
  assert.equal(parsed.meta.invoiceNo,'INV-458');
  assert.equal(parsed.meta.total,303600);
  assert.equal(parsed.meta.paid,200000);
  assert.equal(parsed.meta.debt,103600);
});

test('unknown and oversized files are accepted safely for later server analysis',async()=>{
  const { analyzeImportFile, MAX_LOCAL_IMPORT_BYTES }=await import('../src/services/documentImportService.js');
  const unknown={name:'ombor.bin',type:'application/octet-stream',size:128};
  const unknownResult=await analyzeImportFile(unknown);
  assert.equal(unknownResult.status,'server_required');
  const huge={name:'katta.pdf',type:'application/pdf',size:MAX_LOCAL_IMPORT_BYTES+1};
  const hugeResult=await analyzeImportFile(huge);
  assert.equal(hugeResult.status,'server_required');
  assert.match(hugeResult.message,/Hajmi katta/);
});

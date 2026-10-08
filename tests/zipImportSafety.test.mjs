import test from 'node:test';
import assert from 'node:assert/strict';
import { createXlsxBytes } from '../src/utils/simpleXlsx.js';
import { parseXlsxArrayBuffer, unzipArchive, MAX_ZIP_ENTRY_BYTES } from '../src/utils/spreadsheetImport.js';

const asBuffer=bytes=>bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength);
const valid=()=>createXlsxBytes('Mahsulotlar',['Nomi','Miqdor','Tannarx'],[['Cola',24,8500]]);
const centralOffset=(bytes)=>{
 for(let i=bytes.length-22;i>=0;i--){if(bytes[i]===0x50&&bytes[i+1]===0x4b&&bytes[i+2]===0x05&&bytes[i+3]===0x06)
   return new DataView(bytes.buffer,bytes.byteOffset,bytes.length).getUint32(i+16,true)}
 throw new Error('EOCD missing');
};

test('ordinary spreadsheet still parses after ZIP limits',async()=>{
 const parsed=await parseXlsxArrayBuffer(asBuffer(valid()));
 assert.equal(parsed.rows.length,1);
 assert.equal(parsed.sheetName,'Mahsulotlar');
});

test('rejects ZIP bomb advertised uncompressed sizes before decompression',async()=>{
 const bytes=valid();
 new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength).setUint32(centralOffset(bytes)+24,MAX_ZIP_ENTRY_BYTES+1,true);
 await assert.rejects(unzipArchive(asBuffer(bytes)),/hajmi xavfsiz/);
});

test('rejects malformed ZIP central offsets and lengths',async()=>{
 const bytes=valid();
 const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
 const pos=centralOffset(bytes);
 view.setUint32(pos+42,0xffffff00,true);
 await assert.rejects(unzipArchive(asBuffer(bytes)),/chegara/);
});

test('rejects encrypted ZIPs instead of parsing undecrypted bytes',async()=>{
 const bytes=valid();
 const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
 view.setUint16(centralOffset(bytes)+8,1,true);
 await assert.rejects(unzipArchive(asBuffer(bytes)),/Parol/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {launchPosPro} from '../src/utils/launchPosPro.js';
import {validateSerialChoice} from '../src/pages/posPro/serialSelection.js';
import {displayUnit,formatStock,formatQuantity,formatDiscount} from '../src/pages/posPro/presentation.js';
import {createHidScanner} from '../src/pages/posPro/hardware.js';
test('display discount never prefixes zero with a minus and preserves positive money',()=>{
 for(const value of [0,-0,.001])assert.equal(formatDiscount(value),'0 so‘m');
 assert.equal(formatDiscount(1250),'−1 250 so‘m');
});
test('HID cadence uses event creation time, not delayed JavaScript dispatch time',()=>{
 const scans=[],scanner=createHidScanner(code=>scans.push(code));let stamp=100;
 for(const key of [...'12345678','Enter'])scanner.key({key,timeStamp:stamp+=180});
 assert.deepEqual(scans,[],'queued slow typing must not become a scanner burst');
 for(const key of [...'12345678','Enter'])scanner.key({key,timeStamp:stamp+=8});
 assert.deepEqual(scans,['12345678']);
});
test('presentation preserves product units and branch stock without inventing conversions',()=>{
 for(const [input,expected]of [['kilogramm','kg'],['litr','l'],['gramm','g'],['ml','ml'],['dona','dona'],['quti','quti']])assert.equal(displayUnit(input),expected);
 assert.equal(displayUnit(''),'birlik');assert.equal(formatQuantity(.75),'0.75');assert.equal(formatStock(1000,'g'),'1 000 g mavjud');assert.equal(formatStock(.75,'kg'),'0.75 kg mavjud');assert.equal(formatStock(12,'dona'),'12 dona mavjud');assert.equal(formatStock(0,'l'),'Qoldiq tugagan');assert.equal(formatStock(undefined,'kg'),'Qoldiq tekshirilmagan');
});
test('POS window launch uses a named user-gesture window, severs opener and safely falls back',()=>{
 const navigations=[],calls=[],popup={opener:{},location:{pathname:'blank',replace(path){calls.push(['replace',path]);this.pathname=path}},focus(){calls.push('focus')}};
 const host={screen:{availWidth:1920,availHeight:1080},open(...args){calls.push(args);return popup}};
 assert.equal(launchPosPro(path=>navigations.push(path),host),'window');assert.equal(popup.opener,null);assert.equal(calls[0][0],'');assert.equal(calls[0][1],'zenix-pos-pro');assert.match(calls[0][2],/width=1920/);assert.deepEqual(navigations,[]);
 launchPosPro(path=>navigations.push(path),host);assert.equal(calls.filter(call=>call[0]==='replace').length,1,'existing cashier must not reload');
 for(const open of [()=>null,()=>{throw Error('denied')}])assert.equal(launchPosPro(path=>navigations.push(path),{open}),'same-tab');assert.deepEqual(navigations,['/pos-pro','/pos-pro']);
});
test('serialized checkout requires the physical unit, never auto-picks the first serial',()=>{
 const line={id:'p',name:'Scanner',quantity:2,cartQty:1,serializedUnits:[{id:'a',serial:'S1',storeId:'branch'},{id:'b',serial:'S2',storeId:'branch'}]};
 assert.throws(()=>validateSerialChoice(line,'branch'),/Serial/);
 assert.doesNotThrow(()=>validateSerialChoice({...line,tracking:{serials:[{id:'b'}]}},'branch'));
 assert.throws(()=>validateSerialChoice({...line,tracking:{serials:[{id:'missing'}]}},'branch'),/Serial/);
 assert.throws(()=>validateSerialChoice({...line,cartQty:.5,tracking:{serials:[{id:'a'}]}},'branch'),/Serial/);
 assert.doesNotThrow(()=>validateSerialChoice({id:'apple',cartQty:.75,quantity:1},'branch'));
});

test('receipt print frame cleans up after print and reports printer failures',async()=>{
 const {printReceipt}=await import('../src/pages/posPro/receiptFormat.js');
 const originalDocument=globalThis.document;
 const sale={id:'test-sale',createdAt:'2026-10-30T00:00:00Z',total:12000,items:[]};
 try{
  for(const failPrint of [false,true]){
   let afterprint,prints=0,removes=0,error=null,created;
   const frame={
    style:{},remove(){removes++},
    contentWindow:{
     addEventListener(event,handler){if(event==='afterprint')afterprint=handler},
     focus(){},
     print(){prints++;if(failPrint)throw Error('Printer blocked')}
    }
   };
   globalThis.document={createElement(tag){assert.equal(tag,'iframe');created=frame;return frame},body:{append(node){assert.equal(node,frame)}}};
   printReceipt(sale,{width:'80'},err=>{error=err});
   assert.equal(created,frame);
   assert.ok(frame.srcdoc.includes('test-sale'));
   frame.onload();
   assert.equal(prints,1);
   if(!failPrint){assert.equal(error,null);afterprint()}else assert.match(error.message,/Printer blocked/);
   assert.equal(removes,1);
  }
 }finally{globalThis.document=originalDocument}
});

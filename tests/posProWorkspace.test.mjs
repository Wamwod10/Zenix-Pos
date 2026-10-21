import test from 'node:test';
import assert from 'node:assert/strict';
import {launchPosPro} from '../src/utils/launchPosPro.js';
import {validateSerialChoice} from '../src/pages/posPro/serialSelection.js';
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

import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {posPrimaryPaymentMethod} from '../src/pages/posPro/posLayout.js';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('configured primary payment is used only when enabled',()=>{
 assert.equal(posPrimaryPaymentMethod({cash:true,card:true},true,'card'),'card');
 assert.equal(posPrimaryPaymentMethod({cash:true,card:false},true,'card'),'cash');
 assert.equal(posPrimaryPaymentMethod({cash:false,card:false,transfer:false,split:false,credit:true},false,'credit'),null);
 assert.equal(posPrimaryPaymentMethod({cash:true},true,'invalid'),'cash');
});
test('only fresh locally acknowledged receipt can trigger configured automatic printing',()=>{
 const pos=read('src/pages/posPro/PosPro.jsx'),session=read('src/pages/posPro/useProSession.js');
 assert.match(session,/finish\(result\.sale,packet,!result\.reconciled\)/);
 assert.match(session,/const finish=\(sale,packet,fresh=false\)/);
 assert.match(session,/setFreshReceipt\(fresh\?sale:null\)/);
 assert.match(pos,/lastSale\.current===sale/);
 assert.match(pos,/session\.freshReceipt===sale&&settings\.pos\.autoPrintReceipt===true/);
 assert.match(pos,/autoPrintError=\{autoPrintError\}/);
});
test('system theme reacts to OS changes, and zero warning minutes is preserved',()=>{
 const appearance=read('src/utils/useWorkspaceAppearance.js'),settings=read('src/pages/settings/Settings.jsx');
 assert.match(appearance,/addEventListener\?\.\("change",applyTheme\)/);
 assert.match(appearance,/removeEventListener\?\.\("change",applyTheme\)/);
 assert.match(settings,/warnBeforeCloseMinutes\?\?30/);
});

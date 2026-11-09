import test from 'node:test';
import assert from 'node:assert/strict';
import {trialOverview,onboardingSteps,profitEvidenceComplete} from '../src/pages/dashboard/posGettingStarted.js';

const ownerPermissions=new Set(['moduleSettings','moduleProducts','moduleSales','moduleDashboard','moduleBilling']);
const can=key=>ownerPermissions.has(key);
const store={id:'b1111111-1111-4111-8111-111111111111',name:'Asosiy filial',active:true};
const business={id:'org-test',address:'',trialEndsAt:'2026-11-20T12:00:00.000Z',accessMode:'READ_WRITE',serverClockOffset:0};

test('trial presentation uses authenticated server expiry/accessMode and never grants trial access',()=>{
 assert.deepEqual(trialOverview(business,Date.parse('2026-11-09T12:00:00Z')),{days:11,active:true,expiresAt:business.trialEndsAt});
 assert.deepEqual(trialOverview({...business,accessMode:'READ_ONLY'},Date.parse('2026-11-09T12:00:00Z')).active,false);
 assert.deepEqual(trialOverview(business,Date.parse('2026-11-21T12:00:00Z')).days,0);
 assert.equal(trialOverview({...business,trialEndsAt:null,settings:{trialEndsAt:null}}),null);
 assert.equal(trialOverview({...business,trialEndsAt:'invalid'}),null);
 assert.equal(trialOverview({...business,serverClockOffset:86400000},Date.parse('2026-11-09T12:00:00Z')).days,10);
});

test('new account defaults never falsely mark auto-created store and unloaded catalog complete',()=>{
 const steps=onboardingSteps({organization:business,stores:[store],catalogComplete:false,products:[],salesVisible:true,can});
 assert.deepEqual(steps.map(s=>s.complete),[false,null,false,false]);
 assert.deepEqual(steps.map(s=>s.path),['/settings','/products','/sales','/']);
 assert.equal(steps.length,4);
});

test('real authenticated business data confirms configured store, product, sale and displayed daily report',()=>{
 const steps=onboardingSteps({organization:{...business,address:'Toshkent shahri'},stores:[store],
  catalogComplete:true,products:[{id:'stock-1',archived:false}],salesHistory:[{id:'sale-1'}],
  salesVisible:true,reportViewed:true,can});
 assert.ok(steps.every(s=>s.complete===true));
 assert.ok(steps.every(s=>s.enabled===true));
});
test('scope and permissions do not turn hidden business records into false completion',()=>{
 const steps=onboardingSteps({organization:business,stores:[store],catalogComplete:true,
   products:[{id:'archived-only',archived:true}],salesHistory:[{id:'inaccessible'}],
   salesVisible:false,can:()=>false});
 assert.deepEqual(steps.map(s=>s.complete),[null,null,null,false]);
 assert.ok(steps.every(s=>s.enabled===false));
});

test('profit with missing or zero original unit cost is not confidently displayed',()=>{
 assert.equal(profitEvidenceComplete([]),true);
 assert.equal(profitEvidenceComplete([{items:[{quantity:'2',unitCost:'13000.00'}]}]),true);
 assert.equal(profitEvidenceComplete([{items:[{quantity:'2',unitCost:0}]}]),false);
 assert.equal(profitEvidenceComplete([{items:[{quantity:'2'}]}]),false);
 assert.equal(profitEvidenceComplete([{items:[{quantity:'0',unitCost:null}]}]),true);
});

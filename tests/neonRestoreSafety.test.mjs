import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareIsolatedRestore,verifyIsolatedRestore} from '../scripts/neonRestoreSafety.mjs';

const production={id:'br-prod',name:'production',project_id:'project-id',primary:true,default:true,protected:true};
const endpoint={id:'ep-live',host:'ep-live.neon.tech',branch_id:'br-prod',type:'read_write'};
const snapshot={id:'snap-auto',source_branch_id:'br-prod',manual:false};
const branches=[production,{id:'br-old',name:'old-staging',parent_id:'br-prod'}];
const name='zenix-snapshot-restore-audit-20261030';
const productionSnapshotSchedule=[{frequency:'daily',hour:21,retention_seconds:604800}];
const plan=()=>prepareIsolatedRestore({snapshot,production,branches,endpoint,name,maxRootBranches:3,productionSnapshotSchedule});
const restored={id:'br-restored',name,primary:false,default:false,protected:false,
  restored_from:'snap-auto',restore_status:'restored'};

test('requires explicit finalize false for NEW restore branch, never points at production',()=>{
 const result=plan();
 assert.deepEqual(result.restoreArguments,{
   project_id:'project-id',snapshot_id:'snap-auto',name,finalize:false
 });
 assert.ok(!Object.hasOwn(result.restoreArguments,'target_branch_id'));
 assert.equal(result.before.productionEndpointId,'ep-live');
 assert.equal(verifyIsolatedRestore({
   before:result.before,production,defaultBranch:production,endpoint,restored,productionSnapshotSchedule,
 }).safe,true);
});

test('rejects the exact 2026-10-30 incident: implicit promotion or endpoint swap',()=>{
 const before=plan().before;
 for(const changed of [
   {defaultBranch:{...restored,default:true}},
   {endpoint:{...endpoint,branch_id:'br-restored'}},
   {production:{...production,default:false,primary:false}},
   {restored:{...restored,name:'production',default:true,primary:true,restore_status:'finalized'}},
   {endpoint:{...endpoint,id:'ep-new',host:'ep-new.neon.tech'}},
   {restored:{...restored,restore_status:'finalized'}},
   {productionSnapshotSchedule:[]},
 ]) {
   assert.throws(()=>verifyIsolatedRestore({
     before,production,defaultBranch:production,endpoint,restored,productionSnapshotSchedule,...changed,
   }),/INCIDENT|Production|production|endpoint|unfinalized/);
 }
});

test('fails closed for full quota, wrong source and manual or reused snapshots',()=>{
 assert.throws(()=>prepareIsolatedRestore({
   snapshot,production,branches:[production,{id:'br-other'}],endpoint,name,maxRootBranches:2,productionSnapshotSchedule,
 }),/Root branch limit/);
 assert.throws(()=>prepareIsolatedRestore({
   snapshot:{...snapshot,source_branch_id:'br-other'},production,branches,endpoint,name,maxRootBranches:3,productionSnapshotSchedule,
 }),/Snapshot source/);
 assert.throws(()=>prepareIsolatedRestore({
   snapshot:{...snapshot,manual:true},production,branches,endpoint,name,maxRootBranches:3,productionSnapshotSchedule,
 }),/scheduled snapshot/);
 assert.throws(()=>prepareIsolatedRestore({
   snapshot,production,branches,endpoint:{...endpoint,branch_id:'br-other'},name,maxRootBranches:3,productionSnapshotSchedule,
 }),/endpoint provenance/);
 assert.throws(()=>prepareIsolatedRestore({
   snapshot,production,branches,endpoint,name:'production',maxRootBranches:3,productionSnapshotSchedule,
 }),/restore branch name/);
});

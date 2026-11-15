import test from 'node:test';
import assert from 'node:assert/strict';
import {fetchSessionBootstrap} from '../src/utils/authSessionBootstrap.js';

test('anonymous page bootstrap succeeds without unauthorized browser network logs',async()=>{
 const paths=[];
 const data=await fetchSessionBootstrap(async path=>{
   paths.push(path);
   assert.equal(path,'/api/auth/session');
   return {user:null};
 });
 assert.deepEqual(data,{user:null});
 assert.deepEqual(paths,['/api/auth/session']);
});

test('active session returns authenticated user without touching other endpoints',async()=>{
 const calls=[];
 const data=await fetchSessionBootstrap(async(path)=>{
   calls.push(path);
   return {user:{id:'user-1',organizationId:'org-1',appRole:'OWNER'}};
 });
 assert.equal(data.user.id,'user-1');
 assert.deepEqual(calls,['/api/auth/session']);
});

test('older backends support a strict 404-only fallback to protected /me',async()=>{
 const paths=[];
 const data=await fetchSessionBootstrap(async path=>{
   paths.push(path);
   if(path==='/api/auth/session')throw Object.assign(new Error('not found'),{status:404});
   return {user:{id:'legacy-user'}};
 });
 assert.equal(data.user.id,'legacy-user');
 assert.deepEqual(paths,['/api/auth/session','/api/auth/me']);
});

test('expired/revoked session remains 401 and must not be bypassed',async()=>{
 const paths=[];
 await assert.rejects(fetchSessionBootstrap(async path=>{
   paths.push(path);
   throw Object.assign(new Error('Unauthorized'),{status:401});
 }),{status:401});
 assert.deepEqual(paths,['/api/auth/session']);
});

test('server errors, blocked users and aborts fail closed without retrying auth',async()=>{
 for(const status of [403,429,500]){
   const paths=[];
   await assert.rejects(fetchSessionBootstrap(async path=>{
     paths.push(path);
     throw Object.assign(new Error('denied'),{status});
   }),{status});
   assert.deepEqual(paths,['/api/auth/session']);
 }
 const controller=new AbortController();
 const received=[];
 await fetchSessionBootstrap(async(path,options)=>{
   received.push({path,signal:options.signal});
   return {user:null};
 },{signal:controller.signal});
 assert.equal(received[0].signal,controller.signal);
 await assert.rejects(fetchSessionBootstrap(null),/HTTP GET implementation required/);
});

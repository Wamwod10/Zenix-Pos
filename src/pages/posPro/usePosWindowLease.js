import {useEffect,useState} from 'react';
// Lifetime browser lock protects the shared draft; financial Web Locks/idempotency
// remain in the existing checkout service. Never force another cashier tab out.
export default function usePosWindowLease(identity){
 const [state,setState]=useState('waiting'),[attempt,setAttempt]=useState(0);
 useEffect(()=>{
  let disposed=false,release;
  setState('waiting');
  if(!navigator.locks?.request){setState('unsupported');return}
  navigator.locks.request(`zenix:pos-pro-editor:${identity}`,{ifAvailable:true},async lock=>{
   if(disposed)return;
   if(!lock){setState('blocked');return}
   await new Promise(resolve=>{release=resolve;setState('owned')});
  }).catch(()=>{if(!disposed)setState('unsupported')});
  return()=>{disposed=true;release?.()};
 },[identity,attempt]);
 return {state,retry:()=>setAttempt(n=>n+1)};
}

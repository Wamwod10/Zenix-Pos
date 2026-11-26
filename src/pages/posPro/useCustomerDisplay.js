import {useEffect,useRef,useState} from 'react';
import {customerDisplaySnapshot,openCustomerDisplay} from './customerDisplay.js';
export default function useCustomerDisplay(input){
 const handle=useRef(null),latest=useRef(input);latest.current=input;
 const [state,setState]=useState({open:false,error:''});
 const close=()=>{try{handle.current?.close()}catch{}handle.current=null;setState({open:false,error:''})};
 const open=()=>{
  try{
   if(handle.current&&!handle.current.closed()){handle.current.focus();return}
   handle.current=openCustomerDisplay();
   handle.current.update(customerDisplaySnapshot(latest.current));
   setState({open:true,error:''});
  }catch(error){try{handle.current?.close()}catch{}handle.current=null;setState({open:false,error:error.message||'Mijoz ekranini ochib bo‘lmadi'})}
 };
 useEffect(()=>{
  if(!handle.current)return;
  try{if(!handle.current.update(customerDisplaySnapshot(input)))close()}
  catch{close()}
 },[input.business,input.branch,input.cart,input.cartPct,input.confirmedSale]);
 useEffect(()=>{
  const timer=setInterval(()=>{try{if(handle.current?.closed())close()}catch{close()}},1000);
  const dispose=()=>{try{handle.current?.close()}catch{}handle.current=null};
  window.addEventListener('pagehide',dispose);
  return()=>{clearInterval(timer);window.removeEventListener('pagehide',dispose);dispose()};
 },[]);
 return {...state,openDisplay:open,closeDisplay:close};
}

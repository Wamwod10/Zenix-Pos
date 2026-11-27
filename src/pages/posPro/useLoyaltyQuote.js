import {useEffect,useState} from 'react';
import {api} from '../../services/apiClient';
import {validateRedemptionQuote} from './loyaltyPayment';
export async function getLoyaltyQuote({storeId,customerId,total,points=0},signal){
 const {quote}=await api.get('/api/sales/loyalty-quote?'+new URLSearchParams({storeId,customerId,total,points}),{signal});
 return validateRedemptionQuote(quote,total,points);
}
export function useLoyaltyQuote({enabled,storeId,customerId,total}){
 const [points,setPoints]=useState(''),[state,setState]=useState(null);
 const n=Number(points||0),valid=Number.isSafeInteger(n)&&n>=0&&n<=999999999999;
 const key=JSON.stringify([enabled,storeId,customerId,total,n]);
 useEffect(()=>{
  if(!enabled||!valid)return;
  let active=true;const abort=new AbortController();
  const timer=setTimeout(()=>getLoyaltyQuote({storeId,customerId,total,points:n},abort.signal).then(quote=>{if(active)setState({key,quote})}).catch(e=>{if(active)setState({key,error:e.message})}),150);
  return()=>{active=false;clearTimeout(timer);abort.abort()};
 },[key,valid]);
 const current=state?.key===key?state:null,quote=enabled?current?.quote:null;
 return {points,setPoints,quote,ready:!enabled||n===0||Boolean(quote),error:enabled?valid?current?.error:'Butun bonus ballarini kiriting.':'',redemption:quote&&n>0?{points:n,amount:quote.amount}:null};
}

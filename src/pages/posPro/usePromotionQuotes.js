import {useEffect,useMemo,useState} from 'react';
import {lineAmount,sumMoney} from '../../utils/posMoney.js';
import {api} from '../../services/apiClient';
import {promotionItems,applyPromotionQuotes} from './promotionQuotes';
export async function quoteCart(cart,cartPct,storeId,signal){
 const items=promotionItems(cart,cartPct);
 if(!items.length)return cart;
 const data=await api.post('/api/sales/promotion-quotes',{storeId,items},{signal});
 return applyPromotionQuotes(cart,cartPct,data.quotes);
}
export function usePromotionQuotes(cart,cartPct,storeId,enabled){
 const [state,setState]=useState(null),[retry,setRetry]=useState(0);
 const key=useMemo(()=>enabled?JSON.stringify(promotionItems(cart,cartPct).map(p=>[p.productId,p.quantity,cart.find(x=>x.id===p.productId)?.sellPrice])):'',[cart,cartPct,enabled]);
 const needed=enabled&&key!=='[]';
 useEffect(()=>{
  if(!needed)return;
  const abort=new AbortController();let alive=true;
  const timer=setTimeout(()=>quoteCart(cart,cartPct,storeId,abort.signal).then(lines=>{if(alive)setState({key,retry,quotes:lines.filter(p=>p.promotionQuote).map(p=>({productId:p.id,...p.promotionQuote,net:p.promotionNet,gross:lineAmount(p.cartQty,p.sellPrice),discount:sumMoney([lineAmount(p.cartQty,p.sellPrice),-p.promotionNet])}))})}).catch(e=>{if(alive)setState({key,retry,error:e.message||'Aksiya hisobi yuklanmadi'})}),120);
  return()=>{alive=false;clearTimeout(timer);abort.abort()};
 },[key,needed,storeId,retry]);
 const current=state?.key===key&&state?.retry===retry?state:null;
 const lines=useMemo(()=>needed&&current?.quotes?applyPromotionQuotes(cart,cartPct,current.quotes):cart,[cart,cartPct,needed,current]);
 return {lines,ready:!needed||Boolean(current?.quotes),error:needed?current?.error:'',refresh:()=>setRetry(x=>x+1)};
}

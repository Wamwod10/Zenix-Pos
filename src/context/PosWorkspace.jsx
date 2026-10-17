import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {useAuth} from './AuthContext';
import {StoreContext,useStore,productFromApi} from './StoreContext';
import {api} from '../services/apiClient';
import {createPosCatalog} from '../utils/posCatalog';
import {posDraftKey,readPosDraft} from '../utils/posDraft';
import {PageSkeleton} from '../components/Ui';

export default function PosWorkspace({children}){
 const base=useStore(),{currentUser}=useAuth();
 // Start route code while the bounded catalog request is still in flight.
 useEffect(()=>{void import('../pages/sales/Sales').catch(()=>{})},[]);
 // Do not remount the cashier when another module completes a full snapshot.
 const [remote]=useState(()=>!base.catalogComplete);
 if(!remote)return children;
 const scope=JSON.stringify([currentUser?.organizationId,currentUser?.id,currentUser?.appRole,currentUser?.permissionOverrides,base.currentStoreId]);
 return <RemotePos key={scope} base={base} user={currentUser}>{children}</RemotePos>;
}
function RemotePos({base,user,children}){
 const [view,setView]=useState({products:[],results:[],categories:[],hasMore:false}),[ready,setReady]=useState(false),[error,setError]=useState(''),[pending,setPending]=useState(false),[attempt,setAttempt]=useState(0);
 const active=useRef(true),queryGeneration=useRef(0),epoch=useRef(base.catalogEpoch),catalogRef=useRef(null);
 const [catalog,setCatalog]=useState(null);
 const store=base.currentStoreId;
 const request=useCallback(query=>api.get(`/api/bootstrap/catalog?${new URLSearchParams({storeId:store,...query})}`,{signal:AbortSignal.timeout(15000)}),[store]);
 useEffect(()=>{
  const controller=createPosCatalog({request,normalize:row=>{
   const stock=row.stockByStore||row.stock_by_store;
   if(!stock||!Object.hasOwn(stock,store)||stock[store]===null||!Number.isFinite(Number(stock[store])))throw Error('Mahsulot qoldig‘i hali tekshirilmagan');
   const p=productFromApi(row,[store]);return {...p,quantity:Number(stock[store]),stock:Number(stock[store])};
  },onChange:setView});
  catalogRef.current=controller;setCatalog(controller);let current=true;
  active.current=true;setReady(false);setError('');
  const saved=readPosDraft(window.localStorage,posDraftKey(user.organizationId,user.id,store));
  const ids=(saved?.cart||[]).map(p=>String(p.id));controller.pin(ids);
  Promise.all([controller.search({}),controller.resolve(ids)]).then(()=>{if(current)setReady(true)},e=>{if(current)setError(e?.message||'Katalog bilan aloqa yo‘q. Savat saqlangan.')});
  return()=>{current=false;active.current=false;controller.dispose()};
 },[request,attempt,user.organizationId,user.id,store]);
 const search=useCallback(async(query={},append=false)=>{
  const generation=++queryGeneration.current;setPending(true);setError('');
  try{return await catalog?.search(query,append)}catch(e){if(active.current&&catalogRef.current===catalog&&generation===queryGeneration.current)setError(e?.message||'Qidiruv bajarilmadi');return null}
  finally{if(active.current&&generation===queryGeneration.current)setPending(false)}
 },[catalog]);
 const invalidateSearch=useCallback(()=>{queryGeneration.current++;catalog?.cancelSearch();setPending(true)},[catalog]);
 useEffect(()=>{
  if(epoch.current===base.catalogEpoch||!ready||!catalog)return;epoch.current=base.catalogEpoch;
  // A core refresh (including another tab's mutation) rechecks cached detail.
  const ids=catalog.snapshot().products.map(p=>p.id);
  (async()=>{for(let i=0;i<ids.length;i+=100)await catalog.resolve(ids.slice(i,i+100))})().catch(e=>{if(active.current)setError(e?.message||'Qoldiqni yangilab bo‘lmadi')});
 },[base.catalogEpoch,catalog,ready]);
 const byId=useMemo(()=>new Map(view.products.map(p=>[String(p.id),p])),[view.products]);
 const resolveProducts=useCallback(ids=>catalog.resolve(ids),[catalog]);
 const resolveBarcode=useCallback(code=>catalog.barcode(code),[catalog]);
 const getProduct=useCallback((id,storeId)=>{
  if(storeId!==store)throw Error('Catalog branch changed');
  const product=byId.get(String(id));if(!product)throw Error('Mahsulot qoldig‘i hali tekshirilmagan');return product;
 },[byId,store]);
 const remoteCatalog=useMemo(()=>({results:view.results,categories:view.categories,hasMore:view.hasMore,pending,error,search,invalidateSearch,resolveProducts,resolveBarcode,pin:catalog?.pin}),[view,pending,error,search,invalidateSearch,resolveProducts,resolveBarcode,catalog]);
 const value=useMemo(()=>({...base,catalogComplete:false,inventory:view.products,inventoryState:view.products,remoteCatalog,getStoreProduct:getProduct,getStoreStock:(id,storeId)=>getProduct(id,storeId).quantity}),[base,view.products,remoteCatalog,getProduct]);
 if(!ready)return error?<div className="pro-empty" role="alert"><strong>{error}</strong><span>Savat qurilmada saqlangan.</span><button className="pro-btn primary" onClick={()=>setAttempt(x=>x+1)}>Qayta urinish</button></div>:<PageSkeleton/>;
 return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

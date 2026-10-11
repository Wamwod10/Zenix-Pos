import {useEffect,useRef,useState} from "react";
import {PremiumSelect} from "./Ui";
import Modal from "./Modal";
import {api} from "../services/apiClient";

export default function WarehouseSelector({state,canEdit=false,onChange}){
  const {warehouses,selectedId,setSelectedId,storeId,scope,reload,loading,error}=state;
  const [dialog,setDialog]=useState(null);
  const [name,setName]=useState("");
  const [busy,setBusy]=useState(false);
  const [saveError,setSaveError]=useState("");
  const currentScope=useRef(scope);currentScope.current=scope;
  const mutation=useRef(null);
  useEffect(()=>{mutation.current?.abort();setDialog(null);setName("");setBusy(false);setSaveError("");return()=>mutation.current?.abort()},[scope]);
  useEffect(()=>{onChange?.(selectedId)},[selectedId,onChange]);
  const selected=warehouses.find(row=>row.id===selectedId);
  const open=mode=>{setDialog(mode);setName(mode==="rename"?selected?.name||"":"");setSaveError("")};
  const save=async()=>{
    if(!canEdit||!storeId||name.trim().length<2||busy)return;
    const targetScope=scope;const controller=new AbortController();mutation.current=controller;
    setBusy(true);setSaveError("");
    try{
      if(dialog==="rename")await api.patch(`/api/warehouses/${encodeURIComponent(selectedId)}`,{name:name.trim()},{signal:controller.signal});
      else await api.post("/api/warehouses",{storeId,name:name.trim()},{signal:controller.signal});
      if(controller.signal.aborted||currentScope.current!==targetScope)return;
      setDialog(null);setName("");await reload();
    }catch(failure){if(!controller.signal.aborted&&currentScope.current===targetScope)setSaveError(failure.message||"Ombor saqlanmadi")}
    finally{if(!controller.signal.aborted&&currentScope.current===targetScope)setBusy(false)}
  };
  return <div className="warehouse-selector">
    <div className="pro-toolbar"><label className="pro-field"><span>Ombor</span><PremiumSelect aria-label="Ombor" value={selectedId} disabled={loading||!warehouses.length} onChange={event=>setSelectedId(event.target.value)}>{!warehouses.length&&<option value="">{loading?"Yuklanmoqda...":"Ombor mavjud emas"}</option>}{warehouses.map(row=><option key={row.id} value={row.id}>{row.name}</option>)}</PremiumSelect></label>{canEdit&&<><button className="pro-btn secondary" disabled={!storeId||loading} onClick={()=>open("create")}>Ombor qo‘shish</button><button className="pro-btn secondary" disabled={!selected||loading} onClick={()=>open("rename")}>Nomini o‘zgartirish</button></>}</div>
    {error&&<div className="pro-alert danger" role="alert">{error}<button className="pro-btn secondary" onClick={reload}>Qayta urinish</button></div>}
    <Modal open={Boolean(dialog)} onClose={()=>!busy&&setDialog(null)} title={dialog==="rename"?"Ombor nomini o‘zgartirish":"Ombor qo‘shish"} size="sm" footer={<><button className="pro-btn secondary" disabled={busy} onClick={()=>setDialog(null)}>Bekor qilish</button><button className="pro-btn primary" disabled={busy||name.trim().length<2} onClick={save}>{busy?"Saqlanmoqda...":"Saqlash"}</button></>}><label className="pro-field"><span>Ombor nomi</span><input data-modal-autofocus maxLength={120} value={name} onChange={event=>setName(event.target.value)}/></label>{saveError&&<div className="pro-alert danger" role="alert">{saveError}</div>}</Modal>
  </div>;
}

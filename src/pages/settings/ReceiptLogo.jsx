import {useEffect,useRef,useState} from "react";
import {prepareThermalLogo,thermalLogoSource} from "../../utils/thermalLogo";
export default function ReceiptLogo({value,onChange,disabled}){
 const active=useRef(true),revision=useRef(0);
 const [busy,setBusy]=useState(false),[error,setError]=useState("");
 useEffect(()=>{active.current=true;return()=>{active.current=false;revision.current+=1}},[]);
 const upload=async event=>{
  const file=event.target.files?.[0];event.target.value="";
  if(!file||disabled)return;
  const request=++revision.current;setBusy(true);setError("");
  try{const data=await prepareThermalLogo(file);if(active.current&&revision.current===request)onChange(data)}
  catch(e){if(active.current&&revision.current===request)setError(e.message)}
  finally{if(active.current&&revision.current===request)setBusy(false)}
 };
 const logo=thermalLogoSource(value);
 return <div className="pro-field"><span>Korxona logotipi</span>{logo&&<img src={logo} alt="Termal chek logotipi" style={{display:"block",maxWidth:192,maxHeight:96,background:"#fff",borderRadius:6,padding:4}}/>}<input type="file" accept="image/png,image/jpeg,image/webp" aria-label="Chek logotipini tanlash" disabled={disabled||busy} onChange={upload}/><small>2 MB gacha. Rasm termal printer uchun kichik qora-oq PNG ga aylantiriladi.</small>{busy&&<small role="status">Logotip tayyorlanmoqda...</small>}{error&&<small role="alert">{error}</small>}{logo&&<button type="button" className="pro-btn secondary" disabled={disabled||busy} onClick={()=>onChange("")}>Logotipni olib tashlash</button>}</div>;
}

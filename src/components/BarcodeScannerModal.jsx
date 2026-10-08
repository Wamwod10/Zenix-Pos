import { useEffect, useRef, useState } from "react";
import { FiCamera, FiCheckCircle, FiEdit3, FiRefreshCw } from "react-icons/fi";
import Modal from "./Modal";

const FORMATS=["ean_13","ean_8","upc_a","upc_e","code_128","code_39","codabar","itf","qr_code"];

export default function BarcodeScannerModal({open,onClose,onDetected,title="Shtrix-kodni skanerlash"}){
  const videoRef=useRef(null);const streamRef=useRef(null);const frameRef=useRef(null);const detectorRef=useRef(null);const lastRef=useRef({value:"",at:0});
  const [status,setStatus]=useState("idle");const [message,setMessage]=useState("");const [manual,setManual]=useState("");
  const stop=()=>{if(frameRef.current)cancelAnimationFrame(frameRef.current);frameRef.current=null;(streamRef.current?.getTracks?.()||[]).forEach(track=>track.stop());streamRef.current=null;if(videoRef.current)videoRef.current.srcObject=null};
  const accept=(value)=>{const code=String(value||"").trim();if(!code)return;const now=Date.now();if(lastRef.current.value===code&&now-lastRef.current.at<1500)return;lastRef.current={value:code,at:now};setStatus("success");setMessage(`Shtrix-kod o‘qildi: ${code}`);onDetected?.(code);stop();};
  useEffect(()=>{if(!open){stop();return undefined}let cancelled=false;setManual("");setMessage("");setStatus("starting");
    const start=async()=>{try{
      if(!navigator.mediaDevices?.getUserMedia){setStatus("manual");setMessage("Bu qurilmada kamera API mavjud emas. Shtrix-kodni qo‘lda kiriting yoki USB skanerdan foydalaning.");return}
      if(!("BarcodeDetector" in window)){setStatus("manual");setMessage("Bu brauzer kamera orqali barcode aniqlashni qo‘llamaydi. Chrome/Android yoki USB skanerdan foydalaning.");return}
      const supported=await window.BarcodeDetector.getSupportedFormats?.().catch(()=>[])||[];const formats=FORMATS.filter(item=>!supported.length||supported.includes(item));detectorRef.current=new window.BarcodeDetector(formats.length?{formats}:undefined);
      const stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:"environment"},width:{ideal:1280},height:{ideal:720}},audio:false});if(cancelled){stream.getTracks().forEach(track=>track.stop());return}streamRef.current=stream;videoRef.current.srcObject=stream;await videoRef.current.play();setStatus("scanning");setMessage("Kodni ramka ichiga olib keling.");
      let detectFailures=0;
      const scan=async()=>{if(cancelled||!videoRef.current||!detectorRef.current)return;try{const results=await detectorRef.current.detect(videoRef.current);detectFailures=0;if(results?.[0]?.rawValue){accept(results[0].rawValue);return}}catch{detectFailures+=1;if(detectFailures>=3){setStatus("manual");setMessage("Kamera dekoderi ishlamadi. Kodni qo‘lda kiriting yoki USB/Bluetooth skanerdan foydalaning.");stop();return}}frameRef.current=requestAnimationFrame(scan)};frameRef.current=requestAnimationFrame(scan);
    }catch(error){setStatus("manual");setMessage(error?.name==="NotAllowedError"?"Kameraga ruxsat berilmadi. Brauzer sozlamasidan kamera ruxsatini yoqing yoki kodni qo‘lda kiriting.":"Kamerani ishga tushirib bo‘lmadi. Kodni qo‘lda kiriting yoki USB skanerdan foydalaning.");stop()}};start();return()=>{cancelled=true;stop()};
  },[open]);
  return <Modal open={open} onClose={()=>{stop();onClose?.()}} title={title} subtitle="Kamera, USB/Bluetooth skaner yoki qo‘lda kiritish orqali ishlaydi." size="sm">
    <div className="barcode-scanner"><div className={`barcode-camera ${status}`}><video ref={videoRef} playsInline muted/><div className="barcode-frame"><i/><i/><i/><i/></div>{status==="starting"&&<div className="barcode-camera-state"><FiRefreshCw className="spin"/><span>Kamera ochilmoqda...</span></div>}{status==="success"&&<div className="barcode-camera-state success"><FiCheckCircle/><span>Topildi</span></div>}</div>
    <div className="barcode-scanner-status"><FiCamera/><span>{message||"Kamerani shtrix-kodga qarating."}</span></div>
    <form className="barcode-manual" onSubmit={event=>{event.preventDefault();accept(manual)}}><label><FiEdit3/><span>Qo‘lda kiritish</span></label><div><input inputMode="numeric" autoComplete="off" value={manual} onChange={event=>setManual(event.target.value)} placeholder="Shtrix-kod raqami"/><button className="pro-btn primary" disabled={!manual.trim()} type="submit">Qo‘llash</button></div></form></div>
  </Modal>;
}

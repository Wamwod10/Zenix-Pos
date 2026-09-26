import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { FiCheckCircle, FiEye, FiEyeOff, FiLock, FiShield } from "react-icons/fi";
import { useAuth } from "../../context/AuthContext";
import { ROLES } from "../../config/roles";
import "./login.scss";

const landingFor = (role) => {
  if ([ROLES.CASHIER, ROLES.SALES].includes(role)) return "/sales";
  if (role === ROLES.WAREHOUSE) return "/inventory";
  if (role === ROLES.PLATFORM_ADMIN) return "/platform";
  return "/";
};

export default function ChangePassword(){
  const navigate=useNavigate();
  const {currentUser,changeCurrentPassword}=useAuth();
  const [form,setForm]=useState({current:"",next:"",confirm:""});
  const [show,setShow]=useState(false);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");

  const submit=async(event)=>{
    event.preventDefault();
    if(busy)return;
    if(form.next!==form.confirm){setError("Yangi parollar bir xil emas");return;}
    if(form.next===form.current){setError("Yangi parol joriy paroldan farq qilishi kerak");return;}
    setBusy(true);setError("");
    const result=await changeCurrentPassword({currentPassword:form.current,newPassword:form.next});
    setBusy(false);
    if(!result.success){setError(result.message);return;}
    navigate(landingFor(currentUser?.appRole),{replace:true});
  };

  return <main className="auth-page password-change-page">
    <section className="auth-showcase password-showcase" aria-label="ZENIX POS hisob xavfsizligi">
      <div className="auth-brand"><span className="auth-brand-mark">Z</span><span>ZENIX POS</span></div>
      <div className="auth-showcase-copy"><span className="auth-kicker">Hisob xavfsizligi</span><h1>Vaqtinchalik parolni o‘zingizga tegishli parolga almashtiring.</h1><p>Bu faqat birinchi kirishda talab qilinadi. Keyingi safar yangi parolingiz bilan kirasiz.</p></div>
      <div className="password-security-list"><span><FiShield/><b>Hisob faqat sizga tegishli bo‘ladi</b></span><span><FiCheckCircle/><b>Kamida 8 ta belgi ishlating</b></span><span><FiLock/><b>Parolingiz xodim kartasida ko‘rinmaydi</b></span></div>
    </section>
    <section className="auth-form-side">
      <div className="auth-card">
        <div className="auth-title"><span>Birinchi kirish</span><h2>Parolni yangilang</h2><p>{currentUser?.name || "Xodim"}, davom etish uchun vaqtinchalik parolingizni almashtiring.</p></div>
        {error&&<div className="auth-error" role="alert">{error}</div>}
        <form onSubmit={submit}>
          <label className="auth-field"><span>Vaqtinchalik parol</span><div className="auth-input"><FiLock/><input autoFocus type={show?"text":"password"} value={form.current} onChange={(e)=>setForm(v=>({...v,current:e.target.value}))} autoComplete="current-password"/><button className="auth-eye" type="button" onClick={()=>setShow(v=>!v)}>{show?<FiEyeOff/>:<FiEye/>}</button></div></label>
          <label className="auth-field"><span>Yangi parol</span><div className="auth-input"><FiLock/><input type={show?"text":"password"} value={form.next} onChange={(e)=>setForm(v=>({...v,next:e.target.value}))} autoComplete="new-password"/></div></label>
          <label className="auth-field"><span>Yangi parolni takrorlang</span><div className="auth-input"><FiLock/><input type={show?"text":"password"} value={form.confirm} onChange={(e)=>setForm(v=>({...v,confirm:e.target.value}))} autoComplete="new-password"/></div></label>
          <button className="auth-submit" disabled={busy||!form.current||!form.next||!form.confirm}>{busy?"Saqlanmoqda...":"Parolni saqlash va davom etish"}</button>
        </form>
      </div>
    </section>
  </main>;
}

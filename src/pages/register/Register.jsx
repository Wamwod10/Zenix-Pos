import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { FiBarChart2, FiBriefcase, FiCheckCircle, FiEye, FiEyeOff, FiLock, FiPhone, FiShield, FiShoppingCart, FiUser } from "react-icons/fi";
import { useAuth } from "../../context/AuthContext";
import { formatUzPhone } from "../../utils/phone";
import "../login/login.scss";

function Register(){
  const { register, isLoginTaken } = useAuth();
  const navigate = useNavigate();
  const [form,setForm]=useState({businessName:"",ownerName:"",phone:"+998 ",login:"",password:"",startOption:"TRIAL"});
  const [errors,setErrors]=useState({});
  const [submitting,setSubmitting]=useState(false);
  const [showPassword,setShowPassword]=useState(false);
  const strength=useMemo(()=>{const p=form.password;let score=0;if(p.length>=8)score++;if(/[A-ZА-Я]/.test(p))score++;if(/\d/.test(p))score++;if(/[^\w\s]/.test(p))score++;return score},[form.password]);
  const set=(key,value)=>{setForm(prev=>({...prev,[key]:value}));setErrors(prev=>({...prev,[key]:"",form:""}))};
  const validate=()=>{
    const next={};
    if(form.businessName.trim().length<2)next.businessName="Biznes nomini kiriting";
    if(form.ownerName.trim().length<2)next.ownerName="Egasi ismini kiriting";
    if(form.phone.replace(/\D/g,"").length!==12)next.phone="Telefon raqamni to‘liq kiriting";
    if(form.login.trim().length<3)next.login="Kirish nomi kamida 3 ta belgi bo‘lsin";
    else if(isLoginTaken(form.login))next.login="Bu kirish nomi yoki email band";
    if(form.password.length<8)next.password="Parol kamida 8 ta belgidan iborat bo‘lsin";
    setErrors(next);return Object.keys(next).length===0;
  };
  const submit=async(e)=>{e.preventDefault();if(submitting||!validate())return;setSubmitting(true);const result=await register(form);if(!result.success){setErrors({form:result.message});setSubmitting(false);return}navigate(form.startOption==="TRIAL"?"/":"/activation")};
  return <main className="auth-page register-auth">
    <section className="auth-showcase">
      <div className="auth-brand"><span className="auth-brand-mark">Z</span><span>ZENIX POS</span></div>
      <div className="auth-showcase-copy"><span className="auth-kicker">Yangi biznes</span><h1>Biznesingiz uchun tartibli va tez POS muhiti.</h1><p>Ro‘yxatdan o‘tish bir necha daqiqa. Keyin platformani biznesingizga moslab sozlaysiz.</p></div>
      <div className="auth-feature-list"><div><FiShoppingCart/><span><strong>Savdo</strong><small>Tezkor POS va to‘lovlar</small></span></div><div><FiBarChart2/><span><strong>Boshqaruv</strong><small>Boshqaruv paneli, xarajat va analitika</small></span></div><div><FiShield/><span><strong>Nazorat</strong><small>Rollar va ruxsatlar</small></span></div></div>
    </section>
    <section className="auth-form-side"><div className="auth-card auth-register-card">
      <div className="auth-mobile-brand"><span className="auth-brand-mark">Z</span><strong>ZENIX POS</strong></div>
      <div className="auth-title"><span>1 daqiqada boshlang</span><h2>Yangi biznes yaratish</h2><p>Asosiy ma’lumotlarni kiriting. Keyingi bosqichda tarifni tanlaysiz.</p></div>
      {errors.form&&<div className="auth-error" role="alert">{errors.form}</div>}
      <form onSubmit={submit} noValidate>
        <div className="auth-register-grid">
          <label className="auth-field full"><span>Biznes nomi</span><div className={`auth-input ${errors.businessName?"invalid":""}`}><FiBriefcase/><input autoFocus value={form.businessName} onChange={e=>set("businessName",e.target.value)} placeholder="Masalan: Baraka Market"/></div>{errors.businessName&&<small className="auth-field-error">{errors.businessName}</small>}</label>
          <label className="auth-field"><span>Egasi ismi</span><div className={`auth-input ${errors.ownerName?"invalid":""}`}><FiUser/><input value={form.ownerName} onChange={e=>set("ownerName",e.target.value)} placeholder="Ism familiya"/></div>{errors.ownerName&&<small className="auth-field-error">{errors.ownerName}</small>}</label>
          <label className="auth-field"><span>Telefon</span><div className={`auth-input ${errors.phone?"invalid":""}`}><FiPhone/><input type="tel" value={form.phone} onChange={e=>set("phone",formatUzPhone(e.target.value))} placeholder="+998 90 123 45 67"/></div>{errors.phone&&<small className="auth-field-error">{errors.phone}</small>}</label>
          <label className="auth-field"><span>Kirish nomi</span><div className={`auth-input ${errors.login?"invalid":""}`}><FiUser/><input value={form.login} onBlur={()=>{if(form.login&&isLoginTaken(form.login))setErrors(p=>({...p,login:"Bu kirish nomi band"}))}} onChange={e=>set("login",e.target.value)} placeholder="Kirish nomi" autoComplete="username"/></div>{errors.login&&<small className="auth-field-error">{errors.login}</small>}</label>
          <label className="auth-field"><span>Parol</span><div className={`auth-input ${errors.password?"invalid":""}`}><FiLock/><input type={showPassword?"text":"password"} value={form.password} onChange={e=>set("password",e.target.value)} placeholder="Kamida 8 ta belgi" autoComplete="new-password"/><button className="auth-eye" type="button" onClick={()=>setShowPassword(v=>!v)}>{showPassword?<FiEyeOff/>:<FiEye/>}</button></div>{errors.password&&<small className="auth-field-error">{errors.password}</small>}<div className="password-strength" aria-label="Parol kuchi"><i className={strength>=1?"on":""}/><i className={strength>=2?"on":""}/><i className={strength>=3?"on":""}/><i className={strength>=4?"on":""}/><span>{strength<=1?"Oddiy":strength===2?"Yaxshi":strength===3?"Kuchli":"Juda kuchli"}</span></div></label>
        </div>
        <div className="auth-field full" style={{marginBottom:14}}><span>Qanday boshlamoqchisiz?</span><div style={{display:"flex",gap:8,flexWrap:"wrap",marginTop:8}}>{[["TRIAL","14 kun bepul"],["MONTHLY","1 oylik tarif"],["ANNUAL","1 yillik tarif"]].map(([value,label])=><button type="button" key={value} className={`pro-btn ${form.startOption===value?"primary":"secondary"}`} onClick={()=>set("startOption",value)}>{label}</button>)}</div><small>Bepul sinov tugaganda to‘lov qilmaguncha operatsiyalar cheklanadi.</small></div>
        <button className="auth-submit" disabled={submitting} type="submit">{submitting?"Tizim tayyorlanmoqda...":"Davom etish"}</button>
      </form>
      <div className="auth-privacy"><FiCheckCircle/> Ma’lumotlaringiz alohida va toza ish maydonida saqlanadi.</div>
      <div className="auth-switch">Akkauntingiz bormi? <Link to="/login">Kirish</Link></div>
    </div></section>
  </main>;
}
export default Register;

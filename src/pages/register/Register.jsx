import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { FiBarChart2, FiBriefcase, FiCheckCircle, FiEye, FiEyeOff, FiLock, FiPhone, FiShield, FiShoppingCart, FiUser } from "react-icons/fi";
import { useAuth } from "../../context/AuthContext";
import { formatUzPhone } from "../../utils/phone";
import { api } from "../../services/apiClient";
import { canRegisterTrial, otpPhone, otpRemaining, trialRequiresOtp } from "../../utils/registrationOtp";
import "../login/login.scss";
import "./registerOtp.scss";

const otpMessage=error=>({OTP_INVALID:"Kod noto'g'ri, ishlatilgan yoki muddati tugagan. Yangi kod oling.",OTP_REQUIRED:"Telefonni SMS kod bilan tasdiqlang.",OTP_RATE_LIMITED:"Urinishlar limiti tugadi. Biroz kutib qayta urinib ko'ring.",OTP_UNAVAILABLE:"SMS tasdiqlash hozir mavjud emas. Keyinroq urinib ko'ring.",SMS_UNAVAILABLE:"SMS yuborish xizmati hozir mavjud emas. Qayta urinib ko'ring."}[error?.code]||error?.message||"Tasdiqlash amalga oshmadi. Qayta urinib ko'ring.");

function Register(){
  const { register, isLoginTaken } = useAuth();
  const navigate = useNavigate();
  const [form,setForm]=useState({businessName:"",ownerName:"",phone:"+998 ",login:"",password:"",startOption:"TRIAL"});
  const [errors,setErrors]=useState({});
  const [submitting,setSubmitting]=useState(false);
  const [showPassword,setShowPassword]=useState(false);
  const [challenge,setChallenge]=useState(null);
  const [proof,setProof]=useState(null);
  const [code,setCode]=useState("");
  const [otpError,setOtpError]=useState("");
  const [otpBusy,setOtpBusy]=useState(false);
  const [now,setNow]=useState(Date.now());
  const [policy,setPolicy]=useState(null);
  const [policyError,setPolicyError]=useState(false);
  const [serverOffset,setServerOffset]=useState(0);
  const loadPolicy=async()=>{
    setPolicyError(false);
    try{const value=await api.get('/api/auth/registration-config');
      if(typeof value?.phoneVerificationRequired!=='boolean')throw new Error('Invalid registration policy');
      setServerOffset(Number.isFinite(Date.parse(value.serverTime))?Date.parse(value.serverTime)-Date.now():0);setPolicy(value);
    }catch{setPolicy(null);setPolicyError(true)}
  };
  useEffect(()=>{loadPolicy()},[]);
  const requiresOtp=trialRequiresOtp(policy,now+serverOffset);
  const phoneRef=useRef(form.phone);
  useEffect(()=>{if(!challenge&&!proof&&!policy?.temporaryUntil)return;const timer=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(timer)},[challenge,proof,policy]);
  const verified=canRegisterTrial(proof,form.phone,now);
  const cooldown=otpRemaining(challenge?.resendAt,now);
  const expired=Boolean(challenge)&&otpRemaining(challenge.expiresAt,now)===0;
  const sendOtp=async()=>{
    const phone=otpPhone(form.phone);
    if(!phone){setOtpError("Telefon raqamni to'liq kiriting");return}
    if(otpBusy||cooldown)return;
    setOtpBusy(true);setOtpError("");setProof(null);
    try{const result=await api.post("/api/auth/otp/request",{phone});if(otpPhone(phoneRef.current)===phone){setChallenge({...result,phone});setCode("");setNow(Date.now())}}
    catch(error){if(otpPhone(phoneRef.current)===phone)setOtpError(otpMessage(error))}
    finally{setOtpBusy(false)}
  };
  const verifyOtp=async()=>{
    if(otpBusy||!challenge||expired||!/^\d{6}$/.test(code))return;
    const phone=otpPhone(form.phone);setOtpBusy(true);setOtpError("");
    try{const result=await api.post("/api/auth/otp/verify",{challengeId:challenge.challengeId,phone,code});if(otpPhone(phoneRef.current)===phone){setProof({...result,phone});setCode("");setNow(Date.now())}}
    catch(error){if(otpPhone(phoneRef.current)===phone)setOtpError(otpMessage(error))}
    finally{setOtpBusy(false)}
  };
  const strength=useMemo(()=>{const p=form.password;let score=0;if(p.length>=8)score++;if(/[A-ZА-Я]/.test(p))score++;if(/\d/.test(p))score++;if(/[^\w\s]/.test(p))score++;return score},[form.password]);
  const set=(key,value)=>{if(key==="phone"){phoneRef.current=value;if(otpPhone(value)!==otpPhone(form.phone)){setChallenge(null);setProof(null);setCode("");setOtpError("")}}setForm(prev=>({...prev,[key]:value}));setErrors(prev=>({...prev,[key]:"",form:""}))};
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
  const submit=async(e)=>{e.preventDefault();if(submitting||!validate())return;if(form.startOption==="TRIAL"&&(!policy||(requiresOtp&&!canRegisterTrial(proof,form.phone)))){setOtpError("Trial uchun telefonni SMS kod bilan tasdiqlang");return}setSubmitting(true);const result=await register({...form,registrationToken:form.startOption==="TRIAL"&&requiresOtp?proof?.registrationToken:undefined});if(!result.success){if(result.code==='OTP_REQUIRED')loadPolicy();setErrors({form:result.message});setSubmitting(false);return}navigate(form.startOption==="TRIAL"?"/":"/activation")};
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
        <fieldset className="registration-options"><legend>Qanday boshlamoqchisiz?</legend><div className="registration-option-grid">{[["TRIAL","14 kun bepul sinab ko‘rish","To‘lovsiz boshlang"],["MONTHLY","1 oylik pullik tarif","Har oy yangilash"],["ANNUAL","1 yillik pullik tarif","Bir yil foydalanish"]].map(([value,label,description])=><label key={value} className={`registration-option ${form.startOption===value?"selected":""}`}><input type="radio" name="startOption" value={value} checked={form.startOption===value} onChange={()=>set("startOption",value)}/><span><strong>{label}</strong><small>{description}</small></span></label>)}</div><small>Sinov tugaganda ma’lumotlaringiz saqlanadi. Davom etish uchun obunani faollashtiring.</small></fieldset>
        {form.startOption==="TRIAL"&&policyError&&<div className="auth-error" role="alert">Ro'yxatdan o'tish sozlamalari yuklanmadi. <button type="button" onClick={loadPolicy}>Qayta urinish</button></div>}
        {form.startOption==="TRIAL"&&requiresOtp&&policy&&<section className="registration-otp" aria-label="Telefonni tasdiqlash">
          {verified?<p className="auth-privacy" role="status"><FiCheckCircle/> Telefon tasdiqlandi</p>:<>
            <button className="auth-submit" type="button" disabled={otpBusy||cooldown>0||!otpPhone(form.phone)} onClick={sendOtp}>{otpBusy?"Kutilmoqda...":cooldown>0?`Qayta yuborish: ${cooldown} soniya`:challenge?"SMS kodni qayta yuborish":"SMS kod yuborish"}</button>
            {challenge&&<><label className="auth-field"><span>SMS kod</span><div className="auth-input"><FiLock/><input aria-label="SMS kod" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,"").slice(0,6))}/></div></label><small role="status">{expired?"Kod muddati tugadi. Yangi kod yuboring.":`Kod amal qiladi: ${otpRemaining(challenge.expiresAt,now)} soniya`}</small><button className="auth-submit" type="button" disabled={otpBusy||expired||code.length!==6} onClick={verifyOtp}>Kodni tasdiqlash</button></>}
          </>}
          {proof&&!verified&&<small className="auth-field-error" role="status">Tasdiqlash muddati tugadi. Yangi SMS kod oling.</small>}
          {otpError&&<div className="auth-error" role="alert">{otpError}</div>}
        </section>}
        <button className="auth-submit" disabled={submitting||otpBusy||(form.startOption==="TRIAL"&&(!policy||(requiresOtp&&!verified)))} type="submit">{submitting?"Tizim tayyorlanmoqda...":"Davom etish"}</button>
      </form>
      <div className="auth-privacy"><FiCheckCircle/> Ma’lumotlaringiz alohida va toza ish maydonida saqlanadi.</div>
      <div className="auth-switch">Akkauntingiz bormi? <Link to="/login">Kirish</Link></div>
    </div></section>
  </main>;
}
export default Register;

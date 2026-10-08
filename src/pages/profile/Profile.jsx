import { useEffect, useMemo, useState } from "react";
import { FiClock, FiEdit2, FiKey, FiLock, FiLogOut, FiMonitor, FiPhone, FiShield, FiSmartphone, FiUser } from "react-icons/fi";
import { useAuth } from "../../context/AuthContext";
import { useStore } from "../../context/StoreContext";
import { formatUzPhone } from "../../utils/phone";
import { ROLE_LABELS } from "../../config/roles";
import { PageHeader, StatusBadge } from "../../components/Ui";
import Modal from "../../components/Modal";
import { useFeedback } from "../../context/FeedbackContext";
import useUnsavedGuard from "../../utils/useUnsavedGuard";
import "./profile.scss";

const formatDateTime = (value) => value ? new Intl.DateTimeFormat("uz-UZ", { dateStyle:"medium", timeStyle:"short" }).format(new Date(value)) : "—";

export default function Profile() {
  const { currentUser, changeCurrentPassword, updateCurrentProfile, getActiveSessions, revokeSession, revokeOtherSessions } = useAuth();
  const { currentStore, stores } = useStore();
  const { notify, confirm } = useFeedback();
  const [passwordOpen,setPasswordOpen]=useState(false);
  const [profileOpen,setProfileOpen]=useState(false);
  const [profileForm,setProfileForm]=useState({name:currentUser?.name||"",phone:currentUser?.phone||""});
  const [sessionVersion,setSessionVersion]=useState(0);
  const [passwords,setPasswords]=useState({current:"",next:"",confirm:""});
  const [busy,setBusy]=useState(false);
  const profileDirty=profileOpen&&(profileForm.name!==(currentUser?.name||"")||profileForm.phone!==(currentUser?.phone||""));
  const passwordDirty=passwordOpen&&!!(passwords.current||passwords.next||passwords.confirm);
  const guardProfileClose=useUnsavedGuard(profileDirty,"Profil ma’lumotlarida saqlanmagan o‘zgarishlar bor.");
  const guardPasswordClose=useUnsavedGuard(passwordDirty,"Parol maydonlarida saqlanmagan ma’lumotlar bor.");
  const closeProfileEditor=()=>guardProfileClose(()=>setProfileOpen(false));
  const openPasswordEditor=()=>{setPasswords({current:"",next:"",confirm:""});setPasswordOpen(true)};
  const closePasswordEditor=()=>{if(busy)return;guardPasswordClose(()=>{setPasswordOpen(false);setPasswords({current:"",next:"",confirm:""})})};
  const sessions=useMemo(()=>getActiveSessions(),[currentUser?.sessionId,sessionVersion]);
  useEffect(()=>{const interval=window.setInterval(()=>setSessionVersion((value)=>value+1),60_000);return()=>window.clearInterval(interval)},[]);
  const store=stores.find((item)=>item.id===currentUser?.storeId)||currentStore;
  const savePassword=async()=>{
    if(passwords.next!==passwords.confirm){notify({tone:"danger",title:"Parollar mos emas",message:"Yangi parolni qayta tekshiring."});return}
    setBusy(true);const result=await changeCurrentPassword({currentPassword:passwords.current,newPassword:passwords.next});setBusy(false);
    if(!result.success){notify({tone:"danger",title:"Parol o‘zgartirilmadi",message:result.message});return}
    setPasswordOpen(false);setPasswords({current:"",next:"",confirm:""});notify({tone:"success",title:"Parol yangilandi"});
  };
  const openProfileEdit=()=>{setProfileForm({name:currentUser?.name||"",phone:currentUser?.phone||""});setProfileOpen(true)};
  const saveProfile=async()=>{
    const result=await updateCurrentProfile(profileForm);
    if(!result.success){notify({tone:"danger",title:"Profil saqlanmadi",message:result.message});return}
    setProfileOpen(false);notify({tone:"success",title:"Profil yangilandi"});
  };
  const closeOtherSessions=async()=>{
    const accepted=await confirm({title:"Boshqa qurilmalardan chiqish",message:`${Math.max(0,sessions.length-1)} ta boshqa qurilmadagi hisobdan chiqiladi. Hozirgi qurilma ochiq qoladi.`,confirmLabel:"Qurilmalardan chiqish",cancelLabel:"Bekor qilish",tone:"danger"});
    if(!accepted)return;await revokeOtherSessions();setSessionVersion((value)=>value+1);notify({tone:"success",title:"Boshqa qurilmalardan chiqildi"});
  };
  const closeOneSession=async(session)=>{
    const accepted=await confirm({title:"Qurilmadan chiqish",message:`${session.device||"Brauzer"} qurilmasidagi hisobdan chiqiladi.`,confirmLabel:"Chiqish",cancelLabel:"Bekor qilish",tone:"danger"});
    if(!accepted)return;await revokeSession(session.id);setSessionVersion((value)=>value+1);notify({tone:"success",title:"Qurilmadan chiqildi",message:session.device||"Brauzer"});
  };
  return <div className="pro-page profile-page">
    <PageHeader title="Mening profilim" subtitle="Shaxsiy hisob ma’lumotlari, xavfsizlik va faol qurilmalar."/>
    <section className="profile-hero pro-card">
      <div className="profile-avatar-large">{currentUser?.name?.charAt(0)||"U"}</div>
      <div className="profile-hero-copy"><h2>{currentUser?.name||"Foydalanuvchi"}</h2><p>{currentUser?.organizationName||"Zenix POS"}</p><div><StatusBadge tone="success">{ROLE_LABELS[currentUser?.appRole]||currentUser?.appRole}</StatusBadge><span>{store?.name||"Asosiy filial"}</span></div></div>
      <div className="profile-hero-actions"><button className="pro-btn secondary" onClick={openProfileEdit}><FiEdit2/> Profilni tahrirlash</button><button className="pro-btn secondary" onClick={openPasswordEditor}><FiKey/> Parolni o‘zgartirish</button></div>
    </section>
    <div className="profile-grid">
      <section className="pro-card"><div className="pro-card-head"><div><h2>Hisob ma’lumotlari</h2><p>Kirish nomi va aloqa ma’lumotlari.</p></div></div><div className="profile-detail-list">
        <div><FiUser/><span><small>Kirish nomi</small><strong>{currentUser?.username||"—"}</strong></span></div>
        <div><FiPhone/><span><small>Telefon</small><strong>{currentUser?.phone?formatUzPhone(currentUser.phone):"Kiritilmagan"}</strong></span></div>
        <div><FiShield/><span><small>Rol</small><strong>{ROLE_LABELS[currentUser?.appRole]||"—"}</strong></span></div>
        <div><FiClock/><span><small>Oxirgi kirish</small><strong>{formatDateTime(currentUser?.lastLoginAt||sessions[0]?.createdAt)}</strong></span></div>
      </div></section>
      <section className="pro-card"><div className="pro-card-head"><div><h2>Faol qurilmalar</h2><p>Hisob ochiq turgan qurilmalarni boshqaring.</p></div>{sessions.length>1&&<button className="pro-btn secondary" onClick={closeOtherSessions}>Boshqalaridan chiqish</button>}</div><div className="session-list">{sessions.length?sessions.map((session)=><div className="session-row" key={session.id}><span className="session-icon"><FiMonitor/></span><span><strong>{session.device||"Brauzer"}</strong><small>{session.id===currentUser?.sessionId?"Hozirgi qurilma":`Oxirgi faollik: ${formatDateTime(session.lastSeenAt)}`}</small></span>{session.id===currentUser?.sessionId?<StatusBadge tone="success">Hozir</StatusBadge>:<button className="pro-btn secondary" onClick={()=>closeOneSession(session)}><FiLogOut/> Chiqish</button>}</div>):<div className="pro-empty"><strong>Faol qurilma topilmadi</strong></div>}</div></section>
    </div>
    <section className="pro-card profile-security-card"><div className="pro-card-head"><div><h2>Xavfsizlik</h2><p>Parol, faol qurilmalar va qo‘shimcha kirish himoyasi.</p></div></div><div className="profile-security-list"><div><span className="profile-security-icon"><FiLock/></span><span><strong>Parol</strong><small>Hisob paroli himoyalangan ko‘rinishda saqlanadi. Vaqti-vaqti bilan yangilab turing.</small></span><StatusBadge tone="success">O‘rnatilgan</StatusBadge><button className="pro-btn secondary" onClick={openPasswordEditor}>O‘zgartirish</button></div><div><span className="profile-security-icon"><FiSmartphone/></span><span><strong>2 bosqichli tasdiqlash</strong><small>Serverdagi kirish tizimi ulangach Telegram yoki autentifikator orqali qo‘shimcha himoya shu yerda boshqariladi.</small></span><StatusBadge tone="neutral">Server ulanishi kerak</StatusBadge><button className="pro-btn secondary" disabled>Keyingi bosqich</button></div><div><span className="profile-security-icon"><FiShield/></span><span><strong>Faol qurilmalar</strong><small>{sessions.length} ta qurilmada hisob ochiq. Noma’lum qurilmani yuqoridagi ro‘yxatdan chiqaring.</small></span><StatusBadge tone={sessions.length>1?"warning":"success"}>{sessions.length} ta</StatusBadge><button className="pro-btn secondary" disabled={sessions.length<=1} onClick={closeOtherSessions}>Boshqalaridan chiqish</button></div></div></section>
    <Modal open={profileOpen} onClose={closeProfileEditor} title="Profilni tahrirlash" subtitle="Ism va aloqa ma’lumotlarini yangilang." size="sm" footer={<><button className="pro-btn secondary" onClick={closeProfileEditor}>Bekor qilish</button><button className="pro-btn primary" onClick={saveProfile}>Saqlash</button></>}><div className="profile-password-fields"><label className="pro-field"><span>Ism va familiya</span><input data-modal-autofocus value={profileForm.name} onChange={(event)=>setProfileForm({...profileForm,name:event.target.value})}/></label><label className="pro-field"><span>Telefon</span><input inputMode="tel" value={profileForm.phone} onChange={(event)=>setProfileForm({...profileForm,phone:formatUzPhone(event.target.value)})} placeholder="+998 90 123 45 67"/></label></div></Modal>
    <Modal open={passwordOpen} onClose={closePasswordEditor} title="Parolni o‘zgartirish" subtitle="Yangi parol kamida 8 ta belgidan iborat bo‘lsin." size="sm" footer={<><button className="pro-btn secondary" disabled={busy} onClick={closePasswordEditor}>Bekor qilish</button><button className="pro-btn primary" disabled={busy||passwords.next.length<8} onClick={savePassword}>{busy?"Saqlanmoqda...":"Parolni saqlash"}</button></>}><div className="profile-password-fields"><label className="pro-field"><span>Joriy parol</span><input data-modal-autofocus type="password" value={passwords.current} onChange={(event)=>setPasswords({...passwords,current:event.target.value})}/></label><label className="pro-field"><span>Yangi parol</span><input type="password" value={passwords.next} onChange={(event)=>setPasswords({...passwords,next:event.target.value})}/></label><label className="pro-field"><span>Yangi parolni takrorlang</span><input type="password" value={passwords.confirm} onChange={(event)=>setPasswords({...passwords,confirm:event.target.value})}/></label></div></Modal>
  </div>;
}

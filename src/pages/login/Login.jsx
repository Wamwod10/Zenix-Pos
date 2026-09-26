import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { FiBarChart2, FiBox, FiEye, FiEyeOff, FiLock, FiShield, FiShoppingCart, FiUser } from "react-icons/fi";
import { useAuth } from "../../context/AuthContext";
import { ROLES } from "../../config/roles";
import "./login.scss";

function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [formData, setFormData] = useState({ username:"", password:"" });
  const [error, setError] = useState("");
  const [loggingIn, setLoggingIn] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (loggingIn) return;
    if (!formData.username.trim() || !formData.password) { setError("Kirish nomi va parolni kiriting"); return; }
    setLoggingIn(true); setError("");
    const result = await login(formData.username, formData.password);
    if (!result.success) { setError(result.message); setLoggingIn(false); return; }
    if (result.user.forcePasswordChange) navigate("/change-password");
    else if (result.user.appRole === ROLES.PLATFORM_ADMIN) navigate("/platform");
    else if ([ROLES.CASHIER, ROLES.SALES].includes(result.user.appRole)) navigate("/sales");
    else if (result.user.appRole === ROLES.WAREHOUSE) navigate("/inventory");
    else navigate("/");
  };

  return <main className="auth-page">
    <section className="auth-showcase" aria-label="Zenix POS imkoniyatlari">
      <div className="auth-brand"><span className="auth-brand-mark">Z</span><span>ZENIX POS</span></div>
      <div className="auth-showcase-copy"><span className="auth-kicker">Savdo boshqaruv platformasi</span><h1>Savdo, ombor va jamoani bitta tizimdan boshqaring.</h1><p>Har qanday do‘konga mos, tezkor kassa jarayoni va kuchli boshqaruv vositalari.</p></div>
      <div className="auth-feature-grid"><div><FiShoppingCart/><span><strong>Tezkor POS</strong><small>Skaner va klaviatura bilan tez savdo</small></span></div><div><FiBox/><span><strong>Ombor nazorati</strong><small>Qoldiq, transfer va inventarizatsiya</small></span></div><div><FiBarChart2/><span><strong>Analitika</strong><small>Foyda va sotuvchi natijalari</small></span></div><div><FiShield/><span><strong>Rollar</strong><small>Egasidan kassirgacha</small></span></div></div>
      <div className="auth-trust">Professional POS • Barcha qurilmalarga mos • Qorong‘i rejim • Universal</div>
    </section>
    <section className="auth-form-side">
      <div className="auth-card">
        <div className="auth-mobile-brand"><span className="auth-brand-mark">Z</span><strong>ZENIX POS</strong></div>
        <div className="auth-title"><span>Qaytib kelganingizdan xursandmiz</span><h2>Tizimga kirish</h2><p>Ishingizni davom ettirish uchun ma’lumotlaringizni kiriting.</p></div>
        {error && <div className="auth-error" role="alert">{error}</div>}
        <form onSubmit={handleSubmit} noValidate>
          <label className="auth-field"><span>Kirish nomi</span><div className="auth-input"><FiUser/><input autoFocus type="text" placeholder="masalan: owner" disabled={loggingIn} value={formData.username} onChange={(e)=>setFormData({...formData,username:e.target.value})} autoComplete="username"/></div></label>
          <label className="auth-field"><span>Parol</span><div className="auth-input"><FiLock/><input type={showPassword?"text":"password"} placeholder="Parolingiz" disabled={loggingIn} value={formData.password} onChange={(e)=>setFormData({...formData,password:e.target.value})} autoComplete="current-password"/><button type="button" className="auth-eye" onClick={()=>setShowPassword(v=>!v)} aria-label={showPassword?"Parolni yashirish":"Parolni ko‘rsatish"}>{showPassword?<FiEyeOff/>:<FiEye/>}</button></div></label>
          <button className="auth-submit" disabled={loggingIn} type="submit">{loggingIn ? "Kirilmoqda..." : "Kirish"}</button>
        </form>
        <div className="auth-switch">Yangi mijozmisiz? <Link to="/register">Biznes yaratish</Link></div>
      </div>
    </section>
  </main>;
}
export default Login;

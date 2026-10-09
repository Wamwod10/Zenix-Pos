import {useState} from 'react';
import {Link} from 'react-router-dom';
import {api} from '../../services/apiClient';
import '../login/login.scss';

export default function ResetPassword(){
  const [token,setToken]=useState('');
  const [password,setPassword]=useState('');
  const [confirmation,setConfirmation]=useState('');
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [done,setDone]=useState(false);
  const submit=async event=>{
    event.preventDefault();if(busy)return;
    if(password!==confirmation){setError('Parollar mos emas');return}
    setBusy(true);setError('');
    try{await api.post('/api/auth/reset-password',{token:token.trim(),password});setDone(true);setToken('');setPassword('');setConfirmation('')}
    catch(e){setError(e.message||'Parol tiklanmadi')}
    finally{setBusy(false)}
  };
  return <main className="auth-page"><section className="auth-form-side"><div className="auth-card"><div className="auth-title"><h2>Parolni tiklash</h2><p>Administrator bergan bir martalik token 15 daqiqa amal qiladi.</p></div>{error&&<div className="auth-error" role="alert">{error}</div>}{done?<p role="status">Parol yangilandi. <Link to="/login">Tizimga kirish</Link></p>:<form onSubmit={submit}><label className="auth-field"><span>Tiklash tokeni</span><div className="auth-input"><input value={token} onChange={e=>setToken(e.target.value)} autoComplete="off" required/></div></label><label className="auth-field"><span>Yangi parol</span><div className="auth-input"><input type="password" minLength={12} maxLength={128} value={password} onChange={e=>setPassword(e.target.value)} autoComplete="new-password" required/></div></label><label className="auth-field"><span>Parolni takrorlang</span><div className="auth-input"><input type="password" value={confirmation} onChange={e=>setConfirmation(e.target.value)} autoComplete="new-password" required/></div></label><button className="auth-submit" disabled={busy}>{busy?'Saqlanmoqda...':'Yangi parolni o‘rnatish'}</button></form>}<div className="auth-switch"><Link to="/login">Kirish sahifasi</Link></div></div></section></main>;
}

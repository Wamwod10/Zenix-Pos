import {FiArrowLeft,FiMaximize,FiMinimize,FiSettings,FiSun,FiMoon,FiWifi,FiWifiOff} from 'react-icons/fi';
import {PremiumSelect} from '../../components/Ui';
export default function WorkspaceHeader({store,user,disabled,online,time,fullscreen,onFullscreen,onReturn,onDevices}){
 const dark=store.uiPreferences.theme==='dark'||(store.uiPreferences.theme==='system'&&matchMedia('(prefers-color-scheme: dark)').matches);
 return <header className="pp-top">
  <div className="pp-brand"><img src="/zenix-logo.png" alt="" width="36" height="36"/><div><b>ZENIX <span>POS Pro</span></b><small>Kassir ish maydoni</small></div></div>
  <label className="pp-branch"><span>Filial</span><PremiumSelect aria-label="POS Pro filial" value={store.currentStoreId} disabled={disabled} onChange={e=>store.setSelectedStoreId(e.target.value)}>{store.stores.filter(s=>s.active!==false).map(s=><option value={s.id} key={s.id}>{s.name}</option>)}</PremiumSelect></label>
  <div className="pp-cashier"><small>Kassir</small><strong title={user.name}>{user.name}</strong></div>
  <div className="pp-session-state"><span className={`pp-shift-status ${store.activeShift?'pp-shift-open':'pp-shift-closed'}`}>{store.activeShift?'Smena ochiq':'Smena yopiq'}</span><div className="pp-connection"><span className={online?'pp-online':'pp-offline'}>{online?<FiWifi/>:<FiWifiOff/>}{online?'Online':'Offline · draft'}</span><time>{time}</time></div></div>
  <div className="pp-header-actions" role="group" aria-label="Ish muhiti boshqaruvi"><button aria-label="Mavzu" title="Mavzuni almashtirish" onClick={()=>store.setUiPreferences({theme:dark?'light':'dark'})}>{dark?<FiSun/>:<FiMoon/>}</button><button aria-label="Qurilmalar" title="Qurilmalar markazi" onClick={onDevices}><FiSettings/><span>Qurilmalar</span></button><button onClick={onFullscreen} aria-label={fullscreen?'To‘liq ekrandan chiqish':'To‘liq ekran'}>{fullscreen?<FiMinimize/>:<FiMaximize/>}<span>{fullscreen?'Ekrandan chiqish':'To‘liq ekran'}</span></button><button className="pp-return" aria-label="Platformaga qaytish" title="Platformaga qaytish" onClick={onReturn}><FiArrowLeft/><span>Platformaga qaytish</span></button></div>
 </header>;
}

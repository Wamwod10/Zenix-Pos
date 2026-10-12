import {FiCheck,FiShield} from 'react-icons/fi';
import {annualSaving,RESOURCE_LABELS} from '../utils/subscription';
import {formatPrice} from '../utils/formatPrice';
export default function SubscriptionPlans({plans=[],value,onChange,interval='MONTHLY',disabled=false,registration=false}){
  const options=['START','BUSINESS','PREMIUM'].map(code=>plans.find(p=>p.code===code)||{code,label:{START:'Start',BUSINESS:'Business',PREMIUM:'Premium'}[code]});
  return <div className="pricing-grid subscription-plan-grid" role="radiogroup" aria-label="Tarifni tanlang">{options.map(plan=><label key={plan.code} className={`pricing-card ${plan.code==='BUSINESS'?'featured':''} ${value===plan.code?'selected':''}`}>
    {plan.code==='BUSINESS'&&<span className="best-badge">Tavsiya etiladi</span>}
    <div className="pricing-top"><span>{plan.label}</span><input type="radio" name="planCode" value={plan.code} checked={value===plan.code} onChange={()=>onChange(plan.code)} disabled={disabled||!plan.prices} aria-label={plan.label}/></div>
    {plan.prices?<><strong>{formatPrice(plan.prices[interval],'UZS')}</strong><small>/{interval==='ANNUAL'?'yil':'oy'}</small>
    {interval==='ANNUAL'&&<div className="saving-pill">{formatPrice(annualSaving(plan).amount,'UZS')} ({annualSaving(plan).percent}%) tejaysiz</div>}
    <ul>{Object.entries(RESOURCE_LABELS).map(([key,label])=><li key={key}><FiCheck/> {label}: {plan.limits[key]??'Cheksiz'}</li>)}<li><FiShield/> {plan.limits.aiRequests?`${plan.limits.aiRequests} AI so‘rov/oy`:'ZENIX AI yo‘q'}</li><li><FiCheck/> Barcha standart POS modullari</li></ul></>:<small>Tarif ma’lumotlari yuklanmoqda...</small>}
    {registration&&<p className="subscription-trial-note">Tanlangan tarifda 14 kun bepul</p>}
  </label>)}</div>;
}

import {cartTotals,finalUnitPrice,formatProMoney} from './model.js';
import {lineAmount} from '../../utils/posMoney.js';
const text=value=>String(value??'').slice(0,250);
export function customerDisplaySnapshot({business,branch,cart=[],cartPct=0,confirmedSale=null}){
 const totals=cartTotals(cart,cartPct),confirmed=!cart.length&&confirmedSale&&Array.isArray(confirmedSale.items)&&confirmedSale.items.length>0;
 // Only customer-visible amounts, names, and quantities; never expose
 // customer identity, cashier ID, cost, inventory, payment or session secrets.
 const lines=confirmed?[]:cart.map(line=>({
  name:text(line.name),quantity:text(line.cartQty)+' '+text(line.unit||'dona'),amount:formatProMoney(lineAmount(line.cartQty,finalUnitPrice(line,cartPct)))
 }));
 return {business:text(business||'ZENIX POS'),branch:text(branch),state:confirmed?'confirmed':lines.length?'cart':'idle',lines,
  total:formatProMoney(confirmed?confirmedSale.total??confirmedSale.saleTotal??0:totals.total),
  discount:confirmed?'':totals.discount>0?formatProMoney(totals.discount):''};
}
export function openCustomerDisplay(host=window){
 const popup=host.open('','_blank','popup,width=980,height=740');
 if(!popup)throw Error('Brauzer ikkinchi oynani blokladi. Pop-up ruxsatini tekshiring.');
 try{
  popup.opener=null;
  const doc=popup.document;
  doc.title='ZENIX POS — Mijoz ekrani';doc.documentElement.lang='uz';
  const node=(tag,cls,value)=>{const el=doc.createElement(tag);if(cls)el.className=cls;if(value!==undefined)el.textContent=value;return el};
  const style=node('style',null,'*{box-sizing:border-box}body{margin:0;background:#111315;color:#f5f5f5;font-family:Arial,sans-serif}main{min-height:100vh;display:grid;grid-template-rows:auto 1fr auto;gap:24px;padding:clamp(16px,4vw,56px)}header{display:flex;justify-content:space-between;gap:16px;align-items:center;flex-wrap:wrap}h1,p{margin:0}h1{font-size:clamp(24px,4vw,44px);overflow-wrap:anywhere}small{color:#b9c3ca;font-size:16px}section{min-width:0}ul{padding:0;margin:0;list-style:none}li{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:12px;padding:18px 0;border-bottom:1px solid #34383c;font-size:clamp(17px,2.3vw,27px)}li strong,li span{overflow-wrap:anywhere}li span{text-align:right;max-width:45vw}li small{display:block;margin-top:6px}footer{position:sticky;bottom:0;background:#23282b;padding:24px;border-radius:16px;display:grid;gap:8px}footer b{font-size:clamp(30px,6vw,68px);font-variant-numeric:tabular-nums;overflow-wrap:anywhere}.state{font-size:clamp(24px,5vw,48px);padding:24px 0}.confirmed{color:#a7e9bc}');
  doc.head.append(style);
  const main=node('main'),header=node('header'),business=node('h1'),branch=node('small'),section=node('section'),status=node('p','state'),list=node('ul'),footer=node('footer'),discount=node('small'),caption=node('small',null,'JAMI'),total=node('b');
  header.append(business,branch);section.append(status,list);footer.append(discount,caption,total);main.append(header,section,footer);doc.body.replaceChildren(main);
  return {closed:()=>popup.closed||popup.document!==doc,close:()=>popup.close(),focus:()=>popup.focus(),update(snapshot){
   if(popup.closed||popup.document!==doc)return false;
   business.textContent=snapshot.business;branch.textContent=snapshot.branch;
   status.textContent=snapshot.state==='confirmed'?'Xaridingiz uchun rahmat!':snapshot.state==='idle'?'Xush kelibsiz!':'Sizning xaridlaringiz';
   status.className='state'+(snapshot.state==='confirmed'?' confirmed':'');
   list.replaceChildren(...snapshot.lines.map(line=>{const row=node('li'),label=node('strong',null,line.name);label.append(node('small',null,line.quantity));row.append(label,node('span',null,line.amount));return row}));
   discount.textContent=snapshot.discount?'Chegirma: '+snapshot.discount:'';
   total.textContent=snapshot.total;
   return true;
  }};
 }catch(error){try{popup.close()}catch{}throw error}
}

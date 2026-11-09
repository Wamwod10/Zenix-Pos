// UI-only presentation. Every input comes from the authenticated bootstrap and
// finance report; this never authorizes trial access or changes customer data.
export function trialOverview(organization,now=Date.now()){
 const until=organization?.trialEndsAt||organization?.settings?.trialEndsAt;
 if(typeof until!=='string'||!Number.isFinite(Date.parse(until)))return null;
 const serverNow=now+(Number.isFinite(organization?.serverClockOffset)?organization.serverClockOffset:0);
 const days=Math.max(0,Math.ceil((Date.parse(until)-serverNow)/86400000));
 return {days,active:days>0&&organization?.accessMode==='READ_WRITE',expiresAt:until};
}
export function onboardingSteps({
 organization,stores=[],products=[],catalogComplete=false,dailySales=[],salesHistory=[],
 salesVisible=false,reportViewed=false,can=()=>false,
}={}){
 const configuredStore=stores.some(s=>s?.active!==false&&s?.id&&
  (String(s.name||'').trim()!=='Asosiy filial'||Boolean(String(organization?.address||'').trim())));
 const visibleProducts=catalogComplete?products.filter(p=>p&&!p.archived).length:null;
 const firstSale=salesVisible?(dailySales.length>0||salesHistory.length>0):null;
 return [
  {id:'store',title:'Do‘konni sozlash',detail:'Filial nomi yoki biznes manzilini tekshiring.',path:'/settings',complete:can('moduleSettings')?configuredStore:null,enabled:can('moduleSettings')},
  {id:'product',title:'Birinchi mahsulotni kiritish',detail:'Katalogda haqiqiy mahsulot bo‘lishi kerak.',path:can('productWrite')?'/products?new=1':'/products',complete:can('moduleProducts')?(catalogComplete?visibleProducts>0:null):null,enabled:can('moduleProducts')},
  {id:'sale',title:'Birinchi savdoni amalga oshirish',detail:'Faqat saqlangan haqiqiy savdo hisoblanadi.',path:'/sales',complete:firstSale,enabled:can('moduleSales')},
  {id:'report',title:'Bugungi hisobotni ko‘rish',detail:'Hisobot yuklangach ushbu sessiyada belgilash mumkin.',path:'/',complete:reportViewed,enabled:can('moduleDashboard')},
 ];
}
export function profitEvidenceComplete(sales=[]){
 // No positive unit cost is a conservative warning: original POS cost
 // snapshots may contain unknown unit costs represented as zero. Suppress
 // confidently labeled profit rather than inventing a margin.
 return sales.every(sale=>(sale?.items||[]).every(item=>{
  const units=Number(item.quantity??item.qty??0);
  if(!Number.isFinite(units)||units<=0)return true;
  return Number.isFinite(Number(item.unitCost))&&Number(item.unitCost)>0;
 }));
}

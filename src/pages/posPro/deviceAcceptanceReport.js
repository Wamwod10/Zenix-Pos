// Browser-only operator evidence template; deliberately no network/storage access.
// A human report is never a substitute for actual connected-device acceptance.
export const DEVICE_ACCEPTANCE_CASES=Object.freeze([
  {id:'scanner',name:'USB/HID barcode skaner',hint:'EAN-13, qisqa/uzun, vaznli yorliq va takroriy tez skan; bitta skan bitta mahsulotga teng'},
  {id:'printer58',name:'58 mm chek printeri',hint:'Test chek: o‘zbek/kirill, qaytim, uzun nomlar, qog‘oz tugashi va offline holat'},
  {id:'printer80',name:'80 mm chek printeri',hint:'Test chek: mahsulot, miqdor, narx va jami kesilmasin; printer uzilganda xabar'},
  {id:'touch',name:'Android/Windows touch',hint:'320, 375, 430, 768 px; savat, miqdor, checkout va modal gorizontal scrollsiz'},
  {id:'offline',name:'Offline va reconnect',hint:'Faqat sinov biznesida. Yuborish oldi/undan keyin uzilish va bir xil chekni takrorlamaslik'},
  {id:'multitab',name:'Ikkita kassir oynasi',hint:'Faqat sinov biznesida. Web Locks bor/yo‘q; faqat bitta checkout'},
]);
export const DEVICE_ACCEPTANCE_STATUSES=Object.freeze(['not_tested','pass','fail','blocked']);
const normalize=(value,max)=>typeof value==='string'?value.trim().slice(0,max):'';

export function buildDeviceAcceptanceReport({
  testTenant,operator,results={},checkedAt=new Date().toISOString(),
  online,usbApiAvailable,serialApiAvailable,browserInfo='',
}={}){
  const tenant=normalize(testTenant,120);
  if(!tenant)throw Error('Sinov biznesi/filial identifikatorini kiriting (mijoz ma’lumotisiz)');
  if(!results||typeof results!=='object'||Array.isArray(results))throw Error('Sinov natijasi noto‘g‘ri');
  if(typeof checkedAt!=='string'||!Number.isFinite(Date.parse(checkedAt)))throw Error('Sinov vaqti noto‘g‘ri');
  const checks=DEVICE_ACCEPTANCE_CASES.map(({id,name})=>{
    const row=results[id]??{};
    if(!row||typeof row!=='object'||Array.isArray(row))throw Error('Natija shakli noto‘g‘ri');
    const status=row.status??'not_tested';
    if(!DEVICE_ACCEPTANCE_STATUSES.includes(status))throw Error('Sinov statusi noto‘g‘ri');
    const evidence=normalize(row.evidence,350);
    if(status==='pass'&&!evidence)throw Error(name+' — O‘tdi holati uchun dalil izohini kiriting');
    return {id,name,status,device:normalize(row.device,100),evidence,notes:normalize(row.notes,500)};
  });
  const countByStatus=Object.fromEntries(DEVICE_ACCEPTANCE_STATUSES.map(status=>
    [status,checks.filter(check=>check.status===status).length]));
  return {
    schema:'zenix-pos-device-acceptance-v1',
    verifiedAutomatically:false,
    evidenceSource:'operator-self-reported',
    certification:'NOT_CERTIFIED',
    generatedAt:checkedAt,
    testContext:{testTenant:tenant,operator:normalize(operator,80),browser:normalize(browserInfo,230)},
    browserCapabilities:{
      online:online===true,
      webUSBAPIAvailable:usbApiAvailable===true,
      webSerialAPIAvailable:serialApiAvailable===true,
      // Browser API support does not indicate actual connected hardware.
      connectedHardwareVerifiedAutomatically:false,
    },
    summary:{total:checks.length,...countByStatus},
    checks,
    instructions:'Operator va reviewer haqiqiy qurilma dalilini alohida tasdiqlashi zarur. Real mijozlar, tokenlar yoki maxfiy ma’lumotlarni yozmang.',
  };
}

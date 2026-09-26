const CACHE_TTL=15*60*1000;
const ENDPOINT="https://cbu.uz/uz/arkhiv-kursov-valyut/json/";
const CURRENCIES=["USD","EUR","RUB"];

let memoryCache=null;

const readCache=()=>memoryCache;
const writeCache=(payload)=>{memoryCache=payload};
const normalize=(row)=>({
  code:row.Ccy,
  name:row.CcyNm_UZ||row.CcyNm_EN||row.Ccy,
  rate:Number(row.Rate||0)/Math.max(1,Number(row.Nominal||1)),
  diff:Number(row.Diff||0)/Math.max(1,Number(row.Nominal||1)),
  effectiveDate:row.Date||"",
});

export const getCachedExchangeRates=()=>readCache();

export async function fetchExchangeRates({force=false}={}){
  const cached=readCache();
  if(!force&&cached&&Date.now()-Number(cached.fetchedAt||0)<CACHE_TTL)return {...cached,fromCache:true};
  try{
    const response=await fetch(ENDPOINT,{headers:{Accept:"application/json"}});
    if(!response.ok)throw new Error(`FX ${response.status}`);
    const data=await response.json();
    const rows=(Array.isArray(data)?data:[]).filter((row)=>CURRENCIES.includes(row.Ccy)).map(normalize);
    if(rows.length!==CURRENCIES.length)throw new Error("FX response incomplete");
    const rates=Object.fromEntries(rows.map((row)=>[row.code,row]));
    const payload={rates,fetchedAt:Date.now(),source:"O‘zbekiston Markaziy banki",effectiveDate:rows[0]?.effectiveDate||""};
    writeCache(payload);
    return {...payload,fromCache:false};
  }catch(error){
    if(cached)return {...cached,fromCache:true,error:"Kursni yangilab bo‘lmadi. Oxirgi qiymat shu sessiya davomida ko‘rsatilmoqda."};
    throw error;
  }
}

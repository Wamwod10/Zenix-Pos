/** UI estimate only. The billing API remains the authority for the final quote.
 * A monthly/annual branch pass is only credited if it covers the ENTIRE new
 * subscription period, not merely because it is active today.
 */
export function coveredExtraStoresForPeriod(passes, periodStart, periodEnd){
  const iso=/^\d{4}-\d{2}-\d{2}$/;
  if(!iso.test(periodStart||'')||!iso.test(periodEnd||'')||periodEnd<=periodStart)return 0;
  if(!Array.isArray(passes))return 0;
  return passes.reduce((count,pass)=>{
    const quantity=Number(pass?.quantity);
    if(!Number.isInteger(quantity)||quantity<1||quantity>20)return count;
    const start=String(pass?.startsOn||'').slice(0,10);
    const end=String(pass?.expiresOn||'').slice(0,10);
    return iso.test(start)&&iso.test(end)&&start<=periodStart&&end>=periodEnd ? count+quantity : count;
  },0);
}

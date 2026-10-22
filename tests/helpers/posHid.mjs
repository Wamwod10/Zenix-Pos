// SIMULATED device emission clock, independent of automation/JS delivery jitter.
export async function simulateHid(page,codes,gap=6,deliveryDelay=6){
 await page.evaluate(async({codes,gap,deliveryDelay})=>{
  let stamp=Math.max(performance.now(),window.hidEmissionStamp||0);
  for(const code of codes)for(const key of [...code,'Enter']){
   const event=new KeyboardEvent('keydown',{key,bubbles:true,cancelable:true});
   Object.defineProperty(event,'timeStamp',{value:stamp+=gap});
   document.body.dispatchEvent(event);
   if(deliveryDelay)await new Promise(resolve=>setTimeout(resolve,deliveryDelay));
  }
  window.hidEmissionStamp=stamp;
 },{codes,gap,deliveryDelay});
}

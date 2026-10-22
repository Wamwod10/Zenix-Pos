/** HID is only observed outside editable fields. Barcode input has its own Enter handler. */
export function createHidScanner(onScan,{maxGap=45,minLength=6}={}){
 let buffer='',last=0;
 // Measure when the browser created the input event, not when a busy UI handles it.
 return {reset(){buffer='';last=0},key(event,now=Number.isFinite(event.timeStamp)?event.timeStamp:performance.now()){
  if(event.blocked||event.editable||event.repeat||event.ctrlKey||event.altKey||event.metaKey){buffer='';last=0;return false}
  if(now-last>maxGap)buffer='';
  last=now;
  if(event.key==='Enter'){const code=buffer;buffer='';if(code.length>=minLength){onScan(code);return true}return false}
  if(event.key.length===1&&/^[\x20-\x7e]$/.test(event.key)){buffer=(buffer+event.key).slice(-128)}else buffer='';
  return false;
 }};
}
export function ean13CheckDigit(body){
 if(!/^\d{12}$/.test(body))throw Error('Invalid EAN-13 body');
 return String((10-[...body].reduce((sum,n,i)=>sum+Number(n)*(i%2?3:1),0)%10)%10);
}
export function validateWeightSchemes(schemes){
 if(!Array.isArray(schemes)||schemes.length>20)throw Error('Invalid scale configuration');
 for(const s of schemes){
  if(!s||!/^\d{2,4}$/.test(s.prefix)||![s.productStart,s.productLength,s.valueStart,s.valueLength].every(Number.isInteger)
   ||s.productLength<1||s.valueLength<1||s.productLength>8||s.valueLength>8||s.productStart<s.prefix.length||s.valueStart<s.prefix.length
   ||s.productStart+s.productLength>12||s.valueStart+s.valueLength>12
   ||s.productStart<s.valueStart+s.valueLength&&s.valueStart<s.productStart+s.productLength
   ||![1,10,100,1000,10000].includes(s.divisor)||!['kg','g','l','ml'].includes(s.unit)||!['weight','price',undefined].includes(s.encoding))throw Error('Invalid scale configuration');
 }
 for(let i=0;i<schemes.length;i++)for(let j=i+1;j<schemes.length;j++)if(schemes[i].prefix.startsWith(schemes[j].prefix)||schemes[j].prefix.startsWith(schemes[i].prefix))throw Error('Ambiguous scale configuration');
 return schemes;
}
export function decodeWeightBarcode(code,schemes=[]){
 validateWeightSchemes(schemes);
 if(!/^\d{13}$/.test(code))return null;
 const scheme=schemes.find(s=>code.startsWith(s.prefix));if(!scheme)return null;
 if(ean13CheckDigit(code.slice(0,12))!==code[12])throw Error('Tarozi barcode checksum noto‘g‘ri');
 const value=Number(code.slice(scheme.valueStart,scheme.valueStart+scheme.valueLength))/scheme.divisor;
 if(value<=0)throw Error('Tarozi qiymati noto‘g‘ri');
 return {productCode:code.slice(scheme.productStart,scheme.productStart+scheme.productLength),...(scheme.encoding==='price'?{amount:value}:{quantity:value}),unit:scheme.unit};
}
// Protocol-specific implementations can be injected after device acceptance testing.
export const hardwareCapabilities=()=>({hid:true,browserPrint:true,serialAPI:Boolean(globalThis.navigator?.serial),usbAPI:Boolean(globalThis.navigator?.usb),scaleAdapter:false,escPosAdapter:false,cashDrawerAdapter:false});

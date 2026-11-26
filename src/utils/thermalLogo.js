// Strictly bounded, inline raster images only. No network fetch or SVG in receipts.
export function thermalLogoSource(value){
 if(typeof value!=='string'||value.length>22000||!/^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/.test(value))return '';
 try{
  const bytes=atob(value.slice(22));
  if(bytes.length<45||bytes.length>16384||btoa(bytes)!==value.slice(22)||bytes.slice(0,8)!=="\x89PNG\r\n\x1a\n"||bytes.slice(12,16)!=="IHDR"||bytes.slice(-12)!=="\0\0\0\0IEND\xaeB\x60\x82")return '';
  const number=offset=>Array.from(bytes.slice(offset,offset+4)).reduce((n,ch)=>n*256+ch.charCodeAt(0),0);
  const w=number(16),h=number(20);
  return number(8)===13&&w>0&&w<=192&&h>0&&h<=96?value:'';
 }catch{return ''}
}
export async function prepareThermalLogo(file){
 if(!file||!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>2*1024*1024)throw Error('PNG, JPG yoki WebP rasm tanlang (2 MB gacha).');
 const url=URL.createObjectURL(file);
 try{
  const image=new Image();
  await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=()=>reject(Error('Rasmni ochib bo‘lmadi.'));image.src=url});
  if(!image.naturalWidth||!image.naturalHeight||image.naturalWidth*image.naturalHeight>16000000)throw Error('Rasm o‘lchami juda katta.');
  const ratio=Math.min(192/image.naturalWidth,96/image.naturalHeight,1);
  const canvas=document.createElement('canvas');
  canvas.width=Math.max(1,Math.floor(image.naturalWidth*ratio));canvas.height=Math.max(1,Math.floor(image.naturalHeight*ratio));
  const context=canvas.getContext('2d',{willReadFrequently:true});
  if(!context)throw Error('Brauzer rasmni tayyorlay olmadi.');
  context.fillStyle='#fff';context.fillRect(0,0,canvas.width,canvas.height);context.drawImage(image,0,0,canvas.width,canvas.height);
  const pixels=context.getImageData(0,0,canvas.width,canvas.height);
  for(let i=0;i<pixels.data.length;i+=4){const gray=.2126*pixels.data[i]+.7152*pixels.data[i+1]+.0722*pixels.data[i+2];const color=gray<155?0:255;pixels.data[i]=pixels.data[i+1]=pixels.data[i+2]=color;pixels.data[i+3]=255}
  context.putImageData(pixels,0,0);
  const data=thermalLogoSource(canvas.toDataURL('image/png'));
  if(!data)throw Error('Logotip sig‘madi. Soddaroq rasm tanlang.');
  return data;
 }finally{URL.revokeObjectURL(url)}
}

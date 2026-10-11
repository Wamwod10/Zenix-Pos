import { lineAmount, roundMoney } from './posMoney.js';

export const PRODUCT_UNITS = ['dona','kg','gramm','litr','metr','quti','blok','pachka'];
export const PACKAGING_UNITS = ['dona','blok','quti','pachka'];
export const productMetadata=(value={},previous={})=>{
 const keys=['variant','size','color','weight','volume','model','warranty','imageKey','imageName','packaging','manufacturedDate','expiryDate','trackingMode','lotTracking'];
 return {...previous,...(value.metadata||{}),...Object.fromEntries(keys.filter(key=>Object.hasOwn(value,key)).map(key=>[key,value[key]]))};
};
const numeric=(value,positive=false)=>{
 const number=Number(value);
 if(value===''||value==null||!Number.isFinite(number)||(positive?number<=0:number<0))throw new RangeError('Invalid product option');
 return number;
};
export const normalizePackaging=(rows=[])=>{
 if(!Array.isArray(rows)||rows.length>20||new Set(rows.map(row=>row.unit)).size!==rows.length)throw new RangeError('Invalid packaging options');
 return rows.map(row=>{
 if(!PACKAGING_UNITS.includes(row.unit))throw new RangeError('Invalid packaging unit');
 const factor=numeric(row.factor,true);
 if(factor<0.001||factor>1000000||Number(factor.toFixed(3))!==factor)throw new RangeError('Invalid packaging factor');
 return {...row,unit:row.unit,factor,salePrice:roundMoney(numeric(row.salePrice))};
 });
};
export const packagingReceiptTotals=(quantity,packageCost,packaging={factor:1})=>{
 const factor=numeric(packaging.factor,true),count=numeric(quantity,true),cost=numeric(packageCost);
 const rawQuantity=count*factor;
 if(!Number.isFinite(rawQuantity)||rawQuantity>999999999||Math.abs(rawQuantity*1000-Math.round(rawQuantity*1000))>0.000001)throw new RangeError('Invalid base quantity');
 const baseQuantity=Math.round(rawQuantity*1000)/1000;
 return {baseQuantity,totalCost:lineAmount(count,cost),baseUnitCost:cost/factor};
};
export const validateProductOptions=(value={})=>{
 const errors={};
 try{normalizePackaging(value.packaging||[])}catch{errors.packaging='Qadoq birliklari takrorlanmasin. Koeffitsiyent 0.001–1000000 va ko‘pi bilan 3 kasr xona, narx manfiy bo‘lmasin.'}
 if(value.manufacturedDate&&value.expiryDate&&value.expiryDate<value.manufacturedDate)errors.expiryDate='Yaroqlilik sanasi ishlab chiqarilgan sanadan oldin bo‘lmasin.';
 return errors;
};

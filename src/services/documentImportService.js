import { readSpreadsheetFile, unzipArchive, zipEntryText } from "../utils/spreadsheetImport.js";

const IMAGE_EXTENSIONS=new Set(["jpg","jpeg","png","webp","heic","heif","bmp","tif","tiff"]);
const DOCUMENT_EXTENSIONS=new Set(["pdf","doc","docx"]);
const TEXT_EXTENSIONS=new Set(["txt","rtf","md","log","xml","html","htm","yaml","yml"]);
const STRUCTURED_EXTENSIONS=new Set(["json"]);
const SPREADSHEET_EXTENSIONS=new Set(["csv","tsv","xlsx"]);
export const MAX_LOCAL_IMPORT_BYTES=25*1024*1024;

export const fileExtension=(file)=>String(file?.name||"").split(".").pop()?.toLowerCase()||"";

export const detectImportKind=(file)=>{
  const ext=fileExtension(file);
  const type=String(file?.type||"").toLowerCase();
  if(SPREADSHEET_EXTENSIONS.has(ext)||type.includes("spreadsheet")||type.includes("csv"))return "spreadsheet";
  if(STRUCTURED_EXTENSIONS.has(ext)||type.includes("json"))return "structured";
  if(TEXT_EXTENSIONS.has(ext)||type.startsWith("text/"))return "text";
  if(ext==="xls")return "legacy-spreadsheet";
  if(ext==="pdf"||type==="application/pdf")return "pdf";
  if(IMAGE_EXTENSIONS.has(ext)||type.startsWith("image/"))return "image";
  if(DOCUMENT_EXTENSIONS.has(ext)||type.includes("word"))return "document";
  return "unknown";
};

const cleanText=(value)=>String(value||"")
  .replace(/\u00a0/g," ")
  .replace(/[\t ]+/g," ")
  .replace(/\r/g,"")
  .trim();

const rtfToText=(value)=>cleanText(String(value||"")
  .replace(/\\par[d]?\b/g,"\n")
  .replace(/\\'[0-9a-fA-F]{2}/g," ")
  .replace(/\\[a-zA-Z]+-?\d* ?/g,"")
  .replace(/[{}]/g,""));

const decodeXmlEntities=(value="")=>String(value)
  .replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&quot;/g,'"').replace(/&apos;/g,"'").replace(/&amp;/g,"&");

// Word tables express each field as its own paragraph. Preserve table rows
// before stripping tags so product, quantity and price stay on ONE logical line.
export const extractDocxTextFromXml=(xml="")=>{
  const withTableRows=String(xml).replace(/<w:tbl\b[^>]*>[\s\S]*?<\/w:tbl>/gi,(table)=>table
    .replace(/<\/w:p>/gi," ")
    .replace(/<\/w:tc>/gi,"\t")
    .replace(/<\/w:tr>/gi,"\n"));
  return cleanText(decodeXmlEntities(withTableRows
    .replace(/<w:tab\b[^>]*\/>/gi,"\t")
    .replace(/<w:br\b[^>]*\/>/gi,"\n")
    .replace(/<\/w:p>/gi,"\n")
    .replace(/<w:t\b[^>]*>([\s\S]*?)<\/w:t>/gi,"$1")
    .replace(/<[^>]+>/g,"")));
};

// Extract Word table cells as structured rows instead of guessing quantities
// from flattened prose. A valid name+quantity header is required for mapping.
export const parseDocxTableRowsFromXml=(xml="")=>{
  const imported=[];
  for(const table of String(xml).matchAll(/<w:tbl\b[^>]*>([\s\S]*?)<\/w:tbl>/gi)){
    const matrix=[];
    for(const row of table[1].matchAll(/<w:tr\b[^>]*>([\s\S]*?)<\/w:tr>/gi)){
      const cells=[...row[1].matchAll(/<w:tc\b[^>]*>([\s\S]*?)<\/w:tc>/gi)]
        .map(match=>cleanText(decodeXmlEntities([...match[1].matchAll(/<w:t\b[^>]*>([\s\S]*?)<\/w:t>/gi)]
          .map(token=>token[1]).join(" "))));
      if(cells.length)matrix.push(cells);
    }
    const index=matrix.findIndex(row=>row.some(cell=>aliasSet.name.has(structuredKey(cell)))
      &&row.some(cell=>aliasSet.qty.has(structuredKey(cell))));
    if(index<0)continue;
    const headers=matrix[index];
    const items=matrix.slice(index+1).map(row=>Object.fromEntries(headers.map((key,i)=>[key,row[i]||""])));
    const result=parseStructuredJsonText(JSON.stringify({items}));
    // Every DOCX row stays review-only even when all cells are present.
    imported.push(...result.rows.map(row=>({...row,confidence:"review",missing:[...row.missing,"DOCX jadvalini tekshiring"]})));
  }
  return imported;
};

const latin1Decoder=new TextDecoder("latin1");
const utf8Decoder=new TextDecoder("utf-8");
const decodePdfBytes=(bytes)=>{
  if(!bytes?.length)return "";
  if(bytes[0]===0xfe&&bytes[1]===0xff){
    let out="";for(let i=2;i+1<bytes.length;i+=2)out+=String.fromCharCode((bytes[i]<<8)|bytes[i+1]);return out;
  }
  const zeroes=Array.from(bytes).filter((value)=>value===0).length;
  if(bytes.length>=4&&zeroes/bytes.length>.22){
    let out="";for(let i=0;i+1<bytes.length;i+=2)out+=String.fromCharCode((bytes[i]<<8)|bytes[i+1]);return out;
  }
  try{return utf8Decoder.decode(bytes)}catch{return latin1Decoder.decode(bytes)}
};

const pdfLiteralBytes=(raw="")=>{
  const bytes=[];
  for(let i=0;i<raw.length;i+=1){
    const code=raw.charCodeAt(i)&255;
    if(code!==92){bytes.push(code);continue}
    const next=raw[i+1];
    if(next==="n"){bytes.push(10);i+=1;continue}
    if(next==="r"){bytes.push(13);i+=1;continue}
    if(next==="t"){bytes.push(9);i+=1;continue}
    if(next==="b"){bytes.push(8);i+=1;continue}
    if(next==="f"){bytes.push(12);i+=1;continue}
    if(next==="("||next===")"||next==="\\"){bytes.push(next.charCodeAt(0));i+=1;continue}
    const oct=raw.slice(i+1).match(/^[0-7]{1,3}/)?.[0];
    if(oct){bytes.push(parseInt(oct,8)&255);i+=oct.length;continue}
    if(next==="\r"&&raw[i+2]==="\n"){i+=2;continue}
    if(next==="\r"||next==="\n"){i+=1;continue}
    if(next){bytes.push(next.charCodeAt(0)&255);i+=1}
  }
  return new Uint8Array(bytes);
};

const decodePdfHex=(hex="")=>{
  const clean=String(hex).replace(/\s/g,"");
  const padded=clean.length%2?`${clean}0`:clean;
  const bytes=new Uint8Array(padded.length/2);
  for(let i=0;i<padded.length;i+=2)bytes[i/2]=parseInt(padded.slice(i,i+2),16)||0;
  return decodePdfBytes(bytes);
};

const extractPdfTextOperators=(content="")=>{
  const chunks=[];
  const pushLiteral=(raw)=>{const text=decodePdfBytes(pdfLiteralBytes(raw));if(text.trim())chunks.push(text)};
  for(const match of String(content).matchAll(/\(((?:\\.|[^\\)])*)\)\s*Tj\b/gs))pushLiteral(match[1]);
  for(const match of String(content).matchAll(/<([0-9A-Fa-f\s]+)>\s*Tj\b/g)){const text=decodePdfHex(match[1]);if(text.trim())chunks.push(text)}
  for(const match of String(content).matchAll(/\[([\s\S]*?)\]\s*TJ\b/g)){
    const parts=[];
    for(const token of match[1].matchAll(/\(((?:\\.|[^\\)])*)\)|<([0-9A-Fa-f\s]+)>/gs)){
      const text=token[1]!==undefined?decodePdfBytes(pdfLiteralBytes(token[1])):decodePdfHex(token[2]);
      if(text)parts.push(text);
    }
    if(parts.length)chunks.push(parts.join(""));
  }
  return cleanText(chunks.join("\n"));
};

const inflatePdfStream=async(bytes)=>{
  if(typeof DecompressionStream==="undefined")return null;
  try{
    const response=new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate")));
    return new Uint8Array(await response.arrayBuffer());
  }catch{return null}
};

export const extractPdfTextFromArrayBuffer=async(arrayBuffer)=>{
  const bytes=new Uint8Array(arrayBuffer);
  const raw=latin1Decoder.decode(bytes);
  const texts=[];
  let cursor=0;
  while(cursor<raw.length){
    const match=/stream\r?\n/g.exec(raw.slice(cursor));
    if(!match)break;
    const streamKeyword=cursor+match.index;
    const dataStart=streamKeyword+match[0].length;
    const end=raw.indexOf("endstream",dataStart);
    if(end<0)break;
    const dictStart=Math.max(raw.lastIndexOf("<<",streamKeyword),streamKeyword-1000);
    const dictionary=raw.slice(dictStart,streamKeyword);
    let dataEnd=end;
    while(dataEnd>dataStart&&(raw[dataEnd-1]==="\r"||raw[dataEnd-1]==="\n"))dataEnd-=1;
    const streamBytes=bytes.slice(dataStart,dataEnd);
    let decodedBytes=streamBytes;
    if(/\/FlateDecode\b/.test(dictionary))decodedBytes=await inflatePdfStream(streamBytes);
    else if(/\/Filter\b/.test(dictionary)&&!/\/FlateDecode\b/.test(dictionary))decodedBytes=null;
    if(decodedBytes){const extracted=extractPdfTextOperators(latin1Decoder.decode(decodedBytes));if(extracted)texts.push(extracted)}
    cursor=end+9;
  }
  if(!texts.length){const fallback=extractPdfTextOperators(raw);if(fallback)texts.push(fallback)}
  return cleanText(texts.join("\n"));
};


const structuredKey=(value)=>String(value||"").toLowerCase().replace(/[^a-z0-9а-яёʻ’']/gi,"");
const STRUCTURED_FIELD_ALIASES={
  name:["name","product","productname","item","itemname","nomi","mahsulot","наименование","товар"],
  barcode:["barcode","barcodeno","gtin","ean","upc","shtrixkod","shtrix","штрихкод"],
  sku:["sku","article","artikul","артикул","код"],
  qty:["qty","quantity","count","amount","miqdor","soni","количество","колво"],
  costPrice:["cost","costprice","purchaseprice","buyprice","tannarx","закупочнаяцена","себестоимость","цена"],
  sellPrice:["sellprice","saleprice","retailprice","price","sotuvnarxi","розничнаяцена"],
  unit:["unit","uom","olchov","o‘lchov","birlik","единица"],
  category:["category","kategoriya","категория"],
  brand:["brand","brend","бренд"],
};
const STRUCTURED_META_ALIASES={
  supplier:["supplier","suppliername","vendor","vendorname","taminotchi","ta’minotchi","ta'minotchi","поставщик"],
  invoiceNo:["invoice","invoiceno","invoicenumber","documentno","documentnumber","nakladnoy","накладная","номернакладной"],
  date:["date","documentdate","invoicedate","sana","дата"],
  dueDate:["duedate","paymentdue","deadline","muddat","срокоплаты"],
  total:["total","grandtotal","amounttotal","jami","итого","сумма"],
  paid:["paid","paidamount","payment","tolangan","to’langan","to'langan","оплачено"],
  debt:["debt","balance","remaining","qarz","долг","остатокдолга"],
};
const aliasSet=Object.fromEntries(Object.entries(STRUCTURED_FIELD_ALIASES).map(([field,values])=>[field,new Set(values.map(structuredKey))]));
const metaAliasSet=Object.fromEntries(Object.entries(STRUCTURED_META_ALIASES).map(([field,values])=>[field,new Set(values.map(structuredKey))]));
const structuredValue=(object,field)=>{
  if(!object||typeof object!=="object"||Array.isArray(object))return "";
  for(const [key,value] of Object.entries(object)){if(aliasSet[field]?.has(structuredKey(key)))return value}
  return "";
};
const primitiveStructuredValue=(value)=>{
  if(value==null)return "";
  if(["string","number","boolean"].includes(typeof value))return value;
  if(typeof value==="object"&&!Array.isArray(value)){
    for(const key of ["name","title","value","number","no","id"]){
      const found=value[key];
      if(["string","number"].includes(typeof found))return found;
    }
  }
  return "";
};
const structuredMetaValue=(value,field,depth=0)=>{
  if(depth>6||value==null)return "";
  if(Array.isArray(value)){
    for(const item of value){const found=structuredMetaValue(item,field,depth+1);if(found!=="")return found}
    return "";
  }
  if(typeof value!=="object")return "";
  for(const [key,entry] of Object.entries(value)){
    if(metaAliasSet[field]?.has(structuredKey(key))){
      const primitive=primitiveStructuredValue(entry);
      if(primitive!=="")return primitive;
    }
  }
  for(const entry of Object.values(value)){
    const found=structuredMetaValue(entry,field,depth+1);
    if(found!=="")return found;
  }
  return "";
};
const structuredMeta=(parsed)=>({
  supplier:cleanText(structuredMetaValue(parsed,"supplier")),
  invoiceNo:cleanText(structuredMetaValue(parsed,"invoiceNo")),
  date:cleanText(structuredMetaValue(parsed,"date")),
  dueDate:cleanText(structuredMetaValue(parsed,"dueDate")),
  total:amountNumber(structuredMetaValue(parsed,"total")),
  paid:amountNumber(structuredMetaValue(parsed,"paid")),
  debt:amountNumber(structuredMetaValue(parsed,"debt")),
});

const structuredObjects=(value,depth=0)=>{
  if(depth>6||value==null)return [];
  if(Array.isArray(value)){
    const direct=value.filter((item)=>item&&typeof item==="object"&&!Array.isArray(item));
    const productLike=direct.filter((item)=>structuredValue(item,"name")||structuredValue(item,"barcode")||structuredValue(item,"sku"));
    if(productLike.length)return productLike;
    return value.flatMap((item)=>structuredObjects(item,depth+1));
  }
  if(typeof value==="object"){
    if(structuredValue(value,"name")||structuredValue(value,"barcode")||structuredValue(value,"sku"))return [value];
    return Object.values(value).flatMap((item)=>structuredObjects(item,depth+1));
  }
  return [];
};

export const parseStructuredJsonText=(raw)=>{
  let parsed;
  try{parsed=JSON.parse(String(raw||""))}catch{return {meta:{},rows:[],confidence:"low",message:"JSON strukturasini o‘qib bo‘lmadi."}}
  const meta=structuredMeta(parsed);
  const objects=structuredObjects(parsed);
  const rows=objects.map((item,index)=>{
    const name=cleanText(structuredValue(item,"name"));
    const barcode=cleanText(structuredValue(item,"barcode"));
    const sku=cleanText(structuredValue(item,"sku"));
    const qty=amountNumber(structuredValue(item,"qty"));
    const costPrice=amountNumber(structuredValue(item,"costPrice"));
    const sellPrice=amountNumber(structuredValue(item,"sellPrice"));
    if(!qty||(!name&&!barcode&&!sku))return null;
    const missing=[];if(!costPrice)missing.push("tannarx");if(!name)missing.push("nomi");
    return {
      id:`json-${index}-${crypto.randomUUID().slice(0,8)}`,name,barcode,sku,qty:String(qty),
      costPrice:costPrice?String(costPrice):"",sellPrice:sellPrice?String(sellPrice):"",
      unit:cleanText(structuredValue(item,"unit"))||"dona",category:cleanText(structuredValue(item,"category")),brand:cleanText(structuredValue(item,"brand")),
      missing,confidence:missing.length?"review":"high",
    };
  }).filter(Boolean);
  return {meta,rows,confidence:rows.length?"review":"low"};
};

const markupToText=(value="")=>cleanText(decodeXmlEntities(String(value)
  .replace(/<(?:br|\/p|\/div|\/tr|\/li|\/h[1-6])\b[^>]*>/gi,"\n")
  .replace(/<\/?(?:td|th)\b[^>]*>/gi," ")
  .replace(/<script\b[\s\S]*?<\/script>/gi,"")
  .replace(/<style\b[\s\S]*?<\/style>/gi,"")
  .replace(/<[^>]+>/g," ")));

// Monetary separators must not turn 12,000 UZS into 12 UZS.
export const amountNumber=(value)=>{
  const raw=String(value??"").replace(/[\s\u00a0]/g,"").replace(/[^0-9,.-]/g,"");
  if(!raw||raw.startsWith("-"))return 0;
  const comma=raw.lastIndexOf(","),dot=raw.lastIndexOf(".");
  let normalized=raw;
  if(comma>=0&&dot>=0){
    // Last separator is the decimal mark; the other is a thousands grouping.
    const decimal=comma>dot?",":".";
    normalized=raw.replace(decimal==="."?/,/g:/\./g,"").replace(decimal,".");
  }else if(comma>=0){
    const parts=raw.split(",");
    normalized=parts.length>2||parts[parts.length-1]?.length===3?parts.join(""):raw.replace(",",".");
  }else if(dot>=0){
    const parts=raw.split(".");
    if(parts.length>2||parts[parts.length-1]?.length===3)normalized=parts.join("");
  }
  const number=Number(normalized);
  return Number.isFinite(number)&&number>=0?number:0;
};

const firstMatch=(text,patterns)=>{
  for(const pattern of patterns){
    const match=text.match(pattern);
    if(match?.[1])return cleanText(match[1]);
  }
  return "";
};

const extractAmount=(text,labels)=>{
  const label=labels.join("|");
  const patterns=[
    new RegExp(`(?:${label})\\s*[:=–—-]?\\s*([0-9][0-9\\s.,]*)`,"i"),
    new RegExp(`([0-9][0-9\\s.,]*)\\s*(?:so['’]?m|sum|uzs)?\\s*(?:${label})`,"i"),
  ];
  for(const pattern of patterns){
    const match=text.match(pattern);
    if(match?.[1])return amountNumber(match[1]);
  }
  return 0;
};

const UNIT_PATTERN="dona|ta|pcs?|шт\\.?|kg|кг|g|гр|l|litr|литр|metr|метр|quti|короб";
const moneyTokens=(line)=>[...String(line).matchAll(/(?:^|\s)([0-9][0-9\s.,]{2,})(?=\s*(?:so['’]?m|sum|uzs|$|x|×))/gi)]
  .map((match)=>amountNumber(match[1])).filter((value)=>value>0);

const parseLooseProductLine=(raw,index)=>{
  const line=cleanText(raw).replace(/^[-•·*]+\s*/,"");
  if(!line||line.length<3)return null;
  if(/^(jami|итого|total|to['’]?langan|оплачено|qarz|долг|ta['’]?minotchi|поставщик|supplier|nakladnoy|invoice|hujjat)/i.test(line))return null;
  const barcodeMatch=line.match(/(?:^|\D)(\d{8,14})(?:\D|$)/);
  const multiplyMatch=line.match(new RegExp(`(?:^|\\s)(\\d+(?:[.,]\\d+)?)\\s*(?:${UNIT_PATTERN})?\\s*[x×]\\s*([0-9][0-9\\s.,]*)`,"i"));
  const explicit=[...line.matchAll(new RegExp(`(?:^|\\s)(\\d+(?:[.,]\\d+)?)\\s*(${UNIT_PATTERN})\\b`,"ig"))];
  // '1L' in the product name is *not* the stock quantity. A tabular
  // 'Name 24 8500 204000' row must be treated as review-only.
  const table=line.match(/^(.*?)\s+(\d+(?:[.,]\d+)?)\s+([\d\s.,]+?)\s+([\d\s.,]+)\s*$/);
  const tableQty=table?amountNumber(table[2]):0;
  const tableCost=table?amountNumber(table[3]):0;
  const tableTotal=table?amountNumber(table[4]):0;
  const tableConsistent=table&&tableQty>0&&tableCost>0&&Math.abs(tableQty*tableCost-tableTotal)<=Math.max(0.02,tableTotal*0.001);
  const qtyMatch=explicit.findLast(match=>/^(?:dona|ta|pcs?|шт\.?)$/i.test(match[2]))||null;
  const qty=tableConsistent?tableQty:amountNumber(qtyMatch?.[1]||multiplyMatch?.[1]||0);
  if(qty<=0)return null;
  const costPrice=tableConsistent?tableCost:amountNumber(multiplyMatch?.[2]||0);
  let name=tableConsistent?table[1]:line.slice(0,Math.min(...[qtyMatch?.index,multiplyMatch?.index].filter((v)=>Number.isInteger(v)&&v>=0)));
  if(barcodeMatch?.[1])name=name.replace(barcodeMatch[1],"");
  name=cleanText(name.replace(/[|;,:-]+$/, ""));
  if(name.length<2)return null;
  const missing=["hujjat qatori: miqdor va tannarxni tasdiqlang"];
  if(!costPrice)missing.push("tannarx");
  return {id:`text-${index}-${crypto.randomUUID().slice(0,8)}`,name,barcode:barcodeMatch?.[1]||"",sku:"",qty:String(qty),costPrice:costPrice?String(costPrice):"",sellPrice:"",unit:qtyMatch?.[2]||"dona",category:"",brand:"",missing,confidence:"review"};
};

export const parseLooseDocumentText=(input)=>{
  const text=cleanText(input);
  const lines=text.split(/\n+/).map(cleanText).filter(Boolean);
  const supplier=firstMatch(text,[
    /(?:ta['’]?minotchi|supplier|поставщик)\s*[:=–—-]?\s*([^\n]+)/i,
  ]);
  const invoiceNo=firstMatch(text,[
    /(?:nakladnoy|накладн(?:ая|ой)|invoice|hisob(?:-faktura)?|hujjat)\s*(?:№|#|no\.?|raqami)?\s*[:=–—-]?\s*([A-ZА-Я0-9/_-]+)/i,
  ]);
  const total=extractAmount(text,["jami","итого","total","umumiy"]);
  const paid=extractAmount(text,["to['’]?langan","оплачено","paid"]);
  const debt=extractAmount(text,["qarz","долг","balance"]);
  const rows=lines.map(parseLooseProductLine).filter(Boolean);

  return {
    meta:{supplier,invoiceNo,total,paid,debt},
    rows,
    confidence:rows.length?"review":"low",
  };
};

export const analyzeImportFile=async(file)=>{
  const kind=detectImportKind(file);
  const base={
    id:crypto.randomUUID(),
    file,
    fileName:file?.name||"Noma’lum fayl",
    size:Number(file?.size||0),
    kind,
  };

  if(base.size>MAX_LOCAL_IMPORT_BYTES)return {...base,status:"server_required",message:"Fayl qabul qilindi. Hajmi katta bo‘lgani uchun browser ichida tahlil qilinmaydi; server hujjat tahlili kerak."};

  if(kind==="spreadsheet"){
    try{
      const table=await readSpreadsheetFile(file);
      return {...base,status:"parsed",table,meta:{}};
    }catch(error){
      return {...base,status:"error",message:error?.message||"Faylni o‘qib bo‘lmadi."};
    }
  }

  if(kind==="structured"){
    try{
      const extracted=parseStructuredJsonText(await file.text());
      if(!extracted.rows.length)return {...base,status:"review_text",meta:extracted.meta,rows:[],message:extracted.message||"JSON o‘qildi, lekin miqdori aniq ko‘rsatilgan mahsulot qatorlari topilmadi."};
      return {...base,status:"parsed_text",...extracted,message:"JSON ma’lumotlari o‘qildi. Omborga yozishdan oldin ko‘rib chiqing."};
    }catch(error){return {...base,status:"error",message:error?.message||"JSON faylni o‘qib bo‘lmadi."}}
  }

  if(kind==="text"){
    try{
      const raw=await file.text();
      const ext=fileExtension(file);
      const text=ext==="rtf"?rtfToText(raw):["xml","html","htm"].includes(ext)?markupToText(raw):raw;
      const extracted=parseLooseDocumentText(text);
      if(!extracted.rows.length){
        return {...base,status:"review_text",meta:extracted.meta,rows:[],message:"Matn o‘qildi, lekin miqdori aniq ko‘rsatilgan mahsulot qatorlari ishonchli topilmadi. Ko‘rib chiqishda qo‘lda tekshiring."};
      }
      return {...base,status:"parsed_text",...extracted};
    }catch(error){
      return {...base,status:"error",message:error?.message||"Matnli faylni o‘qib bo‘lmadi."};
    }
  }

  if(kind==="legacy-spreadsheet"){
    return {...base,status:"needs_conversion",message:"Eski .xls fayl tanlandi. Server tahlili bu formatni o‘giradi; hozircha faylni .xlsx qilib saqlab yuklash mumkin."};
  }

  if(kind==="document"&&fileExtension(file)==="docx"){
    try{
      const entries=await unzipArchive(await file.arrayBuffer());
      const xml=zipEntryText(entries,"word/document.xml");
      if(!xml)throw new Error("DOCX ichidagi matn topilmadi.");
      const text=extractDocxTextFromXml(xml);
      const extracted=parseLooseDocumentText(text);
      const tableRows=parseDocxTableRowsFromXml(xml);
      const rows=tableRows.length?tableRows:extracted.rows;
      return rows.length
        ? {...base,status:"parsed_text",...extracted,rows,confidence:"review",message:"DOCX jadvali/matni o‘qildi. Har bir qatorni omborga yozishdan oldin tekshiring."}
        : {...base,status:"review_text",meta:extracted.meta,rows:[],extractedText:text,message:"DOCX matni o‘qildi, lekin miqdori aniq ko‘rsatilgan mahsulot qatorlari topilmadi."};
    }catch(error){return {...base,status:"error",message:error?.message||"DOCX faylni o‘qib bo‘lmadi."}}
  }

  if(kind==="pdf"){
    try{
      const text=await extractPdfTextFromArrayBuffer(await file.arrayBuffer());
      if(text){
        const extracted=parseLooseDocumentText(text);
        if(extracted.rows.length)return {...base,status:"parsed_text",...extracted,extractedText:text,message:"PDF ichidagi matn o‘qildi. Qiymatlarni ko‘rib chiqing."};
        return {...base,status:"review_text",meta:extracted.meta,rows:[],extractedText:text,message:"PDF matni o‘qildi, lekin ishonchli mahsulot qatorlari topilmadi. Hujjatni ko‘rib chiqing."};
      }
    }catch{/* OCR fallback below */}
    return {...base,status:"recognition_required",message:"PDF qabul qilindi, lekin ichida o‘qiladigan matn qatlami topilmadi. Skanerlangan PDF uchun OCR tahlili kerak; tasdiqsiz omborga hech narsa yozilmaydi."};
  }

  if(kind==="image"){
    return {...base,status:"recognition_required",message:"Rasm qabul qilindi. Matnni aniq ajratish uchun OCR tahlili kerak; tasdiqsiz omborga hech narsa yozilmaydi."};
  }

  if(kind==="document"){
    return {...base,status:"recognition_required",message:"Fayl qabul qilindi. Bu hujjat formatini ishonchli ajratish uchun server hujjat tahlili kerak; tasdiqsiz omborga hech narsa yozilmaydi."};
  }

  return {...base,status:"server_required",message:"Fayl qabul qilindi. Bu formatni ishonchli tushunish uchun server hujjat tahlili kerak; tasdiqsiz omborga hech narsa yozilmaydi."};
};

export const analyzeImportFiles=async(files)=>Promise.all(Array.from(files||[]).map(analyzeImportFile));

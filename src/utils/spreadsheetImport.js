const textDecoder = new TextDecoder("utf-8");

const xmlDecode = (value = "") => String(value)
  .replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&quot;/g,'"').replace(/&apos;/g,"'").replace(/&amp;/g,"&");

const stripTags = (value = "") => xmlDecode(String(value).replace(/<[^>]*>/g,""));

const columnIndex = (ref = "A1") => {
  const letters = String(ref).match(/[A-Z]+/i)?.[0]?.toUpperCase() || "A";
  let result = 0;
  for (const char of letters) result = result * 26 + char.charCodeAt(0) - 64;
  return Math.max(0,result-1);
};

const expandScientific = (raw) => {
  const text=String(raw??"").trim();
  const match=text.match(/^([+-]?)(\d+)(?:\.(\d*))?[eE]([+-]?\d+)$/);
  if(!match)return text;
  const [,sign,whole,fraction="",expRaw]=match;
  const exp=Number(expRaw);
  if(!Number.isFinite(exp))return text;
  const digits=whole+fraction;
  const point=whole.length+exp;
  if(point<=0)return `${sign}0.${"0".repeat(-point)}${digits}`;
  if(point>=digits.length)return `${sign}${digits}${"0".repeat(point-digits.length)}`;
  return `${sign}${digits.slice(0,point)}.${digits.slice(point)}`;
};

const parseCsvLine=(line,delimiter)=>{const out=[];let value="",quoted=false;for(let i=0;i<line.length;i+=1){const ch=line[i];if(ch==='"'&&quoted&&line[i+1]==='"'){value+='"';i+=1;continue}if(ch==='"'){quoted=!quoted;continue}if(ch===delimiter&&!quoted){out.push({value:value.trim(),format:""});value="";continue}value+=ch}out.push({value:value.trim(),format:""});return out};

export const parseCsvText=(text)=>{
  const lines=String(text||"").replace(/^\uFEFF/,"").split(/\r?\n/).filter(line=>line.trim());
  if(!lines.length)return{headers:[],rows:[],sheetName:"CSV"};
  const commas=(lines[0].match(/,/g)||[]).length, semis=(lines[0].match(/;/g)||[]).length, tabs=(lines[0].match(/\t/g)||[]).length;
  const delimiter=tabs>commas&&tabs>semis?"\t":semis>commas?";":",";
  const matrix=lines.map(line=>parseCsvLine(line,delimiter));
  return matrixToImport(matrix,"CSV");
};

const findEocd=(bytes)=>{
  for(let i=bytes.length-22;i>=Math.max(0,bytes.length-65557);i-=1){if(bytes[i]===0x50&&bytes[i+1]===0x4b&&bytes[i+2]===0x05&&bytes[i+3]===0x06)return i}
  return -1;
};

const inflateRaw=async(data)=>{
  if(typeof DecompressionStream==="undefined")throw new Error("Bu browser XLSX decompression'ni qo‘llamaydi");
  let stream;
  try{stream=new DecompressionStream("deflate-raw")}catch{stream=new DecompressionStream("deflate")}
  const response=new Response(new Blob([data]).stream().pipeThrough(stream));
  return new Uint8Array(await response.arrayBuffer());
};

const unzip=async(arrayBuffer)=>{
  const bytes=new Uint8Array(arrayBuffer), view=new DataView(arrayBuffer);
  const eocd=findEocd(bytes);if(eocd<0)throw new Error("XLSX ZIP struktura topilmadi");
  const entryCount=view.getUint16(eocd+10,true), centralOffset=view.getUint32(eocd+16,true);
  const entries=new Map();let ptr=centralOffset;
  for(let i=0;i<entryCount;i+=1){
    if(view.getUint32(ptr,true)!==0x02014b50)throw new Error("XLSX central directory xato");
    const compression=view.getUint16(ptr+10,true), compressedSize=view.getUint32(ptr+20,true);
    const nameLen=view.getUint16(ptr+28,true),extraLen=view.getUint16(ptr+30,true),commentLen=view.getUint16(ptr+32,true),localOffset=view.getUint32(ptr+42,true);
    const name=textDecoder.decode(bytes.slice(ptr+46,ptr+46+nameLen));
    if(view.getUint32(localOffset,true)!==0x04034b50)throw new Error("XLSX local entry xato");
    const localNameLen=view.getUint16(localOffset+26,true),localExtraLen=view.getUint16(localOffset+28,true);
    const dataStart=localOffset+30+localNameLen+localExtraLen;
    const compressed=bytes.slice(dataStart,dataStart+compressedSize);
    let decoded;
    if(compression===0)decoded=compressed;
    else if(compression===8)decoded=await inflateRaw(compressed);
    else throw new Error(`Qo‘llab-quvvatlanmagan XLSX compression: ${compression}`);
    entries.set(name,decoded);
    ptr+=46+nameLen+extraLen+commentLen;
  }
  return entries;
};

const entryText=(entries,name)=>entries.has(name)?textDecoder.decode(entries.get(name)):"";
export const unzipArchive=unzip;
export const zipEntryText=entryText;
const resolvePath=(base,target)=>{
  if(target.startsWith("/"))return target.slice(1);
  const parts=(base+target).split("/");const out=[];
  for(const part of parts){if(!part||part===".")continue;if(part==="..")out.pop();else out.push(part)}
  return out.join("/");
};

const parseSharedStrings=(xml)=>{
  const list=[];
  for(const match of xml.matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g)){const parts=[...match[1].matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)].map(item=>xmlDecode(item[1]));list.push(parts.join(""))}
  return list;
};

const parseStyles=(xml)=>{
  const custom={};
  for(const match of xml.matchAll(/<numFmt\b[^>]*numFmtId="(\d+)"[^>]*formatCode="([^"]*)"[^>]*\/?>(?:<\/numFmt>)?/g))custom[Number(match[1])]=xmlDecode(match[2]);
  const xfsSection=xml.match(/<cellXfs\b[^>]*>([\s\S]*?)<\/cellXfs>/)?.[1]||"";
  const styles=[];
  for(const match of xfsSection.matchAll(/<xf\b([^>]*)\/?>(?:<\/xf>)?/g)){const id=Number(match[1].match(/numFmtId="(\d+)"/)?.[1]||0);styles.push(custom[id]||"")}
  return styles;
};

const cellValue=(cellXml,type,sharedStrings)=>{
  if(type==="inlineStr"){const parts=[...cellXml.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)].map(item=>xmlDecode(item[1]));return parts.join("")}
  const raw=cellXml.match(/<v\b[^>]*>([\s\S]*?)<\/v>/)?.[1]??"";
  if(type==="s")return sharedStrings[Number(raw)]??"";
  if(type==="b")return raw==="1"?"TRUE":"FALSE";
  return xmlDecode(raw);
};

const parseWorksheet=(xml,sharedStrings,styles)=>{
  const rows=[];
  for(const rowMatch of xml.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)){
    const cells=[];
    for(const cellMatch of rowMatch[1].matchAll(/<c\b([^>]*)>([\s\S]*?)<\/c>|<c\b([^>]*)\/>/g)){
      const attrs=cellMatch[1]||cellMatch[3]||"", body=cellMatch[2]||"";
      const ref=attrs.match(/\br="([^"]+)"/)?.[1]||"A1", type=attrs.match(/\bt="([^"]+)"/)?.[1]||"", styleIndex=Number(attrs.match(/\bs="(\d+)"/)?.[1]||-1);
      const index=columnIndex(ref), value=cellValue(body,type,sharedStrings);
      cells[index]={value,format:styleIndex>=0?(styles[styleIndex]||""):"",rawType:type};
    }
    rows.push(cells);
  }
  return rows;
};

const matrixToImport=(matrix,sheetName="Sheet1")=>{
  const headerRow=matrix.find(row=>row.some(cell=>String(cell?.value??"").trim()))||[];
  const headerIndex=matrix.indexOf(headerRow);
  const headers=headerRow.map(cell=>String(cell?.value??"").trim());
  const rows=matrix.slice(headerIndex+1).filter(row=>row.some(cell=>String(cell?.value??"").trim()));
  return{headers,rows,sheetName};
};

export const parseXlsxArrayBuffer=async(arrayBuffer)=>{
  const entries=await unzip(arrayBuffer);
  const workbook=entryText(entries,"xl/workbook.xml");
  const rels=entryText(entries,"xl/_rels/workbook.xml.rels");
  const relMap={};
  for(const match of rels.matchAll(/<Relationship\b([^>]*)\/?>(?:<\/Relationship>)?/g)){
    const id=match[1].match(/\bId="([^"]+)"/)?.[1],target=match[1].match(/\bTarget="([^"]+)"/)?.[1];
    if(id&&target)relMap[id]=target;
  }
  const firstSheet=workbook.match(/<sheet\b([^>]*)\/?>(?:<\/sheet>)?/);
  if(!firstSheet)throw new Error("Excel faylda sheet topilmadi");
  const attrs=firstSheet[1],sheetName=xmlDecode(attrs.match(/\bname="([^"]+)"/)?.[1]||"Sheet1"),relId=attrs.match(/(?:r:)?id="([^"]+)"/)?.[1];
  const target=relMap[relId]||"worksheets/sheet1.xml";
  const sheetPath=resolvePath("xl/",target);
  const sheetXml=entryText(entries,sheetPath);
  if(!sheetXml)throw new Error("Excel worksheet o‘qilmadi");
  const shared=parseSharedStrings(entryText(entries,"xl/sharedStrings.xml"));
  const styles=parseStyles(entryText(entries,"xl/styles.xml"));
  return matrixToImport(parseWorksheet(sheetXml,shared,styles),sheetName);
};

export const readSpreadsheetFile=async(file)=>{
  const name=String(file?.name||"").toLowerCase();
  if(name.endsWith(".csv")||name.endsWith(".tsv")||name.endsWith(".txt"))return parseCsvText(await file.text());
  if(name.endsWith(".xlsx"))return parseXlsxArrayBuffer(await file.arrayBuffer());
  if(name.endsWith(".xls"))throw new Error("Eski .xls format qo‘llab-quvvatlanmaydi. Faylni .xlsx yoki .csv formatida saqlang.");
  throw new Error("Excel yoki jadval faylini o‘qib bo‘lmadi.");
};

export const cellToText=(cell,{identifier=false}={})=>{
  let value=String(cell?.value??"").trim();
  if(identifier){
    value=expandScientific(value);
    const zeroFormat=String(cell?.format||"").replace(/[^0]/g,"");
    if(/^\d+$/.test(value)&&zeroFormat.length>value.length)value=value.padStart(zeroFormat.length,"0");
    return value;
  }
  return value;
};

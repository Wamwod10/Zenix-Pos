// Embedded TrueType font with explicit CID mapping and ToUnicode text extraction.
const encoder=new TextEncoder(),hex=n=>n.toString(16).padStart(4,'0').toUpperCase();
export function unicodeCatalogPdf(products,{fontBytes,storeName='',exportDate=new Date().toISOString().slice(0,10)}){
 const data=fontBytes instanceof Uint8Array?fontBytes:new Uint8Array(fontBytes),v=new DataView(data.buffer,data.byteOffset,data.byteLength),tables={};
 for(let i=0;i<v.getUint16(4);i++){const p=12+i*16;tables[String.fromCharCode(...data.slice(p,p+4))]=v.getUint32(p+8)}
 const cmap=tables.cmap;let sub;
 for(let i=0;i<v.getUint16(cmap+2);i++){const p=cmap+4+i*8,o=cmap+v.getUint32(p+4);if(v.getUint16(o)===4&&(v.getUint16(p)===0||v.getUint16(p)===3))sub=o}
 if(sub===undefined)throw new Error('PDF font Unicode xaritasi topilmadi');
 const segments=v.getUint16(sub+6)/2,end=sub+14,start=end+segments*2+2,delta=start+segments*2,range=delta+segments*2;
 const glyph=code=>{for(let i=0;i<segments;i++){if(code<v.getUint16(start+i*2)||code>v.getUint16(end+i*2))continue;const offset=v.getUint16(range+i*2),d=v.getInt16(delta+i*2);if(!offset)return (code+d)&65535;const g=v.getUint16(range+i*2+offset+2*(code-v.getUint16(start+i*2)));return g?(g+d)&65535:0}return 0};
 const units=v.getUint16(tables.head+18),metrics=v.getUint16(tables.hhea+34),used=new Map(),widths=new Map();
 const width=code=>{if(!widths.has(code)){const g=glyph(code);widths.set(code,Math.round(v.getUint16(tables.hmtx+4*Math.min(g,metrics-1))*1000/units))}return widths.get(code)};
 const text=value=>Array.from(String(value??'')).map(c=>{const code=c.codePointAt(0);if(code>65535||!glyph(code))throw new Error(`PDF font belgini qo'llamaydi: ${c}`);used.set(code,glyph(code));return hex(code)}).join('');
 const fit=(value,max)=>{let result='',sum=0;for(const c of String(value??'')){const next=width(c.charCodeAt(0))*8/1000;if(sum+next>max)break;result+=c;sum+=next}return result};
 const objects=[null],obj=value=>(objects.push(value),objects.length-1),stream=bytes=>[encoder.encode(`<< /Length ${bytes.length} >>\nstream\n`),bytes,encoder.encode('\nendstream')];
 const fontFile=obj([encoder.encode(`<< /Length ${data.length} /Length1 ${data.length} >>\nstream\n`),data,encoder.encode('\nendstream')]);
 const descriptor=obj(`<< /Type /FontDescriptor /FontName /NotoSans /Flags 32 /FontBBox [-1000 -1000 3000 3000] /ItalicAngle 0 /Ascent 1069 /Descent -293 /CapHeight 714 /StemV 80 /FontFile2 ${fontFile} 0 R >>`);
 const mapping=obj(''),unicode=obj(''),cid=obj(''),font=obj(`<< /Type /Font /Subtype /Type0 /BaseFont /NotoSans /Encoding /Identity-H /DescendantFonts [${cid} 0 R] /ToUnicode ${unicode} 0 R >>`),pages=obj(''),refs=[];
 const columns=[30,230,335,440,570,680],limits=[190,95,95,120,100,130],headers=['Mahsulot','SKU','Shtrix-kod','Kategoriya','Narx (so‘m)','Qoldiq / birlik'];
 const number=value=>new Intl.NumberFormat('uz-UZ',{maximumFractionDigits:3}).format(Number(value)||0).replace(/\u00a0|\u202f/g,' ');
 for(let i=0;i<Math.max(1,products.length);i+=28){
  let commands='BT /F1 8 Tf 0 g ';const put=(value,x,y)=>{commands+=`1 0 0 1 ${x} ${y} Tm <${text(value)}> Tj `};
  put(`Zenix POS · ${storeName} · ${exportDate}`,30,565);
  headers.forEach((h,k)=>put(h,columns[k],543));
  products.slice(i,i+28).forEach((p,n)=>{const row=[p.name,p.sku,p.barcode,p.category,number(p.sellPrice??p.price),`${number(p.quantity)} ${p.unit||'dona'}`];row.forEach((value,k)=>{const first=fit(value,limits[k]);put(first,columns[k],520-n*17);if(k===0&&first.length<String(value??'').length)put(fit(String(value).slice(first.length),limits[k]),columns[k],512-n*17)})});
  put(`${Math.floor(i/28)+1} / ${Math.max(1,Math.ceil(products.length/28))}`,30,25);commands+='ET';
  const content=obj(stream(encoder.encode(commands))),page=obj(`<< /Type /Page /Parent ${pages} 0 R /MediaBox [0 0 842 595] /Resources << /Font << /F1 ${font} 0 R >> >> /Contents ${content} 0 R >>`);refs.push(`${page} 0 R`);
 }
 const max=Math.max(...used.keys()),map=new Uint8Array((max+1)*2);for(const [code,g]of used){map[code*2]=g>>8;map[code*2+1]=g&255}objects[mapping]=stream(map);
 const entries=[...used.keys()].sort((a,b)=>a-b),groups=[];for(let i=0;i<entries.length;i+=100)groups.push(`${Math.min(100,entries.length-i)} beginbfchar\n${entries.slice(i,i+100).map(c=>`<${hex(c)}> <${hex(c)}>`).join('\n')}\nendbfchar`);
 objects[unicode]=stream(encoder.encode(`/CIDInit /ProcSet findresource begin 12 dict begin begincmap /CIDSystemInfo << /Registry (Adobe) /Ordering (UCS) /Supplement 0 >> def /CMapName /ZenixUnicode def /CMapType 2 def 1 begincodespacerange <0000> <FFFF> endcodespacerange\n${groups.join('\n')}\nendcmap CMapName currentdict /CMap defineresource pop end end`));
 objects[cid]=`<< /Type /Font /Subtype /CIDFontType2 /BaseFont /NotoSans /CIDSystemInfo << /Registry (Adobe) /Ordering (Identity) /Supplement 0 >> /FontDescriptor ${descriptor} 0 R /CIDToGIDMap ${mapping} 0 R /DW 600 /W [${entries.map(c=>`${c} [${width(c)}]`).join(' ')}] >>`;
 objects[pages]=`<< /Type /Pages /Kids [${refs.join(' ')}] /Count ${refs.length} >>`;const catalog=obj(`<< /Type /Catalog /Pages ${pages} 0 R >>`),chunks=[encoder.encode('%PDF-1.4\n')],offsets=[0];let length=chunks[0].length;
 const push=part=>{const bytes=typeof part==='string'?encoder.encode(part):part;chunks.push(bytes);length+=bytes.length};
 for(let n=1;n<objects.length;n++){offsets.push(length);push(`${n} 0 obj\n`);for(const part of Array.isArray(objects[n])?objects[n]:[objects[n]])push(part);push('\nendobj\n')}
 const xref=length;push(`xref\n0 ${objects.length}\n0000000000 65535 f \n${offsets.slice(1).map(o=>`${String(o).padStart(10,'0')} 00000 n \n`).join('')}trailer\n<< /Size ${objects.length} /Root ${catalog} 0 R >>\nstartxref\n${xref}\n%%EOF`);
 return new Blob(chunks,{type:'application/pdf'});
}

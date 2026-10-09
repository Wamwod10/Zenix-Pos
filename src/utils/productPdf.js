/** Standalone PDF 1.4 writer for a printable product catalog (no network dependency).
 * WinAnsi's limited repertoire requires transliteration of Uzbek Cyrillic.
 * Prices and barcodes retain ASCII digits; never place user text in PDF commands.
 */
const ascii=(v)=>String(v??"").normalize("NFKD").replace(/[‘’ʻʼ`]/g,"'").replace(/[^\x20-\x7e]/g,"?").slice(0,150);
const esc=(v)=>ascii(v).replace(/\\/g,"\\\\").replace(/\(/g,"\\(").replace(/\)/g,"\\)");
export function productCatalogPdf(products=[]){
  const objects=[null];const obj=(value)=>{objects.push(value);return objects.length-1};
  const font=obj('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
  const pages=obj('');const references=[];
  const columns=[40,235,305,380,468,520];
  const header=['Mahsulot','SKU','Shtrix-kod','Kategoriya','Narx','Qoldiq'];
  const lines=products.map(p=>[p.name,p.sku,p.barcode,p.category,p.sellPrice??p.price,p.quantity]);
  for(let i=0;i<Math.max(1,lines.length);i+=37){
    const chunk=[header,...lines.slice(i,i+37)];
    let stream=`BT /F1 9 Tf 0 g `;
    chunk.forEach((row,n)=>{const y=772-n*19;row.forEach((value,k)=>{stream+=`1 0 0 1 ${columns[k]} ${y} Tm (${esc(ascii(value).slice(0,k===0?36:18))}) Tj `})});
    stream+='ET';
    const content=obj(`<< /Length ${new TextEncoder().encode(stream).length} >>\nstream\n${stream}\nendstream`);
    const page=obj(`<< /Type /Page /Parent ${pages} 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 ${font} 0 R >> >> /Contents ${content} 0 R >>`);
    references.push(`${page} 0 R`);
  }
  objects[pages]=`<< /Type /Pages /Kids [${references.join(' ')}] /Count ${references.length} >>`;
  const catalog=obj(`<< /Type /Catalog /Pages ${pages} 0 R >>`);
  const chunks=['%PDF-1.4\n'];const offsets=[0];let length=chunks[0].length;
  for(let n=1;n<objects.length;n++){offsets.push(length);const text=`${n} 0 obj\n${objects[n]}\nendobj\n`;chunks.push(text);length+=new TextEncoder().encode(text).length}
  const xref=length;chunks.push(`xref\n0 ${objects.length}\n0000000000 65535 f \n`);
  offsets.slice(1).forEach(offset=>chunks.push(`${String(offset).padStart(10,'0')} 00000 n \n`));
  chunks.push(`trailer\n<< /Size ${objects.length} /Root ${catalog} 0 R >>\nstartxref\n${xref}\n%%EOF`);
  return new Blob(chunks,{type:'application/pdf'});
}

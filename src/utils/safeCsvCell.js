// Spreadsheet applications may evaluate text cells as formulas even in quoted CSV.
export function safeCsvCell(value){
 const text=String(value??"");
 const escaped=typeof value==="number"&&Number.isFinite(value)?text:/^[\s\uFEFF\u200B]*[=+\-@＝＋－＠]|^[\t\r\n]/u.test(text)?"'"+text:text;
 return '"'+escaped.replace(/"/g,'""')+'"';
}

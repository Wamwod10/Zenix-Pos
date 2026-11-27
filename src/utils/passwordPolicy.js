// Keep new credential validation aligned with the server's bcrypt byte boundary.
// Do not apply this to old passwords entered for login or confirmation.
export function newPasswordError(value,min=8){
 const password=String(value??'');
 if(password.length<min)return 'Parol kamida '+min+' ta belgidan iborat bo‘lsin';
 if(new TextEncoder().encode(password).length>72)return 'Parol UTF-8 formatida 72 baytdan oshmasligi kerak. Qisqaroq parol tanlang.';
 return '';
}

// One isolated print-frame lifecycle shared by receipts and reports.
export function printReportDocument(markup,title,onError){
 const frame=document.createElement('iframe');
 frame.title=title;
 frame.style.cssText='position:fixed;width:1px;height:1px;bottom:0;left:0;border:0';
 let finished=false,timer;
 const cleanup=()=>{if(finished)return;finished=true;clearTimeout(timer);frame.remove()};
 const fail=error=>{cleanup();onError?.(error instanceof Error?error:new Error('Printer oynasini ochib bo‘lmadi'));return false};
 frame.onerror=()=>fail(new Error('Chop etish oynasi yuklanmadi'));
 frame.onload=()=>{if(finished)return;try{const target=frame.contentWindow;if(!target?.print)throw Error('Brauzer chop etishni qo‘llab-quvvatlamadi');target.addEventListener('afterprint',cleanup,{once:true});target.focus();target.print()}catch(error){fail(error)}};
 timer=setTimeout(cleanup,180000);
 try{frame.srcdoc=markup;document.body.append(frame);return true}catch(error){return fail(error)}
}

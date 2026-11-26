// Print isolated report document; caller must not claim physical printing succeeded.
export function printReportDocument(markup){
 const frame=document.createElement("iframe");
 frame.title="Hisobotni chop etish";
 frame.style.cssText="position:fixed;width:1px;height:1px;bottom:0;left:0;border:0";
 let finished=false,timer;
 const cleanup=()=>{if(finished)return;finished=true;clearTimeout(timer);frame.remove()};
 frame.onerror=cleanup;
 frame.onload=()=>{if(finished)return;try{const target=frame.contentWindow;if(!target?.print){cleanup();return}target.addEventListener("afterprint",cleanup,{once:true});target.focus();target.print()}catch{cleanup()}};
 timer=setTimeout(cleanup,180000);
 try{frame.srcdoc=markup;document.body.append(frame);return true}catch{cleanup();return false}
}

// Keep scroll geometry reads outside React's synchronous layout commit.
export function scheduleChatScroll(node,reset,requestFrame=requestAnimationFrame,cancelFrame=cancelAnimationFrame,shouldScroll=()=>true){
 const frame=requestFrame(()=>{if(shouldScroll())node.scrollTop=reset?0:node.scrollHeight;});
 return ()=>cancelFrame(frame);
}

import {useEffect,useRef} from 'react';
import ZenixAIIcon from './ZenixAIIcon';

// Keep the launcher in the right-hand lane, lifting it above visible controls.
export function launcherPlacement({width,height,right=24,edge=24,size=48,obstacles=[]}){
 let bottom=edge;
 for(let pass=0;pass<=obstacles.length;pass++){
  const left=width-right-size,top=height-bottom-size;
  const hit=obstacles.find(r=>r.width>0&&r.height>0&&r.right>left-8&&r.left<width-right+8&&r.top<top+size+8&&r.bottom>top-8);
  if(!hit)return {bottom,hidden:top<8};
  bottom=Math.max(bottom,height-hit.top+8);
 }
 return {bottom,hidden:height-bottom-size<8};
}

export default function ZenixAILauncher({open,hidden,onOpen}){
 const ref=useRef(null);
 useEffect(()=>{
  const button=ref.current;if(!button||open||hidden)return;
  let frame;
  const measure=()=>{
   const style=window.getComputedStyle(button),safeBottom=parseFloat(style.marginBottom)||0;
   const edge=(parseFloat(style.getPropertyValue('--zenix-ai-edge'))||24)+safeBottom;
   const obstacles=[...document.querySelectorAll('.pos-checkout input,.pos-checkout select,.pos-customer-results,.checkout-primary,.pos-mobile-cart-bar,.mobile-nav,.mobile-bottom-nav,.guide-coach,.pro-btn.primary,.payment-grid button,button[type="submit"],[data-floating-control]')]
    .filter(node=>node!==button&&!node.closest('#zenix-ai-panel')).map(node=>node.getBoundingClientRect());
   const placement=launcherPlacement({width:window.innerWidth,height:window.innerHeight,right:parseFloat(style.right)||24,edge,size:button.offsetWidth||48,obstacles});
   button.style.setProperty('--zenix-ai-bottom-gap',`${placement.bottom-safeBottom}px`);
   button.style.visibility=placement.hidden?'hidden':'';
  };
  const schedule=()=>{window.cancelAnimationFrame(frame);frame=window.requestAnimationFrame(measure)};
  const observer=typeof ResizeObserver==='function'?new ResizeObserver(schedule):null;
  observer?.observe(document.documentElement);
  const mutations=typeof window.MutationObserver==='function'?new window.MutationObserver(records=>{
   // Ignore our own placement styles to avoid observing ourselves in a loop.
   if(records.some(record=>record.type==='childList'||record.target!==button))schedule();
  }):null;
  mutations?.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['class','style','hidden','open']});
  window.addEventListener('resize',schedule);window.addEventListener('scroll',schedule,true);
  window.visualViewport?.addEventListener('resize',schedule);schedule();
  return()=>{window.cancelAnimationFrame(frame);observer?.disconnect();mutations?.disconnect();window.removeEventListener('resize',schedule);window.removeEventListener('scroll',schedule,true);window.visualViewport?.removeEventListener('resize',schedule)};
 },[open,hidden]);
 return <button ref={ref} className="zenix-ai-floating" type="button" onClick={onOpen} hidden={open||hidden} aria-label="ZENIX AI ochish" aria-expanded={open} aria-controls="zenix-ai-panel" aria-describedby="zenix-ai-launcher-tip">
  <ZenixAIIcon/><span role="tooltip" id="zenix-ai-launcher-tip">ZENIX AI suhbatini ochish</span>
 </button>;
}

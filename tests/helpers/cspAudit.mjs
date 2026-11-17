// Local, mock-only security audit. Never add these headers to Vercel production here.
export const auditEnabled=process.env.ZENIX_CSP_AUDIT==='1';
export const reportPath='/__zenix_csp_report';
export const auditHeaders={
  'Content-Security-Policy':"base-uri 'self'; object-src 'none'; frame-ancestors 'none'",
  'Content-Security-Policy-Report-Only':[
    "default-src 'self'", "script-src 'self'", "script-src-attr 'none'",
    "style-src 'self' 'unsafe-inline'", "img-src 'self' data: blob: https:",
    "font-src 'self' data: https:", "connect-src 'self' https: wss:",
    "worker-src 'self' blob:", "frame-src 'self' blob: https:",
    "media-src 'self' blob: data:", "form-action 'self' https:",
    "base-uri 'self'", "object-src 'none'", "frame-ancestors 'none'",
    "require-trusted-types-for 'script'", "report-uri "+reportPath,
  ].join('; '),
};
export async function observeCsp(context,counts){
  await context.exposeBinding('__zenixCspAuditDirective',(_source,directive,disposition)=>{
    if(typeof directive!=='string'||!/^[a-z-]{1,64}$/.test(directive)||!['report','enforce'].includes(disposition))return;
    const key=disposition+':'+directive;
    counts[key]=(counts[key]||0)+1;
  });
  await context.addInitScript(()=>{
    document.addEventListener('securitypolicyviolation',event=>{
      // Do not store URLs, samples, document content, or request bodies.
      void globalThis.__zenixCspAuditDirective(event.effectiveDirective,event.disposition).catch(()=>{});
    });
  });
}
export function printCspSummary(scope,counts){
  console.log(JSON.stringify({scope,policy:'local mock-only report-only candidate; not enforced in production',directiveCounts:counts}));
}

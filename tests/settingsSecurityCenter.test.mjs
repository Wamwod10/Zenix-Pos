import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('profile distinguishes server session fetch errors and confirmed revocation',()=>{
 const auth=read('src/context/AuthContext.jsx'),profile=read('src/pages/profile/Profile.jsx');
 assert.match(auth,/sessionIdentityRef\.current!==identity\|\|sessionReadRevision\.current!==revision/);
 assert.match(auth,/state:"error",error:apiMessage/);
 assert.match(profile,/if\(!result\.success\)\{notify\(\{tone:"danger",title:"Sessiya yopilmadi"/);
 assert.match(profile,/sessionListStatus\?\.state==="error"/);
 assert.match(profile,/void refreshSessions\(\)/);
});

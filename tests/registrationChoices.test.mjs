import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {MemoryRouter} from 'react-router-dom';
import {createServer} from 'vite';

test('registration renders three accessible plan cards with trial selected',async()=>{
 const vite=await createServer({server:{middlewareMode:true},appType:'custom',logLevel:'silent'});
 try{
  const [{AuthProvider},{default:Register}]=await Promise.all([vite.ssrLoadModule('/src/context/AuthContext.jsx'),vite.ssrLoadModule('/src/pages/register/Register.jsx')]);
  const html=renderToStaticMarkup(React.createElement(AuthProvider,null,React.createElement(MemoryRouter,null,React.createElement(Register))));
  assert.equal((html.match(/type="radio"/g)||[]).length,3);
  assert.match(html,/14 kun bepul sinab/);assert.match(html,/1 oylik pullik/);assert.match(html,/1 yillik pullik/);
  assert.match(html,/checked="" value="TRIAL"/);
 }finally{await vite.close()}
});

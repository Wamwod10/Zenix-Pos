import {chromium,expect} from '@playwright/test';
import {createServer} from 'vite';
import {mkdir,writeFile} from 'node:fs/promises';
const phase=process.env.A11Y_PHASE||'after',out=`../artifacts/frontend-master-20261026/${phase}/shared-accessibility`;
await mkdir(out,{recursive:true});
const server=await createServer({server:{host:'127.0.0.1',port:0},logLevel:'error'});await server.listen();
const base=server.resolvedUrls.local[0],browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH||(process.platform==='win32'?'C:/Users/User/AppData/Local/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-win64/chrome-headless-shell.exe':undefined)});
const checks=[];
try{
 const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block',reducedMotion:'reduce'}),page=await context.newPage();
 let auth=false;const store='11111111-1111-4111-8111-111111111111',org='22222222-2222-4222-8222-222222222222';
 await context.route('**/*',async route=>{const url=new URL(route.request().url());if(url.origin!==new URL(base).origin)return route.abort();if(!url.pathname.startsWith('/api/'))return route.continue();if(url.pathname==='/api/auth/me'&&!auth)return route.fulfill({status:401,json:{ok:false,error:{code:'UNAUTHORIZED'}}});let data={items:[],sessions:[],events:[],total:0};
 if(url.pathname==='/api/auth/me')data={user:{id:'owner',organizationId:org,appRole:'OWNER',name:'Test owner'}};
 if(url.pathname==='/api/auth/registration-config')data={phoneVerificationRequired:false,plans:[{code:'START'},{code:'BUSINESS'},{code:'PRO'}]};
 if(url.pathname==='/api/bootstrap')data={catalogComplete:true,stores:[{id:store,name:'Test store',active:true}],inventory:[],suppliers:[],employees:[],activeShifts:{},organization:{id:org,planCode:'BUSINESS',expiryDate:'2099-01-01',licenseStatus:'ACTIVE'}};
 if(url.pathname==='/api/bootstrap/catalog')data={products:[],categories:[],hasMore:false};
 if(url.pathname==='/api/settings')data={selectedStoreId:store};
 if(url.pathname==='/api/warehouses')data={warehouses:[],balances:[]};
 if(url.pathname==='/api/finance')data={sales:[],returns:[],expenses:[],pagination:{hasMore:false}};
 await route.fulfill({json:{ok:true,data}});});
 const check=async(name,fn)=>{try{await fn();checks.push({name,status:'PASS'})}catch(e){checks.push({name,status:'FAIL',error:e.message})}};
 await page.goto(base+'register');await page.locator('.auth-eye').waitFor();await page.screenshot({path:out+'/register.png',fullPage:true});
 await check('Register password reveal has accessible name',async()=>{await expect(page.locator('.auth-eye')).toHaveAccessibleName(/Parolni/);await page.locator('.auth-eye').click();await expect(page.locator('.auth-eye')).toHaveAccessibleName('Parolni yashirish')});
 auth=true;await page.goto(base+'inventory');await page.getByRole('button',{name:'Tezkor kirim',exact:true}).first().click();await page.getByRole('dialog').waitFor();
 const select=page.getByRole('dialog').locator('.premium-select').first();await select.focus();await page.keyboard.press('Enter');await page.getByRole('listbox').waitFor();await page.waitForTimeout(250);await page.screenshot({path:out+'/select-open.png',fullPage:true});
 await check('Wrapped supplier select preserves its native accessible label',()=>expect(select).toHaveAccessibleName(/Ta.minotchi/));
 await check('Select exposes active option',async()=>{await expect(select).toHaveAttribute('aria-activedescendant',/.+/);const id=await select.getAttribute('aria-activedescendant');await expect(page.locator(`[id="${id}"]`)).toHaveAttribute('role','option')});
 await check('Select Arrow/Home/End and Space select options',async()=>{await page.keyboard.press('End');await expect(select).toHaveAttribute('aria-activedescendant',/-1$/);await page.keyboard.press('Home');await expect(select).toHaveAttribute('aria-activedescendant',/-0$/);await page.keyboard.press('ArrowDown');await expect(select).toHaveAttribute('aria-activedescendant',/-1$/);await page.keyboard.press('Home');await page.keyboard.press('Space');await expect(page.getByRole('listbox')).toHaveCount(0);await expect(select).toBeFocused();await page.keyboard.press('Enter')});
 await check('Escape closes select and retains parent modal',async()=>{await page.keyboard.press('Escape');await expect(page.getByRole('listbox')).toHaveCount(0);await expect(page.getByRole('dialog')).toBeVisible()});
 if(await page.getByRole('dialog').count()){
 await select.focus();await page.keyboard.press('Enter');await page.keyboard.press('Tab');await check('Tab dismisses select',()=>expect(page.getByRole('listbox')).toHaveCount(0));
 await page.keyboard.press('Escape');await check('Second Escape closes modal',()=>expect(page.getByRole('dialog')).toHaveCount(0));
 }
 await page.screenshot({path:out+'/modal-closed.png',fullPage:true});
 await page.goto(base+'profile');const edit=page.getByRole('button',{name:'Profilni tahrirlash',exact:true});await edit.click();const dialog=page.getByRole('dialog');await dialog.waitFor();await page.waitForTimeout(50);
 await check('Profile modal focuses form field',()=>expect(dialog.locator('input').first()).toBeFocused());
 await check('Profile modal traps forward and reverse Tab',async()=>{const buttons=dialog.getByRole('button');await buttons.last().focus();await page.keyboard.press('Tab');await expect(buttons.first()).toBeFocused();await page.keyboard.press('Shift+Tab');await expect(buttons.last()).toBeFocused()});
 await page.keyboard.press('Escape');await check('Profile Escape restores trigger focus',()=>expect(edit).toBeFocused());
 await page.goto(base);await check('Bare dashboard selects retain accessible selected-value names',async()=>{const selects=page.locator('.dashboard-filters .premium-select');await expect(selects).toHaveCount(2);for(const select of await selects.all())await expect(select).toHaveAccessibleName(/\S/)});
 await page.goto(base+'analytics');await check('Analytics filter names are stable',async()=>{for(const name of ['Filial','Kategoriya','Sotuvchi'])await expect(page.getByRole('combobox',{name,exact:true})).toBeVisible()});
 await page.goto(base+'seller-analytics');await check('Seller Analytics filter names are stable',async()=>{for(const name of ['Davr','Filial'])await expect(page.getByRole('combobox',{name,exact:true})).toBeVisible()});
 await page.goto(base+'help');await check('Help route renders',()=>expect(page.locator('main h1')).toBeVisible());

}finally{await writeFile(out+'/results.json',JSON.stringify(checks,null,2));await browser.close();await server.close()}
console.log(JSON.stringify(checks,null,2));if(phase!=='before'&&checks.some(c=>c.status==='FAIL'))process.exitCode=1;

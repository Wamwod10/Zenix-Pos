import {chromium,expect} from '@playwright/test';
import {createServer} from 'vite';
const server=await createServer({server:{host:'127.0.0.1',port:0},logLevel:'error'});await server.listen();const base=server.resolvedUrls.local[0];
const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH||(process.platform==='win32'?'C:/Users/User/AppData/Local/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-win64/chrome-headless-shell.exe':undefined)});
try{
 const context=await browser.newContext({serviceWorkers:'block'}),page=await context.newPage();await page.clock.setFixedTime(new Date('2026-10-27T07:00:00Z'));
 const sale={id:'s',storeId:'a',dateISO:'2026-10-26',items:[{productId:'p',name:'Audit product',unit:'kg',quantity:2,finalPrice:2000,unitCost:1000}],total:4000,saleTotal:4000};
 const refund={id:'r',saleId:'s',productId:'p',storeId:'a',dateISO:'2026-10-27',quantity:1,amount:2000,unitCost:1000,createdBy:'other'};
 const product={id:'p',name:'Audit product',unit:'kg',stockByStore:{a:5,b:0},costByStore:{a:1000,b:0}};let transferRequests=0;
 await context.route('**/*',async route=>{const u=new URL(route.request().url());if(u.origin!==new URL(base).origin)return route.abort();if(!u.pathname.startsWith('/api/'))return route.continue();let data={items:[],users:[],sessions:[],revision:'1',holds:[]};
  if(u.pathname==='/api/auth/me')data={user:{id:'owner',organizationId:'org',appRole:'OWNER',name:'Owner'}};
  if(u.pathname==='/api/bootstrap')data={catalogComplete:true,stores:[{id:'a',name:'Branch A',active:true},{id:'b',name:'Branch B',active:true}],inventory:[product],suppliers:[{id:'sup',name:'Audit supplier',phone:'123',purchaseHistory:[{id:'i',invoiceNo:'INV1',total:100,paidAmount:0,balance:100,dueDate:'2026-09-30T00:00:00.000Z',dateISO:'2026-09-29',date:'raw-date'}],transactions:[]}],activeShifts:{},organization:{id:'org',planCode:'BUSINESS',licenseStatus:'ACTIVE',expiryDate:'2099-01-01',storeLimit:3}};
  if(u.pathname==='/api/bootstrap/catalog')data={products:[product],categories:[],hasMore:false};
  if(u.pathname==='/api/settings')data={selectedStoreId:'a',workspaceSettings:{organization:{timezone:'Asia/Tashkent',dateFormat:'DD.MM.YYYY'}}};
  if(u.pathname==='/api/finance')data={sales:[sale],returns:[refund],expenses:[],pagination:{hasMore:false}};
  if(u.pathname==='/api/ai/status')data={enabled:false};
  if(u.pathname==='/api/billing/subscription')data={subscription:{planCode:'BUSINESS',status:'ACTIVE'}};
  if(u.pathname==='/api/inventory/transfers'&&route.request().method()==='POST'){transferRequests++;await new Promise(resolve=>setTimeout(resolve,400));data={transfer:{id:'t',to_store_id:'b',items:[{product_id:'p'}]}};}
  return route.fulfill({json:{ok:true,data}});
 });
 await page.goto(base);const row=page.locator('.top-product-list > div').filter({hasText:'Audit product'});await expect(row).toContainText('1 kg');await expect(row).toContainText('foyda 1,000');await expect(row.locator('b')).toContainText('2,000');
 refund.quantity=2;refund.amount=4000;await page.reload();await expect(row).toContainText('0 kg');await expect(row).toContainText('foyda 0');await expect(row.locator('b')).toContainText('0');console.log('PASS: browser partial and full refunds on a later date by another operator');
 await page.goto(new URL('/suppliers',base).href);await expect(page.getByRole('heading',{name:'Audit supplier'})).toBeVisible();await expect(page.locator('body')).not.toContainText('2026-09-30T00:00:00.000Z');await expect(page.locator('body')).toContainText(/30[./]09[./]2026/);await page.getByRole('button',{name:'Batafsil'}).click();await expect(page.locator('body')).toContainText(/29[./]09[./]2026/);console.log('PASS: supplier dates in list and detail');
 await page.goto(new URL('/inventory',base).href);await page.getByRole('button',{name:'Transferlar',exact:true}).click();const builder=page.locator('.transfer-builder');await builder.locator('.premium-select').first().click();await page.getByRole('option',{name:'Branch B',exact:true}).click();await builder.locator('.premium-select').nth(1).click();await page.getByRole('option',{name:/Audit product/}).click();await builder.locator('input[type=number]').fill('2');await builder.getByRole('button',{name:'Qo‘shish'}).click();const submit=builder.getByRole('button',{name:'Transfer yaratish'});await submit.dblclick({delay:20,force:true});await expect(page.locator('body')).toContainText('1 ta mahsulot · Branch B');if(transferRequests!==1)throw Error(`Expected one transfer request, got ${transferRequests}`);await expect(page.locator('body')).not.toContainText('undefined');console.log('PASS: transfer message and double click');
}finally{await browser.close();await server.close()}

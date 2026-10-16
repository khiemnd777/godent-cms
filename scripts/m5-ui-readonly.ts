/** Authenticated M5 UI gap checks. Only session creation and private GETs;
 * injected read failures stay inside this isolated browser context. */
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {chmod,mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {chromium,expect,type Page} from '@playwright/test';
import {readM5Fixtures} from './m5-fixtures';
async function main(){
 const dataOnly=process.argv[3]==='--data-only';
 if(Bun.version!=='1.4.3'||process.cwd()!==resolve(import.meta.dir,'..')||process.argv[2]!=='--local-m5'||process.argv.length!==(dataOnly?4:3))throw new Error('Explicit local M5 required');
 const f=await readM5Fixtures();assert.equal(f.status,'complete');const t=f.tenants.find(t=>t.label==='A')!,run=randomUUID(),directory=`docs/evidence/m5/ui-readonly-${run}`;await mkdir(directory,{mode:0o700});
 const b=await chromium.launch({channel:'chrome',headless:true}),checks:Record<string,unknown>[]=[],pageErrors:string[]=[];
 async function login(label:string,destination:string){const i=f.identities.find(x=>x.label===label)!;const context=await b.newContext({reducedMotion:'reduce'}),p=await context.newPage();p.on('pageerror',e=>pageErrors.push(e.name));await p.goto('http://127.0.0.1:5891/login');await p.getByLabel('Email',{exact:true}).fill(i.email);await p.getByLabel('Mật khẩu',{exact:true}).fill(i.password);await p.getByRole('button',{name:'Đăng nhập',exact:true}).click();await p.waitForURL('http://127.0.0.1:5891'+destination);return p;}
 async function shot(p:Page,name:string){const path=`${directory}/${name}.png`;await p.screenshot({path,fullPage:true,mask:[p.locator('input,textarea,.account-menu,.account-button')]});await chmod(path,0o600);}
 async function recoverRead(p:Page,path:string,loading:string,failed:string,ready:string){
  let entered:()=>void=()=>{},release:()=>void=()=>{};const seen=new Promise<void>(r=>{entered=r;}),gate=new Promise<void>(r=>{release=r;});
  let requests=0;const endpoint=new URL(path).pathname;await p.route(url=>url.pathname===endpoint,async route=>{if(endpoint.endsWith('/m5/platform')&&requests++===0){await route.continue();return;}entered();await gate;await route.fulfill({status:503,contentType:'application/json',body:'{"statusCode":503,"error":"Service Unavailable"}'});});
  const reload=p.reload({waitUntil:'domcontentloaded'});await seen;await expect(p.getByRole('heading',{name:loading,exact:true})).toBeVisible();release();await reload;await expect(p.getByRole('heading',{name:failed,exact:true})).toBeVisible();await shot(p,endpoint.includes('domains')?'domains-read-error':'data-read-error');await p.unrouteAll({behavior:'wait'});
  const retry=p.getByRole('button',{name:'Thử lại',exact:true});await retry.focus();await expect(retry).toBeFocused();const response=p.waitForResponse(r=>new URL(r.url()).pathname===endpoint&&r.status()===200);await p.keyboard.press('Enter');await response;await expect(p.getByRole('heading',{name:ready,exact:true})).toBeVisible();checks.push({state:'loading-error-keyboard-retry-real-GET',endpoint,status:'PASS'});
 }
 try{
  if(!dataOnly){const platform=await login('PlatformOnly','/platform');await platform.goto(`http://127.0.0.1:5891/platform/limits?tenant=${t.id}`);await expect(platform.getByRole('heading',{name:'Hạn mức & sử dụng',exact:true})).toBeVisible();await expect(platform.getByRole('combobox',{name:/^Chọn nha khoa/})).toHaveValue(t.id);
  for(const width of [1440,390,320]){await platform.setViewportSize({width,height:900});await platform.evaluate(()=>document.fonts.ready);const metric=await platform.evaluate(()=>({viewport:innerWidth,document:document.documentElement.scrollWidth,outside:Array.from(document.querySelectorAll<HTMLElement>('button,input,select,textarea,a[href]')).filter(n=>{const r=n.getBoundingClientRect(),s=getComputedStyle(n);return r.width>0&&r.height>0&&s.visibility!=='hidden'&&s.display!=='none'&&(r.left < -1||r.right>innerWidth+1);}).length}));assert.ok(metric.document<=width+1);assert.equal(metric.outside,0);await shot(platform,`platform-${width}`);checks.push({state:'platform-responsive',width,...metric,status:'PASS'});}
  }
  const tenant=await login('A1','/cms');if(!dataOnly){await tenant.goto(`http://127.0.0.1:5891/cms/settings/domains?tenant=${t.id}`);await expect(tenant.getByRole('heading',{name:'Địa chỉ chính',exact:true})).toBeVisible();await recoverRead(tenant,`http://127.0.0.1:5890/api/tenants/${t.id}/domains`,'Đang tải tên miền','Chưa thể tải tên miền','Địa chỉ chính');}
  await tenant.goto(`http://127.0.0.1:5891/cms/settings/data?tenant=${t.id}`);await expect(tenant.getByRole('heading',{name:'Xuất dữ liệu',exact:true})).toBeVisible();await recoverRead(tenant,`http://127.0.0.1:5890/api/cms/tenants/${t.id}/m5/platform`,'Đang tải trạng thái','Chưa thể tải trạng thái','Xuất dữ liệu');assert.deepEqual(pageErrors,[]);
  await writeFile(`${directory}/results.json`,JSON.stringify({owner:'GCMS-M5-UI-READONLY-v1',fixtureRun:f.runId,status:'PASS',checks,pageErrors,limits:'Browser-only read faults; recovery reads the actual API. No business commands, export download, domain or lifecycle mutation.'},null,2)+'\n');console.info(JSON.stringify({status:'PASS',checks:checks.length,evidence:directory}));
 }catch(error){let detail=String(error instanceof Error?error.stack:error);for(const i of f.identities)for(const value of [i.password,i.email])detail=detail.replaceAll(value,'[REDACTED]');await writeFile(`.local/m5-ui-readonly-error-${run}.txt`,detail,{mode:0o600,flag:'wx'});await writeFile(`${directory}/results.json`,JSON.stringify({owner:'GCMS-M5-UI-READONLY-v1',fixtureRun:f.runId,status:'FAIL',checks,pageErrors,detailsRedacted:true},null,2)+'\n');console.error(JSON.stringify({status:'FAIL',completedChecks:checks.length,evidence:directory,detailsRedacted:true}));process.exitCode=1;}finally{await b.close();}
}
if(import.meta.main)void main().catch(()=>{console.error('M5 read-only UI check refused; details redacted.');process.exitCode=1;});

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEVICE_ACCEPTANCE_CASES,
  DEVICE_ACCEPTANCE_STATUSES,
  buildDeviceAcceptanceReport,
} from '../src/pages/posPro/deviceAcceptanceReport.js';

const args=()=>({testTenant:'Maxsus sinov filiali',operator:'QA',checkedAt:'2026-11-12T13:00:00.000Z',
 online:true,usbApiAvailable:true,serialApiAvailable:false});

test('operator evidence export defaults to NOT CERTIFIED even when API is available',()=>{
  const report=buildDeviceAcceptanceReport(args());
  assert.equal(report.certification,'NOT_CERTIFIED');
  assert.equal(report.verifiedAutomatically,false);
  assert.equal(report.browserCapabilities.connectedHardwareVerifiedAutomatically,false);
  assert.equal(report.browserCapabilities.webUSBAPIAvailable,true);
  assert.deepEqual(report.summary,{total:6,not_tested:6,pass:0,fail:0,blocked:0});
  assert.equal(report.generatedAt,'2026-11-12T13:00:00.000Z');
  assert.equal(report.testContext.testTenant,'Maxsus sinov filiali');
  assert.deepEqual(report.checks.map(x=>x.id),DEVICE_ACCEPTANCE_CASES.map(x=>x.id));
});

test('pass requires an operator-provided evidence reference; never auto-certifies',()=>{
  const a=args();a.results={scanner:{status:'pass',device:'USB HID Test',evidence:'Rasm va dalil: QA-001'}};
  const report=buildDeviceAcceptanceReport(a);
  assert.equal(report.summary.pass,1);
  assert.equal(report.summary.not_tested,5);
  assert.equal(report.checks[0].evidence,'Rasm va dalil: QA-001');
  assert.equal(report.certification,'NOT_CERTIFIED');
  assert.equal(report.evidenceSource,'operator-self-reported');
  assert.throws(()=>buildDeviceAcceptanceReport({...a,results:{scanner:{status:'pass'}}}),/dalil izohini/);
  assert.throws(()=>buildDeviceAcceptanceReport({...a,results:{scanner:{status:'pass',evidence:'    '}}}),/dalil izohini/);
});

test('records fail, blocked and untested without claiming device success',()=>{
  const a=args();a.results={
    scanner:{status:'fail',notes:'Testdagi skaner Enter yubormadi'},
    printer58:{status:'blocked',device:'Printer mavjud emas'},
    printer80:{status:'not_tested'},
    touch:{status:'pass',evidence:'QA-TOUCH-32-390'},
  };
  const report=buildDeviceAcceptanceReport(a);
  assert.deepEqual(report.summary,{total:6,not_tested:3,pass:1,fail:1,blocked:1});
  assert.ok(report.checks.find(x=>x.id==='scanner').notes.includes('Enter'));
  assert.equal(report.browserCapabilities.webSerialAPIAvailable,false);
});

test('input validation blocks missing context, invalid timestamps and invented statuses',()=>{
  assert.throws(()=>buildDeviceAcceptanceReport({}),/Sinov biznesi/);
  assert.throws(()=>buildDeviceAcceptanceReport({...args(),testTenant:'   '}),/Sinov biznesi/);
  assert.throws(()=>buildDeviceAcceptanceReport({...args(),checkedAt:'wrong'}),/vaqti/);
  assert.throws(()=>buildDeviceAcceptanceReport({...args(),results:[]}),/noto‘g‘ri/);
  assert.throws(()=>buildDeviceAcceptanceReport({...args(),results:{scanner:{status:'verified-by-ai'}}}),/status/);
  assert.throws(()=>buildDeviceAcceptanceReport({...args(),results:{scanner:null}}),/shakli/);
  assert.deepEqual(DEVICE_ACCEPTANCE_STATUSES,['not_tested','pass','fail','blocked']);
});

test('freeform notes are bounded and report remains plain JSON without network side effects',()=>{
  const report=buildDeviceAcceptanceReport({...args(),testTenant:'  Sinov  ',operator:'  OP  ',browserInfo:'Chrome test',
   results:{offline:{status:'blocked',device:'A'.repeat(300),notes:'N'.repeat(1500),evidence:'E'.repeat(1500)}}});
  assert.equal(report.testContext.testTenant,'Sinov');
  assert.equal(report.testContext.operator,'OP');
  const offline=report.checks.find(x=>x.id==='offline');
  assert.equal(offline.device.length,100);
  assert.equal(offline.notes.length,500);
  assert.equal(offline.evidence.length,350);
  assert.doesNotThrow(()=>JSON.parse(JSON.stringify(report)));
});

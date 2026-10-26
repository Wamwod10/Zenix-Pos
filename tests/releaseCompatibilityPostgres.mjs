// Explicitly disposable local release rehearsal; never reads a project .env.
import assert from 'node:assert/strict';
import {mkdtemp,copyFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import pg from '../../backend/node_modules/pg/lib/index.js';
import {assertSafeTestDatabaseUrl} from '../../backend/scripts/assertTestDatabase.js';
import {loadMigrationCatalog} from '../../backend/src/db/migrationCatalog.js';
import {runMigrations,checkMigrationStatus} from '../../backend/src/db/migrationRunner.js';

const database=process.env.RELEASE_COMPAT_DB_NAME||'zenix_final_compat_test_20261026';
assert.match(database,/^zenix_final_compat_test_\d{8}(?:_[a-z0-9]+)?$/,'A fresh explicitly named disposable compatibility database is required');
const url=process.env.TEST_DATABASE_URL;
const parsed=assertSafeTestDatabaseUrl(url);
assert.equal(parsed.hostname,'127.0.0.1');
assert.equal(parsed.port,'55435');
assert.equal(parsed.pathname,`/${database}`);
assert.equal(process.env.NODE_ENV,'test');
assert.equal(process.env.DATABASE_URL,url);
const adminUrl=new URL(url);adminUrl.pathname='/postgres';
const admin=new pg.Client({connectionString:adminUrl.href});
try{
  await admin.connect();
  const target=(await admin.query('SELECT host(inet_server_addr()) host,inet_server_port() port')).rows[0];
  assert.deepEqual(target,{host:'127.0.0.1',port:55435});
  assert.equal((await admin.query('SELECT 1 FROM pg_database WHERE datname=$1',[database])).rowCount,0,'Use a fresh database; this rehearsal never resets an existing database');
  await admin.query(`CREATE DATABASE ${database}`);
}finally{await admin.end();}
const pool=new pg.Pool({connectionString:url});
const directory=fileURLToPath(new URL('../../backend/migrations/',import.meta.url));
const catalog=await loadMigrationCatalog(directory),temporary=await mkdtemp(path.join(tmpdir(),'zenix-compat-040-'));
try{
  for(const m of catalog.filter(m=>Number(m.prefix)<=40))await copyFile(path.join(directory,m.name),path.join(temporary,m.name));
  assert.equal((await runMigrations({pool,directory:temporary,logger:{}})).total,40);
  // These statements are used by the new backend's repayment, replay and file paths.
  for(const sql of ['SELECT shift_id,register_id,repayment_client_reference FROM customer_ledger LIMIT 0','SELECT purpose FROM file_assets LIMIT 0']){
    await assert.rejects(pool.query(sql),error=>error.code==='42703');
  }
  const replayConstraint=async()=>(await pool.query("SELECT pg_get_constraintdef(oid) definition FROM pg_constraint WHERE conname='financial_write_replays_operation_check'")).rows[0].definition;
  assert.doesNotMatch(await replayConstraint(),/supplier_invoice_create/);
  console.log('PASS: schema040 rejects new backend required columns (42703); migrations must precede backend');
  const result=await runMigrations({pool,directory,logger:{}});
  assert.equal(result.applied.length,4);
  assert.match(await replayConstraint(),/supplier_invoice_create/);
  assert.deepEqual(await checkMigrationStatus({db:pool,directory}),{tableMissing:false,missing:[],drifted:[],unverified:[],unknown:[]});
  for(const m of catalog.filter(m=>Number(m.prefix)>40))assert.equal((await pool.query('SELECT checksum FROM schema_migrations WHERE name=$1',[m.name])).rows[0].checksum,m.checksum);
  assert.equal((await runMigrations({pool,directory,logger:{}})).applied.length,0);
  console.log('PASS: 040 -> 044, checksums preserved, rerun applies zero migrations');
}finally{await pool.end();await rm(temporary,{recursive:true,force:true});}

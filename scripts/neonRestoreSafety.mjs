/**
 * Neon isolated snapshot-restore safety gate (incident #97).
 *
 * These PURE functions do not call Neon or access credentials. Operators must
 * validate the before/after inventories from Neon API and pass the returned
 * request arguments unchanged, especially `finalize:false`.
 */
import assert from 'node:assert/strict';

function required(value,label) {
  assert.equal(typeof value,'string',`${label} must be a string`);
  assert.ok(value.trim(),`${label} is required`);
  return value;
}
function branchIsDefault(branch) {
  return branch?.default === true || branch?.primary === true;
}
function prodEndpoint(endpoints, id) {
  return endpoints.find(x=>x.id===id);
}

/**
 * Only approve a new, non-production branch and explicit NO-FINALIZE.
 * Fail closed if root capacity is exhausted or the expected snapshot changes.
 */
export function prepareIsolatedRestore({
  snapshot, production, branches, endpoint, name, maxRootBranches,
}) {
  required(name,'restore branch name');
  assert.ok(/^zenix-[a-z0-9-]+$/.test(name),'Use an explicit zenix- restore branch name');
  assert.ok(!/^(?:zenix-)?production$/i.test(name),'Never restore as production');
  assert.ok(snapshot?.id && snapshot?.source_branch_id,'Snapshot provenance required');
  assert.equal(snapshot.source_branch_id,production?.id,'Snapshot source must be current production');
  assert.equal(snapshot.manual,false,'Use scheduled snapshot for this acceptance');
  assert.ok(branchIsDefault(production) && production.protected,'Original production must be default and protected');
  assert.ok(endpoint?.id && endpoint.branch_id===production.id && endpoint.type==='read_write',
    'Production database endpoint provenance mismatch');
  assert.ok(Array.isArray(branches)&&branches.some(b=>b.id===production.id),'Current branch inventory required');
  assert.ok(!branches.some(b=>b.name===name),'Restore name already in use');
  assert.ok(Number.isSafeInteger(maxRootBranches)&&maxRootBranches>0,'Root-branch capacity must be verified');
  assert.ok(branches.filter(b=>!b.parent_id).length < maxRootBranches,
    'Root branch limit reached: do not delete any branch automatically');

  const before={
    productionBranchId:production.id,
    productionBranchName:production.name,
    productionEndpointId:endpoint.id,
    productionEndpointHost:endpoint.host,
    snapshotId:snapshot.id,
    maxRootBranches,
  };
  return {
    before,
    // The Neon connector defaults to finalize:true on NEW branches.
    // The explicit false is a mandatory safety invariant, never omit it.
    restoreArguments:Object.freeze({
      project_id:required(production.project_id,'project_id'),
      snapshot_id:snapshot.id,
      name,
      finalize:false,
    }),
  };
}

/** After restore, verify no switch, no promotion and no endpoint movement. */
export function verifyIsolatedRestore({before, production, defaultBranch, endpoint, restored}) {
  assert.ok(before?.productionBranchId && before?.productionEndpointId && before?.snapshotId,
    'Signed-off preflight evidence required');
  assert.equal(defaultBranch?.id,before.productionBranchId,'INCIDENT: production default branch switched');
  assert.equal(production?.id,before.productionBranchId,'Original production branch missing');
  assert.ok(branchIsDefault(production) && production.protected,'Production unprotected or demoted');
  assert.equal(endpoint?.id,before.productionEndpointId,'Production compute replaced');
  assert.equal(endpoint?.branch_id,before.productionBranchId,'INCIDENT: production compute moved to another branch');
  assert.equal(endpoint?.host,before.productionEndpointHost,'Production endpoint host changed');
  assert.ok(restored?.id && restored.id!==before.productionBranchId,'Restore must be independent');
  assert.equal(restored?.restored_from,before.snapshotId,'Wrong snapshot restored');
  assert.ok(!branchIsDefault(restored),'INCIDENT: restored branch was promoted');
  assert.notEqual(restored?.name,'production','Restore branch must not take production name');
  assert.equal(restored?.restore_status,'restored','Restore must remain unfinalized / unpromoted');
  return Object.freeze({safe:true,restoredBranchId:restored.id,sourceSnapshotId:before.snapshotId});
}

import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

test('frontend permission resolver fails closed like backend for string overrides',()=>{
 const source=readFileSync(new URL('../src/context/StoreContext.jsx',import.meta.url),'utf8');
 const start=source.indexOf('  const hasPermission = useCallback(');
 const end=source.indexOf('  const effectiveWorkspaceSettings',start);
 assert.ok(start>=0&&end>start);
 const resolver=source.slice(start,end);
 assert.match(resolver,/overrides\[permission\]===true/);
 assert.match(resolver,/rolePermissions\?\.\[role\]\?\.\[permission\]===true/);
 assert.doesNotMatch(resolver,/Boolean\(overrides\[permission\]\)|Boolean\(rolePermissions\?\.\[role\]/);
 assert.match(resolver,/permission==='platformAdmin'/);
 assert.match(resolver,/role===ROLES\.PLATFORM_ADMIN/);
 assert.match(resolver,/if\(role===ROLES\.OWNER\)return true/);
});

test('Settings permission matrix and employee overrides fail closed for non-boolean grants',()=>{
 const source=readFileSync(new URL('../src/pages/settings/Settings.jsx',import.meta.url),'utf8');
 assert.match(source,/emp\.permissionOverrides\[permission\]===true/);
 assert.match(source,/rolePermissions\?\.\[emp\?\.role\]\?\.\[permission\]===true/);
 assert.match(source,/const defaults=rolePermissions\?\.\[emp\.role\]\?\.\[permission\]===true/);
 assert.match(source,/\[permission\]:prev\?\.\[role\]\?\.\[permission\]!==true/);
 assert.match(source,/rolePermissions\?\.\[role\]\?\.\[id\]===true/);
 assert.match(source,/rolePermissions\?\.\[mobilePermissionRole\]\?\.\[id\]===true/);
 assert.doesNotMatch(source,/Boolean\(emp\.permissionOverrides\[permission\]\)|!!rolePermissions\?\.\[/);
});

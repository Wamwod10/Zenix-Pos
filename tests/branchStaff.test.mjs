import test from 'node:test';
import assert from 'node:assert/strict';
import * as roles from '../src/config/roles.js';

test('branch staff includes only assigned employees and excludes organization owners',()=>{
  assert.equal(typeof roles.isBranchEmployee,'function');
  const employees=[{id:'a',role:'CASHIER',storeId:'main'},{id:'b',role:'MANAGER',storeId:'branch'},{id:'owner',role:'OWNER',storeId:'main'},{id:'unassigned',role:'ADMIN'}];
  assert.deepEqual(employees.filter(employee=>roles.isBranchEmployee(employee,'main')).map(employee=>employee.id),['a']);
  assert.deepEqual(employees.filter(employee=>roles.isBranchEmployee(employee,'branch')).map(employee=>employee.id),['b']);
  assert.equal(roles.isBranchEmployee(employees[0],null),false);
});

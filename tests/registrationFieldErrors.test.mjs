import test from 'node:test';
import assert from 'node:assert/strict';
import {registrationFieldErrors} from '../src/utils/registrationErrors.js';
test('registration routes username and phone errors to their fields',()=>{
 assert.deepEqual(registrationFieldErrors({code:'USERNAME_EXISTS',message:'Login band'}),{login:'Login band'});
 assert.deepEqual(registrationFieldErrors({code:'TRIAL_ALREADY_USED',message:'Trial ishlatilgan'}),{phone:'Trial ishlatilgan'});
 assert.deepEqual(registrationFieldErrors({code:'PHONE_EXISTS',message:'Telefon band'}),{phone:'Telefon band'});
 assert.deepEqual(registrationFieldErrors({code:'INTERNAL_ERROR',message:'Qayta urining'}),{form:'Qayta urining'});
});

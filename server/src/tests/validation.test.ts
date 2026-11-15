import test from 'node:test';
import assert from 'node:assert/strict';
import { ageFromDob, isPlausiblePhone } from '@manhunt/shared';

const NOW = new Date('2026-11-15T12:00:00Z');

test('ageFromDob: correct age, birthday not yet reached this year', () => {
  assert.equal(ageFromDob('2000-11-15', NOW), 26);
  assert.equal(ageFromDob('2000-11-16', NOW), 25);
  assert.equal(ageFromDob('2010-01-01', NOW), 16);
  assert.equal(ageFromDob('2026-11-15', NOW), 0);
});

test('ageFromDob: rejects impossible and nonsense dates', () => {
  assert.equal(ageFromDob('2002-02-31', NOW), null);
  assert.equal(ageFromDob('2002-13-01', NOW), null);
  assert.equal(ageFromDob('14/08/2002', NOW), null);
  assert.equal(ageFromDob('', NOW), null);
  assert.equal(ageFromDob('2030-01-01', NOW), null, 'future date');
  assert.equal(ageFromDob('1800-01-01', NOW), null, 'too old');
});

test('isPlausiblePhone', () => {
  assert.equal(isPlausiblePhone('+91 98765 43210'), true);
  assert.equal(isPlausiblePhone('9876543210'), true);
  assert.equal(isPlausiblePhone('(555) 234-5678'), true);
  assert.equal(isPlausiblePhone('12345'), false);
  assert.equal(isPlausiblePhone('call me'), false);
  assert.equal(isPlausiblePhone(''), false);
});

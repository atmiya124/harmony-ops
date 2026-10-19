import { test } from 'node:test';
import assert from 'node:assert/strict';
import { distinctInitials, nameInitials } from './format';

test('initials: first and last name', () => {
  assert.equal(nameInitials('Atmiya Patel'), 'AP');
  assert.equal(nameInitials('  makinde  ade oluwasegun '), 'MO');
  assert.equal(nameInitials('Fred'), 'F');
  assert.equal(nameInitials('jasmine.soodeen'), 'JS');
  assert.equal(nameInitials(''), '?');
  assert.equal(nameInitials('atmiya patel', 2), 'AtP');
});

test('distinct initials: only clashing names get longer', () => {
  const m = distinctInitials(['Atmiya Patel', 'Ankit Patel', 'Jasmine Soodeen', 'Atmiya Patel']);
  assert.equal(m.get('Atmiya Patel'), 'AtP');
  assert.equal(m.get('Ankit Patel'), 'AnP');
  assert.equal(m.get('Jasmine Soodeen'), 'JS');
  assert.equal(m.size, 3);
});

test('distinct initials: shared first letters lengthen further', () => {
  const m = distinctInitials(['Anna Patel', 'Ankit Patel']);
  assert.equal(m.get('Anna Patel'), 'AnnP');
  assert.equal(m.get('Ankit Patel'), 'AnkP');
});

test('distinct initials: one person alone stays short', () => {
  assert.equal(distinctInitials(['Atmiya Patel']).get('Atmiya Patel'), 'AP');
});

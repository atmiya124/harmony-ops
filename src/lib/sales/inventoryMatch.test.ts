import { test } from 'node:test';
import assert from 'node:assert/strict';
import { matchInventory } from './inventoryMatch';

const item = (itemName: string, section: string, description: string | null = null) => ({ itemName, section, description });
const items = [
  item('Wireless Mic', 'Sound', 'Shure handheld'),
  item('Wired Mic', 'Sound'),
  item('Indoor LED Wall P2.6', 'LED Display', '500×500mm panels'),
  item('Mic Stand', 'Sound'),
  item('Uplighting', 'Lighting', 'Wireless battery uplights'),
];
const names = (list: { itemName: string }[]) => list.map((i) => i.itemName);

test('every typed word must match name, description or section', () => {
  assert.deepEqual(names(matchInventory(items, 'led p2', '')), ['Indoor LED Wall P2.6']);
  assert.deepEqual(names(matchInventory(items, 'shure', '')), ['Wireless Mic']);
  assert.deepEqual(names(matchInventory(items, 'xyz', '')), []);
});

test('names starting with the text come first, then the current section', () => {
  assert.deepEqual(names(matchInventory(items, 'wi', 'Lighting')), ['Wired Mic', 'Wireless Mic', 'Uplighting']);
  assert.deepEqual(names(matchInventory(items, 'mic', 'Sound')), ['Mic Stand', 'Wired Mic', 'Wireless Mic']);
});

test('blank text lists the current section first', () => {
  assert.deepEqual(names(matchInventory(items, '', 'lighting')).slice(0, 1), ['Uplighting']);
  assert.equal(matchInventory(items, '', '', 2).length, 2);
});

test('an exact name suggests nothing', () => {
  assert.deepEqual(matchInventory(items, 'wired mic', 'Sound'), []);
});

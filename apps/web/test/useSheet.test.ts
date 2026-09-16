import { DEFAULT_CONFIG } from '@fridgeweek/core';
import { beforeEach, describe, expect, it } from 'vitest';
import { useSheet } from '../src/components/builder/useSheet.js';

/**
 * The controller is where a control's intent becomes a configuration. Order and
 * reset are the two operations with no control of their own to read them back
 * from, so they are worth pinning here rather than only in the browser.
 */

function names(sheet: ReturnType<typeof useSheet>): string[] {
  return sheet.config.value.people.map((person) => person.name);
}

function household(): ReturnType<typeof useSheet> {
  const sheet = useSheet();
  sheet.update({
    people: [
      { name: 'Iris', symbol: 'unicorn' },
      { name: 'Otto', symbol: 'dinosaur' },
      { name: 'Vera', symbol: 'flower' },
    ],
  });
  return sheet;
}

beforeEach(() => {
  location.hash = '';
  localStorage.clear();
});

describe('movePerson', () => {
  it('moves somebody down the list', () => {
    const sheet = household();
    sheet.movePerson(0, 2);
    expect(names(sheet)).toEqual(['Otto', 'Vera', 'Iris']);
  });

  it('moves somebody up the list', () => {
    const sheet = household();
    sheet.movePerson(2, 0);
    expect(names(sheet)).toEqual(['Vera', 'Iris', 'Otto']);
  });

  it('takes a drop past the end as the end', () => {
    const sheet = household();
    sheet.movePerson(0, 9);
    expect(names(sheet)).toEqual(['Otto', 'Vera', 'Iris']);
  });

  it('does nothing when nothing would change', () => {
    const sheet = household();
    sheet.movePerson(1, 1);
    sheet.movePerson(-1, 0);
    sheet.movePerson(5, 0);
    expect(names(sheet)).toEqual(['Iris', 'Otto', 'Vera']);
  });

  it('keeps everyone, with their marks, in the new order', () => {
    const sheet = household();
    sheet.movePerson(1, 0);
    expect(sheet.config.value.people).toEqual([
      { name: 'Otto', symbol: 'dinosaur' },
      { name: 'Iris', symbol: 'unicorn' },
      { name: 'Vera', symbol: 'flower' },
    ]);
  });

  it('is what the sheet prints: the legend reads in list order', () => {
    const sheet = household();
    const before = sheet.layout.value.header?.legend?.items.map((item) => item.text.text);
    sheet.movePerson(2, 0);
    const after = sheet.layout.value.header?.legend?.items.map((item) => item.text.text);
    expect(before).not.toEqual(after);
    expect(after?.slice(-3)).toEqual(['Vera', 'Iris', 'Otto']);
  });
});

describe('reset', () => {
  it('goes back to the defaults, whatever was set', () => {
    const sheet = household();
    sheet.update({ locale: 'sv', paper: 'Letter', linesPerDay: 1, marginMm: 18 });
    sheet.reset();

    expect(sheet.config.value).toEqual(DEFAULT_CONFIG);
    expect(names(sheet)).toEqual(['Alex', 'Sam']);
  });

  it('clears the complaint about the link that was being read', () => {
    const sheet = useSheet();
    sheet.linkWasBroken.value = true;
    sheet.reset();
    expect(sheet.linkWasBroken.value).toBe(false);
    expect(sheet.rejected.value).toEqual([]);
  });

  it('hands back a configuration of its own, not the frozen defaults', () => {
    const sheet = useSheet();
    sheet.reset();
    sheet.update({ people: [{ name: 'Iris', symbol: 'unicorn' }] });
    expect(DEFAULT_CONFIG.people).toHaveLength(2);
  });
});

import { beforeEach, describe, expect, it } from 'vitest';

import {
    DISMISSED_HEALTH_ITEMS_KEY,
    clearDismissedHealthItems,
    dismissHealthItem,
    filterDismissedHealthItems,
    isHealthItemDismissed,
    readDismissedHealthItemIds,
    restoreHealthItem,
} from '../../src/utils/health-item-dismissal.js';

describe('health-item-dismissal', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    it('starts with nothing dismissed', () => {
        expect(readDismissedHealthItemIds()).toEqual([]);
        expect(isHealthItemDismissed('auto-token')).toBe(false);
    });

    it('remembers a dismissed item id', () => {
        dismissHealthItem('auto-token');

        expect(isHealthItemDismissed('auto-token')).toBe(true);
        expect(isHealthItemDismissed('expired-subscriptions')).toBe(false);
        expect(readDismissedHealthItemIds()).toEqual(['auto-token']);
    });

    it('ignores duplicate dismissals', () => {
        dismissHealthItem('auto-token');
        dismissHealthItem('auto-token');

        expect(readDismissedHealthItemIds()).toEqual(['auto-token']);
    });

    it('restores a single item', () => {
        dismissHealthItem('auto-token');
        dismissHealthItem('low-traffic');
        restoreHealthItem('auto-token');

        expect(readDismissedHealthItemIds()).toEqual(['low-traffic']);
    });

    it('clears every dismissal', () => {
        dismissHealthItem('auto-token');
        dismissHealthItem('low-traffic');
        clearDismissedHealthItems();

        expect(readDismissedHealthItemIds()).toEqual([]);
    });

    it('filters dismissed items out of a list', () => {
        dismissHealthItem('low-traffic');
        const items = [{ id: 'auto-token' }, { id: 'low-traffic' }, { id: 'zero-nodes' }];

        expect(filterDismissedHealthItems(items).map((i) => i.id)).toEqual([
            'auto-token',
            'zero-nodes',
        ]);
    });

    it('ignores blank ids so the store cannot be polluted', () => {
        dismissHealthItem('');
        dismissHealthItem('   ');
        dismissHealthItem(null);

        expect(readDismissedHealthItemIds()).toEqual([]);
    });

    it('trims ids before comparing', () => {
        dismissHealthItem('  auto-token  ');

        expect(isHealthItemDismissed('auto-token')).toBe(true);
    });

    it('survives corrupted storage without throwing', () => {
        localStorage.setItem(DISMISSED_HEALTH_ITEMS_KEY, 'not-json{{');

        expect(readDismissedHealthItemIds()).toEqual([]);
        expect(isHealthItemDismissed('auto-token')).toBe(false);

        // Writing still works after a corrupt read.
        dismissHealthItem('auto-token');
        expect(isHealthItemDismissed('auto-token')).toBe(true);
    });

    it('discards non-array storage payloads', () => {
        localStorage.setItem(DISMISSED_HEALTH_ITEMS_KEY, JSON.stringify({ a: 1 }));

        expect(readDismissedHealthItemIds()).toEqual([]);
    });

    it('discards non-string entries inside the array', () => {
        localStorage.setItem(DISMISSED_HEALTH_ITEMS_KEY, JSON.stringify(['ok', 42, null, '']));

        expect(readDismissedHealthItemIds()).toEqual(['ok']);
    });

    it('caps the stored list so it cannot grow without bound', () => {
        for (let i = 0; i < 150; i += 1) dismissHealthItem(`item-${i}`);

        const ids = readDismissedHealthItemIds();
        expect(ids.length).toBe(100);
        // The newest entries are the ones kept.
        expect(ids[ids.length - 1]).toBe('item-149');
        expect(ids).not.toContain('item-0');
    });
});

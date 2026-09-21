import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { computed } from 'vue';

const pushMock = vi.fn();

const subscriptionsRef = { value: [] };
const manualNodesRef = { value: [] };

vi.mock('vue-router', async () => {
    const actual = await vi.importActual('vue-router');
    return {
        ...actual,
        useRouter: () => ({ push: pushMock }),
    };
});

vi.mock('../../src/composables/useSubscriptions.js', () => ({
    useSubscriptions: () => ({
        totalRemainingTraffic: computed(() => 0),
        enabledSubscriptionsCount: computed(
            () => subscriptionsRef.value.filter((sub) => sub.enabled).length
        ),
        subscriptions: subscriptionsRef,
        addSubscriptionsFromBulk: vi.fn(),
    }),
}));

vi.mock('../../src/composables/useManualNodes.js', () => ({
    useManualNodes: () => ({
        manualNodes: manualNodesRef,
        addNodesFromBulk: vi.fn(),
    }),
}));
import DashboardView from '../../src/views/DashboardView.vue';
import { createI18n } from '../../src/i18n/index.js';
import { useDataStore } from '../../src/stores/useDataStore.js';
import { useSettingsStore } from '../../src/stores/settings.js';

function mountDashboard(locale = 'zh-CN') {
    return mount(DashboardView, {
        global: {
            // Reuse the Pinia activated in beforeEach: mounting with a fresh
            // instance would hide the fixtures seeded into the active store.
            plugins: [pinia, createI18n({ initialLocale: locale })],
            stubs: {
                SkeletonLoader: true,
                StatCards: true,
                RightPanel: true,
                BulkImportModal: true,
                ProfileModal: true,
                QRCodeModal: true,
                RouterLink: { template: '<a><slot /></a>' },
            },
        },
    });
}

const buildSub = (over = {}) => ({
    id: 'sub',
    enabled: true,
    nodeCount: 3,
    ...over,
});

// One Pinia for the whole file, re-created per test and shared with `mount` so
// the component sees exactly the state each test seeds.
let pinia;

describe('DashboardView 待处理事项', () => {
    beforeEach(() => {
        pushMock.mockClear();
        subscriptionsRef.value = [];
        pinia = createPinia();
        setActivePinia(pinia);
        // Dismissals live in localStorage, so clear them between tests.
        localStorage.clear();
        const dataStore = useDataStore();
        dataStore.profiles = [{ id: 'profile-1', name: '日常', enabled: true, customId: 'daily' }];
        useSettingsStore().setConfig({ mytoken: 'stable-token', profileToken: 'share-token' });
    });

    // Regression: the view read `item.action` while the helper emitted
    // `secondaryAction`, so "打开日志" was a dead button.
    it('opens the log modal from the failed-subscription secondary action', async () => {
        subscriptionsRef.value = [buildSub({ id: 'failed', lastError: 'timeout' })];

        const wrapper = mountDashboard();
        const logButton = wrapper.findAll('button').find((button) => button.text() === '打开日志');

        expect(logButton).toBeTruthy();
        // Before the fix the button was inert: the helper emitted `secondaryAction`
        // while the view dispatched on `item.action`, so this call did nothing.
        await logButton.trigger('click');

        const { nextTick } = await import('vue');
        await nextTick();

        expect(wrapper.vm.showLogModal).toBe(true);
        // A secondary action must never navigate.
        expect(pushMock).not.toHaveBeenCalled();
    });

    // Regression: exceeding four items silently hid the remainder.
    it('collapses beyond four items but exposes the hidden count and an expand toggle', async () => {
        const expired = Math.floor(Date.now() / 1000) - 60;
        subscriptionsRef.value = [
            // Three expired subscriptions collapse into ONE `expired-subscriptions`
            // item, so distinct categories (not subscriptions) drive the count.
            buildSub({
                id: 'e1',
                userInfo: { total: 100, upload: 1, download: 1, expire: expired },
            }),
            buildSub({
                id: 'e2',
                userInfo: { total: 100, upload: 1, download: 1, expire: expired },
            }),
            buildSub({
                id: 'e3',
                userInfo: { total: 100, upload: 1, download: 1, expire: expired },
            }),
            buildSub({ id: 'low', userInfo: { total: 100, upload: 95, download: 0 } }),
            buildSub({ id: 'failed', lastError: 'boom' }),
            // Disabled alongside enabled -> the `disabled-subscriptions` category.
            buildSub({ id: 'off', enabled: false }),
        ];
        useSettingsStore().setConfig({ mytoken: 'auto', profileToken: 'share-token' });

        const wrapper = mountDashboard();
        const expandButton = () =>
            wrapper.findAll('button').find((b) => /展开其余|收起/.test(b.text()));

        // auto-token + subscription-errors + expired + low-traffic + disabled.
        expect(wrapper.vm.dashboardHealthItems.map((item) => item.id)).toEqual([
            'auto-token',
            'subscription-errors',
            'expired-subscriptions',
            'low-traffic',
            'disabled-subscriptions',
        ]);
        expect(expandButton()).toBeTruthy();
        // The toggle reports how many are hidden, not the total.
        expect(expandButton().text()).toContain('展开其余 1 项');

        // Only four items are rendered up front.
        expect(wrapper.vm.visibleHealthItems.length).toBe(4);
        expect(wrapper.vm.hiddenHealthItemsCount).toBe(1);

        await expandButton().trigger('click');
        expect(wrapper.vm.visibleHealthItems.length).toBe(5);
        expect(wrapper.vm.hiddenHealthItemsCount).toBe(0);
        expect(expandButton().text()).toBe('收起');
    });

    it('does not render an expand toggle when every item already fits', () => {
        subscriptionsRef.value = [buildSub({ id: 'failed', lastError: 'x' })];

        const wrapper = mountDashboard();
        const expandButton = wrapper.findAll('button').find((b) => /展开其余|收起/.test(b.text()));

        expect(expandButton).toBeUndefined();
        expect(wrapper.vm.hiddenHealthItemsCount).toBe(0);
    });

    it('still routes primary actions to their target with query params', async () => {
        subscriptionsRef.value = [buildSub({ id: 'failed', lastError: 'x' })];
        useSettingsStore().setConfig({ mytoken: 'auto', profileToken: 'share-token' });

        const wrapper = mountDashboard();
        const primary = wrapper.findAll('button').find((b) => b.text() === '固定 Token');

        expect(primary).toBeTruthy();
        await primary.trigger('click');

        expect(pushMock).toHaveBeenCalledWith({
            path: '/dashboard/settings',
            query: { focus: 'mytoken' },
        });
    });

    it('renders the hidden-count toggle copy in English without leaking keys', async () => {
        const expired = Math.floor(Date.now() / 1000) - 60;
        subscriptionsRef.value = [
            buildSub({
                id: 'e1',
                userInfo: { total: 100, upload: 1, download: 1, expire: expired },
            }),
            buildSub({
                id: 'e2',
                userInfo: { total: 100, upload: 1, download: 1, expire: expired },
            }),
            buildSub({
                id: 'e3',
                userInfo: { total: 100, upload: 1, download: 1, expire: expired },
            }),
            buildSub({ id: 'low', userInfo: { total: 100, upload: 95, download: 0 } }),
            buildSub({ id: 'failed', lastError: 'boom' }),
            buildSub({ id: 'off', enabled: false }),
        ];
        useSettingsStore().setConfig({ mytoken: 'auto', profileToken: 'share-token' });

        const wrapper = mountDashboard('en-US');
        const toggle = wrapper.findAll('button').find((b) => /Show \d+ more/.test(b.text()));

        expect(toggle).toBeTruthy();
        expect(wrapper.text()).not.toContain('dashboard.');
    });

    // Regression: the item copy used to be hardcoded Chinese, so the English UI
    // showed Chinese cards.
    it('renders health item copy in English instead of leaked Chinese', async () => {
        subscriptionsRef.value = [
            buildSub({ id: 'failed', lastError: 'timeout' }),
            buildSub({ id: 'off', enabled: false }),
        ];
        useSettingsStore().setConfig({ mytoken: 'auto', profileToken: 'share-token' });

        const wrapper = mountDashboard('en-US');
        await wrapper.vm.$nextTick();

        const text = wrapper.text();
        expect(text).toContain('1 source(s) failed to update');
        expect(text).toContain('View failed sources');
        expect(text).toContain('Open logs');
        expect(text).toContain('Main token is still automatic');

        // The old hardcoded Chinese must be gone entirely.
        expect(text).not.toContain('个订阅最近更新失败');
        expect(text).not.toContain('主 Token 仍为自动模式');
        expect(text).not.toContain('打开日志');
        expect(text).not.toContain('healthItems.');
    });

    it('still renders health item copy in Chinese for zh-CN', async () => {
        subscriptionsRef.value = [buildSub({ id: 'failed', lastError: 'timeout' })];
        useSettingsStore().setConfig({ mytoken: 'auto', profileToken: 'share-token' });

        const wrapper = mountDashboard('zh-CN');
        await wrapper.vm.$nextTick();

        expect(wrapper.text()).toContain('1 个订阅最近更新失败');
        expect(wrapper.text()).toContain('打开日志');
        expect(wrapper.text()).toContain('主 Token 仍为自动模式');
    });

    // The dashboard links with a status filter the target view now honours.
    it('navigates with the status filter the subscriptions view consumes', async () => {
        subscriptionsRef.value = [buildSub({ id: 'failed', lastError: 'timeout' })];
        useSettingsStore().setConfig({ mytoken: 'stable-token', profileToken: 'share-token' });

        const wrapper = mountDashboard();
        await wrapper.vm.$nextTick();

        // A healthy profile + stable token leave the error subscription as the
        // only outstanding item, so this label is unambiguous.
        expect(wrapper.vm.dashboardHealthItems.map((item) => item.id)).toEqual([
            'subscription-errors',
        ]);

        const primary = wrapper.findAll('button').find((b) => b.text().trim() === '查看失败订阅');

        expect(primary).toBeTruthy();
        await primary.trigger('click');

        expect(pushMock).toHaveBeenCalledWith({
            path: '/dashboard/subscriptions',
            query: { status: 'error' },
        });
    });

    // Regression: the primary handler used to read `item.action`, so an item
    // carrying the secondary `openLog` key opened the log modal *instead of*
    // navigating — the "查看失败订阅" button led nowhere.
    it('navigates from the primary button even when the item also has an openLog action', async () => {
        subscriptionsRef.value = [buildSub({ id: 'failed', lastError: 'timeout' })];

        const wrapper = mountDashboard();
        await wrapper.vm.$nextTick();

        const item = wrapper.vm.dashboardHealthItems.find((i) => i.id === 'subscription-errors');
        // Precondition: this item genuinely carries both an action and a route.
        expect(item.action).toBe('openLog');
        expect(item.actionRoute).toBe('/dashboard/subscriptions');

        wrapper.vm.handleHealthAction(item);

        expect(pushMock).toHaveBeenCalledWith({
            path: '/dashboard/subscriptions',
            query: { status: 'error' },
        });
        expect(wrapper.vm.showLogModal).toBe(false);
    });

    // The secondary button must still open the log modal and never navigate.
    it('dispatch the openLog secondary action without navigating', async () => {
        subscriptionsRef.value = [buildSub({ id: 'failed', lastError: 'timeout' })];

        const wrapper = mountDashboard();
        await wrapper.vm.$nextTick();

        const item = wrapper.vm.dashboardHealthItems.find((i) => i.id === 'subscription-errors');
        wrapper.vm.handleHealthSecondaryAction(item);
        await wrapper.vm.$nextTick();

        expect(wrapper.vm.showLogModal).toBe(true);
        expect(pushMock).not.toHaveBeenCalled();
    });

    // --- Dismissal ---

    it('hides a dismissed item from the list and reports the hidden count', async () => {
        subscriptionsRef.value = [
            buildSub({ id: 'failed', lastError: 'timeout' }),
            buildSub({ id: 'off', enabled: false }),
        ];
        useSettingsStore().setConfig({ mytoken: 'auto', profileToken: 'share-token' });

        const wrapper = mountDashboard();
        await wrapper.vm.$nextTick();

        const before = wrapper.vm.dashboardHealthItems.map((i) => i.id);
        expect(before).toContain('auto-token');
        expect(before).toContain('disabled-subscriptions');

        const dismiss = wrapper
            .findAll('[data-testid="health-item-dismiss"]')
            .find((b, idx) => wrapper.vm.visibleHealthItems[idx]?.id === 'auto-token');
        await dismiss.trigger('click');

        expect(wrapper.vm.dashboardHealthItems.map((i) => i.id)).not.toContain('auto-token');
        expect(wrapper.vm.dismissedHealthItemsCount).toBe(1);
        // The rest of the list is untouched.
        expect(wrapper.vm.dashboardHealthItems.map((i) => i.id)).toContain(
            'disabled-subscriptions'
        );
    });

    it('shows a restore affordance only once something is dismissed', async () => {
        subscriptionsRef.value = [buildSub({ id: 'failed', lastError: 'timeout' })];

        const wrapper = mountDashboard();
        await wrapper.vm.$nextTick();

        const restore = () => wrapper.find('[data-testid="health-items-restore"]');
        expect(restore().exists()).toBe(false);

        await wrapper.find('[data-testid="health-item-dismiss"]').trigger('click');
        expect(restore().exists()).toBe(true);
        expect(restore().text()).toContain('1');
    });

    it('brings a dismissed item back on restore', async () => {
        subscriptionsRef.value = [buildSub({ id: 'failed', lastError: 'timeout' })];

        const wrapper = mountDashboard();
        await wrapper.vm.$nextTick();

        await wrapper.find('[data-testid="health-item-dismiss"]').trigger('click');
        expect(wrapper.vm.dashboardHealthItems.length).toBe(0);
        expect(wrapper.vm.hasHealthItems).toBe(false);

        await wrapper.find('[data-testid="health-items-restore"]').trigger('click');

        expect(wrapper.vm.dashboardHealthItems.length).toBe(1);
        expect(wrapper.vm.dismissedHealthItemsCount).toBe(0);
        expect(wrapper.find('[data-testid="health-items-restore"]').exists()).toBe(false);
    });

    it('persists a dismissal across a remount', async () => {
        subscriptionsRef.value = [buildSub({ id: 'failed', lastError: 'timeout' })];

        const first = mountDashboard();
        await first.vm.$nextTick();
        await first.find('[data-testid="health-item-dismiss"]').trigger('click');
        first.unmount();

        // A fresh mount reads the same localStorage record.
        const second = mountDashboard();
        await second.vm.$nextTick();

        expect(second.vm.dashboardHealthItems.length).toBe(0);
        expect(second.vm.dismissedHealthItemsCount).toBe(1);
    });

    it('renders the dismissal copy in English without leaking keys', async () => {
        subscriptionsRef.value = [buildSub({ id: 'failed', lastError: 'timeout' })];

        const wrapper = mountDashboard('en-US');
        await wrapper.vm.$nextTick();

        await wrapper.find('[data-testid="health-item-dismiss"]').trigger('click');

        const restore = wrapper.find('[data-testid="health-items-restore"]');
        expect(restore.text()).toContain('1 dismissed');
        expect(wrapper.text()).not.toContain('dashboard.');
    });

    // --- Terminology ---

    // The badge and the section title used to read "Pending" / "Pending" in
    // English, which the user could not tell apart.
    it('distinguishes the readiness badge from the section title', async () => {
        subscriptionsRef.value = [buildSub({ id: 'failed', lastError: 'timeout' })];

        const wrapper = mountDashboard('en-US');
        await wrapper.vm.$nextTick();

        expect(wrapper.vm.readinessText).toBe('Items pending');
        expect(wrapper.text()).toContain('Pending items');
        expect(wrapper.text()).not.toContain('有待处理事项');
    });

    it('keeps the Chinese badge and title wording distinct', async () => {
        subscriptionsRef.value = [buildSub({ id: 'failed', lastError: 'timeout' })];

        const wrapper = mountDashboard('zh-CN');
        await wrapper.vm.$nextTick();

        expect(wrapper.vm.readinessText).toBe('有待处理项');
        expect(wrapper.text()).toContain('待处理事项');
    });
});

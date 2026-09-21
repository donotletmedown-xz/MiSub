import { createRouter, createWebHistory } from 'vue-router';

// Lazy load views for better performance
const DashboardView = () => import('../views/DashboardView.vue');
const SubscriptionGroupsView = () => import('../views/SubscriptionGroupsView.vue');
const ManualNodesView = () => import('../views/ManualNodesView.vue');
const MySubscriptionsView = () => import('../views/MySubscriptionsView.vue');
const SettingsView = () => import('../views/SettingsView.vue');

const HomeView = () => import('../views/HomeView.vue'); // [NEW] Wrapper View

let authContextResolver = () => ({ state: 'loading', loginPath: '/login' });

export function configureAuthGuard(resolver) {
    authContextResolver = typeof resolver === 'function' ? resolver : authContextResolver;
}

const routes = [
    {
        path: '/', // Root path is HomeView (Smart Wrapper)
        name: 'Home',
        component: HomeView,
        meta: { title: '首页', isPublic: true }, // Publicly accessible, view handles content
    },
    {
        path: '/explore',
        name: 'Explore',
        component: HomeView,
        meta: { title: '公开页', isPublic: true },
    },
    {
        path: '/dashboard',
        name: 'Dashboard',
        component: DashboardView,
        meta: { title: '仪表盘', requiresAuth: true },
    },
    {
        path: '/dashboard/groups',
        name: 'SubscriptionGroups',
        component: SubscriptionGroupsView,
        meta: { title: '订阅组', requiresAuth: true },
    },
    {
        path: '/dashboard/nodes',
        name: 'ManualNodes',
        component: ManualNodesView,
        meta: { title: '手动节点', requiresAuth: true },
    },
    {
        path: '/dashboard/subscriptions',
        name: 'MySubscriptions',
        component: MySubscriptionsView,
        meta: { title: '我的订阅', requiresAuth: true },
    },
    {
        path: '/dashboard/settings',
        name: 'Settings',
        component: SettingsView,
        meta: { title: '设置', requiresAuth: true },
    },
    /* 
    // [REMOVED] Static /login route. 
    // Handled dynamically by Catch-All route (Entrance.vue) to support Custom Login Path.
    {
        path: '/login',
        name: 'Login',
        component: () => import('../components/modals/Login.vue'),
        meta: { title: '登录', isPublic: false } 
    }, 
    */
    {
        // Catch-all route for Custom Login Path or 404
        path: '/:pathMatch(.*)*',
        name: 'Entrance',
        component: () => import('../views/Entrance.vue'),
        meta: { title: 'MiSub', isPublic: true }, // Public, so Entrance.vue can decide what to render
    },
];

const router = createRouter({
    history: createWebHistory(),
    routes,
    scrollBehavior(to, from, savedPosition) {
        if (savedPosition) {
            return savedPosition;
        } else {
            return { top: 0 };
        }
    },
});

// 自动恢复动态 chunk 加载失败导致的白屏
router.onError((error) => {
    const message = error?.message || '';
    if (
        message.includes('Failed to fetch dynamically imported module') ||
        message.includes('error loading dynamically imported module')
    ) {
        const reloadKey = 'misub:chunk-reload';
        if (sessionStorage.getItem(reloadKey) !== '1') {
            sessionStorage.setItem(reloadKey, '1');
            window.location.reload();
        }
    }
});

// Navigation guard
router.beforeEach((to) => {
    if (typeof document !== 'undefined') {
        document.title = to.meta.title ? `${to.meta.title} - MISUB` : 'MISUB';
    }

    if (!to.meta.requiresAuth) return true;

    const context = authContextResolver() || {};
    if (context.state === 'loading') return true;
    if (context.state === 'loggedIn') return true;

    return {
        path: context.loginPath || '/login',
        query: { redirect: to.fullPath },
    };
});

export default router;

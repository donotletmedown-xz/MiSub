/**
 * 待处理事项的「忽略」记忆
 *
 * 有些待处理项在当前阶段并不打算处理（例如暂时不想固定主 Token），
 * 但健康检查每次都会重新推导出来，用户无法把它从列表里去掉。
 * 这里把被忽略的条目 id 记在本地，让用户可以主动收起不关心的项。
 *
 * 存储位置：localStorage（纯前端偏好，不进入后端数据，不影响导出/备份）。
 * 与 `domain-name-memory.js` 同属一类：只影响本机展示，不改变订阅数据。
 */

const STORAGE_KEY = 'misub:dismissedHealthItems';
const MAX_ENTRIES = 100;

/** 读取已忽略的条目 id 集合（容错：损坏时返回空集合） */
function readAll() {
    try {
        if (typeof localStorage === 'undefined') return [];
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];
        return parsed.filter((id) => typeof id === 'string' && id);
    } catch {
        return [];
    }
}

function writeAll(ids) {
    try {
        if (typeof localStorage === 'undefined') return;
        // 控制体积：超出上限时丢弃最早写入的条目
        const trimmed = ids.slice(-MAX_ENTRIES);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
    } catch {
        /* 忽略写入失败（隐私模式等） */
    }
}

/** 某个待处理项是否已被忽略 */
export function isHealthItemDismissed(id) {
    const key = String(id || '').trim();
    if (!key) return false;
    return readAll().includes(key);
}

/**
 * 读取已忽略 id 的数组副本。
 * 供视图镜像到 ref 使用（localStorage 本身不具备响应性）。
 */
export function readDismissedHealthItemIds() {
    return readAll();
}

/** 忽略一个待处理项（重复忽略无副作用） */
export function dismissHealthItem(id) {
    const key = String(id || '').trim();
    if (!key) return;
    const ids = readAll();
    if (ids.includes(key)) return;
    ids.push(key);
    writeAll(ids);
}

/** 取消忽略（用于「全部恢复」） */
export function restoreHealthItem(id) {
    const key = String(id || '').trim();
    if (!key) return;
    writeAll(readAll().filter((entry) => entry !== key));
}

/** 清空全部忽略记录（用于「全部恢复」） */
export function clearDismissedHealthItems() {
    try {
        if (typeof localStorage !== 'undefined') localStorage.removeItem(STORAGE_KEY);
    } catch {
        /* ignore */
    }
}

/**
 * 过滤掉已被忽略的条目。
 * @param {Array<{id: string}>} items
 * @returns {Array} 保留的条目
 */
export function filterDismissedHealthItems(items) {
    if (!Array.isArray(items)) return [];
    const dismissed = new Set(readAll());
    return items.filter((item) => !dismissed.has(item.id));
}

export const DISMISSED_HEALTH_ITEMS_KEY = STORAGE_KEY;

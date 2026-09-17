/**
 * 机场命名记忆（按域名）
 *
 * 订阅响应头 / 官网标题并不总能给出机场名，而人工判断最准。
 * 因此把用户手动确认过的「域名 -> 名称」记在本地，后续同域名的订阅
 * 可直接沿用，无需再次识别。这是「用自己的数据当名单」的做法。
 *
 * 存储位置：localStorage（纯前端偏好，不进入后端数据，不影响导出/备份）。
 */

const STORAGE_KEY = 'misub:domainNameMemory';
const MAX_ENTRIES = 500;

/** 读取全部记忆（容错：损坏时返回空对象） */
function readAll() {
    try {
        if (typeof localStorage === 'undefined') return {};
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return {};
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch {
        return {};
    }
}

function writeAll(map) {
    try {
        if (typeof localStorage === 'undefined') return;
        // 控制体积：超出上限时丢弃最早写入的条目
        const entries = Object.entries(map);
        let trimmed = map;
        if (entries.length > MAX_ENTRIES) {
            const keep = entries.slice(-MAX_ENTRIES);
            trimmed = Object.fromEntries(keep);
        }
        localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
    } catch {
        /* 忽略写入失败（隐私模式等） */
    }
}

/**
 * 记忆某个域名的机场名。
 * @param {string} domain 机场主域名（小写）
 * @param {string} name 用户确认的名称
 */
export function rememberDomainName(domain, name) {
    const key = String(domain || '')
        .trim()
        .toLowerCase();
    const value = String(name || '').trim();
    if (!key || !value) return;
    const map = readAll();
    map[key] = value;
    writeAll(map);
}

/**
 * 查询某域名记住的名称。
 * @param {string} domain
 * @returns {string} 未记录时返回空字符串
 */
export function lookupDomainName(domain) {
    const key = String(domain || '')
        .trim()
        .toLowerCase();
    if (!key) return '';
    const map = readAll();
    const hit = map[key];
    return typeof hit === 'string' ? hit.trim() : '';
}

/** 清空全部记忆 */
export function clearDomainNameMemory() {
    try {
        if (typeof localStorage !== 'undefined') localStorage.removeItem(STORAGE_KEY);
    } catch {
        /* ignore */
    }
}

export const DOMAIN_NAME_MEMORY_KEY = STORAGE_KEY;

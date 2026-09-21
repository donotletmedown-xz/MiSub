/**
 * URL origin helpers used by browser-level error recovery.
 */

export function isSameOriginUrl(value, origin, baseUrl = origin) {
    if (!origin || value === undefined || value === null || value === '') return false;

    try {
        return new URL(String(value), baseUrl || origin).origin === origin;
    } catch {
        return false;
    }
}

export function isLocalHost(hostname) {
    return ['localhost', '127.0.0.1', '::1', '[::1]'].includes(
        String(hostname || '')
            .trim()
            .toLowerCase()
    );
}

import { describe, expect, it } from 'vitest';
import { isLocalHost, isSameOriginUrl } from '../../src/utils/url-origin.js';

describe('URL origin helpers', () => {
    const origin = 'https://example.com';
    const baseUrl = `${origin}/dashboard`;

    it('accepts same-origin absolute and relative URLs', () => {
        expect(isSameOriginUrl(`${origin}/assets/app.js`, origin, baseUrl)).toBe(true);
        expect(isSameOriginUrl('/assets/app.js?v=1', origin, baseUrl)).toBe(true);
    });

    it('rejects lookalike and third-party origins', () => {
        expect(isSameOriginUrl('https://example.com.evil.test/assets/app.js', origin)).toBe(false);
        expect(isSameOriginUrl('https://third-party.test/assets/app.js', origin)).toBe(false);
    });

    it('rejects malformed and empty values', () => {
        expect(isSameOriginUrl('', origin)).toBe(false);
        expect(isSameOriginUrl('javascript:alert(1)', origin)).toBe(false);
        expect(isSameOriginUrl('https://[invalid-host', origin)).toBe(false);
    });

    it.each(['localhost', '127.0.0.1', '::1', '[::1]'])('recognizes local host %s', (host) => {
        expect(isLocalHost(host)).toBe(true);
    });

    it('does not classify public hosts as local', () => {
        expect(isLocalHost('example.com')).toBe(false);
    });
});

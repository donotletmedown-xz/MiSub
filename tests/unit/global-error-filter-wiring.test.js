/**
 * 接线守卫：全局错误处理器必须过滤非本站错误。
 *
 * src/utils/error-source.js 里的判定函数本身有单测，但如果没有被 main.js 真正
 * 接入全局监听器，噪音依然会走到 handleError 弹出「操作失败，请稍后重试」，
 * 并且浏览器控制台仍会打印扩展/跨域脚本的报错。这里锁定接线关系。
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const mainSource = readFileSync(path.resolve(process.cwd(), 'src/main.js'), 'utf-8');

describe('main.js 全局错误处理器接线', () => {
    it('引入来源判定工具', () => {
        expect(mainSource).toMatch(
            /import\s*\{[^}]*isForeignRejection[^}]*\}\s*from\s*'\.\/utils\/error-source\.js'/
        );
        expect(mainSource).toMatch(
            /import\s*\{[^}]*isAppScriptError[^}]*\}\s*from\s*'\.\/utils\/error-source\.js'/
        );
    });

    it('资源错误处理使用已定义的本地环境与同源判断', () => {
        expect(mainSource).toMatch(
            /import\s*\{[^}]*isLocalHost[^}]*isSameOriginUrl[^}]*\}\s*from\s*'\.\/utils\/url-origin\.js'/
        );
        expect(mainSource).toContain('const localHost = isLocalHost(window.location.hostname);');
        expect(mainSource).toContain('isSameOriginResource(resourceUrl)');
        expect(mainSource).not.toContain('if (isLocalHost &&');
    });

    const handlers = [
        ["'unhandledrejection'", 'isForeignRejection'],
        ["'error'", 'isAppScriptError'],
    ];

    it.each(handlers)('%s 处理器中使用 %s 过滤', (eventName, guard) => {
        const start = mainSource.indexOf(`addEventListener(${eventName}`);
        expect(start).toBeGreaterThan(-1);
        // 截取到下一个 addEventListener 之前，确保守卫在该处理器体内
        const next = mainSource.indexOf('addEventListener', start + 10);
        const body = mainSource.slice(start, next === -1 ? undefined : next);
        expect(body).toContain(guard);
        expect(body).toContain('event.preventDefault()');
    });

    it('被过滤的分支在调用 handleError 之前 return（不弹提示）', () => {
        const guard = mainSource.indexOf('isForeignRejection(event.reason)');
        expect(guard).toBeGreaterThan(-1);
        const branch = mainSource.slice(guard, guard + 200);
        expect(branch).toMatch(/return;/);
        expect(branch.indexOf('return;')).toBeLessThan(branch.indexOf('handleError'));
    });
});

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    ProcessorService,
    isClashYamlProfileTemplate,
    isIniTemplateSource,
} from '../../functions/services/processor-service.js';
import { KV_KEY_RULE_TEMPLATES } from '../../functions/modules/rule-template-handler.js';
import yaml from 'js-yaml';

const NODE_LIST = 'trojan://pass@1.1.1.1:443#HK-01';

describe('ProcessorService.renderOutput', () => {
    const storageAdapter = {
        get: vi.fn().mockResolvedValue(null),
        put: vi.fn(),
    };

    beforeEach(() => {
        vi.stubGlobal(
            'fetch',
            vi.fn(
                async () =>
                    new Response(
                        `
[Proxy Group]
MyGroup = select, HK-01, DIRECT

[Rule]
MATCH,MyGroup
`,
                        { status: 200 }
                    )
            )
        );
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.clearAllMocks();
    });

    it('recognizes remote ini templates with query strings', async () => {
        expect(
            isIniTemplateSource({
                kind: 'remote',
                value: 'https://example.com/template.ini?token=abc',
            })
        ).toBe(true);

        const result = await ProcessorService.renderOutput({
            targetFormat: 'clash',
            combinedNodeList: NODE_LIST,
            subName: 'Demo',
            config: { UpdateInterval: 86400 },
            builtinOptions: { ruleLevel: 'std', enableUdp: true, skipCertVerify: false },
            templateSource: { kind: 'remote', value: 'https://example.com/template.ini?token=abc' },
            managedConfigUrl: 'https://example.com/sub',
            storageAdapter,
        });

        expect(result.contentType).toBe('application/x-yaml; charset=utf-8');
        expect(result.content).toContain('name: MyGroup');
        expect(result.content).toContain('MATCH,MyGroup');
    });

    it('uses builtin rendering when templateSource is omitted', async () => {
        const result = await ProcessorService.renderOutput({
            targetFormat: 'clash',
            combinedNodeList: NODE_LIST,
            subName: 'Demo',
            config: {},
            builtinOptions: { ruleLevel: 'base' },
            managedConfigUrl: 'https://example.com/sub',
            storageAdapter,
        });

        expect(result.contentType).toBe('application/x-yaml; charset=utf-8');
        expect(result.content).toContain('proxies:');
        expect(fetch).not.toHaveBeenCalled();
    });

    it('renders remote Clash YAML profile templates by injecting MiSub nodes locally', async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn(
                async () =>
                    new Response(
                        `
mode: rule
mixed-port: 7890
proxy-groups:
  - name: 🚀 节点选择
    type: select
    proxies:
      - 🇭🇰 香港
      - DIRECT
  - name: 🇭🇰 香港
    type: url-test
    include-all: true
    filter: (?i)港|hk|hong ?kong|🇭🇰
rule-providers:
  AI:
    type: http
    behavior: domain
    format: mrs
    url: https://example.com/ai.mrs
rules:
  - RULE-SET,AI,🚀 节点选择
  - MATCH,🚀 节点选择
`,
                        { status: 200 }
                    )
            )
        );

        const result = await ProcessorService.renderOutput({
            targetFormat: 'clash',
            combinedNodeList: NODE_LIST,
            subName: 'ShellCrash',
            config: { UpdateInterval: 86400 },
            builtinOptions: { ruleLevel: 'std', enableUdp: true, skipCertVerify: false },
            templateSource: {
                kind: 'remote',
                value: 'https://raw.githubusercontent.com/Luckylos/shellcrashyaml/refs/heads/main/subconverter-shellcrash-needs.yaml',
            },
            managedConfigUrl: 'https://example.com/sub?clash',
            storageAdapter,
        });

        expect(result.contentType).toBe('application/x-yaml; charset=utf-8');
        expect(result.headers['X-MiSub-Template-Mode']).toBe('clash-yaml-profile');
        expect(result.content).toContain('proxy-groups:');
        expect(result.content).toContain('name: 🚀 节点选择');
        expect(result.content).toContain('name: 🇭🇰 香港');
        expect(result.content).toContain('rule-providers:');
        expect(result.content).toContain('RULE-SET,AI,🚀 节点选择');
        expect(result.content).toContain('proxies:');
        expect(result.content).toContain('name: 🇭🇰 HK-01');
        expect(result.content).not.toContain('metadata:');
    });

    it('detects Clash YAML profile templates by structure instead of treating them as ini templates', () => {
        expect(
            isClashYamlProfileTemplate(`
proxy-groups:
  - name: 🚀 节点选择
    type: select
rules:
  - MATCH,🚀 节点选择
`)
        ).toBe(true);
        expect(isClashYamlProfileTemplate('[Proxy Group]\nProxy = select, A')).toBe(false);
    });

    it('passes userAgent into builtin generator so Hiddify profile rendering omits rule providers', async () => {
        const result = await ProcessorService.renderOutput({
            targetFormat: 'clash',
            combinedNodeList: NODE_LIST,
            subName: 'Hiddify Test',
            config: { UpdateInterval: 86400 },
            builtinOptions: {
                ruleLevel: 'std',
                userAgent: 'HiddifyNext/4.1.1 (android) like ClashMeta v2ray sing-box',
                searchParams: new URLSearchParams(''),
            },
            templateSource: { kind: 'none', value: '' },
            managedConfigUrl: '',
            storageAdapter,
        });

        expect(result.contentType).toBe('application/x-yaml; charset=utf-8');
        expect(result.content).toContain('proxies:');
        expect(result.content).not.toContain('rule-providers:');
        expect(result.content).not.toContain('RULE-SET,');
        expect(result.content).toContain('MATCH,🚀 节点选择');
    });

    it('ignores ini templates for Hiddify Clash rendering to keep conservative compatibility output', async () => {
        const result = await ProcessorService.renderOutput({
            targetFormat: 'clash',
            combinedNodeList: NODE_LIST,
            subName: 'Hiddify Test',
            config: { UpdateInterval: 86400 },
            builtinOptions: {
                ruleLevel: 'std',
                userAgent: 'HiddifyNext/4.1.1 (android) like ClashMeta v2ray sing-box',
                hiddifyCompatible: true,
                searchParams: new URLSearchParams(''),
            },
            templateSource: { kind: 'remote', value: 'https://example.com/template.ini' },
            managedConfigUrl: '',
            storageAdapter,
        });

        expect(fetch).not.toHaveBeenCalled();
        expect(result.content).toContain('proxies:');
        expect(result.content).not.toContain('name: MyGroup');
        expect(result.content).not.toContain('rule-providers:');
        expect(result.content).not.toContain('RULE-SET,');
        expect(result.content).toContain('MATCH,🚀 节点选择');
    });

    it('preserves managed config header for builtin quanx output', async () => {
        const result = await ProcessorService.renderOutput({
            targetFormat: 'quanx',
            combinedNodeList: NODE_LIST,
            subName: 'Demo',
            config: { UpdateInterval: 86400 },
            builtinOptions: { ruleLevel: 'std', skipCertVerify: false, enableUdp: false },
            managedConfigUrl: 'https://example.com/sub?target=quanx&builtin=1',
            storageAdapter,
        });

        expect(result.content).toContain(
            '#!MANAGED-CONFIG https://example.com/sub?target=quanx&builtin=1 interval=86400 strict=false'
        );
        expect(result.content).toContain('[general]');
        expect(result.content).toContain('[dns]');
    });

    it('does not inject AI groups or UK flags when rendering a stored custom INI template', async () => {
        const customStorage = {
            get: vi.fn(async (key) => {
                if (key === KV_KEY_RULE_TEMPLATES) {
                    return [
                        {
                            id: 'user-custom',
                            name: '用户模板',
                            enabled: true,
                            content: [
                                '[custom]',
                                'ruleset=🎯 全球直连,[]GEOIP,PRIVATE',
                                'ruleset=☑️ 手动选择,[]FINAL',
                                'custom_proxy_group=☑️ 手动选择`select`.*',
                                'custom_proxy_group=🎯 全球直连`select`[]DIRECT`[]☑️ 手动选择',
                            ].join('\n'),
                        },
                    ];
                }
                return null;
            }),
            put: vi.fn(),
        };

        const result = await ProcessorService.renderOutput({
            targetFormat: 'clash',
            combinedNodeList:
                'vless://22222222-2222-4222-8222-222222222222@vless.example.com:443?encryption=none&type=tcp&security=reality&pbk=public-key-value&sid=6d1f4f&x25519mlkem768=1&flow=xtls-rprx-vision&sni=www.cloudflare.com&fp=chrome#vless-reality-rspeschywk%7C%F0%9F%93%8A325.82GB',
            subName: 'UserCustom',
            config: { UpdateInterval: 86400 },
            builtinOptions: { ruleLevel: 'std', enableUdp: true, skipCertVerify: false },
            templateSource: { kind: 'custom', value: 'user-custom' },
            managedConfigUrl: 'https://example.com/sub',
            storageAdapter: customStorage,
        });

        const parsed = yaml.load(result.content);
        const proxy = parsed.proxies[0];
        const groupNames = (parsed['proxy-groups'] || []).map((group) => group.name);

        expect(proxy.name).toBe('vless-reality-rspeschywk|📊325.82GB');
        expect(result.content).not.toContain('metadata:');
        expect(proxy['reality-opts']['support-x25519mlkem768']).toBe(true);
        expect(groupNames).not.toEqual(expect.arrayContaining(['🤖 OpenAI', '🤖 Claude']));
        expect(groupNames).toContain('☑️ 手动选择');
    });
});

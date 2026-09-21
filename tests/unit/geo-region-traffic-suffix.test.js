import { describe, expect, it } from 'vitest';
import { extractNodeRegion } from '../../functions/modules/utils/geo-utils.js';
import { extractNodeMetadata } from '../../functions/modules/utils/metadata-extractor.js';

describe('region detection vs traffic suffixes', () => {
    it('does not treat leftover traffic units like 325.82GB as Britain', () => {
        expect(extractNodeRegion('vless-reality-rspeschywk|📊325.82GB')).toBe('其他');
        expect(extractNodeRegion('vless-reality-node|📊332.98GB')).toBe('其他');
        expect(extractNodeRegion('剩余流量 12GB')).toBe('其他');
        expect(extractNodeRegion('Tokyo-01 | 1.2TB')).toBe('日本');
    });

    it('still recognizes real GB/UK region tokens', () => {
        expect(extractNodeRegion('GB-01')).toBe('英国');
        expect(extractNodeRegion('UK London')).toBe('英国');
        expect(extractNodeRegion('英国节点')).toBe('英国');
    });

    it('does not invent a country flag from traffic leftovers', () => {
        const metadata = extractNodeMetadata('vless-reality-rspeschywk|📊325.82GB');
        expect(metadata.region).toBe('其他');
        expect(metadata.flag).toBe('');
    });
});

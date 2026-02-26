export const DEFAULT_BLOOM_M_BITS = 128;
export const DEFAULT_BLOOM_K = 3;
export const DEFAULT_BLOOM_SEED = 'kmap-bloom-v1';

function fnv1a32(input: string, seed = 0x811c9dc5): number {
    let h = seed >>> 0;
    for (let i = 0; i < input.length; i++) {
        h ^= input.charCodeAt(i);
        h = Math.imul(h, 0x01000193) >>> 0;
    }
    return h >>> 0;
}

function u32ToBitIndex(x: number, mBits: number): number {
    return (x >>> 0) % mBits;
}

function deriveHashes(item: string, k: number, seed: string): number[] {
    // Kirsch–Mitzenmacher: use two base hashes to generate k.
    const h1 = fnv1a32(`${seed}|1|${item}`);
    const h2 = fnv1a32(`${seed}|2|${item}`, 0x9e3779b9);
    const out: number[] = [];
    for (let i = 0; i < k; i++) {
        out.push((h1 + Math.imul(i, h2)) >>> 0);
    }
    return out;
}

function bytesForBits(mBits: number): number {
    return Math.ceil(mBits / 8);
}

function setBit(buf: Uint8Array, bitIndex: number) {
    const byte = (bitIndex / 8) | 0;
    const bit = bitIndex % 8;
    buf[byte] |= 1 << bit;
}

function getBit(buf: Uint8Array, bitIndex: number): boolean {
    const byte = (bitIndex / 8) | 0;
    const bit = bitIndex % 8;
    return (buf[byte] & (1 << bit)) !== 0;
}

export function buildBloomFilter(
    items: string[],
    mBits = DEFAULT_BLOOM_M_BITS,
    k = DEFAULT_BLOOM_K,
    seed = DEFAULT_BLOOM_SEED,
): string {
    if (mBits <= 0) throw new Error('mBits must be positive');
    if (k <= 0) throw new Error('k must be positive');

    const buf = new Uint8Array(bytesForBits(mBits));
    for (const raw of items) {
        const item = (raw ?? '').toString().trim().toLowerCase();
        if (!item) continue;
        for (const h of deriveHashes(item, k, seed)) {
            setBit(buf, u32ToBitIndex(h, mBits));
        }
    }

    let bits = '';
    for (let i = 0; i < mBits; i++) bits += getBit(buf, i) ? '1' : '0';
    return bits;
}

export function mightContain(
    filter: string,
    itemRaw: string,
    mBits = DEFAULT_BLOOM_M_BITS,
    k = DEFAULT_BLOOM_K,
    seed = DEFAULT_BLOOM_SEED,
): boolean {
    if (!filter || filter.length < mBits) return false;

    const item = (itemRaw ?? '').toString().trim().toLowerCase();
    if (!item) return false;

    // Fast path: check filter string directly (avoid reconstructing bytes).
    for (const h of deriveHashes(item, k, seed)) {
        const idx = u32ToBitIndex(h, mBits);
        if (filter[idx] !== '1') return false;
    }
    return true;
}


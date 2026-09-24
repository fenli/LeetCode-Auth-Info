(function (global) {
    "use strict";

    const ADD64AA = (v, a, b) => {
        const o0 = v[a] + v[b];
        let o1 = v[a + 1] + v[b + 1];
        if (o0 >= 0x100000000) o1++;
        v[a] = o0;
        v[a + 1] = o1;
    };

    const ADD64AC = (v, a, b0, b1) => {
        let o0 = v[a] + b0;
        if (b0 < 0) o0 += 0x100000000;
        let o1 = v[a + 1] + b1;
        if (o0 >= 0x100000000) o1++;
        v[a] = o0;
        v[a + 1] = o1;
    };

    const B2B_GET32 = (arr, i) =>
        arr[i] ^ (arr[i + 1] << 8) ^ (arr[i + 2] << 16) ^ (arr[i + 3] << 24);

    const BLAKE2B_IV32 = new Uint32Array([
        0xf3bcc908, 0x6a09e667, 0x84caa73b, 0xbb67ae85,
        0xfe94f82b, 0x3c6ef372, 0x5f1d36f1, 0xa54ff53a,
        0xade682d1, 0x510e527f, 0x2b3e6c1f, 0x9b05688c,
        0xfb41bd6b, 0x1f83d9ab, 0x137e2179, 0x5be0cd19
    ]);

    const SIGMA8 = [
        0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15,
        14, 10, 4, 8, 9, 15, 13, 6, 1, 12, 0, 2, 11, 7, 5, 3,
        11, 8, 12, 0, 5, 2, 15, 13, 10, 14, 3, 6, 7, 1, 9, 4,
        7, 9, 3, 1, 13, 12, 11, 14, 2, 6, 5, 10, 4, 0, 15, 8,
        9, 0, 5, 7, 2, 4, 10, 15, 14, 1, 11, 12, 6, 8, 3, 13,
        2, 12, 6, 10, 0, 11, 8, 3, 4, 13, 7, 5, 15, 14, 1, 9,
        12, 5, 1, 15, 14, 13, 4, 10, 0, 7, 6, 3, 9, 2, 8, 11,
        13, 11, 7, 14, 12, 1, 3, 9, 5, 0, 15, 4, 8, 6, 2, 10,
        6, 15, 14, 9, 11, 3, 0, 8, 12, 2, 13, 7, 1, 4, 10, 5,
        10, 2, 8, 4, 7, 6, 1, 5, 15, 11, 9, 14, 3, 12, 13, 0,
        0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15,
        14, 10, 4, 8, 9, 15, 13, 6, 1, 12, 0, 2, 11, 7, 5, 3
    ];

    const SIGMA82 = new Uint8Array(SIGMA8.map((x) => x * 2));
    const mixV = new Uint32Array(32);
    const mixM = new Uint32Array(32);

    function B2B_G(a, b, c, d, ix, iy) {
        const x0 = mixM[ix];
        const x1 = mixM[ix + 1];
        const y0 = mixM[iy];
        const y1 = mixM[iy + 1];

        ADD64AA(mixV, a, b);
        ADD64AC(mixV, a, x0, x1);

        let xor0 = mixV[d] ^ mixV[a];
        let xor1 = mixV[d + 1] ^ mixV[a + 1];
        mixV[d] = xor1;
        mixV[d + 1] = xor0;

        ADD64AA(mixV, c, d);

        xor0 = mixV[b] ^ mixV[c];
        xor1 = mixV[b + 1] ^ mixV[c + 1];
        mixV[b] = (xor0 >>> 24) ^ (xor1 << 8);
        mixV[b + 1] = (xor1 >>> 24) ^ (xor0 << 8);

        ADD64AA(mixV, a, b);
        ADD64AC(mixV, a, y0, y1);

        xor0 = mixV[d] ^ mixV[a];
        xor1 = mixV[d + 1] ^ mixV[a + 1];
        mixV[d] = (xor0 >>> 16) ^ (xor1 << 16);
        mixV[d + 1] = (xor1 >>> 16) ^ (xor0 << 16);

        ADD64AA(mixV, c, d);

        xor0 = mixV[b] ^ mixV[c];
        xor1 = mixV[b + 1] ^ mixV[c + 1];
        mixV[b] = (xor1 >>> 31) ^ (xor0 << 1);
        mixV[b + 1] = (xor0 >>> 31) ^ (xor1 << 1);
    }

    function blake2bCompress(ctx, last) {
        let i;

        for (i = 0; i < 16; i++) {
            mixV[i] = ctx.h[i];
            mixV[i + 16] = BLAKE2B_IV32[i];
        }

        mixV[24] = mixV[24] ^ ctx.t;
        mixV[25] = mixV[25] ^ (ctx.t / 0x100000000);

        if (last) {
            mixV[28] = ~mixV[28];
            mixV[29] = ~mixV[29];
        }

        for (i = 0; i < 32; i++) {
            mixM[i] = B2B_GET32(ctx.b, 4 * i);
        }

        for (i = 0; i < 12; i++) {
            B2B_G(0, 8, 16, 24, SIGMA82[i * 16 + 0], SIGMA82[i * 16 + 1]);
            B2B_G(2, 10, 18, 26, SIGMA82[i * 16 + 2], SIGMA82[i * 16 + 3]);
            B2B_G(4, 12, 20, 28, SIGMA82[i * 16 + 4], SIGMA82[i * 16 + 5]);
            B2B_G(6, 14, 22, 30, SIGMA82[i * 16 + 6], SIGMA82[i * 16 + 7]);
            B2B_G(0, 10, 20, 30, SIGMA82[i * 16 + 8], SIGMA82[i * 16 + 9]);
            B2B_G(2, 12, 22, 24, SIGMA82[i * 16 + 10], SIGMA82[i * 16 + 11]);
            B2B_G(4, 14, 16, 26, SIGMA82[i * 16 + 12], SIGMA82[i * 16 + 13]);
            B2B_G(6, 8, 18, 28, SIGMA82[i * 16 + 14], SIGMA82[i * 16 + 15]);
        }

        for (i = 0; i < 16; i++) {
            ctx.h[i] = ctx.h[i] ^ mixV[i] ^ mixV[i + 16];
        }
    }

    function blake2bInit(outlen) {
        const ctx = {
            b: new Uint8Array(128),
            h: new Uint32Array(16),
            t: 0,
            c: 0,
            outlen
        };

        for (let i = 0; i < 16; i++) {
            ctx.h[i] = BLAKE2B_IV32[i];
        }

        ctx.h[0] ^= 0x01010000 ^ outlen;
        return ctx;
    }

    function blake2bUpdate(ctx, input) {
        for (let i = 0; i < input.length; i++) {
            if (ctx.c === 128) {
                ctx.t += ctx.c;
                blake2bCompress(ctx, false);
                ctx.c = 0;
            }
            ctx.b[ctx.c++] = input[i];
        }
    }

    function blake2bFinal(ctx) {
        ctx.t += ctx.c;

        while (ctx.c < 128) {
            ctx.b[ctx.c++] = 0;
        }

        blake2bCompress(ctx, true);

        const out = new Uint8Array(ctx.outlen);
        for (let i = 0; i < ctx.outlen; i++) {
            out[i] = ctx.h[i >> 2] >> (8 * (i & 3));
        }
        return out;
    }

    function nonceFromKeys(pk1, pk2) {
        const ctx = blake2bInit(nacl.box.nonceLength);
        blake2bUpdate(ctx, pk1);
        blake2bUpdate(ctx, pk2);
        return blake2bFinal(ctx);
    }

    function seal(message, publicKey) {
        const boxedLength = nacl.box.overheadLength + message.length;
        const out = new Uint8Array(nacl.box.publicKeyLength + boxedLength);
        const ephemeral = nacl.box.keyPair();

        out.set(ephemeral.publicKey);

        const nonce = nonceFromKeys(ephemeral.publicKey, publicKey);
        const boxed = nacl.box(message, nonce, publicKey, ephemeral.secretKey);
        out.set(boxed, ephemeral.publicKey.length);

        ephemeral.secretKey.fill(0);
        return out;
    }

    global.sealedBox = { seal };
})(self);

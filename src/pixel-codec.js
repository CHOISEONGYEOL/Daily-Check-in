import { TCOL } from './constants.js';

export const PixelCodec = {
    // Build reverse map: hex color → TCOL key
    _revMap: null,
    _getRevMap() {
        if (this._revMap) return this._revMap;
        this._revMap = {};
        for (const [k, v] of Object.entries(TCOL)) {
            if (v) this._revMap[v.toUpperCase()] = k;
        }
        return this._revMap;
    },

    // Pixels (NxN hex/null array) → flat TCOL string
    _pixelsToTcolStr(pixels) {
        const rev = this._getRevMap();
        const grid = pixels.length;
        let s = '';
        for (let y = 0; y < grid; y++) {
            for (let x = 0; x < grid; x++) {
                const c = pixels[y] && pixels[y][x];
                if (!c) { s += '_'; continue; }
                const up = c.toUpperCase();
                s += rev[up] || '_';
            }
        }
        return s;
    },

    // RLE encode: char + 2-digit count (01-99), e.g. "_32a05F01"
    _rleEncode(s) {
        let out = '', i = 0;
        while (i < s.length) {
            const ch = s[i];
            let cnt = 1;
            while (i + cnt < s.length && s[i + cnt] === ch && cnt < 99) cnt++;
            out += ch + (cnt < 10 ? '0' + cnt : '' + cnt);
            i += cnt;
        }
        return out;
    },

    // RLE decode: read char + 2-digit count
    _rleDecode(rle) {
        let out = '', i = 0;
        while (i + 2 < rle.length) {
            const ch = rle[i];
            const cnt = parseInt(rle[i + 1] + rle[i + 2], 10) || 1;
            out += ch.repeat(cnt);
            i += 3;
        }
        return out;
    },

    // Encode: {pixels, name, price, seller} → compact code string
    encode(obj) {
        const grid = obj.pixels.length;
        const tcolStr = this._pixelsToTcolStr(obj.pixels);
        const rle = this._rleEncode(tcolStr);
        // 64x64: H| 접두사 추가, 32x32: 기존 포맷 유지 (하위호환)
        const prefix = grid > 32 ? `H${grid}|` : '';
        const payload = prefix + [obj.name || '', obj.price || 0, obj.seller || '', rle].join('|');
        return btoa(unescape(encodeURIComponent(payload)))
            .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    },

    // Encode character: {pixels, charName, name, price, seller} → code with 'C' prefix
    encodeChar(obj) {
        const grid = obj.pixels.length;
        const tcolStr = this._pixelsToTcolStr(obj.pixels);
        const rle = this._rleEncode(tcolStr);
        // 64x64: H| 접두사 추가
        const prefix = grid > 32 ? `H${grid}|` : '';
        const payload = prefix + ['C', obj.charName || '', obj.name || '', obj.price || 0, obj.seller || '', rle].join('|');
        return btoa(unescape(encodeURIComponent(payload)))
            .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    },

    // Decode: code string → {type, pixels, name, price, seller, [charName]}
    decode(code) {
        try {
            // Restore base64 padding
            let b64 = code.replace(/-/g, '+').replace(/_/g, '/');
            while (b64.length % 4) b64 += '=';
            const payload = decodeURIComponent(escape(atob(b64)));
            const parts = payload.split('|');
            if (parts.length < 4) return null;

            // HD 포맷 감지: H64| 접두사
            let grid = 32;
            let offset = 0;
            if (parts[0].match(/^H(\d+)$/)) {
                grid = parseInt(parts[0].slice(1), 10) || 32;
                offset = 1;
            }

            const isChar = parts[offset] === 'C';
            let name, price, seller, charName, rle;
            if (isChar) {
                if (parts.length < offset + 6) return null;
                charName = parts[offset + 1];
                name = parts[offset + 2];
                price = parseInt(parts[offset + 3]) || 0;
                seller = parts[offset + 4];
                rle = parts.slice(offset + 5).join('|');
            } else {
                name = parts[offset];
                price = parseInt(parts[offset + 1]) || 0;
                seller = parts[offset + 2];
                rle = parts.slice(offset + 3).join('|');
            }

            const tcolStr = this._rleDecode(rle);
            // Convert back to pixel array
            const pixels = [];
            for (let y = 0; y < grid; y++) {
                const row = [];
                for (let x = 0; x < grid; x++) {
                    const ch = tcolStr[y * grid + x] || '_';
                    row.push(TCOL[ch] || null);
                }
                pixels.push(row);
            }
            if (isChar) return { type: 'char', pixels, charName, name, price, seller };
            return { type: 'art', pixels, name, price, seller };
        } catch (e) {
            return null;
        }
    }
};

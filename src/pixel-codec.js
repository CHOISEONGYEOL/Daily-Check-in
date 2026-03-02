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

    // Pixels (32x32 hex/null array) → flat TCOL string
    _pixelsToTcolStr(pixels) {
        const rev = this._getRevMap();
        let s = '';
        for (let y = 0; y < 32; y++) {
            for (let x = 0; x < 32; x++) {
                const c = pixels[y] && pixels[y][x];
                if (!c) { s += '_'; continue; }
                const up = c.toUpperCase();
                s += rev[up] || '_';
            }
        }
        return s; // 1024 chars
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
        const tcolStr = this._pixelsToTcolStr(obj.pixels);
        const rle = this._rleEncode(tcolStr);
        // Format: name|price|seller|rleData
        const payload = [obj.name || '', obj.price || 0, obj.seller || '', rle].join('|');
        // Base64url encode
        return btoa(unescape(encodeURIComponent(payload)))
            .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    },

    // Encode character: {pixels, charName, name, price, seller} → code with 'C' prefix
    encodeChar(obj) {
        const tcolStr = this._pixelsToTcolStr(obj.pixels);
        const rle = this._rleEncode(tcolStr);
        // Format: C|charName|name|price|seller|rleData
        const payload = ['C', obj.charName || '', obj.name || '', obj.price || 0, obj.seller || '', rle].join('|');
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

            const isChar = parts[0] === 'C';
            let name, price, seller, charName, rle;
            if (isChar) {
                if (parts.length < 6) return null;
                charName = parts[1];
                name = parts[2];
                price = parseInt(parts[3]) || 0;
                seller = parts[4];
                rle = parts.slice(5).join('|');
            } else {
                name = parts[0];
                price = parseInt(parts[1]) || 0;
                seller = parts[2];
                rle = parts.slice(3).join('|');
            }

            const tcolStr = this._rleDecode(rle);
            // Convert back to pixel array
            const pixels = [];
            for (let y = 0; y < 32; y++) {
                const row = [];
                for (let x = 0; x < 32; x++) {
                    const ch = tcolStr[y * 32 + x] || '_';
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

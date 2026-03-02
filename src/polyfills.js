/**
 * 구버전 브라우저 호환 폴리필
 * - Canvas roundRect (iOS < 15.4, 구형 Android)
 * - crypto.randomUUID (iOS < 15.2, Chrome < 92)
 * - AbortSignal.timeout (iOS < 16.4, Chrome < 108)
 */

// ── Canvas roundRect 폴리필 ──
if (typeof CanvasRenderingContext2D !== 'undefined' && !CanvasRenderingContext2D.prototype.roundRect) {
    CanvasRenderingContext2D.prototype.roundRect = function(x, y, w, h, radii) {
        let r;
        if (typeof radii === 'number') {
            r = { tl: radii, tr: radii, br: radii, bl: radii };
        } else if (Array.isArray(radii)) {
            if (radii.length === 1) r = { tl: radii[0], tr: radii[0], br: radii[0], bl: radii[0] };
            else if (radii.length === 2) r = { tl: radii[0], tr: radii[1], br: radii[0], bl: radii[1] };
            else if (radii.length === 3) r = { tl: radii[0], tr: radii[1], br: radii[2], bl: radii[1] };
            else r = { tl: radii[0], tr: radii[1], br: radii[2], bl: radii[3] };
        } else {
            r = { tl: 0, tr: 0, br: 0, bl: 0 };
        }
        this.moveTo(x + r.tl, y);
        this.lineTo(x + w - r.tr, y);
        this.quadraticCurveTo(x + w, y, x + w, y + r.tr);
        this.lineTo(x + w, y + h - r.br);
        this.quadraticCurveTo(x + w, y + h, x + w - r.br, y + h);
        this.lineTo(x + r.bl, y + h);
        this.quadraticCurveTo(x, y + h, x, y + h - r.bl);
        this.lineTo(x, y + r.tl);
        this.quadraticCurveTo(x, y, x + r.tl, y);
        this.closePath();
        return this;
    };
}

// ── crypto.randomUUID 폴리필 ──
if (typeof crypto !== 'undefined' && !crypto.randomUUID) {
    crypto.randomUUID = function() {
        const bytes = new Uint8Array(16);
        crypto.getRandomValues(bytes);
        bytes[6] = (bytes[6] & 0x0f) | 0x40;
        bytes[8] = (bytes[8] & 0x3f) | 0x80;
        const hex = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
        return hex.slice(0,8)+'-'+hex.slice(8,12)+'-'+hex.slice(12,16)+'-'+hex.slice(16,20)+'-'+hex.slice(20);
    };
}

// ── AbortSignal.timeout 폴리필 ──
if (typeof AbortSignal !== 'undefined' && !AbortSignal.timeout) {
    AbortSignal.timeout = function(ms) {
        const controller = new AbortController();
        setTimeout(() => controller.abort(new DOMException('TimeoutError', 'TimeoutError')), ms);
        return controller.signal;
    };
}

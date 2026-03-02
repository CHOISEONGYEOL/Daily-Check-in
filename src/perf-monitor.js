// ── Performance Monitor ──
// Collects FPS, frame times, network stats, errors in ring buffers.
// Renders overlay on game canvas + data for teacher dashboard graphs.

export const PerfMonitor = {
    enabled: false,
    HISTORY: 60,       // 60 seconds of per-second aggregates

    // ── Per-second ring buffers ──
    fps: [],
    frameTime: [],     // avg ms per frame
    updateTime: [],    // avg ms for update()
    renderTime: [],    // avg ms for render()
    msgSentPerSec: [],
    msgRecvPerSec: [],
    bytesSentPerSec: [],
    bytesRecvPerSec: [],

    // ── Current-second accumulators ──
    _cur: { frames:0, ftSum:0, utSum:0, rtSum:0, sent:0, recv:0, sBytes:0, rBytes:0 },
    _frameStart: 0,
    _updateEnd: 0,
    _lastTick: 0,
    _tickId: null,

    // ── Error log (last 200) ──
    errors: [],

    // ── Snapshot for overlay ──
    _snap: { fps:0, ft:0, ut:0, rt:0, sent:0, recv:0 },

    // ── Init: global error handlers + tick timer ──
    init() {
        window.addEventListener('error', e => this.logError(e.message || 'Unknown error'));
        window.addEventListener('unhandledrejection', e => this.logError('Promise: ' + (e.reason?.message || e.reason || 'unknown')));
        this._lastTick = performance.now();
        this._tickId = setInterval(() => this._tick(), 1000);
    },

    // ── Frame measurement ──
    startFrame() {
        if (!this.enabled) return;
        this._frameStart = performance.now();
    },
    endUpdate() {
        if (!this.enabled) return;
        this._updateEnd = performance.now();
    },
    endRender() {
        // no-op, endFrame calculates render time
    },
    endFrame() {
        if (!this.enabled) return;
        const now = performance.now();
        const ft = now - this._frameStart;
        const ut = this._updateEnd - this._frameStart;
        const rt = now - this._updateEnd;
        this._cur.frames++;
        this._cur.ftSum += ft;
        this._cur.utSum += ut;
        this._cur.rtSum += rt;
    },

    // ── Network measurement ──
    logSend(bytes) {
        if (!this.enabled) return;
        this._cur.sent++;
        this._cur.sBytes += (bytes || 0);
    },
    logRecv(bytes) {
        if (!this.enabled) return;
        this._cur.recv++;
        this._cur.rBytes += (bytes || 0);
    },

    // ── Error log ──
    logError(msg) {
        const t = new Date();
        const ts = t.getHours().toString().padStart(2,'0') + ':' +
                   t.getMinutes().toString().padStart(2,'0') + ':' +
                   t.getSeconds().toString().padStart(2,'0');
        this.errors.push({ ts, msg: String(msg).slice(0, 200) });
        if (this.errors.length > 200) this.errors.shift();
    },

    // ── 1-second tick: flush accumulators into ring buffers ──
    _tick() {
        const c = this._cur;
        const n = c.frames || 1;

        const push = (arr, v) => { arr.push(v); if (arr.length > this.HISTORY) arr.shift(); };
        push(this.fps, c.frames);
        push(this.frameTime, c.ftSum / n);
        push(this.updateTime, c.utSum / n);
        push(this.renderTime, c.rtSum / n);
        push(this.msgSentPerSec, c.sent);
        push(this.msgRecvPerSec, c.recv);
        push(this.bytesSentPerSec, c.sBytes);
        push(this.bytesRecvPerSec, c.rBytes);

        // snapshot for overlay
        this._snap = { fps:c.frames, ft:+(c.ftSum/n).toFixed(1), ut:+(c.utSum/n).toFixed(1), rt:+(c.rtSum/n).toFixed(1), sent:c.sent, recv:c.recv };

        // reset
        this._cur = { frames:0, ftSum:0, utSum:0, rtSum:0, sent:0, recv:0, sBytes:0, rBytes:0 };
    },

    // ── Game canvas overlay (top-left) ──
    renderOverlay(ctx) {
        const s = this._snap;
        const txt = `FPS:${s.fps} | ${s.ft}ms (U:${s.ut} R:${s.rt}) | \u25B2${s.sent} \u25BC${s.recv} msg/s`;
        ctx.save();
        ctx.setTransform(1,0,0,1,0,0); // reset camera
        ctx.font = 'bold 11px monospace';
        const w = ctx.measureText(txt).width + 12;
        ctx.fillStyle = 'rgba(0,0,0,.6)';
        ctx.fillRect(4, 4, w, 18);
        ctx.fillStyle = s.fps >= 50 ? '#00B894' : s.fps >= 30 ? '#FDCB6E' : '#FF6B6B';
        ctx.fillText(txt, 10, 16);
        ctx.restore();
    },

    // ── Dashboard graph drawing utility ──
    drawGraph(canvas, datasets, options) {
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const W = canvas.width, H = canvas.height;
        ctx.clearRect(0, 0, W, H);

        // background
        ctx.fillStyle = '#0d0d1a';
        ctx.fillRect(0, 0, W, H);

        if (!datasets || !datasets.length) return;

        // find max across all datasets
        const { baseline, title } = options || {};
        let maxVal = 0;
        for (const ds of datasets) {
            for (const v of ds.data) if (v > maxVal) maxVal = v;
        }
        if (baseline && baseline > maxVal) maxVal = baseline;
        maxVal = maxVal || 1;
        const pad = { t: 22, b: 4, l: 38, r: 4 };
        const gw = W - pad.l - pad.r;
        const gh = H - pad.t - pad.b;

        // grid lines
        ctx.strokeStyle = 'rgba(255,255,255,.06)';
        ctx.lineWidth = 1;
        for (let i = 0; i <= 4; i++) {
            const y = pad.t + (gh / 4) * i;
            ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(W - pad.r, y); ctx.stroke();
        }

        // y-axis labels
        ctx.fillStyle = 'rgba(255,255,255,.3)';
        ctx.font = '9px monospace';
        ctx.textAlign = 'right';
        for (let i = 0; i <= 4; i++) {
            const y = pad.t + (gh / 4) * i;
            const val = maxVal * (1 - i / 4);
            ctx.fillText(val < 10 ? val.toFixed(1) : Math.round(val), pad.l - 4, y + 3);
        }

        // baseline (dashed)
        if (baseline) {
            const by = pad.t + gh * (1 - baseline / maxVal);
            ctx.setLineDash([4, 4]);
            ctx.strokeStyle = 'rgba(255,255,255,.2)';
            ctx.beginPath(); ctx.moveTo(pad.l, by); ctx.lineTo(W - pad.r, by); ctx.stroke();
            ctx.setLineDash([]);
            ctx.fillStyle = 'rgba(255,255,255,.25)';
            ctx.textAlign = 'left';
            ctx.fillText(baseline, W - pad.r - 20, by - 3);
        }

        // datasets
        for (const ds of datasets) {
            const arr = ds.data;
            if (!arr.length) continue;
            const len = arr.length;
            ctx.strokeStyle = ds.color;
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            for (let i = 0; i < len; i++) {
                const x = pad.l + (i / Math.max(len - 1, 1)) * gw;
                const y = pad.t + gh * (1 - arr[i] / maxVal);
                if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
            }
            ctx.stroke();

            // fill under line
            if (datasets.length === 1) {
                ctx.lineTo(pad.l + gw, pad.t + gh);
                ctx.lineTo(pad.l, pad.t + gh);
                ctx.closePath();
                ctx.fillStyle = ds.color.replace(')', ',.08)').replace('rgb', 'rgba');
                ctx.fill();
            }
        }

        // title
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 10px sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(title || '', pad.l, 14);

        // legend
        if (datasets.length > 1) {
            ctx.font = '9px sans-serif';
            let lx = pad.l + (title ? ctx.measureText(title).width + 16 : 0);
            for (const ds of datasets) {
                ctx.fillStyle = ds.color;
                ctx.fillRect(lx, 7, 8, 8);
                ctx.fillStyle = 'rgba(255,255,255,.5)';
                ctx.fillText(ds.label, lx + 10, 14);
                lx += ctx.measureText(ds.label).width + 20;
            }
        }

        // current value (right side)
        if (datasets[0].data.length) {
            const last = datasets[0].data[datasets[0].data.length - 1];
            ctx.fillStyle = datasets[0].color;
            ctx.font = 'bold 11px monospace';
            ctx.textAlign = 'right';
            ctx.fillText(last < 10 ? last.toFixed(1) : Math.round(last), W - 6, 14);
        }
    },
};

// ── Performance Logger ──
// Collects 6 metrics from PerfMonitor every 1s, compresses into 60s aggregates,
// and inserts into Supabase performance_logs table.
// Also detects anomalies (FPS <= 30, Ping >= 150ms) and sends immediately with throttle.

import { supabase } from './supabase.js';
import { PerfMonitor } from './perf-monitor.js';

export const PerfLogger = {
    _enabled: false,
    _userId: null,
    _sessionId: null,

    // ── 60-second buffer: each entry is one 1s sample ──
    _buffer: [],
    _flushInterval: null,
    _sampleInterval: null,

    // ── Anomaly throttle ──
    _lastAnomalyAt: 0,
    ANOMALY_COOLDOWN: 5000, // 5s

    // ── External metric hooks (set by game code) ──
    _pingMs: 0,          // updated externally via PerfLogger.setPing(ms)
    _drawCalls: 0,       // updated externally via PerfLogger.setDrawCalls(n)

    // ── Start logging ──
    start(userId, sessionId) {
        if (this._enabled) return;
        this._enabled = true;
        this._userId = userId;
        this._sessionId = sessionId;
        this._buffer = [];

        // Sample every 1 second — read latest tick from PerfMonitor
        this._sampleInterval = setInterval(() => this._sample(), 1000);

        // Flush (compress + insert) every 60 seconds
        this._flushInterval = setInterval(() => this._flush(), 60000);
    },

    // ── Stop logging + cleanup ──
    stop() {
        if (!this._enabled) return;
        this._enabled = false;
        clearInterval(this._sampleInterval);
        clearInterval(this._flushInterval);
        this._sampleInterval = null;
        this._flushInterval = null;

        // Flush remaining data
        this._flush();
    },

    // ── External setters for metrics not in PerfMonitor ──
    setPing(ms) { this._pingMs = ms; },
    setDrawCalls(n) { this._drawCalls = n; },

    // ── 1-second sample: snapshot current metrics ──
    _sample() {
        const snap = PerfMonitor._snap;
        const mem = performance.memory
            ? Math.round(performance.memory.usedJSHeapSize / 1048576) // MB
            : 0;

        const entry = {
            fps: snap.fps,
            frameTime: snap.ft,
            msgPerSec: snap.sent + snap.recv,
            ping: this._pingMs,
            memory: mem,
            drawCalls: this._drawCalls,
        };

        this._buffer.push(entry);

        // Anomaly detection — immediate send with cooldown
        const now = Date.now();
        if (now - this._lastAnomalyAt >= this.ANOMALY_COOLDOWN) {
            if (entry.fps > 0 && entry.fps <= 30) {
                this._sendAnomaly(entry, 'low_fps');
                this._lastAnomalyAt = now;
            } else if (entry.ping >= 150) {
                this._sendAnomaly(entry, 'high_ping');
                this._lastAnomalyAt = now;
            }
        }
    },

    // ── Compress 60s buffer into min/max/avg and insert ──
    _flush() {
        const buf = this._buffer;
        this._buffer = [];
        if (!buf.length) return;

        const keys = ['fps', 'frameTime', 'msgPerSec', 'ping', 'memory', 'drawCalls'];
        const stats = {};

        for (const key of keys) {
            const vals = buf.map(e => e[key]);
            const sum = vals.reduce((a, b) => a + b, 0);
            stats[key] = {
                min: Math.min(...vals),
                max: Math.max(...vals),
                avg: +(sum / vals.length).toFixed(2),
            };
        }

        const metricsData = {
            period_seconds: buf.length,
            stats,
        };

        this._insert('periodic', metricsData);
    },

    // ── Send anomaly raw snapshot ──
    _sendAnomaly(entry, tag) {
        this._insert('anomaly', {
            tag,
            snapshot: entry,
        });
    },

    // ── Supabase INSERT (fire-and-forget) ──
    _insert(logType, metricsData) {
        supabase.from('performance_logs').insert({
            user_id: this._userId,
            session_id: this._sessionId,
            log_type: logType,
            metrics_data: metricsData,
        }).then(({ error }) => {
            if (error) console.warn('[PerfLogger] insert failed:', error.message);
        });
    },

    // ── Cleanup: call on page unload / session end ──
    cleanup() {
        if (!this._enabled) return;
        clearInterval(this._sampleInterval);
        clearInterval(this._flushInterval);
        this._sampleInterval = null;
        this._flushInterval = null;
        this._enabled = false;

        // Flush remaining buffer synchronously via sendBeacon
        if (this._buffer.length) {
            const buf = this._buffer;
            this._buffer = [];

            const keys = ['fps', 'frameTime', 'msgPerSec', 'ping', 'memory', 'drawCalls'];
            const stats = {};
            for (const key of keys) {
                const vals = buf.map(e => e[key]);
                const sum = vals.reduce((a, b) => a + b, 0);
                stats[key] = {
                    min: Math.min(...vals),
                    max: Math.max(...vals),
                    avg: +(sum / vals.length).toFixed(2),
                };
            }

            const row = {
                user_id: this._userId,
                session_id: this._sessionId,
                log_type: 'periodic',
                metrics_data: { period_seconds: buf.length, stats },
            };

            // sendBeacon for reliable delivery on page close
            const url = `${supabase.supabaseUrl}/rest/v1/performance_logs`;
            const headers = {
                apikey: supabase.supabaseKey,
                Authorization: `Bearer ${supabase.supabaseKey}`,
                'Content-Type': 'application/json',
                Prefer: 'return=minimal',
            };
            try {
                const blob = new Blob([JSON.stringify(row)], { type: 'application/json' });
                // sendBeacon doesn't support custom headers, so fall back to keepalive fetch
                fetch(url, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(row),
                    keepalive: true,
                }).catch(() => {});
            } catch {
                // Last resort — fire normal insert
                this._insert('periodic', { period_seconds: buf.length, stats });
            }
        }
    },
};

// Register cleanup on page unload
if (typeof window !== 'undefined') {
    window.addEventListener('beforeunload', () => PerfLogger.cleanup());
    window.addEventListener('pagehide', () => PerfLogger.cleanup());
}

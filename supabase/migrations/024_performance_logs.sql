-- Performance monitoring logs (compressed 60-second aggregates + anomaly snapshots)
CREATE TABLE IF NOT EXISTS performance_logs (
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id     UUID REFERENCES users(id) ON DELETE SET NULL,
    session_id  TEXT,                          -- game_sessions.id (e.g. 'class_1A')
    log_type    TEXT NOT NULL DEFAULT 'periodic', -- 'periodic' | 'anomaly'
    metrics_data JSONB NOT NULL,               -- compressed stats or raw snapshot
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for querying by session and time range
CREATE INDEX idx_perf_logs_session_time ON performance_logs (session_id, created_at DESC);
CREATE INDEX idx_perf_logs_type ON performance_logs (log_type) WHERE log_type = 'anomaly';

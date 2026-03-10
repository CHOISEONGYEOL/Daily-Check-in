import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    realtime: {
        params: {
            eventsPerSecond: 30,    // 기본 10 → 30 (클라이언트당 초당 발신 상한, 30명×10pos+α 대응)
        },
        heartbeatIntervalMs: 15000, // 기본 30s → 15s (빠른 연결 끊김 감지)
        timeout: 30000,             // 채널 연결 타임아웃 30초 (기본 10초는 30명 동시접속 시 부족)
    },
    db: {
        schema: 'public',
    },
    global: {
        headers: { 'x-client-info': 'daily-checkin/2.0' },
    },
});

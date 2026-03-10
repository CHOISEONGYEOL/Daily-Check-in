// ── App-level Presence (온라인 상태 추적) ──
// 학생 로그인 시 join, 로그아웃/페이지 닫기 시 leave
// 교사 대시보드가 이 채널을 구독하여 실시간 온라인 상태 표시
import { supabase } from './supabase.js';
import { Player } from './player.js';

const MAX_RETRIES = 5;
const RETRY_BASE_MS = 1000;
const RETRY_JITTER_MS = 2000;

export const AppPresence = {
    _channel: null,
    _retryCount: 0,

    join(className) {
        if (this._channel) this.leave();
        this._retryCount = 0;
        // 랜덤 지연으로 thundering herd 방지
        const stagger = Math.random() * 500;
        setTimeout(() => this._doJoin(className), stagger);
    },

    _doJoin(className, retryCount = 0) {
        const ch = supabase.channel(`app:${className || 'main'}`, {
            config: { broadcast: { self: false }, presence: { key: String(Player.studentId) } }
        });
        // 교사 강제 재로그인 수신
        ch.on('broadcast', { event: 'force_relogin' }, ({ payload }) => {
            if (payload?.targetSid === String(Player.studentId)) {
                window.dispatchEvent(new CustomEvent('force-relogin'));
            }
        });
        ch.subscribe(async (status) => {
            if (status === 'SUBSCRIBED') {
                this._retryCount = 0;
                try {
                    await ch.track({
                        studentId: String(Player.studentId),
                        nickname: Player.nickname || '',
                        className: className || '',
                    });
                } catch(e) {
                    console.warn('[AppPresence] track failed, retrying...', e);
                    setTimeout(async () => {
                        try {
                            await ch.track({
                                studentId: String(Player.studentId),
                                nickname: Player.nickname || '',
                                className: className || '',
                            });
                        } catch(e2) { console.error('[AppPresence] track retry failed:', e2); }
                    }, 2000);
                }
            } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
                console.warn(`[AppPresence] ${status}, retry ${retryCount + 1}/${MAX_RETRIES}`);
                if (retryCount < MAX_RETRIES) {
                    const delay = RETRY_BASE_MS * Math.pow(2, retryCount) + Math.random() * RETRY_JITTER_MS;
                    try { ch.unsubscribe(); supabase.removeChannel(ch); } catch(e) {}
                    this._channel = null;
                    setTimeout(() => this._doJoin(className, retryCount + 1), delay);
                    return;
                }
                console.error('[AppPresence] 연결 실패, 최대 재시도 횟수 초과');
            }
        });
        this._channel = ch;
    },

    leave() {
        if (!this._channel) return;
        try {
            this._channel.untrack();
            this._channel.unsubscribe();
            supabase.removeChannel(this._channel);
        } catch(e) { /* ignore */ }
        this._channel = null;
    }
};

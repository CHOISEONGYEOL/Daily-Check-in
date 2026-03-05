// ── App-level Presence (온라인 상태 추적) ──
// 학생 로그인 시 join, 로그아웃/페이지 닫기 시 leave
// 교사 대시보드가 이 채널을 구독하여 실시간 온라인 상태 표시
import { supabase } from './supabase.js';
import { Player } from './player.js';

export const AppPresence = {
    _channel: null,

    join(className) {
        if (this._channel) this.leave();
        const ch = supabase.channel(`app:${className || 'main'}`, {
            config: { broadcast: { self: false }, presence: { key: String(Player.studentId) } }
        });
        ch.subscribe(async (status) => {
            if (status === 'SUBSCRIBED') {
                await ch.track({
                    studentId: String(Player.studentId),
                    nickname: Player.nickname || '',
                    className: className || '',
                });
            }
        });
        this._channel = ch;
    },

    leave() {
        if (!this._channel) return;
        this._channel.untrack();
        this._channel.unsubscribe();
        supabase.removeChannel(this._channel);
        this._channel = null;
    }
};

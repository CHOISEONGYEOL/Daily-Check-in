/**
 * 채팅 모더레이션 — 경고/퇴장 시스템 + DB 로그
 * 욕설 감지 시 경고 부여, 2회 누적 시 퇴장
 */
import { supabase } from './supabase.js';
import { Player } from './player.js';
import { DB } from './db.js';
import { isClean } from './chat-filter.js';

const MAX_WARNINGS = 2; // 경고 N회 누적 시 퇴장

export const ChatModeration = {
    warnings: 0,     // 현재 세션 경고 횟수
    kicked: false,   // 퇴장 상태

    /** 세션 시작 시 초기화 (대기실 진입 시 호출) */
    reset() {
        this.warnings = 0;
        this.kicked = false;
    },

    /**
     * 메시지 검사 + 로그 저장
     * @returns {{ allowed: boolean, warning?: number }} 전송 허용 여부
     */
    async check(text) {
        if (this.kicked) return { allowed: false };
        if (!text) return { allowed: false };

        const clean = isClean(text);

        // DB에 채팅 로그 저장 (비동기, fire-and-forget)
        this._logChat(text, !clean);

        if (!clean) {
            // 경고 부여
            this.warnings++;
            const warningNum = this.warnings;

            // 경고 기록 DB 저장
            this._logWarning(text, warningNum);

            if (this.warnings >= MAX_WARNINGS) {
                // 퇴장 처리
                this.kicked = true;
                this._logKick(text, this.warnings);
                return { allowed: false, warning: warningNum, kicked: true };
            }

            return { allowed: false, warning: warningNum, remaining: MAX_WARNINGS - this.warnings };
        }

        return { allowed: true };
    },

    // ── DB 저장 (fire-and-forget) ──

    _logChat(message, isBlocked) {
        supabase.from('chat_logs').insert({
            user_id: DB.userId,
            student_id: Player.studentId,
            student_name: Player.studentName,
            class_name: Player.className,
            message,
            is_blocked: isBlocked,
        }).then(({ error }) => {
            if (error) console.warn('[ChatMod] chat log error:', error.message);
        });
    },

    _logWarning(message, warningNum) {
        supabase.from('chat_warnings').insert({
            user_id: DB.userId,
            student_id: Player.studentId,
            student_name: Player.studentName,
            class_name: Player.className,
            message,
            warning_num: warningNum,
        }).then(({ error }) => {
            if (error) console.warn('[ChatMod] warning log error:', error.message);
        });
    },

    _logKick(lastMessage, warningCount) {
        supabase.from('chat_kicks').insert({
            user_id: DB.userId,
            student_id: Player.studentId,
            student_name: Player.studentName,
            class_name: Player.className,
            reason: `경고 ${warningCount}회 누적으로 자동 퇴장`,
            last_message: lastMessage,
            warning_count: warningCount,
        }).then(({ error }) => {
            if (error) console.warn('[ChatMod] kick log error:', error.message);
        });
    },
};

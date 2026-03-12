import { supabase } from './supabase.js';

/**
 * DB layer — Supabase ↔ Player 동기화
 * 학번(student_id) 기반 인증 (비밀번호 없이 간단 로그인)
 */
export const DB = {
    userId: null,   // Supabase users.id (UUID)
    ready: false,
    _saveTimer: null,
    _heartbeatId: null,
    sessionToken: null,  // 단일 기기 제한용 세션 토큰
    _currentIP: null,    // 대리 출석 방지용 IP
    _EXEMPT_IDS: ['77777', '99999'], // 교사/테스트 — 다중 기기 허용
    _charCache: new Map(),           // 캐릭터 데이터 캐시 (studentId → data)
    _charCacheExpiry: 60000,         // 캐시 만료 시간 (60초)

    // ── 클라이언트 IP 조회 (대리 출석 방지) ────────
    async _getClientIP() {
        try {
            const r = await fetch('https://api.ipify.org?format=json',
                { signal: AbortSignal.timeout(3000) });
            const d = await r.json();
            return d.ip || null;
        } catch { return null; } // IP 조회 실패 시 제한 없이 통과
    },

    // ── 로그인 / 회원가입 ──────────────────────
    // 학번으로 조회 → 있으면 로그인, 없으면 회원가입
    // existingToken: 페이지 리로드 시 기존 토큰 재사용
    async login(studentId, studentName, nickname, existingToken) {
        const isExempt = this._EXEMPT_IDS.includes(studentId);
        const token = isExempt ? null : (existingToken || crypto.randomUUID());

        // ★ IP 조회를 논블로킹으로 (로그인 지연 방지, 30명 동시 로그인 대응)
        if (!isExempt) {
            this._getClientIP().then(ip => {
                this._currentIP = ip;
                // IP를 나중에 DB에 기록 (로그인 흐름 차단 안 함)
                if (ip && this.userId) {
                    supabase.from('users').update({ login_ip: ip }).eq('id', this.userId).then(() => {});
                }
            }).catch(() => {});
        }

        // 1) 기존 유저 찾기
        let { data: user } = await supabase
            .from('users')
            .select('*')
            .eq('student_id', studentId)
            .single();

        if (user) {
            // 이름 검증 (모든 계정)
            if (user.student_name !== studentName) {
                return { user: null, isNew: false, error: 'name_mismatch' };
            }
            // 닉네임 검증 (최초 설정 후 비밀번호 역할)
            if (user.nickname && user.nickname !== nickname) {
                return { user: null, isNew: false, error: 'nickname_mismatch' };
            }
            // 닉네임이 초기화된 경우 (교사 삭제 등): 새 닉네임 중복 체크 후 설정
            if (!user.nickname && nickname) {
                const { data: dup } = await supabase
                    .from('users').select('id').eq('nickname', nickname).limit(1).maybeSingle();
                if (dup) return { user: null, isNew: false, error: 'nickname_taken' };
                await supabase.from('users').update({ nickname }).eq('id', user.id);
                user.nickname = nickname;
            }
            this.userId = user.id;
            this.sessionToken = token;
            this.ready = true;
            // ★ 세션 토큰 기록 (IP 조회 완료를 기다리지 않음)
            if (!isExempt) {
                const upd = { session_token: token };
                supabase.from('users')
                    .update(upd)
                    .eq('id', user.id)
                    .then(() => {})
                    .catch(e => console.warn('[DB] session token update failed:', e));
            }
            this._startHeartbeat();
            return { user, isNew: false };
        }

        // 2) 없으면 신규 생성 — 닉네임 중복 체크
        if (nickname) {
            const { data: dup } = await supabase
                .from('users')
                .select('id')
                .eq('nickname', nickname)
                .limit(1)
                .maybeSingle();
            if (dup) return { user: null, isNew: false, error: 'nickname_taken' };
        }
        const insertData = {
            student_id: studentId,
            student_name: studentName,
            nickname: nickname,
            coins: 0, streak: 0, max_slots: 1
        };
        if (!isExempt) {
            insertData.session_token = token;
            if (this._currentIP) insertData.login_ip = this._currentIP;
        }

        const { data: newUser, error } = await supabase
            .from('users')
            .insert(insertData)
            .select()
            .single();

        if (error) throw error;
        this.userId = newUser.id;
        this.sessionToken = token;
        this.ready = true;
        this._startHeartbeat();
        return { user: newUser, isNew: true };
    },

    // ── 유저 데이터 전체 로드 ──────────────────
    async loadPlayer() {
        if (!this.userId) return null;

        const [userRes, charsRes] = await Promise.all([
            supabase.from('users').select('*').eq('id', this.userId).single(),
            supabase.from('characters').select('*').eq('user_id', this.userId).order('slot_index')
        ]);

        if (userRes.error) throw userRes.error;
        const u = userRes.data;
        const chars = charsRes.data || [];

        return {
            coins: u.coins,
            streak: u.streak,
            nickname: u.nickname,
            studentId: u.student_id,
            studentName: u.student_name,
            owned: u.owned || [],
            titles: u.titles || [],
            activeTitle: u.active_title,
            activeCharIdx: u.active_char_idx,
            maxSlots: u.max_slots,
            auctionGallery: u.auction_gallery || [],
            clearedGames: u.cleared_games || [],
            characters: chars.map(c => ({
                name: c.name,
                pixels: c.pixels,
                grid: c.grid || (c.pixels ? c.pixels.length : 32),
                equipped: { hat: c.hat || null, effect: c.effect || null, pet: c.pet || null },
                _dbId: c.id           // DB row id (내부용)
            }))
        };
    },

    // ── 유저 데이터 저장 (debounced) ────────────
    savePlayer(player) {
        if (!this.userId) return;
        this._pendingPlayer = player;
        clearTimeout(this._saveTimer);
        this._saveTimer = setTimeout(() => {
            this._doSave(player);
            this._pendingPlayer = null;
        }, 300);
    },

    flushPendingSave() {
        if (this._saveTimer && this._pendingPlayer) {
            clearTimeout(this._saveTimer);
            this._saveTimer = null;
            this._doSave(this._pendingPlayer);
            this._pendingPlayer = null;
        }
    },

    async _doSave(p) {
        if (!this.userId) return;

        // 1) users 테이블 업데이트
        const userUpdate = supabase
            .from('users')
            .update({
                coins: p.coins,
                streak: p.streak,
                nickname: p.nickname,
                student_name: p.studentName,
                owned: p.owned,
                titles: p.titles,
                active_title: p.activeTitle,
                active_char_idx: p.activeCharIdx,
                max_slots: p.maxSlots,
                auction_gallery: p.auctionGallery || [],
                cleared_games: p.clearedGames || []
            })
            .eq('id', this.userId);

        // 2) characters 동기화 — upsert 방식
        const charUpserts = p.characters.map((ch, i) => ({
            user_id: this.userId,
            slot_index: i,
            name: ch.name || `캐릭터 ${i + 1}`,
            pixels: ch.pixels,
            grid: ch.grid || (ch.pixels ? ch.pixels.length : 32),
            hat: ch.equipped?.hat || null,
            effect: ch.equipped?.effect || null,
            pet: ch.equipped?.pet || null
        }));

        // 삭제된 슬롯 처리: DB에 있는 slot_index >= characters.length 삭제
        const charDelete = supabase
            .from('characters')
            .delete()
            .eq('user_id', this.userId)
            .gte('slot_index', p.characters.length);

        const charUpsert = charUpserts.length > 0
            ? supabase
                .from('characters')
                .upsert(charUpserts, { onConflict: 'user_id,slot_index' })
            : Promise.resolve();

        await Promise.all([userUpdate, charDelete, charUpsert]);
    },

    // ── 출석 체크 ───────────────────────────────
    async checkIn() {
        if (!this.userId) return { alreadyChecked: true };

        const today = new Date().toISOString().split('T')[0];

        const { data: existing } = await supabase
            .from('check_ins')
            .select('id')
            .eq('user_id', this.userId)
            .eq('checked_at', today)
            .single();

        if (existing) return { alreadyChecked: true };

        const { error } = await supabase
            .from('check_ins')
            .insert({ user_id: this.userId, checked_at: today });

        if (error) throw error;
        return { alreadyChecked: false };
    },

    // ── 출석 기록 조회 ──────────────────────────
    async getCheckIns(limit = 30) {
        if (!this.userId) return [];
        const { data } = await supabase
            .from('check_ins')
            .select('checked_at')
            .eq('user_id', this.userId)
            .order('checked_at', { ascending: false })
            .limit(limit);
        return (data || []).map(r => r.checked_at);
    },

    // ── 학번으로 유저 존재 여부 확인 ─────────────
    async exists(studentId) {
        const { data } = await supabase
            .from('users')
            .select('id')
            .eq('student_id', studentId)
            .single();
        return !!data;
    },

    // ── roster에서 학번 조회 (이름 검증용) ────────
    async checkRoster(studentId) {
        const { data } = await supabase
            .from('roster')
            .select('student_name, class_name')
            .eq('student_id', studentId)
            .single();
        return data;  // null이면 미등록, 있으면 { student_name, class_name }
    },

    // ── roster 관리 (교사용) ──────────────────────
    async addToRoster(studentId, studentName, className) {
        const { error } = await supabase.from('roster').insert({
            student_id: studentId,
            student_name: studentName,
            class_name: className || ''
        });
        return !error;
    },

    async removeFromRoster(studentId) {
        const { error } = await supabase.from('roster')
            .delete().eq('student_id', studentId);
        return !error;
    },

    async updateRoster(studentId, fields) {
        const { error } = await supabase.from('roster')
            .update(fields).eq('student_id', studentId);
        return !error;
    },

    async updateUser(studentId, fields) {
        const { error } = await supabase.from('users')
            .update(fields).eq('student_id', studentId);
        return !error;
    },

    // ── 코인 변동 (서버사이드 RPC) ──────────────
    async addCoins(amount, reason = 'unknown') {
        if (!this.userId) return null;
        const { data, error } = await supabase.rpc('add_coins', {
            p_user_id: this.userId,
            p_amount: amount,
            p_reason: reason
        });
        if (error) {
            console.error('addCoins RPC failed:', error);
            return null;
        }
        return data; // new balance
    },

    // ── Heartbeat: 세션 토큰 검증 (첫 체크는 로그인 후 90초 뒤, 이후 60초마다) ──
    // 접속 상태(online/offline)는 Supabase Presence가 담당
    _startHeartbeat() {
        clearInterval(this._heartbeatId);
        this._heartbeatMismatchCount = 0;
        // ★ 첫 heartbeat는 90초 뒤 (30명 동시 로그인 시 세션 토큰 DB 반영 지연 대응)
        this._heartbeatId = setTimeout(() => {
            this._sendHeartbeat();
            this._heartbeatId = setInterval(() => this._sendHeartbeat(), 60000);
        }, 90000);
    },

    stopHeartbeat() {
        clearInterval(this._heartbeatId);
        clearTimeout(this._heartbeatId);
        this._heartbeatId = null;
    },

    // ── 로그아웃 시 IP 해제 (대리 출석 방지 해제) ──
    async clearLoginState() {
        if (!this.userId) return;
        try {
            await supabase.from('users')
                .update({ login_ip: null })
                .eq('id', this.userId);
        } catch { /* ignore */ }
        this._currentIP = null;
    },

    async _sendHeartbeat() {
        if (!this.userId) return;

        // 세션 토큰 검증 (Read Only — 면제 계정 제외)
        if (this.sessionToken) {
            try {
                const { data, error } = await supabase
                    .from('users')
                    .select('session_token')
                    .eq('id', this.userId)
                    .single();
                // ★ DB 오류 시 무시 (네트워크 일시 장애로 킥 방지)
                if (error) {
                    console.warn('[DB] heartbeat query failed, skipping:', error.message);
                    this._heartbeatMismatchCount = 0;
                    return;
                }
                if (data && data.session_token !== this.sessionToken) {
                    // ★ 연속 2회 불일치 시에만 킥 (일시적 DB 지연 대응)
                    this._heartbeatMismatchCount = (this._heartbeatMismatchCount || 0) + 1;
                    console.warn(`[DB] session mismatch ${this._heartbeatMismatchCount}/2`);
                    if (this._heartbeatMismatchCount >= 2) {
                        this._onSessionRevoked();
                    }
                } else {
                    this._heartbeatMismatchCount = 0;
                }
            } catch(e) { this._heartbeatMismatchCount = 0; }
        }
    },

    _onSessionRevoked() {
        this.stopHeartbeat();
        this.sessionToken = null;
        window.dispatchEvent(new CustomEvent('session-revoked'));
    },

    // ── 게임 클리어 기록 ───────────────────────
    async saveGameClear(gameId) {
        await supabase.from('game_clears').upsert(
            { game_id: gameId, cleared_at: new Date().toISOString() },
            { onConflict: 'game_id' }
        );
    },

    async getGameClears() {
        const { data } = await supabase
            .from('game_clears')
            .select('game_id');
        return (data || []).map(r => r.game_id);
    },

    // ── 게임 세션 상태 조회 (반별, 캐시 + 재시도) ──────────────────
    _isGameOpenCache: {},      // { sessionId: { value, ts } }
    _IS_GAME_OPEN_TTL: 10000, // 캐시 TTL 10초 (30명×15초 폴링 = DB 부하 최소화)
    async isGameOpen(className) {
        const sessionId = className ? 'class_' + className : 'main';
        // ★ 캐시 히트: TTL 내면 DB 쿼리 없이 즉시 반환
        const cached = this._isGameOpenCache[sessionId];
        if (cached && Date.now() - cached.ts < this._IS_GAME_OPEN_TTL) {
            return cached.value;
        }
        // ★ 최대 3회 재시도 (30명 동시 조회 시 DB 일시 과부하 대응)
        for (let attempt = 0; attempt < 3; attempt++) {
            try {
                const { data, error } = await supabase
                    .from('game_sessions')
                    .select('is_open')
                    .eq('id', sessionId)
                    .single();
                if (error && attempt < 2) {
                    await new Promise(r => setTimeout(r, 500 * (attempt + 1)));
                    continue;
                }
                const result = data?.is_open === true;
                this._isGameOpenCache[sessionId] = { value: result, ts: Date.now() };
                return result;
            } catch(e) {
                if (attempt < 2) {
                    await new Promise(r => setTimeout(r, 500 * (attempt + 1)));
                    continue;
                }
                console.error('[DB] isGameOpen failed after retries:', e);
                // ★ 에러 시 캐시된 마지막 상태 반환 (접속 차단 방지)
                if (cached) return cached.value;
                return false;
            }
        }
        if (cached) return cached.value;
        return false;
    },

    async getWrMode(className) {
        const sessionId = className ? 'class_' + className : 'main';
        const { data } = await supabase
            .from('game_sessions')
            .select('wr_mode')
            .eq('id', sessionId)
            .single();
        return data?.wr_mode || 'soccer';
    },

    // ── 접속 로그 기록 ───────────────────────────
    async recordLogin(studentId, studentName) {
        if (!this.userId) return;
        // roster에서 반 정보 조회
        let className = '';
        const { data: roster } = await supabase
            .from('roster')
            .select('class_name')
            .eq('student_id', studentId)
            .single();
        if (roster) className = roster.class_name;
        await supabase.from('login_logs').insert({
            user_id: this.userId,
            student_id: studentId,
            student_name: studentName,
            class_name: className
        });
    },

    // ── 특정 날짜의 접속 로그 조회 (교사용) ──────
    async getLoginLogs(date) {
        const { data } = await supabase
            .from('login_logs')
            .select('student_id, student_name, class_name, logged_in_at')
            .gte('logged_in_at', date + 'T00:00:00')
            .lte('logged_in_at', date + 'T23:59:59.999')
            .order('logged_in_at', { ascending: true });
        return data || [];
    },

    // ── 게임 시작 신호 (교사 → 학생) ──────────────
    async startGameSession(className) {
        const sessionId = className ? 'class_' + className : 'main';
        await supabase.from('game_sessions')
            .update({ game_started: true, updated_at: new Date().toISOString() })
            .eq('id', sessionId);
    },

    async checkGameStarted(className) {
        const sessionId = className ? 'class_' + className : 'main';
        const { data } = await supabase
            .from('game_sessions')
            .select('game_started')
            .eq('id', sessionId)
            .single();
        return data?.game_started === true;
    },

    async closeGameSession(className) {
        const sessionId = className ? 'class_' + className : 'main';
        await supabase.from('game_sessions')
            .update({ is_open: false, game_started: false, phase: 'waiting', vote_data: null, selected_game: null, closed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
            .eq('id', sessionId);
    },

    // ── 관전 모드용 메서드 ──
    async broadcastVote(className, voteData) {
        const sessionId = className ? 'class_' + className : 'main';
        await supabase.from('game_sessions')
            .update({ vote_data: JSON.stringify(voteData), updated_at: new Date().toISOString() })
            .eq('id', sessionId);
    },

    async setGamePhase(className, phase, extra = {}) {
        const sessionId = className ? 'class_' + className : 'main';
        await supabase.from('game_sessions')
            .update({ phase, updated_at: new Date().toISOString(), ...extra })
            .eq('id', sessionId);
    },

    async setSelectedGame(className, gameId) {
        const sessionId = className ? 'class_' + className : 'main';
        const { data } = await supabase.from('game_sessions')
            .select('selected_game').eq('id', sessionId).single();
        if (!data?.selected_game) {
            await supabase.from('game_sessions')
                .update({ selected_game: gameId, updated_at: new Date().toISOString() })
                .eq('id', sessionId);
        }
    },

    async readVoteData(className) {
        const sessionId = className ? 'class_' + className : 'main';
        const { data } = await supabase.from('game_sessions')
            .select('vote_data').eq('id', sessionId).single();
        return data?.vote_data ? JSON.parse(data.vote_data) : null;
    },

    async getSpectatorData(className) {
        const sessionId = className ? 'class_' + className : 'main';
        const { data } = await supabase.from('game_sessions')
            .select('phase, vote_data, selected_game').eq('id', sessionId).single();
        return {
            phase: data?.phase || 'waiting',
            voteData: data?.vote_data ? JSON.parse(data.vote_data) : null,
            selectedGame: data?.selected_game || null
        };
    },

    async setParticipantCount(className, count) {
        const sessionId = className ? 'class_' + className : 'main';
        await supabase.from('game_sessions')
            .update({ participant_count: count, updated_at: new Date().toISOString() })
            .eq('id', sessionId);
    },

    async getParticipantCount(className) {
        const sessionId = className ? 'class_' + className : 'main';
        const { data } = await supabase.from('game_sessions')
            .select('participant_count').eq('id', sessionId).single();
        return data?.participant_count || 0;
    },

    // ── 교사 출결 체크 ──
    async saveTeacherAttendance(studentId, className, status) {
        const today = new Date().toISOString().split('T')[0];
        const { error } = await supabase.from('teacher_attendance').upsert({
            student_id: studentId,
            class_name: className,
            attend_date: today,
            status,
            marked_at: new Date().toISOString()
        }, { onConflict: 'student_id,attend_date' });
        if (error) console.error('saveTeacherAttendance error:', error);
    },

    // ── 원격 플레이어 캐릭터 조회 (캐시 적용, 동시 접속 시 DB 부하 방지) ──
    async getPlayerCharacterByStudentId(studentId) {
        // 캐시 확인
        const cached = this._charCache.get(studentId);
        if (cached && Date.now() - cached.ts < this._charCacheExpiry) {
            return cached.data;
        }

        try {
            const { data: user } = await supabase
                .from('users')
                .select('id, nickname, active_title, active_char_idx')
                .eq('student_id', studentId)
                .single();
            if (!user) return null;
            const { data: char } = await supabase
                .from('characters')
                .select('pixels, hat, effect, pet')
                .eq('user_id', user.id)
                .eq('slot_index', user.active_char_idx ?? 0)
                .single();
            const result = {
                nickname: user.nickname,
                activeTitle: user.active_title,
                pixels: char?.pixels || null,
                hat: char?.hat || null,
                effect: char?.effect || null,
                pet: char?.pet || null,
            };
            // 캐시 저장
            this._charCache.set(studentId, { data: result, ts: Date.now() });
            return result;
        } catch(e) {
            console.warn('[DB] getPlayerCharacter failed:', studentId, e);
            return cached?.data || null; // 실패 시 만료된 캐시라도 반환
        }
    },

    async loadTeacherAttendance(date) {
        const { data } = await supabase.from('teacher_attendance')
            .select('student_id, class_name, status, marked_at')
            .eq('attend_date', date)
            .order('marked_at', { ascending: true });
        return data || [];
    },

    // ── 채팅 모더레이션 조회 (교사용) ──

    /** 채팅 로그 조회 (최근 N건, 차단된 메시지만 필터 가능) */
    async getChatLogs({ date, className, blockedOnly, limit = 100 } = {}) {
        let q = supabase.from('chat_logs')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(limit);
        if (date) {
            q = q.gte('created_at', date + 'T00:00:00')
                 .lt('created_at', date + 'T23:59:59.999');
        }
        if (className) q = q.eq('class_name', className);
        if (blockedOnly) q = q.eq('is_blocked', true);
        const { data } = await q;
        return data || [];
    },

    /** 경고 기록 조회 */
    async getChatWarnings({ date, className, limit = 100 } = {}) {
        let q = supabase.from('chat_warnings')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(limit);
        if (date) {
            q = q.gte('created_at', date + 'T00:00:00')
                 .lt('created_at', date + 'T23:59:59.999');
        }
        if (className) q = q.eq('class_name', className);
        const { data } = await q;
        return data || [];
    },

    /** 퇴장 기록 조회 */
    async getChatKicks({ date, className, limit = 100 } = {}) {
        let q = supabase.from('chat_kicks')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(limit);
        if (date) {
            q = q.gte('created_at', date + 'T00:00:00')
                 .lt('created_at', date + 'T23:59:59.999');
        }
        if (className) q = q.eq('class_name', className);
        const { data } = await q;
        return data || [];
    },
};

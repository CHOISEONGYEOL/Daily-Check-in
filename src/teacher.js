import { supabase } from './supabase.js';
import { DB } from './db.js';
import { esc } from './sanitize.js';
import { TeacherAttendance } from './teacher-attendance.js';
import { TeacherMarket, setTeacherMarketMarketplace } from './teacher-market.js';
import { PerfMonitor } from './perf-monitor.js';

// Forward references
let Marketplace = null;
export function setTeacherMarketplace(m) { Marketplace = m; setTeacherMarketMarketplace(m); }
let WaitingRoom = null;
export function setTeacherWaitingRoom(wr) { WaitingRoom = wr; }

export const Teacher = {
    students: [],
    gameIsOpen: false,
    _pollId: null,
    _mainTab: 'students',
    _classFilter: '',   // '' = 전체, '6반', '7반' 등
    _attendance: {},     // { studentId: { status, markedAt } }
    // ── 실시간 접속 상태 (Supabase Presence) ──
    _rtChannels: new Map(),      // className → Supabase channel (대기실 wr: 채널)
    _appChannels: new Map(),     // className → Supabase channel (앱 전체 app: 채널)
    _realtimeOnline: new Set(),  // 앱 접속 중인 studentId Set (로비 포함)
    _wrOnline: new Set(),        // 대기실(출석게임) 접속 중인 studentId Set

    async init() {
        await Promise.all([this.loadStudents(), this.loadGameState(), this._loadTodayAttendance()]);
        this._renderClassBar();
        this._populateGameClassSelect();
        this.render();
        clearInterval(this._pollId);
        // 출석 상태만 폴링 (온라인은 Presence가 담당) — 30초
        this._pollId = setInterval(() => this.refresh(), 30000);
        // 모든 반에 앱 Presence 구독 (온라인 상태 실시간 추적)
        const allClasses = [...new Set(this.students.map(s => s.className).filter(c => c))];
        allClasses.forEach(c => this._appSubscribe(c));
        this._appSubscribe(''); // 미분류 학생
        // 열린 반이 있으면 대기실 Presence 구독 (재진입 시 복구)
        if (this._openClasses.length > 0) {
            this._openClasses.forEach(c => this._rtSubscribe(c));
            this.startRosterPoll();
        }
    },

    stop() {
        clearInterval(this._pollId);
        this._pollId = null;
        this.stopRosterPoll();
        this._rtUnsubscribeAll();
        this._appUnsubscribeAll();
    },

    _editingId: null,  // 현재 인라인 편집 중인 studentId

    // ── 학생 데이터 로드 ──
    async loadStudents() {
        const today = new Date().toISOString().split('T')[0];

        const [rosterRes, usersRes, checkinsRes] = await Promise.all([
            supabase.from('roster').select('*').order('student_id'),
            supabase.from('users').select('student_id, student_name, nickname'),
            supabase.from('check_ins').select('user_id, users!inner(student_id)').eq('checked_at', today)
        ]);

        const roster = rosterRes.data || [];
        const users = usersRes.data || [];
        const checkins = checkinsRes.data || [];

        const userMap = {};
        users.forEach(u => { userMap[u.student_id] = u; });

        const checkedSet = new Set();
        checkins.forEach(c => { if (c.users) checkedSet.add(c.users.student_id); });

        const rosterIds = new Set(roster.map(r => r.student_id));
        const TEACHER_ID = '77777';
        const TEST_ID = '99999';

        this.students = roster.map(r => {
            const u = userMap[r.student_id];
            return {
                studentId: r.student_id,
                studentName: r.student_name,
                className: r.class_name || '',
                gender: r.gender || '',
                nickname: u?.nickname || null,
                checked: checkedSet.has(r.student_id),
                unregistered: false
            };
        });

        // 미등록 학생: users에는 있지만 roster에 없는 사람 (교사/테스트 제외)
        users.forEach(u => {
            if (rosterIds.has(u.student_id)) return;
            if (u.student_id === TEACHER_ID || u.student_id === TEST_ID) return;
            this.students.push({
                studentId: u.student_id,
                studentName: u.student_name || u.nickname || '이름없음',
                className: '',
                gender: '',
                nickname: u.nickname || null,
                checked: checkedSet.has(u.student_id),
                unregistered: true
            });
        });
    },

    // ── 게임 세션 상태 (반별) ──
    _openClasses: [],   // 열린 반 목록
    _gameStateLoaded: false, // 최초 로드 완료 여부

    async loadGameState() {
        if (this._gameStateLoaded) {
            // 이미 로드됨 → _openClasses 유지, UI만 갱신
            this.gameIsOpen = this._openClasses.length > 0;
            this.updateToggle();
            return;
        }
        // 최초 로드: 열려있는 세션 복원 (F5 새로고침 시 학생 세션 유지)
        const { data } = await supabase.from('game_sessions')
            .select('id, is_open, opened_at, wr_mode').eq('is_open', true);
        const openSessions = data || [];
        // 12시간 이상 된 좀비 세션만 자동 정리
        const STALE_MS = 12 * 60 * 60 * 1000;
        const now = Date.now();
        const fresh = [], staleIds = [];
        for (const s of openSessions) {
            const age = s.opened_at ? now - new Date(s.opened_at).getTime() : Infinity;
            if (age > STALE_MS) staleIds.push(s.id);
            else fresh.push(s);
        }
        if (staleIds.length > 0) {
            await Promise.all(staleIds.map(id =>
                supabase.from('game_sessions').update({
                    is_open: false, game_started: false, phase: 'waiting',
                    vote_data: null, selected_game: null,
                    closed_at: new Date().toISOString(), updated_at: new Date().toISOString()
                }).eq('id', id)
            ));
        }
        this._openClasses = fresh.map(s => s.id.replace(/^class_/, ''));
        this.gameIsOpen = this._openClasses.length > 0;
        // DB에 저장된 wr_mode 복원
        if (fresh.length > 0 && fresh[0].wr_mode) {
            const sel = document.getElementById('teacher-wr-mode');
            if (sel) sel.value = fresh[0].wr_mode;
        }
        this._gameStateLoaded = true;
        this.updateToggle();
    },

    async toggleGame() {
        const sel = document.getElementById('teacher-game-class');
        const className = sel?.value;
        if (!className) { alert('반을 선택하세요!'); return; }

        const sessionId = 'class_' + className;
        const isOpen = this._openClasses.includes(className);
        const newState = !isOpen;

        const btn = document.getElementById('teacher-game-toggle');
        if (btn) btn.style.pointerEvents = 'none';

        try {
            const { error } = await supabase.from('game_sessions').upsert({
                id: sessionId,
                is_open: newState,
                ...(newState ? {
                    opened_at: new Date().toISOString(),
                    game_started: false,
                    phase: 'waiting',
                    vote_data: null,
                    selected_game: null,
                    wr_mode: document.getElementById('teacher-wr-mode')?.value || 'soccer'
                } : {
                    closed_at: new Date().toISOString(),
                    game_started: false,
                    phase: 'waiting',
                    vote_data: null,
                    selected_game: null
                }),
                updated_at: new Date().toISOString()
            }, { onConflict: 'id' });

            if (error) {
                console.error('toggleGame upsert error:', error);
                alert('게임 상태 변경 실패: ' + error.message);
                return;
            }
            // 닫기 시: 해당 반 채널로 shutdown 브로드캐스트 → 학생 강제 퇴장
            if (!newState) {
                const entry = this._rtChannels.get(className);
                if (entry && entry.channel) {
                    entry.channel.send({ type: 'broadcast', event: 'shutdown', payload: {} });
                }
                // ★ 게임 채널에도 game_end 브로드캐스트 (게임 중인 학생의 물리/렌더 루프 클린업)
                const gameIds = ['picopark', 'numbermatch', 'maze', 'escaperoom', 'crossword', 'ollaolla'];
                const endPromises = gameIds.map(gid => {
                    const chName = `game:${className}_${gid}`;
                    return new Promise((resolve) => {
                        try {
                            const ch = supabase.channel(chName);
                            const timeout = setTimeout(() => { try { ch.unsubscribe(); supabase.removeChannel(ch); } catch(e){} resolve(); }, 3000);
                            ch.subscribe((status) => {
                                if (status === 'SUBSCRIBED') {
                                    ch.send({ type: 'broadcast', event: 'game_end', payload: {} });
                                    setTimeout(() => { clearTimeout(timeout); ch.unsubscribe(); supabase.removeChannel(ch); resolve(); }, 200);
                                } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
                                    clearTimeout(timeout); try { supabase.removeChannel(ch); } catch(e){} resolve();
                                }
                            });
                        } catch(e) { resolve(); }
                    });
                });
                await Promise.all(endPromises);
            }
            // DB 성공 → 로컬 상태 반영
            if (newState) {
                if (!this._openClasses.includes(className)) this._openClasses.push(className);
            } else {
                this._openClasses = this._openClasses.filter(c => c !== className);
            }
            this.gameIsOpen = this._openClasses.length > 0;
            this.updateToggle();
            // 출석부 실시간 폴링 + Presence 구독
            if (this._openClasses.length > 0) {
                this.startRosterPoll();
                this._openClasses.forEach(c => this._rtSubscribe(c));
            } else {
                this.stopRosterPoll();
                this._rtUnsubscribeAll();
                if (WaitingRoom && WaitingRoom.running) WaitingRoom.stop();
            }
        } catch (e) {
            console.error('toggleGame exception:', e);
            alert('게임 상태 변경 중 오류가 발생했습니다.');
        } finally {
            if (btn) btn.style.pointerEvents = '';
        }
    },

    _populateGameClassSelect() {
        const sel = document.getElementById('teacher-game-class');
        if (!sel) return;
        const prev = sel.value; // 기존 선택값 보존
        const classes = [...new Set(this.students.map(s => s.className))].filter(c => c && c.trim());
        classes.sort((a, b) => {
            const pa = a.split(/[-\s]/).map(Number), pb = b.split(/[-\s]/).map(Number);
            for(let i = 0; i < Math.max(pa.length, pb.length); i++){
                const va = pa[i] || 0, vb = pb[i] || 0;
                if(va !== vb) return va - vb;
            }
            return a.localeCompare(b);
        });
        sel.innerHTML = '<option value="">-- 반 선택 --</option>';
        classes.forEach(c => {
            const isOpen = this._openClasses.includes(c);
            sel.innerHTML += `<option value="${c}">${c}${isOpen ? ' ✅' : ''}</option>`;
        });
        if (prev) sel.value = prev; // 선택값 복원
    },

    onGameClassChange() {
        this.updateToggle();
    },

    updateToggle() {
        const btn = document.getElementById('teacher-game-toggle');
        const txt = document.getElementById('teacher-toggle-text');
        const status = document.getElementById('teacher-game-status');
        if (!btn) return;

        // 선택된 반 기준 토글 상태
        const sel = document.getElementById('teacher-game-class');
        const className = sel?.value;
        const isOpen = className && this._openClasses.includes(className);

        if (isOpen) {
            btn.className = 'teacher-toggle open';
            if (txt) txt.textContent = `🎮 ${className} 게임 닫기`;
        } else {
            btn.className = 'teacher-toggle closed';
            if (txt) txt.textContent = className ? `🎮 ${className} 게임 열기` : '🎮 반을 선택하세요';
        }

        // 열린 반 목록 표시
        if (status) {
            if (this._openClasses.length > 0) {
                status.innerHTML = '열린 반: ' + this._openClasses.map(c => `<span class="tg-open-badge">${c}</span>`).join(' ');
            } else {
                status.textContent = '열린 반 없음';
            }
        }

        // 게임 모드 선택 잠금 (열린 반이 있으면 변경 불가)
        const wrModeSelect = document.getElementById('teacher-wr-mode');
        if (wrModeSelect) wrModeSelect.disabled = this._openClasses.length > 0;

        // 출석부 + 대기실 입장 버튼
        const rosterCheck = document.getElementById('teacher-roster-check');
        const enterBtn = document.getElementById('teacher-enter-wr');
        if (this._openClasses.length > 0) {
            if (rosterCheck) { rosterCheck.classList.remove('hidden'); this.renderRosterCheck(); }
            if (enterBtn) enterBtn.classList.remove('hidden');
        } else {
            if (rosterCheck) rosterCheck.classList.add('hidden');
            if (enterBtn) enterBtn.classList.add('hidden');
        }

        // 드롭다운 옵션 갱신 (열린 반 표시)
        this._populateGameClassSelect();
    },

    // ── 실시간 접속 상태: Presence 구독 ──
    _rtSubscribe(className) {
        if (this._rtChannels.has(className)) return; // 이미 구독 중

        // WaitingRoom이 이미 이 채널을 사용 중이면 공유 모드
        if (WaitingRoom && WaitingRoom.running && WaitingRoom._rtChannel) {
            const wrChannel = WaitingRoom._rtChannel;
            this._rtChannels.set(className, { shared: true, channel: wrChannel });
            // 공유 채널에서 Presence 읽기 → 폴링으로 처리
            this._rtSyncFromChannel(className, wrChannel);
            return;
        }

        const channelName = `wr:${className || 'main'}`;
        const channel = supabase.channel(channelName, {
            config: { broadcast: { self: false }, presence: { key: 'teacher-dash-' + Date.now() } }
        });

        channel.on('presence', { event: 'sync' }, () => {
            this._rtSyncFromChannel(className, channel);
        });

        channel.subscribe(async (status) => {
            if (status === 'SUBSCRIBED') {
                console.log('[Teacher RT] subscribed to', channelName);
                await channel.track({ isTeacher: true, studentId: '77777', role: 'dashboard' });
            }
        });

        this._rtChannels.set(className, { shared: false, channel });
    },

    _rtUnsubscribe(className) {
        const entry = this._rtChannels.get(className);
        if (!entry) return;
        // 공유 채널은 해제하지 않음 (WaitingRoom이 관리)
        if (!entry.shared) {
            entry.channel.unsubscribe();
            supabase.removeChannel(entry.channel);
        }
        this._rtChannels.delete(className);
        // 해당 반 학생 대기실 오프라인 처리
        const classStudentIds = new Set(this.students.filter(s => s.className === className).map(s => s.studentId));
        for (const sid of classStudentIds) this._wrOnline.delete(sid);
    },

    _rtUnsubscribeAll() {
        for (const [cls] of this._rtChannels) {
            this._rtUnsubscribe(cls);
        }
        this._wrOnline.clear();
    },

    // Presence 상태 읽기 → _wrOnline 갱신 + UI 업데이트 (대기실 접속자)
    _rtSyncFromChannel(className, channel) {
        const state = channel.presenceState();
        // 이 반에서 이전에 온라인이었던 학생 제거
        const classStudentIds = new Set(this.students.filter(s => s.className === className).map(s => s.studentId));
        for (const sid of classStudentIds) this._wrOnline.delete(sid);

        // 현재 접속자 추가
        for (const [key, presences] of Object.entries(state)) {
            if (!presences || presences.length === 0) continue;
            const p = presences[0];
            if (p.isTeacher) continue;
            const sid = String(p.studentId);
            if (sid) this._wrOnline.add(sid);
        }

        // UI 즉시 갱신
        if (this._openClasses.length > 0) this.renderRosterCheck();
        this.render();
    },

    // ── 앱 레벨 Presence: 전체 온라인 상태 추적 (app: 채널) ──
    _appSubscribe(className) {
        if (this._appChannels.has(className)) return;
        const channelName = `app:${className || 'main'}`;
        const channel = supabase.channel(channelName, {
            config: { broadcast: { self: false }, presence: { key: 'teacher-app-' + Date.now() } }
        });
        channel.on('presence', { event: 'sync' }, () => {
            this._appSyncFromChannel(className, channel);
        });
        channel.subscribe(async (status) => {
            if (status === 'SUBSCRIBED') {
                await channel.track({ isTeacher: true, studentId: '77777', role: 'dashboard' });
            }
        });
        this._appChannels.set(className, channel);
    },

    _appUnsubscribe(className) {
        const channel = this._appChannels.get(className);
        if (!channel) return;
        channel.unsubscribe();
        supabase.removeChannel(channel);
        this._appChannels.delete(className);
    },

    _appUnsubscribeAll() {
        for (const [cls] of this._appChannels) {
            this._appUnsubscribe(cls);
        }
    },

    _appSyncFromChannel(className, channel) {
        const state = channel.presenceState();
        // 이 반 학생을 _realtimeOnline에서 제거 후 현재 접속자 다시 추가 (앱 접속 상태)
        const classStudentIds = new Set(
            this.students.filter(s => (s.className || '') === (className || '')).map(s => s.studentId)
        );
        for (const sid of classStudentIds) this._realtimeOnline.delete(sid);
        for (const [key, presences] of Object.entries(state)) {
            if (!presences || presences.length === 0) continue;
            const p = presences[0];
            if (p.isTeacher) continue;
            const sid = String(p.studentId);
            if (sid) this._realtimeOnline.add(sid);
        }
        this.render();
    },

    // ── 교사 대기실 입장 (전지전능 관전 모드) ──
    async enterWaitingRoom() {
        if (this._openClasses.length === 0) {
            alert('먼저 게임을 열어주세요!');
            return;
        }
        // 참여 인원수를 DB에 저장 (학생 클라이언트가 참조)
        const participants = this.getParticipantCount();
        await Promise.all(this._openClasses.map(c =>
            DB.setParticipantCount(c, participants)
        ));
        this.stop();
        // 화면 전환
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
        document.getElementById('waiting-room').classList.add('active');
        // WaitingRoom god mode 시작 (채널 이름 전달)
        if (WaitingRoom) {
            WaitingRoom._teacherClassName = this._openClasses[0] || '';
            WaitingRoom.startGodMode();
        }
    },

    // ── 반 필터 탭 ──
    _renderClassBar() {
        const bar = document.getElementById('teacher-class-bar');
        if (!bar) return;
        // 빈 문자열 제외, 자연수 정렬 (6반→7반→…→10반)
        const classes = [...new Set(this.students.map(s => s.className))].filter(c => c && c.trim());
        classes.sort((a, b) => {
            const pa = a.split(/[-\s]/).map(Number), pb = b.split(/[-\s]/).map(Number);
            for(let i = 0; i < Math.max(pa.length, pb.length); i++){
                const va = pa[i] || 0, vb = pb[i] || 0;
                if(va !== vb) return va - vb;
            }
            return a.localeCompare(b);
        });
        bar.innerHTML = `<button class="teacher-class-btn${this._classFilter === '' ? ' active' : ''}" onclick="Teacher.filterClass(this,'')">전체</button>`;
        classes.forEach(c => {
            const count = this.students.filter(s => s.className === c).length;
            bar.innerHTML += `<button class="teacher-class-btn${this._classFilter === c ? ' active' : ''}" onclick="Teacher.filterClass(this,'${c}')">${c} <span class="tcb-count">(${count})</span></button>`;
        });
    },

    filterClass(btn, cls) {
        this._classFilter = cls;
        document.querySelectorAll('.teacher-class-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.render();
    },

    // ── 렌더링 ──
    render() {
        const search = (document.getElementById('t-search')?.value || '').toLowerCase();
        const statusFilter = document.getElementById('t-filter-status')?.value || '';

        // 반 필터 적용
        let filtered = this._classFilter
            ? this.students.filter(s => s.className === this._classFilter)
            : this.students;
        if (statusFilter === 'online') filtered = filtered.filter(s => this._realtimeOnline.has(s.studentId));
        else if (statusFilter === 'checked') filtered = filtered.filter(s => s.checked);
        else if (statusFilter === 'offline') filtered = filtered.filter(s => !this._realtimeOnline.has(s.studentId) && !s.checked);
        if (search) filtered = filtered.filter(s =>
            s.studentName.includes(search) || s.studentId.includes(search) || (s.nickname && s.nickname.toLowerCase().includes(search))
        );

        // 통계 (반 필터 기준)
        const classStudents = this._classFilter
            ? this.students.filter(s => s.className === this._classFilter)
            : this.students;
        const total = classStudents.length;
        const online = classStudents.filter(s => this._realtimeOnline.has(s.studentId)).length;
        const checked = classStudents.filter(s => s.checked).length;
        const el = id => document.getElementById(id);
        if (el('t-total')) el('t-total').textContent = total;
        if (el('t-online')) el('t-online').textContent = online;
        if (el('t-checked')) el('t-checked').textContent = checked;
        if (el('t-absent')) el('t-absent').textContent = total - checked;

        // 정렬: 실시간 접속 > 출석 > 미접속
        filtered.sort((a, b) => {
            const score = s => (this._realtimeOnline.has(s.studentId) ? 4 : 0) + (s.checked ? 1 : 0);
            return score(b) - score(a) || a.studentId.localeCompare(b.studentId);
        });

        const grid = document.getElementById('teacher-grid');
        if (!grid) return;

        if (!filtered.length) {
            grid.innerHTML = '<div class="teacher-empty">표시할 학생이 없습니다</div>';
            return;
        }

        grid.innerHTML = '';
        filtered.forEach(s => {
            const card = document.createElement('div');
            const isOnline = this._realtimeOnline.has(s.studentId);
            const status = isOnline ? 'online' : s.checked ? 'checked' : 'offline';

            // ── 인라인 편집 모드 ──
            if (this._editingId === s.studentId) {
                card.className = `teacher-card ${status} t-editing`;
                const esc = v => (v || '').replace(/"/g, '&quot;');
                card.innerHTML = `
                    <div class="t-edit-form">
                        <div class="t-edit-row">
                            <input class="t-edit-input" id="te-sid-${s.studentId}" value="${esc(s.studentId)}" placeholder="학번" maxlength="10">
                            <input class="t-edit-input" id="te-name-${s.studentId}" value="${esc(s.studentName)}" placeholder="이름" maxlength="10">
                            <input class="t-edit-input t-edit-sm" id="te-class-${s.studentId}" value="${esc(s.className)}" placeholder="분반" maxlength="10">
                        </div>
                        <div class="t-edit-row">
                            <input class="t-edit-input" id="te-nick-${s.studentId}" value="${esc(s.nickname || '')}" placeholder="닉네임" maxlength="20">
                            <select class="t-edit-input t-edit-sm" id="te-gender-${s.studentId}">
                                <option value=""${!s.gender ? ' selected' : ''}>성별</option>
                                <option value="남"${s.gender === '남' ? ' selected' : ''}>남</option>
                                <option value="여"${s.gender === '여' ? ' selected' : ''}>여</option>
                            </select>
                            <button class="t-edit-save" onclick="Teacher.saveEdit('${s.studentId}')">저장</button>
                            <button class="t-edit-cancel" onclick="Teacher.cancelEdit()">취소</button>
                        </div>
                    </div>
                `;
                grid.appendChild(card);
                return;
            }

            // ── 일반 카드 ──
            const isLive = this._realtimeOnline.has(s.studentId);
            card.className = `teacher-card ${status}${s.unregistered ? ' unregistered' : ''}${isLive ? ' t-live' : ''}`;

            const dotColor = isLive ? 'live' : s.checked ? 'yellow' : 'gray';
            const timeStr = isLive ? '🟢 접속중' : '미접속';
            const nickHtml = s.nickname ? `<div class="teacher-card-nick">@${esc(s.nickname)}</div>` : '';
            const unregBadge = s.unregistered ? '<span class="teacher-unreg-badge">미등록</span>' : '';
            const genderBadge = s.gender ? `<span class="t-gender-badge ${s.gender === '남' ? 'male' : 'female'}">${esc(s.gender)}</span>` : '';

            const eSid = esc(s.studentId);
            const eName = esc(s.studentName);
            let actionBtns;
            if (s.unregistered) {
                actionBtns = `<button class="t-card-btn t-card-reg" onclick="Teacher.registerStudent('${eSid}','${eName}')">등록</button>`;
            } else {
                actionBtns = `<button class="t-card-btn t-card-edit" onclick="Teacher.editStudent('${eSid}')">✏️</button><button class="t-card-btn t-card-del" onclick="Teacher.removeStudent('${eSid}','${eName}')">✕</button>`;
            }

            card.innerHTML = `
                <div class="teacher-dot ${dotColor}"></div>
                <div class="teacher-card-info">
                    <div class="teacher-card-name">${eName} ${genderBadge} ${unregBadge}</div>
                    <div class="teacher-card-meta">${eSid}${s.className ? ' · ' + esc(s.className) : ''}</div>
                    ${nickHtml}
                </div>
                <div class="teacher-card-time">${timeStr}</div>
                <div class="t-card-actions">${actionBtns}</div>
            `;
            grid.appendChild(card);
        });
    },

    async refresh() {
        await Promise.all([this.loadStudents(), this.loadGameState()]);
        this._renderClassBar();
        this._populateGameClassSelect();
        this.render();
    },

    // ── roster 관리 ──
    toggleRosterForm() {
        const fields = document.getElementById('t-roster-fields');
        const arrow = document.getElementById('t-roster-arrow');
        if (!fields) return;
        fields.classList.toggle('hidden');
        if (arrow) arrow.textContent = fields.classList.contains('hidden') ? '▸' : '▾';
    },

    async addStudent() {
        const sid = document.getElementById('t-add-sid')?.value.trim();
        const name = document.getElementById('t-add-name')?.value.trim();
        const cls = document.getElementById('t-add-class')?.value.trim() || '';
        const msg = document.getElementById('t-add-msg');
        if (!sid || !name) {
            if (msg) { msg.textContent = '학번과 이름을 입력하세요!'; msg.className = 't-add-msg error'; }
            return;
        }
        // 중복 확인
        if (this.students.find(s => s.studentId === sid && !s.unregistered)) {
            if (msg) { msg.textContent = '이미 등록된 학번입니다!'; msg.className = 't-add-msg error'; }
            return;
        }
        const ok = await DB.addToRoster(sid, name, cls);
        if (ok) {
            if (msg) { msg.textContent = `${name} 등록 완료!`; msg.className = 't-add-msg success'; }
            document.getElementById('t-add-sid').value = '';
            document.getElementById('t-add-name').value = '';
            document.getElementById('t-add-class').value = '';
            await this.refresh();
        } else {
            if (msg) { msg.textContent = '등록 실패 (중복 학번?)'; msg.className = 't-add-msg error'; }
        }
    },

    async removeStudent(sid, name) {
        if (!confirm(`"${name}" (${sid})을(를) roster에서 삭제하시겠습니까?`)) return;
        const ok = await DB.removeFromRoster(sid);
        if (ok) await this.refresh();
        else alert('삭제 실패!');
    },

    editStudent(sid) {
        this._editingId = sid;
        this.render();
    },

    cancelEdit() {
        this._editingId = null;
        this.render();
    },

    async saveEdit(origSid) {
        const sid = document.getElementById(`te-sid-${origSid}`)?.value.trim();
        const name = document.getElementById(`te-name-${origSid}`)?.value.trim();
        const cls = document.getElementById(`te-class-${origSid}`)?.value.trim() || '';
        const nick = document.getElementById(`te-nick-${origSid}`)?.value.trim() || '';
        const gender = document.getElementById(`te-gender-${origSid}`)?.value || '';

        if (!sid || !name) { alert('학번과 이름은 필수입니다!'); return; }

        const student = this.students.find(s => s.studentId === origSid);
        const isUnreg = student?.unregistered;

        let ok;
        if (isUnreg) {
            // 미등록 → roster에 새로 등록
            ok = await DB.addToRoster(sid, name, cls);
            if (ok && gender) await DB.updateRoster(sid, { gender });
            // users 테이블 닉네임/이름 업데이트
            const updates = { student_name: name };
            if (nick) updates.nickname = nick;
            await DB.updateUser(origSid, sid !== origSid ? { ...updates, student_id: sid } : updates);
        } else if (sid !== origSid) {
            // 학번이 변경된 경우: 기존 삭제 → 새로 추가
            await DB.removeFromRoster(origSid);
            ok = await DB.addToRoster(sid, name, cls);
            if (ok && gender) await DB.updateRoster(sid, { gender });
            const updates = { student_id: sid, student_name: name };
            if (nick) updates.nickname = nick;
            await DB.updateUser(origSid, updates);
        } else {
            ok = await DB.updateRoster(sid, { student_name: name, class_name: cls, gender });
            const updates = { student_name: name };
            if (nick) updates.nickname = nick;
            await DB.updateUser(sid, updates);
        }

        this._editingId = null;
        if (ok) await this.refresh();
        else { alert('수정 실패!'); this.render(); }
    },

    async registerStudent(sid, name) {
        // 미등록 학생 → 인라인 편집 모드로 바로 전환
        this._editingId = sid;
        this.render();
    },

    // ── 교사 메인 탭 전환 ──
    switchMainTab(btn, tab) {
        this._mainTab = tab;
        document.querySelectorAll('.teacher-main-tab').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const tabs = ['teacher-students-tab', 'teacher-market-tab', 'teacher-attendance-tab', 'teacher-chatmod-tab', 'teacher-perf-tab'];
        tabs.forEach(id => document.getElementById(id)?.classList.add('hidden'));
        clearInterval(this._perfInterval);
        if (tab === 'students') {
            document.getElementById('teacher-students-tab').classList.remove('hidden');
        } else if (tab === 'market') {
            document.getElementById('teacher-market-tab').classList.remove('hidden');
            this.loadMarketItems();
        } else if (tab === 'attendance') {
            document.getElementById('teacher-attendance-tab').classList.remove('hidden');
            this._initAttendance();
        } else if (tab === 'chatmod') {
            document.getElementById('teacher-chatmod-tab').classList.remove('hidden');
            this._initChatMod();
        } else if (tab === 'perf') {
            document.getElementById('teacher-perf-tab').classList.remove('hidden');
            this._initPerfTab();
        }
    },

    // ── 성능 모니터링 탭 ──
    _perfInterval: null,
    _initPerfTab() {
        this._renderPerfGraphs();
        this._perfInterval = setInterval(() => this._renderPerfGraphs(), 1000);
    },
    _renderPerfGraphs() {
        // status
        const st = document.getElementById('perf-status');
        if (st) {
            st.textContent = PerfMonitor.enabled
                ? `🟢 모니터링 중 (FPS: ${PerfMonitor._snap.fps})`
                : '⏸ 대기실 미진입';
            st.style.color = PerfMonitor.enabled ? '#00B894' : 'rgba(255,255,255,.4)';
        }

        // FPS graph
        PerfMonitor.drawGraph(document.getElementById('perf-fps-graph'), [
            { data: PerfMonitor.fps, color: '#00B894', label: 'FPS' },
        ], { title: 'FPS (프레임/초)', baseline: 60 });

        // Frame time graph (update + render breakdown)
        PerfMonitor.drawGraph(document.getElementById('perf-time-graph'), [
            { data: PerfMonitor.frameTime, color: '#FDCB6E', label: '전체' },
            { data: PerfMonitor.updateTime, color: '#6C5CE7', label: 'Update' },
            { data: PerfMonitor.renderTime, color: '#FD79A8', label: 'Render' },
        ], { title: '프레임 시간 (ms)', baseline: 16.6 });

        // Network graph
        PerfMonitor.drawGraph(document.getElementById('perf-net-graph'), [
            { data: PerfMonitor.msgSentPerSec, color: '#0984E3', label: '송신 msg/s' },
            { data: PerfMonitor.msgRecvPerSec, color: '#00CEC9', label: '수신 msg/s' },
        ], { title: '네트워크 메시지' });

        // Error log
        this._renderPerfErrors();
    },
    _renderPerfErrors() {
        const el = document.getElementById('perf-error-log');
        if (!el) return;
        const errs = PerfMonitor.errors;
        if (!errs.length) { el.innerHTML = '<span style="color:rgba(255,255,255,.25)">에러 없음</span>'; return; }
        el.innerHTML = errs.slice(-50).reverse().map(e =>
            `<div class="perf-error-entry"><span class="perf-error-time">${e.ts}</span>${e.msg}</div>`
        ).join('');
    },
    _perfClearErrors() {
        PerfMonitor.errors.length = 0;
        this._renderPerfErrors();
    },

};

// ── 채팅 모더레이션 탭 ──
const TeacherChatMod = {
    _initChatMod() {
        const dateEl = document.getElementById('cm-date');
        if (dateEl && !dateEl.value) {
            dateEl.value = new Date().toISOString().slice(0, 10);
        }
        // 반 필터 드롭다운 채우기
        const sel = document.getElementById('cm-class-filter');
        if (sel && sel.options.length <= 1) {
            const classes = [...new Set(this.students.map(s => s.className).filter(c => c))].sort();
            classes.forEach(c => {
                const opt = document.createElement('option');
                opt.value = c; opt.textContent = c;
                sel.appendChild(opt);
            });
        }
        this.loadChatMod();
    },

    setChatModToday() {
        const dateEl = document.getElementById('cm-date');
        if (dateEl) dateEl.value = new Date().toISOString().slice(0, 10);
        this.loadChatMod();
    },

    async loadChatMod() {
        const date = document.getElementById('cm-date')?.value || '';
        const className = document.getElementById('cm-class-filter')?.value || '';
        const view = document.getElementById('cm-view')?.value || 'warnings';
        const grid = document.getElementById('cm-grid');
        if (!grid) return;

        grid.innerHTML = '<div class="teacher-empty">로딩 중...</div>';

        const opts = { date, className: className || undefined };

        // 통계 로드
        const [warnings, kicks, chatLogs] = await Promise.all([
            DB.getChatWarnings(opts),
            DB.getChatKicks(opts),
            DB.getChatLogs({ ...opts, limit: 500 }),
        ]);

        document.getElementById('cm-warn-count').textContent = warnings.length;
        document.getElementById('cm-kick-count').textContent = kicks.length;
        document.getElementById('cm-chat-count').textContent = chatLogs.length;

        let html = '';
        if (view === 'warnings') {
            if (!warnings.length) { grid.innerHTML = '<div class="teacher-empty">경고 기록 없음</div>'; return; }
            html = warnings.map(w => `<div class="cm-card cm-warning">
                <div class="cm-header"><span class="cm-badge warn">경고 ${esc(String(w.warning_num))}</span>
                <span class="cm-name">${esc(w.student_name || '')} (${esc(w.student_id)})</span>
                <span class="cm-class">${esc(w.class_name || '')}</span>
                <span class="cm-time">${new Date(w.created_at).toLocaleTimeString('ko-KR')}</span></div>
                <div class="cm-msg">${esc(w.message)}</div>
            </div>`).join('');
        } else if (view === 'kicks') {
            if (!kicks.length) { grid.innerHTML = '<div class="teacher-empty">퇴장 기록 없음</div>'; return; }
            html = kicks.map(k => `<div class="cm-card cm-kick">
                <div class="cm-header"><span class="cm-badge kick">퇴장</span>
                <span class="cm-name">${esc(k.student_name || '')} (${esc(k.student_id)})</span>
                <span class="cm-class">${esc(k.class_name || '')}</span>
                <span class="cm-time">${new Date(k.created_at).toLocaleTimeString('ko-KR')}</span></div>
                <div class="cm-reason">${esc(k.reason)}</div>
                <div class="cm-msg">마지막 메시지: ${esc(k.last_message || '')}</div>
            </div>`).join('');
        } else if (view === 'blocked') {
            const blocked = chatLogs.filter(c => c.is_blocked);
            if (!blocked.length) { grid.innerHTML = '<div class="teacher-empty">차단된 메시지 없음</div>'; return; }
            html = blocked.map(c => `<div class="cm-card cm-blocked">
                <div class="cm-header"><span class="cm-badge blocked">차단</span>
                <span class="cm-name">${esc(c.student_name || '')} (${esc(c.student_id)})</span>
                <span class="cm-class">${esc(c.class_name || '')}</span>
                <span class="cm-time">${new Date(c.created_at).toLocaleTimeString('ko-KR')}</span></div>
                <div class="cm-msg">${esc(c.message)}</div>
            </div>`).join('');
        } else {
            // all
            if (!chatLogs.length) { grid.innerHTML = '<div class="teacher-empty">채팅 기록 없음</div>'; return; }
            html = chatLogs.map(c => `<div class="cm-card ${c.is_blocked ? 'cm-blocked' : ''}">
                <div class="cm-header">${c.is_blocked ? '<span class="cm-badge blocked">차단</span>' : ''}
                <span class="cm-name">${esc(c.student_name || '')} (${esc(c.student_id)})</span>
                <span class="cm-class">${esc(c.class_name || '')}</span>
                <span class="cm-time">${new Date(c.created_at).toLocaleTimeString('ko-KR')}</span></div>
                <div class="cm-msg">${esc(c.message)}</div>
            </div>`).join('');
        }
        grid.innerHTML = html;
    },
};

Object.assign(Teacher, TeacherAttendance, TeacherMarket, TeacherChatMod);

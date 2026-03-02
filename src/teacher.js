import { supabase } from './supabase.js';
import { DB } from './db.js';
import { GRID } from './constants.js';
import { esc } from './sanitize.js';

// Forward references
let Marketplace = null;
export function setTeacherMarketplace(m) { Marketplace = m; }
let WaitingRoom = null;
export function setTeacherWaitingRoom(wr) { WaitingRoom = wr; }

const ONLINE_THRESHOLD_MS = 30 * 1000; // 30초 (하트비트 10초 간격 기준)

export const Teacher = {
    students: [],
    gameIsOpen: false,
    _pollId: null,
    _mainTab: 'students',
    _classFilter: '',   // '' = 전체, '6반', '7반' 등
    _attendance: {},     // { studentId: { status, markedAt } }

    async init() {
        await Promise.all([this.loadStudents(), this.loadGameState(), this._loadTodayAttendance()]);
        this._renderClassBar();
        this._populateGameClassSelect();
        this.render();
        clearInterval(this._pollId);
        this._pollId = setInterval(() => this.refresh(), 10000); // 10초마다 갱신
    },

    stop() {
        clearInterval(this._pollId);
        this._pollId = null;
        this.stopRosterPoll();
    },

    _editingId: null,  // 현재 인라인 편집 중인 studentId

    // ── 학생 데이터 로드 ──
    async loadStudents() {
        const today = new Date().toISOString().split('T')[0];
        const now = new Date();

        const [rosterRes, usersRes, checkinsRes] = await Promise.all([
            supabase.from('roster').select('*').order('student_id'),
            supabase.from('users').select('student_id, student_name, nickname, last_active'),
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
            const isOnline = u?.last_active && (now - new Date(u.last_active)) < ONLINE_THRESHOLD_MS;
            const isChecked = checkedSet.has(r.student_id);
            return {
                studentId: r.student_id,
                studentName: r.student_name,
                className: r.class_name || '',
                gender: r.gender || '',
                nickname: u?.nickname || null,
                lastActive: u?.last_active ? new Date(u.last_active) : null,
                online: isOnline,
                checked: isChecked,
                unregistered: false
            };
        });

        // 미등록 학생: users에는 있지만 roster에 없는 사람 (교사/테스트 제외)
        users.forEach(u => {
            if (rosterIds.has(u.student_id)) return;
            if (u.student_id === TEACHER_ID || u.student_id === TEST_ID) return;
            const isOnline = u.last_active && (now - new Date(u.last_active)) < ONLINE_THRESHOLD_MS;
            const isChecked = checkedSet.has(u.student_id);
            this.students.push({
                studentId: u.student_id,
                studentName: u.student_name || u.nickname || '이름없음',
                className: '',
                gender: '',
                nickname: u.nickname || null,
                lastActive: u.last_active ? new Date(u.last_active) : null,
                online: isOnline,
                checked: isChecked,
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
        // 최초 로드: 이전에 열려있던 세션 모두 닫기 (브라우저 닫힘/로그아웃 등으로 잔류된 세션 정리)
        const { data } = await supabase.from('game_sessions').select('id, is_open').eq('is_open', true);
        const staleIds = (data || []).map(r => r.id);
        if (staleIds.length > 0) {
            await Promise.all(staleIds.map(id =>
                supabase.from('game_sessions').update({
                    is_open: false, game_started: false, phase: 'waiting',
                    vote_data: null, selected_game: null,
                    closed_at: new Date().toISOString(), updated_at: new Date().toISOString()
                }).eq('id', id)
            ));
        }
        this._openClasses = [];
        this.gameIsOpen = false;
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

        const { error } = await supabase.from('game_sessions').upsert({
            id: sessionId,
            is_open: newState,
            teacher_id: DB.userId,
            ...(newState ? { opened_at: new Date().toISOString() } : { closed_at: new Date().toISOString() }),
            updated_at: new Date().toISOString()
        }, { onConflict: 'id' });

        if (error) {
            console.error('toggleGame upsert error:', error);
        }
        // UI는 에러와 무관하게 반영 (로컬 상태 우선)
        if (newState) {
            if (!this._openClasses.includes(className)) this._openClasses.push(className);
        } else {
            this._openClasses = this._openClasses.filter(c => c !== className);
        }
        this.gameIsOpen = this._openClasses.length > 0;
        this.updateToggle();
        if (btn) btn.style.pointerEvents = '';
        // 출석부 실시간 폴링
        if (this._openClasses.length > 0) {
            this.startRosterPoll();
        } else {
            this.stopRosterPoll();
            // 모든 반이 닫히면 대기실도 정리
            if (WaitingRoom && WaitingRoom.running) WaitingRoom.stop();
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
        // WaitingRoom god mode 시작
        if (WaitingRoom) WaitingRoom.startGodMode();
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
        if (statusFilter === 'online') filtered = filtered.filter(s => s.online);
        else if (statusFilter === 'checked') filtered = filtered.filter(s => s.checked);
        else if (statusFilter === 'offline') filtered = filtered.filter(s => !s.online && !s.checked);
        if (search) filtered = filtered.filter(s =>
            s.studentName.includes(search) || s.studentId.includes(search) || (s.nickname && s.nickname.toLowerCase().includes(search))
        );

        // 통계 (반 필터 기준)
        const classStudents = this._classFilter
            ? this.students.filter(s => s.className === this._classFilter)
            : this.students;
        const total = classStudents.length;
        const online = classStudents.filter(s => s.online).length;
        const checked = classStudents.filter(s => s.checked).length;
        const el = id => document.getElementById(id);
        if (el('t-total')) el('t-total').textContent = total;
        if (el('t-online')) el('t-online').textContent = online;
        if (el('t-checked')) el('t-checked').textContent = checked;
        if (el('t-absent')) el('t-absent').textContent = total - checked;

        // 정렬: 접속 > 출석 > 미접속
        filtered.sort((a, b) => {
            const score = s => (s.online ? 2 : 0) + (s.checked ? 1 : 0);
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
            const status = s.online ? 'online' : s.checked ? 'checked' : 'offline';

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
            card.className = `teacher-card ${status}${s.unregistered ? ' unregistered' : ''}`;

            const dotColor = s.online ? 'green' : s.checked ? 'yellow' : 'gray';
            const timeStr = s.lastActive ? this._timeAgo(s.lastActive) : '미접속';
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

    _timeAgo(date) {
        const diff = Date.now() - date.getTime();
        if (diff < 60000) return '방금 전';
        if (diff < 3600000) return Math.floor(diff / 60000) + '분 전';
        if (diff < 86400000) return Math.floor(diff / 3600000) + '시간 전';
        return Math.floor(diff / 86400000) + '일 전';
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
        const tabs = ['teacher-students-tab', 'teacher-market-tab', 'teacher-attendance-tab'];
        tabs.forEach(id => document.getElementById(id)?.classList.add('hidden'));
        if (tab === 'students') {
            document.getElementById('teacher-students-tab').classList.remove('hidden');
        } else if (tab === 'market') {
            document.getElementById('teacher-market-tab').classList.remove('hidden');
            this.loadMarketItems();
        } else if (tab === 'attendance') {
            document.getElementById('teacher-attendance-tab').classList.remove('hidden');
            this._initAttendance();
        }
    },

    // ── 판매 요청 로드 + 렌더 ──
    async loadMarketItems() {
        if (!Marketplace) return;
        await Marketplace.loadPending();
        this.renderMarketItems();
    },

    renderMarketItems() {
        if (!Marketplace) return;
        const grid = document.getElementById('teacher-market-grid');
        const count = document.getElementById('t-market-count');
        const items = Marketplace.submissions;
        if (count) count.textContent = `${items.length}건 대기 중`;
        if (!grid) return;

        if (!items.length) {
            grid.innerHTML = '<div class="teacher-empty">대기 중인 판매 요청이 없습니다</div>';
            return;
        }

        grid.innerHTML = '';
        items.forEach(s => {
            const card = document.createElement('div');
            card.className = 'tmr-card';

            let previewHtml;
            if (s.pixel_data) {
                previewHtml = `<div class="tmr-preview tmr-preview-pixel"><canvas class="tmr-pixel-cvs" data-pixels='${JSON.stringify(s.pixel_data)}' width="128" height="128"></canvas></div>`;
            } else {
                previewHtml = `<div class="tmr-preview"><span class="tmr-emoji">${s.icon || '🎨'}</span></div>`;
            }

            const typeLabel = { hat: '모자', pet: '펫', character: '캐릭터', effect: '효과', title: '칭호', skin: '스킨' }[s.item_type] || s.item_type;
            const titleInfo = s.title_text ? ` · "${s.title_text}"` : '';

            card.innerHTML = `
                ${previewHtml}
                <div class="tmr-info">
                    <div class="tmr-name">${s.name}</div>
                    <div class="tmr-meta">${typeLabel}${titleInfo} · by ${s.creator_name}</div>
                    <div class="tmr-desc">${s.description || '(설명 없음)'}</div>
                    <div class="tmr-price-row">
                        <span class="tmr-proposed">희망가: 🪙${s.proposed_price}</span>
                        <span class="tmr-final-label">최종가:</span>
                        <input type="number" class="tmr-price-input" value="${s.proposed_price}" min="1" max="9999" data-id="${s.id}">
                    </div>
                    <div class="tmr-actions">
                        <button class="tmr-approve" onclick="Teacher.approveItem(${s.id}, this)">✅ 승인</button>
                        <button class="tmr-reject" onclick="Teacher.rejectItem(${s.id})">❌ 거절</button>
                    </div>
                </div>
            `;
            grid.appendChild(card);

            // Render pixel preview (128x128 원본 크기)
            const cvs = card.querySelector('.tmr-pixel-cvs');
            if (cvs) {
                const pd = JSON.parse(cvs.dataset.pixels);
                const ctx = cvs.getContext('2d'), sz = 128, sc = sz / GRID;
                for (let y = 0; y < GRID; y++) for (let x = 0; x < GRID; x++) {
                    if (pd[y] && pd[y][x]) { ctx.fillStyle = pd[y][x]; ctx.fillRect(Math.floor(x * sc), Math.floor(y * sc), Math.ceil(sc), Math.ceil(sc)); }
                }
            }
        });
    },

    async approveItem(dbId, btn) {
        if (!Marketplace) return;
        const input = document.querySelector(`.tmr-price-input[data-id="${dbId}"]`);
        const finalPrice = parseInt(input?.value) || 0;
        if (finalPrice < 1) { alert('최종 가격은 1코인 이상이어야 합니다.'); return; }
        if (btn) btn.disabled = true;
        const ok = await Marketplace.approve(dbId, finalPrice);
        if (ok) {
            alert('승인 완료!');
            this.loadMarketItems();
        }
        if (btn) btn.disabled = false;
    },

    async rejectItem(dbId) {
        if (!Marketplace) return;
        const reason = prompt('거절 사유를 입력하세요:');
        if (reason === null) return;
        const ok = await Marketplace.reject(dbId, reason || '사유 없음');
        if (ok) {
            alert('거절 처리 완료');
            this.loadMarketItems();
        }
    },

    // ══════════════════════════════════════════
    // ── 출석부 체크 (게임 시작 전) ────────────
    // ══════════════════════════════════════════

    // 헬퍼: 학생 출결 상태 ('present'|'late'|'early'|'absent'|'')
    _getStatus(sid) {
        const a = this._attendance[sid];
        return a ? a.status : '';
    },

    // 열린 반의 학생 목록
    _getRosterStudents() {
        return this.students.filter(s =>
            s.className && this._openClasses.includes(s.className)
        );
    },

    // 참여 인원 수 (출석 + 지각)
    getParticipantCount() {
        const classStudents = this._getRosterStudents();
        return classStudents.filter(s => {
            const st = this._getStatus(s.studentId);
            return st === 'present' || st === 'late';
        }).length;
    },

    renderRosterCheck() {
        const grid = document.getElementById('trc-grid');
        if (!grid) return;
        const classStudents = this._getRosterStudents();

        // 통계
        let cnt = { present: 0, late: 0, early: 0, absent: 0 };
        classStudents.forEach(s => {
            const st = this._getStatus(s.studentId);
            if (st) cnt[st]++;
        });
        const el = id => document.getElementById(id);
        if (el('trc-present')) el('trc-present').textContent = cnt.present;
        if (el('trc-late')) el('trc-late').textContent = cnt.late;
        if (el('trc-early')) el('trc-early').textContent = cnt.early;
        if (el('trc-absent')) el('trc-absent').textContent = cnt.absent;

        // 정렬: 출석(시간순) → 지각 → 조퇴 → 결석 → 미체크
        const order = { present: 0, late: 1, early: 2, absent: 3 };
        const sorted = [...classStudents].sort((a, b) => {
            const sa = this._getStatus(a.studentId);
            const sb = this._getStatus(b.studentId);
            const oa = sa ? order[sa] : 9;
            const ob = sb ? order[sb] : 9;
            if (oa !== ob) return oa - ob;
            // 같은 상태 내에서 시간순
            const ta = this._attendance[a.studentId]?.markedAt || '';
            const tb = this._attendance[b.studentId]?.markedAt || '';
            if (ta && tb) return new Date(ta) - new Date(tb);
            return a.studentId.localeCompare(b.studentId);
        });

        grid.innerHTML = '';
        sorted.forEach(s => {
            const att = this._attendance[s.studentId];
            const st = att?.status || '';
            const markedAt = att?.markedAt;
            const card = document.createElement('div');
            card.className = `trc-card ${st}`;

            // 도트 색상
            const dotColor = st === 'present' ? 'green' : st === 'late' ? 'yellow' : st === 'early' ? 'purple' : st === 'absent' ? 'red' : 'gray';

            // 타임스탬프
            const timeStr = markedAt
                ? new Date(markedAt).toLocaleString('ko-KR', { year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit', second:'2-digit' })
                : '';

            card.innerHTML = `
                <div class="trc-dot ${dotColor}"></div>
                <div class="trc-info">
                    <div class="trc-name-row">
                        <span class="trc-name">${s.studentName}</span>
                        <span class="trc-id">${s.studentId}</span>
                    </div>
                    ${timeStr ? `<span class="trc-time">${timeStr}</span>` : ''}
                </div>
                <div class="trc-btns">
                    <button class="trc-btn trc-late${st === 'late' ? ' active' : ''}" onclick="Teacher.setAttendance('${s.studentId}','late')">지각</button>
                    <button class="trc-btn trc-early${st === 'early' ? ' active' : ''}" onclick="Teacher.setAttendance('${s.studentId}','early')">조퇴</button>
                    <button class="trc-btn trc-absent-mark${st === 'absent' ? ' active' : ''}" onclick="Teacher.setAttendance('${s.studentId}','absent')">결석</button>
                </div>
            `;
            grid.appendChild(card);
        });
    },

    setAttendance(sid, status) {
        this._attendance[sid] = { status, markedAt: new Date().toISOString() };
        const student = this.students.find(s => s.studentId === sid);
        DB.saveTeacherAttendance(sid, student?.className || '', status);
        this.renderRosterCheck();
    },

    rosterAbsentAll() {
        const now = new Date().toISOString();
        this._getRosterStudents().forEach(s => {
            if (this._getStatus(s.studentId) !== 'present') {
                this._attendance[s.studentId] = { status: 'absent', markedAt: now };
                DB.saveTeacherAttendance(s.studentId, s.className, 'absent');
            }
        });
        this.renderRosterCheck();
    },

    // 오늘자 교사 출결 기록 로드
    async _loadTodayAttendance() {
        const today = new Date().toISOString().split('T')[0];
        const records = await DB.loadTeacherAttendance(today);
        records.forEach(r => {
            this._attendance[r.student_id] = { status: r.status, markedAt: r.marked_at };
        });
    },

    // 실시간 출석부 폴링 (학생 입장 시 자동 반영)
    _rosterPollId: null,
    startRosterPoll() {
        this.stopRosterPoll();
        this._rosterPollId = setInterval(async () => {
            await this._loadTodayAttendance();
            if (this._openClasses.length > 0) this.renderRosterCheck();
        }, 5000);
    },
    stopRosterPoll() {
        clearInterval(this._rosterPollId);
        this._rosterPollId = null;
    },

    // ══════════════════════════════════════════
    // ── 출결 기록 탭 ─────────────────────────
    // ══════════════════════════════════════════
    _attendanceLogs: [],

    // 수업 시간표: 반 → 수업 요일 (0=일, 1=월, 2=화, 3=수, 4=목, 5=금, 6=토)
    CLASS_SCHEDULE: {
        '2-6':  [3, 4, 5],  // 수, 목, 금
        '2-7':  [1, 2, 3],  // 월, 화, 수
        '2-8':  [1, 2, 3],  // 월, 화, 수
        '2-9':  [2, 3, 4],  // 화, 수, 목
        '2-10': [1, 4, 5],  // 월, 목, 금
        '3-1':  [1, 4],     // 월, 목
        '3-2':  [2, 5],     // 화, 금
    },

    // 해당 반의 수업일인지 체크
    _isClassDay(className, date) {
        const days = this.CLASS_SCHEDULE[className];
        if (!days) return true; // 시간표 없으면 모든 날 표시
        return days.includes(date.getDay());
    },

    // 특정 방향으로 가장 가까운 수업일 찾기
    _findNextClassDay(className, date, delta) {
        const d = new Date(date);
        for (let i = 0; i < 14; i++) {
            d.setDate(d.getDate() + delta);
            if (this._isClassDay(className, d)) return d;
        }
        return d; // 14일 내 못 찾으면 그냥 반환
    },

    _initAttendance() {
        const dateInput = document.getElementById('ta-date');
        if (dateInput && !dateInput.value) {
            dateInput.value = new Date().toISOString().split('T')[0];
        }
        // 반 필터 드롭다운 채우기
        const sel = document.getElementById('ta-class-filter');
        if (sel && sel.options.length <= 1) {
            const classes = [...new Set(this.students.map(s => s.className))].filter(c => c && c.trim());
            classes.sort((a, b) => {
                const pa = a.split(/[-\s]/).map(Number), pb = b.split(/[-\s]/).map(Number);
                for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
                    const va = pa[i] || 0, vb = pb[i] || 0;
                    if (va !== vb) return va - vb;
                }
                return a.localeCompare(b);
            });
            classes.forEach(c => {
                const opt = document.createElement('option');
                opt.value = c;
                opt.textContent = c;
                sel.appendChild(opt);
            });
        }
        this._snapToClassDay();
        this.loadAttendance();
    },

    // 반 선택 변경 시 가장 가까운 수업일로 이동
    onAttendanceClassChange() {
        this._snapToClassDay();
        this.loadAttendance();
    },

    _snapToClassDay() {
        const cls = document.getElementById('ta-class-filter')?.value;
        if (!cls) return; // 전체 선택이면 이동 불필요
        const dateInput = document.getElementById('ta-date');
        if (!dateInput?.value) return;
        const d = new Date(dateInput.value);
        if (this._isClassDay(cls, d)) return; // 이미 수업일
        // 오늘 이전의 가장 가까운 수업일로 이동
        const prev = this._findNextClassDay(cls, d, -1);
        dateInput.value = prev.toISOString().split('T')[0];
    },

    setToday() {
        const dateInput = document.getElementById('ta-date');
        if (dateInput) dateInput.value = new Date().toISOString().split('T')[0];
        this._snapToClassDay();
        this.loadAttendance();
    },

    shiftDate(delta) {
        const dateInput = document.getElementById('ta-date');
        if (!dateInput || !dateInput.value) return;
        const cls = document.getElementById('ta-class-filter')?.value;
        const d = new Date(dateInput.value);
        if (cls && this.CLASS_SCHEDULE[cls]) {
            // 수업일만 건너뛰기
            const next = this._findNextClassDay(cls, d, delta > 0 ? 1 : -1);
            dateInput.value = next.toISOString().split('T')[0];
        } else {
            d.setDate(d.getDate() + delta);
            dateInput.value = d.toISOString().split('T')[0];
        }
        this.loadAttendance();
    },

    _teacherAttendanceRecords: [],

    async loadAttendance() {
        const dateInput = document.getElementById('ta-date');
        if (!dateInput || !dateInput.value) return;
        const [logs, taRecords] = await Promise.all([
            DB.getLoginLogs(dateInput.value),
            DB.loadTeacherAttendance(dateInput.value)
        ]);
        this._attendanceLogs = logs;
        this._teacherAttendanceRecords = taRecords;
        this.renderAttendance();
    },

    renderAttendance() {
        const classFilter = document.getElementById('ta-class-filter')?.value || '';
        const logs = this._attendanceLogs;
        const taRecords = this._teacherAttendanceRecords || [];

        // roster 기준 학생 목록 (반 필터 적용)
        let rosterStudents = this.students;
        if (classFilter) rosterStudents = rosterStudents.filter(s => s.className === classFilter);

        // 학생별 첫 접속 시각 매핑
        const loginMap = {};
        logs.forEach(l => {
            if (!loginMap[l.student_id]) loginMap[l.student_id] = l.logged_in_at;
        });

        // 교사 출결 마킹 매핑
        const taMap = {};
        taRecords.forEach(r => { taMap[r.student_id] = r; });

        // 통계
        const total = rosterStudents.length;
        const present = rosterStudents.filter(s => loginMap[s.studentId]).length;
        const taPresent = rosterStudents.filter(s => { const t = taMap[s.studentId]; return t && (t.status === 'present' || t.status === 'late'); }).length;
        const taAbsent = rosterStudents.filter(s => { const t = taMap[s.studentId]; return t && t.status === 'absent'; }).length;
        const taEarly = rosterStudents.filter(s => taMap[s.studentId]?.status === 'early').length;
        const taLate = rosterStudents.filter(s => taMap[s.studentId]?.status === 'late').length;
        const el = id => document.getElementById(id);
        if (el('ta-total')) el('ta-total').textContent = total;
        if (el('ta-present')) el('ta-present').textContent = present;
        if (el('ta-absent')) el('ta-absent').textContent = total - present;

        // 정렬: 접속한 학생(시간순) → 미접속 학생(학번순)
        const sorted = [...rosterStudents].sort((a, b) => {
            const aLog = loginMap[a.studentId];
            const bLog = loginMap[b.studentId];
            if (aLog && !bLog) return -1;
            if (!aLog && bLog) return 1;
            if (aLog && bLog) return new Date(aLog) - new Date(bLog);
            return a.studentId.localeCompare(b.studentId);
        });

        const grid = document.getElementById('ta-grid');
        if (!grid) return;

        if (!sorted.length) {
            grid.innerHTML = '<div class="teacher-empty">표시할 학생이 없습니다</div>';
            return;
        }

        const statusLabel = { present: '출석', late: '지각', early: '조퇴', absent: '결석' };
        const statusColor = { present: '#00b894', late: '#fdcb6e', early: '#a29bfe', absent: '#ff7675' };

        grid.innerHTML = '';
        sorted.forEach(s => {
            const logTime = loginMap[s.studentId];
            const ta = taMap[s.studentId];
            const card = document.createElement('div');
            card.className = `teacher-card ${logTime ? 'online' : 'offline'}`;

            const dotColor = logTime ? 'green' : 'gray';
            const timeStr = logTime
                ? new Date(logTime).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
                : '미접속';

            const taBadge = ta
                ? `<span style="font-size:.7rem;padding:.1rem .4rem;border-radius:4px;background:${statusColor[ta.status]}22;color:${statusColor[ta.status]};border:1px solid ${statusColor[ta.status]}44;margin-left:.3rem;">${statusLabel[ta.status]} ${new Date(ta.marked_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>`
                : '';

            card.innerHTML = `
                <div class="teacher-dot ${dotColor}"></div>
                <div class="teacher-card-info">
                    <div class="teacher-card-name">${s.studentName}${taBadge}</div>
                    <div class="teacher-card-meta">${s.studentId}${s.className ? ' · ' + s.className : ''}</div>
                </div>
                <div class="teacher-card-time">${timeStr}</div>
            `;
            grid.appendChild(card);
        });
    }
};

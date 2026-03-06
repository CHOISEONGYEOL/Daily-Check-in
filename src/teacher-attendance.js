import { supabase } from './supabase.js';
import { DB } from './db.js';

export const TeacherAttendance = {
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

        // 실시간 대기실 접속자 수 (출석게임 입장한 학생만)
        const liveCount = classStudents.filter(s => this._wrOnline.has(s.studentId)).length;

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
        // 실시간 접속자 수 표시
        let liveEl = document.getElementById('trc-live');
        if (!liveEl) {
            const statsEl = document.querySelector('.trc-stats');
            if (statsEl) {
                const span = document.createElement('span');
                span.className = 'trc-stat trc-stat-live';
                span.innerHTML = '🟢 접속 <strong id="trc-live">0</strong>/<strong id="trc-total">0</strong>';
                statsEl.insertBefore(span, statsEl.firstChild);
                liveEl = document.getElementById('trc-live');
            }
        }
        if (liveEl) liveEl.textContent = liveCount;
        const totalEl = document.getElementById('trc-total');
        if (totalEl) totalEl.textContent = classStudents.length;

        // 정렬: 실시간 접속 > 출석(시간순) → 지각 → 조퇴 → 결석 → 미체크
        const order = { present: 0, late: 1, early: 2, absent: 3 };
        const sorted = [...classStudents].sort((a, b) => {
            // 실시간 대기실 접속자 우선
            const aLive = this._wrOnline.has(a.studentId) ? 0 : 1;
            const bLive = this._wrOnline.has(b.studentId) ? 0 : 1;
            if (aLive !== bLive) return aLive - bLive;
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
            const isLive = this._wrOnline.has(s.studentId);
            const card = document.createElement('div');
            card.className = `trc-card ${st}${isLive ? ' trc-live' : ''}`;

            // 도트 색상: 실시간 접속 = 초록(애니메이션), 출석 = 초록(정적), 지각 = 노랑, 조퇴 = 보라, 결석 = 빨강, 기타 = 회색
            const dotColor = isLive ? 'live' : st === 'present' ? 'green' : st === 'late' ? 'yellow' : st === 'early' ? 'purple' : st === 'absent' ? 'red' : 'gray';

            // 타임스탬프
            const timeStr = markedAt
                ? new Date(markedAt).toLocaleString('ko-KR', { year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit', second:'2-digit' })
                : '';

            // 접속 상태 뱃지
            const liveBadge = isLive ? '<span class="trc-live-badge">🟢 접속중</span>' : '';

            card.innerHTML = `
                <div class="trc-dot ${dotColor}"></div>
                <div class="trc-info">
                    <div class="trc-name-row">
                        <span class="trc-name">${s.studentName}</span>
                        <span class="trc-id">${s.studentId}</span>
                        ${liveBadge}
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

    // 실시간 출석부 폴링 + Presence 동기화
    _rosterPollId: null,
    startRosterPoll() {
        this.stopRosterPoll();
        this._rosterPollId = setInterval(async () => {
            await this._loadTodayAttendance();
            // 공유 채널이면 주기적으로 Presence 상태 읽기
            for (const [cls, entry] of this._rtChannels) {
                if (entry.shared && entry.channel) {
                    this._rtSyncFromChannel(cls, entry.channel);
                }
            }
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
    },
};

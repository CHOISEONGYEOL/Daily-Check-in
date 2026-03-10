import { Player } from './player.js';
import { CharRender } from './char-render.js';
import { DB } from './db.js';
import { AppPresence } from './app-presence.js';
import { isNicknameClean } from './chat-filter.js';

let Nav = null;
export function setNav(n) { Nav = n; }

export const ProfileSetup = {
    RENAME_ITEM_ID: 'r_rename',

    async submit() {
        const nick = document.getElementById('ps-nickname').value.trim();
        const sid = document.getElementById('ps-studentid').value.trim();
        const sname = document.getElementById('ps-name').value.trim();
        const err = document.getElementById('ps-error');
        if (!nick || !sid || !sname) {
            if (err) { err.textContent = '모든 항목을 입력해주세요!'; err.classList.remove('hidden'); }
            return;
        }

        // 닉네임 부적절 검사
        if (!isNicknameClean(nick)) {
            const nickErr = document.getElementById('ps-nick-error');
            if (nickErr) { nickErr.textContent = '⚠️ 부적절한 닉네임입니다! 욕설, 비속어, 실명(정치인 등)은 사용할 수 없습니다.'; nickErr.classList.remove('hidden'); }
            return;
        }

        // 로딩 표시
        const btn = document.getElementById('ps-submit-btn');
        if (btn) { btn.disabled = true; btn.textContent = '확인 중...'; }
        if (err) err.classList.add('hidden');
        const nickErr = document.getElementById('ps-nick-error');
        if (nickErr) nickErr.classList.add('hidden');

        try {
            // roster 검증: 학번이 등록되어 있으면 이름이 일치해야 함
            const roster = await DB.checkRoster(sid);
            if (roster && roster.student_name !== sname) {
                if (err) { err.textContent = '학번과 이름이 일치하지 않습니다! 정확히 입력해주세요.'; err.classList.remove('hidden'); }
                if (btn) { btn.disabled = false; btn.textContent = '시작하기'; }
                return;
            }

            // roster에서 반 정보 저장
            if (roster && roster.class_name) {
                Player.className = roster.class_name;
            }

            const result = await Player.login(sid, sname, nick);
            if (result.error === 'name_mismatch') {
                if (err) { err.textContent = '이름이 일치하지 않습니다.'; err.classList.remove('hidden'); }
                if (btn) { btn.disabled = false; btn.textContent = '시작하기'; }
                return;
            }
            if (result.error === 'nickname_mismatch') {
                if (err) { err.textContent = '닉네임이 일치하지 않습니다! (닉네임은 최초 설정 후 변경 불가)'; err.classList.remove('hidden'); }
                if (btn) { btn.disabled = false; btn.textContent = '시작하기'; }
                return;
            }
            if (result.error === 'nickname_taken') {
                const nickErr = document.getElementById('ps-nick-error');
                if (nickErr) { nickErr.textContent = '⚠️ 이미 사용 중인 닉네임입니다. 다른 닉네임을 입력해주세요.'; nickErr.classList.remove('hidden'); }
                if (btn) { btn.disabled = false; btn.textContent = '시작하기'; }
                return;
            }
            if (result.error === 'ip_conflict') {
                if (err) { err.textContent = '이 네트워크에서 다른 학생이 이미 접속 중입니다.'; err.classList.remove('hidden'); }
                if (btn) { btn.disabled = false; btn.textContent = '시작하기'; }
                return;
            }
            // 캐릭터가 없으면 기본 슬롯 생성
            if (!Player.characters.length) {
                Player.characters.push({ name: '캐릭터 1', pixels: null, equipped: {} });
                Player.maxSlots = 1;
                Player.activeCharIdx = 0;
                Player.save();
            }
            // 접속 로그 기록 (교사 제외)
            const TEACHER_ACCOUNT = '77777';
            if (sid !== TEACHER_ACCOUNT) {
                DB.recordLogin(sid, sname);
            }
            // 학생이면 앱 Presence 채널 입장 (교사 제외)
            if (sid !== TEACHER_ACCOUNT) AppPresence.join(Player.className);
            // 교사 계정이면 교사 대시보드로, 신규면 에디터로, 기존 유저면 로비로
            if (sid === TEACHER_ACCOUNT) {
                Nav.go('teacher');
            } else {
                Nav.go(result.isNew ? 'editor' : 'lobby');
            }
        } catch (e) {
            console.error('Login error:', e);
            if (err) { err.textContent = '서버 연결 실패! 다시 시도해주세요.'; err.classList.remove('hidden'); }
        } finally {
            if (btn) { btn.disabled = false; btn.textContent = '시작하기'; }
        }
    },

    // Profile edit screen init
    initEdit() {
        const nickEl = document.getElementById('pe-nickname');
        const sidEl = document.getElementById('pe-studentid');
        const nameEl = document.getElementById('pe-name');
        if(nickEl) nickEl.value = Player.nickname;
        if(sidEl) sidEl.value = Player.studentId;
        if(nameEl) nameEl.value = Player.studentName;
        const msg = document.getElementById('pe-profile-msg');
        if(msg) msg.classList.add('hidden');
        this.renderCharList();
    },

    saveProfile() {
        const nick = document.getElementById('pe-nickname').value.trim();
        const sid = document.getElementById('pe-studentid').value.trim();
        const sname = document.getElementById('pe-name').value.trim();
        const msg = document.getElementById('pe-profile-msg');
        if(!nick || !sid || !sname) {
            if(msg) { msg.textContent = '모든 항목을 입력해주세요!'; msg.className = 'pe-msg error'; }
            return;
        }
        if(!isNicknameClean(nick)) {
            if(msg) { msg.textContent = '⚠️ 부적절한 닉네임입니다! 욕설, 비속어, 실명(정치인 등)은 사용할 수 없습니다.'; msg.className = 'pe-msg error'; }
            return;
        }
        Player.nickname = nick;
        Player.studentId = sid;
        Player.studentName = sname;
        Player.save();
        Player.refreshUI();
        if(msg) { msg.textContent = '저장 완료!'; msg.className = 'pe-msg success'; }
        setTimeout(() => { if(msg) msg.classList.add('hidden'); }, 2000);
    },

    renderCharList() {
        const el = document.getElementById('pe-char-list');
        if(!el) return;
        el.innerHTML = '';
        const renameCount = Player.owned.filter(id => id === this.RENAME_ITEM_ID).length;
        Player.characters.forEach((ch, i) => {
            const row = document.createElement('div');
            row.className = 'pe-char-row';
            if(ch.pixels) {
                const cvs = CharRender.toTinyCanvas(ch.pixels, 36);
                row.appendChild(cvs);
            } else {
                const placeholder = document.createElement('div');
                placeholder.style.cssText = 'width:36px;height:36px;border-radius:6px;background:rgba(255,255,255,.05);display:flex;align-items:center;justify-content:center;color:rgba(255,255,255,.2);font-size:.9rem;';
                placeholder.textContent = '?';
                row.appendChild(placeholder);
            }
            const info = document.createElement('div');
            info.className = 'pe-char-info';
            info.innerHTML = `<div class="pe-char-name">${ch.name || `캐릭터 ${i+1}`}</div><div class="pe-char-idx">슬롯 ${i+1}</div>`;
            row.appendChild(info);
            const btn = document.createElement('button');
            btn.className = 'pe-rename-btn';
            if(renameCount > 0) {
                btn.textContent = `✏️ 이름 변경 (${renameCount}장)`;
                btn.onclick = () => this.renameChar(i);
            } else {
                btn.textContent = '🔒 변경권 필요';
                btn.disabled = true;
            }
            row.appendChild(btn);
            el.appendChild(row);
        });
    },

    renameChar(idx) {
        const ch = Player.characters[idx];
        if(!ch) return;
        const hasTicket = Player.owned.includes(this.RENAME_ITEM_ID);
        if(!hasTicket) { alert('이름변경권이 필요합니다! 상점에서 구매하세요.'); return; }
        const newName = prompt(`"${ch.name || `캐릭터 ${idx+1}`}" 의 새 이름을 입력하세요 (최대 12자):`, ch.name || '');
        if(!newName || !newName.trim()) return;
        const trimmed = newName.trim().slice(0, 12);
        if(trimmed === ch.name) return;
        if(!isNicknameClean(trimmed)) {
            alert('⚠️ 부적절한 이름입니다! 욕설, 비속어, 실명(정치인 등)은 사용할 수 없습니다.');
            return;
        }
        const ticketIdx = Player.owned.indexOf(this.RENAME_ITEM_ID);
        if(ticketIdx !== -1) Player.owned.splice(ticketIdx, 1);
        ch.name = trimmed;
        Player.save();
        alert(`이름이 "${trimmed}"(으)로 변경되었습니다!`);
        this.renderCharList();
    }
};

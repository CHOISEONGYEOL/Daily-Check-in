import { Player } from './player.js';
import { CharRender } from './char-render.js';
import { OTP } from './otp.js';
import { Editor } from './editor.js';
import { Shop } from './shop.js';
import { Inventory } from './inventory.js';
import { Auction } from './auction.js';
import { WaitingRoom } from './waiting-room.js';
import { ProfileSetup } from './profile.js';
import { DB } from './db.js';
import { esc } from './sanitize.js';
import { Teacher } from './teacher.js';
import { Marketplace } from './marketplace.js';
import { AppPresence } from './app-presence.js';

const TEST_ACCOUNT = '99999';
const TEACHER_ACCOUNT = '77777';

// ── 터치 기기 감지 → CSS 강제 가로 회전 활성화 ──
// 크롬북은 터치스크린이 있지만 키보드도 있으므로 모바일 컨트롤 불필요
// iPad(iPadOS 13+)는 UA가 "Macintosh"로 보고되지만 maxTouchPoints > 1
const _isCrOS = /CrOS/.test(navigator.userAgent);
const _hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
const _isIPad = !_isCrOS && navigator.maxTouchPoints > 1
    && /Macintosh|iPad/.test(navigator.userAgent);
// 세로/가로 어느 방향이든 짧은 변 기준으로 태블릿·폰 판별
const _smallScreen = Math.min(window.innerWidth, window.innerHeight) < 1024;
if ((_hasTouch && !_isCrOS && _smallScreen) || _isIPad) {
    document.body.classList.add('touch-device');
}

// ── 화면 회전 시 캔버스 리사이즈 트리거 (iPad 등 태블릿 대응) ──
window.addEventListener('orientationchange', () => {
    setTimeout(() => window.dispatchEvent(new Event('resize')), 100);
    setTimeout(() => window.dispatchEvent(new Event('resize')), 400);
});

// ── 세션 강제 종료 (다른 기기 로그인) ──
window.addEventListener('session-revoked', () => {
    DB.stopHeartbeat();
    const overlay = document.getElementById('session-kicked-overlay');
    if (overlay) overlay.classList.remove('hidden');
});

// ── 교사 강제 아이디 재설정 ──
window.addEventListener('force-relogin', () => {
    // 대기실 중이면 정지
    WaitingRoom.stop();
    AppPresence.leave();
    DB.stopHeartbeat();
    // 닉네임만 삭제 (학번·이름 유지)
    const keepSid = Player.studentId;
    const keepName = Player.studentName;
    Player.logout(); // 전체 초기화
    Player.studentId = keepSid;
    Player.studentName = keepName;
    localStorage.setItem('ck_studentId', keepSid);
    localStorage.setItem('ck_studentName', keepName);
    // 프로필 설정 화면으로 이동 + 학번·이름 미리 채우기
    Nav.go('profile-setup');
    const sidEl = document.getElementById('ps-studentid');
    const nameEl = document.getElementById('ps-name');
    const nickEl = document.getElementById('ps-nickname');
    if (sidEl) { sidEl.value = keepSid; sidEl.readOnly = true; }
    if (nameEl) { nameEl.value = keepName; nameEl.readOnly = true; }
    if (nickEl) nickEl.value = '';
    alert('교사에 의해 아이디가 초기화되었습니다.\n새 아이디(닉네임)를 만들어주세요.');
});

export const Nav = {
    logout() {
        AppPresence.leave(); // Presence 채널 해제
        DB.clearLoginState(); // IP 해제 (대리 출석 방지)
        Player.logout();
        DB.stopHeartbeat();
        this.go('profile-setup');
        // 입력 필드 초기화 + readOnly 해제
        ['ps-nickname','ps-studentid','ps-name'].forEach(id => {
            const el = document.getElementById(id);
            if (el) { el.value = ''; el.readOnly = false; }
        });
    },

    go(id) {
        // Redirect to profile setup if no profile
        if (id === 'lobby' && !Player.hasProfile()) { id = 'profile-setup'; }

        // ── 교사 계정: 로비 → 대시보드 ──
        if (id === 'lobby' && Player.studentId === TEACHER_ACCOUNT) { id = 'teacher'; }

        // ── 교사 계정은 대기실 진입 차단 ──
        if (id === 'waiting-room' && Player.studentId === TEACHER_ACCOUNT) {
            alert('교사 계정은 게임에 참여할 수 없습니다.\n대시보드에서 게임을 열어주세요!');
            return;
        }

        // ── 출석 게임 진입 게이트: 교사 세션 체크 ──
        if (id === 'waiting-room' && Player.studentId !== TEST_ACCOUNT) {
            this._checkSessionAndGo();
            return;
        }

        this._doGo(id);
    },

    async _checkSessionAndGo() {
        // Show loading state on the button
        const btn = document.querySelector('[onclick*="waiting-room"]');
        const origText = btn?.textContent;
        if (btn) { btn.textContent = '확인 중...'; btn.disabled = true; }

        try {
            const isOpen = await DB.isGameOpen(Player.className);
            if (isOpen) {
                Player.streak++;
                Player.save();
                this._doGo('waiting-room');
            } else {
                this._showGameClosed();
            }
        } catch (e) {
            // DB 오류 시 입장 허용 (동시접속 과부하로 차단 방지, 세션 체크는 WR 내부에서 재시도)
            console.warn('[Nav] session check failed, allowing entry:', e);
            Player.streak++;
            Player.save();
            this._doGo('waiting-room');
        } finally {
            if (btn) { btn.textContent = origText; btn.disabled = false; }
        }
    },

    _showGameClosed() {
        const overlay = document.getElementById('game-closed-overlay');
        if (overlay) {
            overlay.classList.remove('hidden');
            setTimeout(() => overlay.classList.add('hidden'), 4000);
        }
    },

    _doGo(id) {
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
        document.getElementById(id).classList.add('active');
        Player.refreshUI();
        if (id === 'lobby') {
            CharRender.toCanvasWithHat('lobby-preview', 128);
            this.renderCharSlots();
            const edBtn = document.getElementById('btn-editor');
            if (edBtn) edBtn.textContent = Player.pixels == null ? '🎨 캐릭터 만들기' : '✏️ 캐릭터 수정하기';
            this._pollGameBtn();
        }
        if (id !== 'lobby') clearInterval(this._gameBtnPollId);
        if (id === 'inventory') { Inventory.render(); Inventory.startFitting(); }
        if (id !== 'inventory') Inventory.stopFitting();
        if (id === 'game-setup') {
            CharRender.toCanvasWithHat('setup-preview', 96); OTP.start();
            const sp = document.getElementById('setup-profile');
            if (sp) sp.innerHTML = `<strong>${esc(Player.nickname)}</strong> · ${esc(Player.studentId)} ${esc(Player.studentName)}`;
        }
        if (id === 'editor') {
            const title = document.getElementById('editor-title');
            const isNew = Player.pixels == null;
            if (title) title.textContent = isNew ? '🎨 캐릭터 만들기' : '✏️ 캐릭터 수정하기';
            Editor.init();
        }
        if (id === 'shop') {
            Shop.clearFittingItem();
            if(Shop.currentTab==='colors'){
                document.getElementById('color-editor').classList.remove('hidden');
                document.getElementById('fitting-room').classList.add('hidden');
                Shop.stopIdleLoop();
                Shop.ceInit();
            }
            Shop.render();
        }
        if (id !== 'shop') Shop.stopIdleLoop();
        if (id === 'auction') Auction.render();
        if (id === 'marketplace-submit') Marketplace.renderSubmitScreen();
        if (id === 'profile-edit') ProfileSetup.initEdit();
        if (id === 'waiting-room') WaitingRoom.start();
        if (id === 'teacher') Teacher.init();
        if (id !== 'teacher') Teacher.stop();
        if (id !== 'game-setup') OTP.stop();
        if (id !== 'waiting-room') WaitingRoom.stop();
        // 게임 화면: CSS 강제 회전 후 캔버스 리사이즈 트리거 (모바일 타이밍 보장)
        if (id === 'waiting-room' || id === 'game') {
            setTimeout(() => window.dispatchEvent(new Event('resize')), 50);
            setTimeout(() => window.dispatchEvent(new Event('resize')), 200);
            setTimeout(() => window.dispatchEvent(new Event('resize')), 500);
            // 터치 기기: 풀스크린 진입
            this._tryFullscreen();
            // iPad/태블릿: 더블탭 줌 & 텍스트 선택 방지
            this._enableTouchGuard();
        } else {
            this._disableTouchGuard();
        }
    },
    // ── 게임 버튼 상태 폴링 ──
    _gameBtnPollId: null,
    _pollGameBtn() {
        clearInterval(this._gameBtnPollId);
        // 교사/테스트 계정은 항상 활성
        if (Player.studentId === TEACHER_ACCOUNT || Player.studentId === TEST_ACCOUNT) {
            this._setGameBtn(true);
            return;
        }
        // 즉시 1회 + 15초마다 체크 (30명+ 동시접속 DB 부하 방지)
        this._checkAndSetGameBtn();
        this._gameBtnPollId = setInterval(() => this._checkAndSetGameBtn(), 15000);
    },
    _lastGameBtnState: null, // 마지막으로 확인된 게임 열림 상태 (에러 시 유지)
    async _checkAndSetGameBtn() {
        try {
            // className이 없으면 roster에서 한 번 갱신 시도
            if(!Player.className) {
                try {
                    const roster = await DB.checkRoster(Player.studentId);
                    if(roster && roster.class_name) {
                        Player.className = roster.class_name;
                        Player.save();
                    }
                } catch(_){}
            }
            const open = await DB.isGameOpen(Player.className);
            this._lastGameBtnState = open;
            this._setGameBtn(open);
        } catch(e) {
            // DB 오류 시 마지막 상태 유지 (동시접속 과부하로 인한 입장 차단 방지)
            if(this._lastGameBtnState !== null) {
                this._setGameBtn(this._lastGameBtnState);
            }
        }
    },
    _setGameBtn(open) {
        const btn = document.getElementById('btn-game');
        if (!btn) return;
        if (open) {
            btn.disabled = false;
            btn.classList.remove('disabled');
            btn.textContent = '🚀 출석 게임';
        } else {
            btn.disabled = true;
            btn.classList.add('disabled');
            btn.textContent = '🔒 출석 게임';
        }
    },

    // ── 터치 기기: 더블탭 줌 방지 (iOS Safari는 viewport meta를 무시) ──
    _touchGuardActive: false,
    _enableTouchGuard() {
        if (this._touchGuardActive) return;
        this._touchGuardActive = true;
        // 더블탭 줌 방지: 300ms 내 연속 터치 차단
        let lastTouchEnd = 0;
        this._dblTapHandler = e => {
            const now = Date.now();
            if (now - lastTouchEnd < 300) { e.preventDefault(); }
            lastTouchEnd = now;
        };
        // 텍스트 선택 방지: selectstart 차단
        this._selectHandler = e => e.preventDefault();
        document.addEventListener('touchend', this._dblTapHandler, { passive: false });
        document.addEventListener('selectstart', this._selectHandler);
    },
    _disableTouchGuard() {
        if (!this._touchGuardActive) return;
        this._touchGuardActive = false;
        if (this._dblTapHandler) document.removeEventListener('touchend', this._dblTapHandler);
        if (this._selectHandler) document.removeEventListener('selectstart', this._selectHandler);
    },

    // ── 터치 기기 전용: 풀스크린 진입 ──
    _tryFullscreen() {
        if (!document.body.classList.contains('touch-device')) return;
        if (document.fullscreenElement) return;
        const el = document.documentElement;
        const req = el.requestFullscreen || el.webkitRequestFullscreen || el.msRequestFullscreen;
        if (req) req.call(el).catch(() => {});
    },

    renderCharSlots() {
        const el = document.getElementById('char-slots');
        if (!el) return;
        el.innerHTML = '';
        Player.characters.forEach((ch, i) => {
            if (ch.pixels) {
                const cvs = CharRender.toTinyCanvas(ch.pixels, 48);
                cvs.className = 'char-slot' + (i === Player.activeCharIdx ? ' active' : '');
                cvs.title = ch.name;
                cvs.onclick = () => { Player.switchChar(i); CharRender.toCanvasWithHat('lobby-preview', 128); this.renderCharSlots(); };
                el.appendChild(cvs);
            } else {
                const btn = document.createElement('button');
                btn.className = 'char-slot' + (i === Player.activeCharIdx ? ' active' : '');
                btn.title = ch.name + ' (비어있음)';
                btn.textContent = '?';
                btn.style.cssText = 'font-size:1.2rem;color:rgba(255,255,255,.3);';
                btn.onclick = () => { Player.switchChar(i); CharRender.toCanvasWithHat('lobby-preview', 128); this.renderCharSlots(); };
                el.appendChild(btn);
            }
        });
        // Add slot button
        if (Player.characters.length < Player.MAX_SLOTS) {
            const add = document.createElement('button');
            add.className = 'char-slot-add';
            add.title = `새 슬롯 (🪙${Player.SLOT_PRICE})`;
            add.textContent = '+';
            add.onclick = () => {
                if (Player.coins < Player.SLOT_PRICE) {
                    alert(`코인이 부족합니다! (${Player.SLOT_PRICE}코인 필요)`);
                    return;
                }
                if (!confirm(`정말로 슬롯을 늘리시겠습니까?\n🪙 ${Player.SLOT_PRICE}코인이 차감됩니다. (보유: ${Player.coins}코인)`)) return;
                if (Player.buySlot()) {
                    Player.switchChar(Player.characters.length - 1);
                    Nav.go('editor');
                }
            };
            el.appendChild(add);
        }
    }
};

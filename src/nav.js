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

const TEST_ACCOUNT = '99999';
const TEACHER_ACCOUNT = '77777';

// ── 가로 회전 오버레이 (게임 화면 세로 모드 차단) ──
const _GAME_SCREENS = new Set(['waiting-room', 'game']);
let _currentScreen = '';

function _isTouchDevice() {
    return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
}

function _checkOrientation() {
    const overlay = document.getElementById('rotate-overlay');
    if (!overlay) return;
    if (!_isTouchDevice() || !_GAME_SCREENS.has(_currentScreen)) {
        overlay.classList.add('hidden');
        return;
    }
    const isPortrait = window.matchMedia('(orientation: portrait)').matches
        || window.innerHeight > window.innerWidth;
    overlay.classList.toggle('hidden', !isPortrait);
}

window.addEventListener('resize', _checkOrientation);
try { screen.orientation?.addEventListener('change', _checkOrientation); } catch(e) {}
try { window.matchMedia('(orientation: portrait)').addEventListener('change', _checkOrientation); } catch(e) {}
// 폴백: 오버레이 표시 중이면 500ms마다 재확인 (일부 폰에서 이벤트 누락 대비)
setInterval(() => {
    const overlay = document.getElementById('rotate-overlay');
    if (overlay && !overlay.classList.contains('hidden')) _checkOrientation();
}, 500);

// ── 세션 강제 종료 (다른 기기 로그인) ──
window.addEventListener('session-revoked', () => {
    DB.stopHeartbeat();
    const overlay = document.getElementById('session-kicked-overlay');
    if (overlay) overlay.classList.remove('hidden');
});

export const Nav = {
    logout() {
        DB.clearLoginState(); // IP 해제 (대리 출석 방지)
        Player.logout();
        DB.stopHeartbeat();
        this.go('profile-setup');
        // 입력 필드 초기화
        ['ps-nickname','ps-studentid','ps-name'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = '';
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
            this._showGameClosed();
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
        _currentScreen = id;
        _checkOrientation();
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
        // 즉시 1회 + 5초마다 체크
        this._checkAndSetGameBtn();
        this._gameBtnPollId = setInterval(() => this._checkAndSetGameBtn(), 5000);
    },
    async _checkAndSetGameBtn() {
        try {
            const open = await DB.isGameOpen(Player.className);
            this._setGameBtn(open);
        } catch(e) {
            this._setGameBtn(false);
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

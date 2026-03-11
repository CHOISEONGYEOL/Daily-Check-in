// ── Entry point: wire up all modules ──
import './polyfills.js'; // 구버전 브라우저 호환 (roundRect, crypto.randomUUID 등)
import { Player } from './player.js';
import { DB } from './db.js';
import { OTP } from './otp.js';
import { CharRender, setInventory, setCharRenderMarketplace } from './char-render.js';
import { ProfileSetup, setNav as setNavProfile } from './profile.js';
import { Editor, setShop as setShopEditor, setNav as setNavEditor, setWaitingRoom as setWREditor } from './editor.js';
import { Shop, setShopInventory, setShopMarketplace } from './shop.js';
import { Inventory, setInventoryMarketplace } from './inventory.js';
import { Auction, setNav as setNavAuction } from './auction.js';
import { WaitingRoom, setGame as setGameWR, setShop as setShopWR, setEditor as setEditorWR } from './waiting-room.js';
import { Game, Confetti, setNav as setNavGame, setWaitingRoom as setWRGame, setSetupEditorKeys } from './game.js';
import { MazeGame } from './maze-game.js';
import { EscapeRoom } from './escape-room.js';
import { CrosswordGame } from './crossword-game.js';
import { OllaOllaGame } from './ollaolla-game.js';
import { Teacher, setTeacherMarketplace, setTeacherWaitingRoom } from './teacher.js';
import { Vote } from './vote.js';
import { LS } from './storage.js';
import { Nav } from './nav.js';
import { Marketplace, setMarketShop, setMarketNav } from './marketplace.js';
import { GameKeyboard } from './game-keyboard.js';
import { PerfMonitor } from './perf-monitor.js';
import { AppPresence } from './app-presence.js';

// ── Wire forward references ──
setInventory(Inventory);
setShopInventory(Inventory);
setNavProfile(Nav);
setShopEditor(Shop);
setNavEditor(Nav);
setWREditor(WaitingRoom);
setNavAuction(Nav);
setGameWR(Game);
setShopWR(Shop);
setEditorWR(Editor);
setNavGame(Nav);
setWRGame(WaitingRoom);
// Marketplace wiring
setMarketShop(Shop);
setMarketNav(Nav);
setShopMarketplace(Marketplace);
setCharRenderMarketplace(Marketplace);
setInventoryMarketplace(Marketplace);
setTeacherMarketplace(Marketplace);
setTeacherWaitingRoom(WaitingRoom);

// ── Maze game mixin ──
Object.assign(Game, MazeGame, EscapeRoom, CrosswordGame, OllaOllaGame);

// ── Expose to window for inline onclick handlers ──
window.Nav = Nav;
window.Editor = Editor;
window.Shop = Shop;
window.Inventory = Inventory;
window.Auction = Auction;
window.Game = Game;
window.ProfileSetup = ProfileSetup;
window.WaitingRoom = WaitingRoom;
window.OTP = OTP;
window.Confetti = Confetti;
// window.DB — 프로덕션에서는 노출하지 않음 (콘솔 해킹 방지)
window.Teacher = Teacher;
window.Vote = Vote;
window.Marketplace = Marketplace;
window.GameKeyboard = GameKeyboard;

// ── Editor keyboard shortcuts ──
function setupEditorKeys(){
    document.addEventListener('keydown', editorKeyHandler);
}
function editorKeyHandler(e){
    if(!document.getElementById('editor').classList.contains('active')) return;
    if((e.ctrlKey||e.metaKey)&&e.key==='z'&&!e.shiftKey){e.preventDefault();Editor.undo();}
    if((e.ctrlKey||e.metaKey)&&(e.key==='y'||(e.key==='z'&&e.shiftKey))){e.preventDefault();Editor.redo();}
}
setupEditorKeys();
setSetupEditorKeys(setupEditorKeys);

// ── Init ──
const TEACHER_ACCOUNT = '77777';

document.addEventListener('DOMContentLoaded', async () => {
    // 성능 모니터 초기화 (에러 캡처 + 1초 tick)
    PerfMonitor.init();
    // 커스텀 한글 키보드 초기화 (모바일용)
    GameKeyboard.init();
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));

    // 항상 로그인 폼 표시 (auto-login 제거: 매번 학번+이름+닉네임 입력 필수)
    document.getElementById('profile-setup').classList.add('active');
    if (Player.hasProfile()) {
        // 기존 값을 폼에 미리 채워서 편의 제공
        const sidEl = document.getElementById('ps-studentid');
        const nameEl = document.getElementById('ps-name');
        const nickEl = document.getElementById('ps-nickname');
        if (sidEl) sidEl.value = Player.studentId;
        if (nameEl) nameEl.value = Player.studentName;
        if (nickEl) nickEl.value = Player.nickname;
    }

    // ── 페이지 닫기 시 Presence 해제 ──
    window.addEventListener('beforeunload', () => AppPresence.leave());

    // Profile setup Enter key
    ['ps-nickname','ps-studentid','ps-name'].forEach(id => {
        const el = document.getElementById(id);
        if(el) el.addEventListener('keydown', e => { if(e.key === 'Enter') ProfileSetup.submit(); });
    });

    // OTP input Enter key
    const otpInput = document.getElementById('otp-input');
    if(otpInput) otpInput.addEventListener('keydown', e => {
        if(e.key === 'Enter') Game.verifyAndEnter();
    });
});

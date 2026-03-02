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
import { Teacher, setTeacherMarketplace, setTeacherWaitingRoom } from './teacher.js';
import { Vote } from './vote.js';
import { LS } from './storage.js';
import { Nav } from './nav.js';
import { Marketplace, setMarketShop, setMarketNav } from './marketplace.js';
import { GameKeyboard } from './game-keyboard.js';

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
Object.assign(Game, MazeGame);

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
    // 커스텀 한글 키보드 초기화 (모바일용)
    GameKeyboard.init();
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));

    if (Player.hasProfile()) {
        // 프로필 있으면 자동 로그인 → 교사는 대시보드, 학생은 로비
        document.getElementById('profile-setup').classList.add('active');
        try {
            const savedToken = LS.get('sessionToken', null);
            await Player.login(Player.studentId, Player.studentName, Player.nickname, savedToken);
            Nav.go(Player.studentId === TEACHER_ACCOUNT ? 'teacher' : 'lobby');
        } catch (e) {
            console.error('Auto-login failed:', e);
            document.getElementById('profile-setup').classList.add('active');
        }
    } else {
        document.getElementById('profile-setup').classList.add('active');
    }

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

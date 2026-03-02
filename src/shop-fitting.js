import { Player } from './player.js';
import { CharRender } from './char-render.js';

// Forward reference (set from shop.js to avoid circular dep)
let Marketplace = null;
export function setFittingMarketplace(m) { Marketplace = m; }

export const ShopFitting = {
    // ── Fitting Room State ──
    fitting: {
        active: false,       // whether an item is being previewed
        idleRunning: false,  // whether idle loop is running
        itemId: null,
        item: null,
        tab: null,
        player: null,
        animRef: null,
        keys: {},
        particles: [],
        platforms: [
            {x:0, y:460, w:400, h:60},   // ground
            {x:20, y:350, w:110, h:16},   // left platform
            {x:150, y:290, w:100, h:16},  // center platform
            {x:280, y:350, w:110, h:16},  // right platform
        ],
        W: 400, H: 520,
        GRAVITY: 0.8, JUMP_FORCE: -14, MOVE_SPD: 4,
    },

    _fittingKeyDown: null,
    _fittingKeyUp: null,

    /** Start the idle fitting room loop (no item selected, just character walking around) */
    startIdleLoop(){
        const f = this.fitting;
        if(f.idleRunning) return;
        f.idleRunning = true;

        const sprite = CharRender.toOffscreen(Player.pixels, 32);
        f.player = { x: f.W/2, y: f.H-160, vx:0, vy:0, dir:1, onGround:false, sprite, w:32, h:48, jumpCount:0 };
        f.particles = [];

        // Key bindings
        f.keys = {};
        this._fittingKeyDown = e => { f.keys[e.key] = true; };
        this._fittingKeyUp = e => { f.keys[e.key] = false; };
        window.addEventListener('keydown', this._fittingKeyDown);
        window.addEventListener('keyup', this._fittingKeyUp);

        const loop = () => {
            if(!f.idleRunning) return;
            this.fittingUpdate();
            this.fittingRender();
            f.animRef = requestAnimationFrame(loop);
        };
        f.animRef = requestAnimationFrame(loop);
    },

    /** Stop the idle fitting room loop */
    stopIdleLoop(){
        const f = this.fitting;
        f.idleRunning = false;
        f.active = false;
        if(f.animRef) cancelAnimationFrame(f.animRef);
        f.animRef = null;
        if(this._fittingKeyDown) window.removeEventListener('keydown', this._fittingKeyDown);
        if(this._fittingKeyUp) window.removeEventListener('keyup', this._fittingKeyUp);
        this._fittingKeyDown = null;
        this._fittingKeyUp = null;
        f.keys = {};
    },

    switchTab(btn,tab){
        this.currentTab=tab;
        document.querySelectorAll('.shop-tab').forEach(b=>b.classList.remove('active'));
        btn.classList.add('active');
        this.clearFittingItem();
        // Toggle color editor vs fitting room
        const ceEl = document.getElementById('color-editor');
        const frEl = document.getElementById('fitting-room');
        if(tab==='colors'){
            ceEl.classList.remove('hidden');
            frEl.classList.add('hidden');
            this.stopIdleLoop();
            this.ceInit();
        } else {
            ceEl.classList.add('hidden');
            frEl.classList.remove('hidden');
            this.ce.active = false;
            if(!this.fitting.idleRunning) this.startIdleLoop();
        }
        // 학생 작품 탭: 승인된 아이템 로드
        if(tab==='student' && Marketplace) Marketplace.loadApproved().then(()=>this.render());
        else this.render();
    },

    /** Clear the currently previewed item but keep idle loop running */
    clearFittingItem(){
        const f = this.fitting;
        f.active = false;
        f.itemId = null;
        f.item = null;
        f.tab = null;
        f.particles = [];
        document.getElementById('fitting-room').classList.remove('active');
        document.getElementById('fitting-info').textContent = '아이템을 선택하세요';
        document.getElementById('fitting-price').textContent = '';
        document.getElementById('fitting-depreciation').textContent = '';
        document.getElementById('fitting-buy').classList.add('hidden');
    },
};

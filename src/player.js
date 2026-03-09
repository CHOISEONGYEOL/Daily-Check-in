import { LS } from './storage.js';
import { DB } from './db.js';

export const Player = {
    coins: LS.get('coins', 0), streak: LS.get('streak', 0),
    owned: LS.get('owned', []),
    titles: LS.get('titles', []), activeTitle: LS.get('activeTitle', null),
    auctionGallery: LS.get('auctionGallery', []),
    clearedGames: LS.get('clearedGames', []),
    // Profile
    nickname: LS.get('nickname', ''),
    studentId: LS.get('studentId', ''),
    studentName: LS.get('studentName', ''),
    className: LS.get('className', ''),
    // Multi-character
    characters: LS.get('characters', []),
    activeCharIdx: LS.get('activeCharIdx', 0),
    maxSlots: LS.get('maxSlots', 1),
    MAX_SLOTS: 5,
    SLOT_PRICE: 100,
    // Per-character equipped: getter proxies to active character
    get equipped() {
        const ch = this.characters[this.activeCharIdx];
        if(!ch) return {};
        if(!ch.equipped) ch.equipped = {};
        return ch.equipped;
    },
    set equipped(v) {
        const ch = this.characters[this.activeCharIdx];
        if(ch) ch.equipped = v;
    },
    // Compatibility: pixels getter/setter
    get grid() { const ch = this.characters[this.activeCharIdx]; return ch?.grid || (ch?.pixels ? ch.pixels.length : 32); },
    get pixels() { const ch = this.characters[this.activeCharIdx]; return ch ? ch.pixels : null; },
    set pixels(v) {
        if (!this.characters.length) this.characters.push({ name: '캐릭터 1', pixels: v, equipped: {}, grid: v ? v.length : 32 });
        else this.characters[this.activeCharIdx].pixels = v;
    },
    hasProfile() { return !!this.nickname; },
    _migrateEquipped() {
        const oldEquip = LS.get('equipped', null);
        if(oldEquip && (oldEquip.hat || oldEquip.effect)) {
            this.characters.forEach(ch => {
                if(!ch.equipped) ch.equipped = { hat: oldEquip.hat || null, effect: oldEquip.effect || null };
            });
            LS.set('equipped', null);
            this.save();
        }
        this.characters.forEach(ch => {
            if(!ch.equipped) ch.equipped = {};
            if(!ch.grid) ch.grid = 32;
        });
    },

    // ── 로그아웃: localStorage 초기화 → 로그인 화면 ──
    logout() {
        const keys = ['coins','streak','owned','characters','activeCharIdx','maxSlots',
            'titles','activeTitle','auctionGallery','clearedGames','nickname','studentId','studentName','className'];
        keys.forEach(k => localStorage.removeItem('ck_' + k));
        this.coins = 0; this.streak = 0; this.owned = []; this.titles = [];
        this.activeTitle = null; this.auctionGallery = []; this.clearedGames = [];
        this.nickname = ''; this.studentId = ''; this.studentName = ''; this.className = '';
        this.characters = []; this.activeCharIdx = 0; this.maxSlots = 1;
    },

    // ── 저장: localStorage + Supabase ──────────
    save() {
        // localStorage (즉시, 오프라인 대비)
        LS.set('coins', this.coins); LS.set('streak', this.streak);
        LS.set('owned', this.owned);
        LS.set('characters', this.characters); LS.set('activeCharIdx', this.activeCharIdx);
        LS.set('maxSlots', this.maxSlots);
        LS.set('titles', this.titles); LS.set('activeTitle', this.activeTitle);
        LS.set('auctionGallery', this.auctionGallery);
        LS.set('clearedGames', this.clearedGames);
        LS.set('nickname', this.nickname); LS.set('studentId', this.studentId); LS.set('studentName', this.studentName);
        LS.set('className', this.className);
        // Supabase (debounced, 비동기)
        DB.savePlayer(this);
    },

    // ── DB에서 데이터 로드 → Player에 반영 ─────
    async loadFromDB() {
        const data = await DB.loadPlayer();
        if (!data) return false;
        this.coins = data.coins;
        this.streak = data.streak;
        this.nickname = data.nickname;
        this.studentId = data.studentId;
        this.studentName = data.studentName;
        this.owned = data.owned;
        this.titles = data.titles;
        this.activeTitle = data.activeTitle;
        this.activeCharIdx = data.activeCharIdx;
        this.maxSlots = data.maxSlots;
        this.auctionGallery = data.auctionGallery || [];
        this.clearedGames = data.clearedGames || [];
        this.characters = data.characters;
        // localStorage도 동기화
        this.save();
        return true;
    },

    // ── 로그인 (학번 기반) ──────────────────────
    async login(studentId, studentName, nickname, existingToken) {
        const result = await DB.login(studentId, studentName, nickname, existingToken);
        // 세션 토큰 localStorage 저장 (페이지 리로드 대비)
        if (DB.sessionToken) LS.set('sessionToken', DB.sessionToken);
        else LS.set('sessionToken', null);
        if (result.isNew) {
            // 신규 유저: 기본값 세팅
            this.coins = 0;
            this.streak = 0;
            this.nickname = nickname;
            this.studentId = studentId;
            this.studentName = studentName;
            this.owned = [];
            this.titles = [];
            this.activeTitle = null;
            this.activeCharIdx = 0;
            this.maxSlots = 1;
            this.auctionGallery = [];
            this.clearedGames = [];
            this.characters = [{ name: '캐릭터 1', pixels: null, equipped: {}, grid: 32 }];
            this.save();
        } else {
            // 기존 유저: DB에서 로드
            await this.loadFromDB();
        }
        return result;
    },

    addCoins(n, reason = 'unknown') {
        this.coins += n;
        if(this.coins < 0) this.coins = 0;
        this.save();
        this.refreshUI();
        // 서버사이드 RPC로 안전하게 코인 변동
        DB.addCoins(n, reason).then(balance => {
            if(balance !== null && balance !== undefined) {
                this.coins = balance; // 서버 잔액으로 동기화
                LS.set('coins', this.coins);
                this.refreshUI();
            }
        }).catch(e => console.warn('Coin sync failed:', e));
    },
    refreshUI() {
        ['L-coins','S-coins','G-coins','A-coins'].forEach(id => { const e = document.getElementById(id); if (e) e.textContent = this.coins; });
        ['L-streak'].forEach(id => { const e = document.getElementById(id); if (e) e.textContent = this.streak; });
        const titleEl = document.getElementById('L-title');
        if(titleEl) titleEl.textContent = this.activeTitle || '';
        if(titleEl) titleEl.classList.toggle('hidden', !this.activeTitle);
        const nickEl = document.getElementById('L-nickname');
        if(nickEl) nickEl.textContent = this.nickname || '';
    },
    buySlot() {
        if (this.characters.length >= this.MAX_SLOTS) return false;
        if (this.coins < this.SLOT_PRICE) return false;
        this.addCoins(-this.SLOT_PRICE, 'slot_buy');
        this.maxSlots++;
        this.characters.push({ name: '캐릭터 ' + this.maxSlots, pixels: null, equipped: {}, grid: 32 });
        this.save(); this.refreshUI();
        return true;
    },
    removeCharacter(idx) {
        if (idx < 0 || idx >= this.characters.length) return false;
        if (this.characters.length <= 1) return false;
        this.characters.splice(idx, 1);
        if (this.activeCharIdx >= this.characters.length) {
            this.activeCharIdx = this.characters.length - 1;
        }
        this.save();
        return true;
    },
    addCharacter(charData) {
        const emptyIdx = this.characters.findIndex(c => !c.pixels);
        if (emptyIdx !== -1) {
            this.characters[emptyIdx] = charData;
        } else if (this.characters.length < this.MAX_SLOTS) {
            this.characters.push(charData);
        } else {
            return false;
        }
        this.save();
        return true;
    },
    switchChar(idx) {
        if (idx < 0 || idx >= this.characters.length) return;
        this.activeCharIdx = idx;
        this.save();
    },
    sell(itemId, allItems, depreciation) {
        const idx = this.owned.indexOf(itemId);
        if(idx === -1) return false;
        // si_ 학생 아이템은 일반 판매 불가 (마켓플레이스 전용)
        if(itemId.startsWith('si_')) return false;
        const item = Object.values(allItems).flat().find(i=>i.id===itemId);
        if(!item || item.consumable) return false;
        const sellPrice = Math.floor(item.price * depreciation);
        this.characters.forEach(ch => {
            if(!ch.equipped) return;
            if(ch.equipped.hat === itemId) ch.equipped.hat = null;
            if(ch.equipped.effect === itemId) ch.equipped.effect = null;
        });
        if(item.titleText){
            if(this.activeTitle === item.titleText) this.activeTitle = null;
            const tIdx = this.titles.indexOf(item.titleText);
            if(tIdx !== -1) this.titles.splice(tIdx, 1);
        }
        this.owned.splice(idx, 1);
        this.addCoins(sellPrice, 'sell');
        this.save();
        return true;
    }
};

// Run migration on load
Player._migrateEquipped();

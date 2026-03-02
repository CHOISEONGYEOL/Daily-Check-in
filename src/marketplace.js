import { supabase } from './supabase.js';
import { Player } from './player.js';
import { DB } from './db.js';
import { GRID, CANVAS_PX, CELL } from './constants.js';
import { CharRender } from './char-render.js';

// Forward references (set from main.js)
let Shop = null;
export function setMarketShop(s) { Shop = s; }
let Nav = null;
export function setMarketNav(n) { Nav = n; }

export const Marketplace = {
    approvedItems: [],
    submissions: [],
    mySubmissions: [],

    // ── 도트 에디터 상태 (등록 화면용) ──
    _ed: {
        pixels: null,
        drawing: false,
        tool: 'pen',
        color: '#6C5CE7',
        zoom: 1,
    },
    _draftTimer: null,
    _currentDraftId: null,
    _edPalette: ['#2D3436','#636E72','#B2BEC3','#DFE6E9','#FFFFFF','#D63031','#E17055','#FDCB6E','#FFEAA7','#00B894','#00CEC9','#0984E3','#6C5CE7','#A29BFE','#FD79A8','#E84393','#74B9FF','#FAB1A0','#855E42','#A0522D'],

    // ── 이모지 목록 (펫용) ──
    _petEmojis: ['🐶','🐱','🐹','🐰','🐦','🐢','🐟','🐝','🐞','🦋','🐼','🐨','🦊','🦝','🐧','🐥','🦄','🐷','🐸','🦔','🦁','🐯','🐻','🦅','🐺','🦈','🐊','🐘','🦩','🦜','🐉','🦇','🐲','🦂','🕷️','🐙','🦑','🐍','🦎','🐾','👾','🤖','🛸','🌟','💀','👻','🎃','🦷','🧸','🪆'],

    // ── 승인된 아이템 로드 (상점 탭 진입 시) ──
    async loadApproved() {
        const { data } = await supabase
            .from('student_items')
            .select('*')
            .eq('status', 'approved')
            .order('created_at', { ascending: false });
        this.approvedItems = (data || []).map(r => this._toShopItem(r));
    },

    // DB row → 상점 아이템 형식 변환
    _toShopItem(r) {
        let icon = r.icon || '🎨';
        if (r.item_type === 'title') icon = '🏷️';
        if ((r.item_type === 'hat' || r.item_type === 'skin') && r.pixel_data) icon = '🖼️';
        return {
            id: r.item_id,
            icon,
            name: r.name,
            desc: r.description || '',
            price: r.final_price || r.proposed_price,
            creator: r.creator_name,
            creatorId: r.creator_id,
            itemType: r.item_type,
            pixelData: r.pixel_data,
            titleText: r.title_text,
            salesCount: r.sales_count,
            _dbId: r.id,
        };
    },

    // ── 아이템 등록 (학생) ──
    async submitItem({ type, name, desc, price, pixelData, emoji, titleText }) {
        const itemId = 'si_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
        const row = {
            item_id: itemId,
            creator_id: DB.userId,
            creator_name: Player.nickname || Player.studentName || '???',
            item_type: type,
            name,
            description: desc || '',
            proposed_price: price,
            status: 'pending',
        };
        if (pixelData) row.pixel_data = pixelData;
        if (emoji) row.icon = emoji;
        if (titleText) row.title_text = titleText;

        const { error } = await supabase.from('student_items').insert(row);
        if (error) { alert('등록 실패: ' + error.message); return false; }
        alert('등록 완료! 교사 승인을 기다려주세요.');
        return true;
    },

    // ── 내 등록 현황 로드 ──
    async loadMySubmissions() {
        if (!DB.userId) return;
        const { data } = await supabase
            .from('student_items')
            .select('*')
            .eq('creator_id', DB.userId)
            .order('created_at', { ascending: false });
        this.mySubmissions = data || [];
    },

    // ── 구매 (buyer → creator 코인 이체) ──
    async buyStudentItem(itemId) {
        const item = this.approvedItems.find(i => i.id === itemId);
        if (!item) { alert('아이템을 찾을 수 없습니다.'); return false; }
        if (Player.owned.includes(itemId)) { alert('이미 보유하고 있습니다.'); return false; }
        if (Player.coins < item.price) { alert('코인이 부족합니다!'); return false; }
        if (item.creatorId === DB.userId) { alert('자신의 아이템은 구매할 수 없습니다.'); return false; }

        // 캐릭터 타입이면 슬롯 확인
        if (item.itemType === 'character') {
            const hasEmpty = Player.characters.some(c => !c.pixels);
            if (!hasEmpty && Player.characters.length >= Player.MAX_SLOTS) {
                // 슬롯 꽉 참 → 교체 팝업
                this._pendingCharPurchase = item;
                this._showCharReplaceDialog(item);
                return 'pending_replace';
            }
        }

        return this._completePurchase(item);
    },

    // ── 캐릭터 교체 선택 팝업 ──
    _showCharReplaceDialog(item) {
        const overlay = document.createElement('div');
        overlay.id = 'char-replace-overlay';
        overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.75);display:flex;align-items:center;justify-content:center;z-index:9999;';
        let slotsHtml = '';
        Player.characters.forEach((ch, i) => {
            const cvs = CharRender.toTinyCanvas(ch.pixels, 64);
            slotsHtml += `<div class="chr-slot-pick" data-idx="${i}">
                <canvas width="64" height="64" data-px='${JSON.stringify(ch.pixels)}' style="image-rendering:pixelated;width:64px;height:64px;border-radius:8px;border:2px solid rgba(255,255,255,.2);background:#111;cursor:pointer;"></canvas>
                <div style="font-size:.85rem;color:#ddd;margin-top:4px;text-align:center;">${ch.name || '캐릭터 '+(i+1)}</div>
            </div>`;
        });
        overlay.innerHTML = `
            <div style="background:#1e1e2e;border-radius:14px;padding:1.5rem;max-width:420px;width:90%;text-align:center;box-shadow:0 8px 32px rgba(0,0,0,.5);">
                <div style="font-size:1.2rem;font-weight:700;margin-bottom:.5rem;">⚠️ 캐릭터 슬롯이 가득 찼어요!</div>
                <div style="color:#FF6B6B;font-weight:700;margin-bottom:.6rem;">떠나보낸 캐릭터는 다시 복구할 수 없습니다!</div>
                <div style="color:#aaa;font-size:.9rem;margin-bottom:1rem;">새 캐릭터 <b style="color:#a29bfe">"${item.name}"</b>와 교체할 캐릭터를 선택하세요.</div>
                <div style="display:flex;gap:.8rem;justify-content:center;flex-wrap:wrap;margin-bottom:1rem;" id="chr-replace-grid">${slotsHtml}</div>
                <button class="btn outline" onclick="document.getElementById('char-replace-overlay')?.remove()" style="width:100%;">취소</button>
            </div>
        `;
        document.body.appendChild(overlay);

        // 캔버스에 픽셀 그리기 + 클릭 이벤트
        overlay.querySelectorAll('.chr-slot-pick').forEach(el => {
            const cvs = el.querySelector('canvas');
            const px = JSON.parse(cvs.dataset.px);
            if (px) {
                const ctx = cvs.getContext('2d');
                const s = 64 / GRID;
                for (let y = 0; y < GRID; y++) for (let x = 0; x < GRID; x++) {
                    if (px[y] && px[y][x]) { ctx.fillStyle = px[y][x]; ctx.fillRect(Math.floor(x*s), Math.floor(y*s), Math.ceil(s), Math.ceil(s)); }
                }
            }
            el.onclick = () => {
                const idx = parseInt(el.dataset.idx);
                const chName = Player.characters[idx]?.name || '캐릭터 '+(idx+1);
                if (!confirm(`정말 "${chName}"을(를) 떠나보내시겠습니까?\n\n이 캐릭터는 영원히 사라지며 복구할 수 없습니다.`)) return;
                this._executeCharReplace(idx);
            };
        });
    },

    async _executeCharReplace(replaceIdx) {
        const item = this._pendingCharPurchase;
        if (!item) return;
        this._pendingCharPurchase = null;
        document.getElementById('char-replace-overlay')?.remove();

        const result = await this._completePurchase(item);
        if (result) {
            // 교체: 선택한 슬롯에 새 캐릭터 픽셀 넣기
            Player.characters[replaceIdx] = {
                name: item.name,
                pixels: item.pixelData,
                equipped: {},
            };
            Player.activeCharIdx = replaceIdx;
            Player.save();
            if (Shop) Shop.render();
        }
    },

    async _completePurchase(item) {
        const { error } = await supabase.rpc('transfer_coins', {
            buyer_uuid: DB.userId,
            seller_uuid: item.creatorId,
            amount: item.price,
            p_item_id: item.id,
        });
        if (error) { alert('구매 실패: ' + error.message); return false; }

        Player.coins -= item.price; // 로컬 UI 업데이트 (DB는 transfer_coins RPC가 처리)
        Player.owned.push(item.id);

        // 캐릭터 타입: 빈 슬롯에 자동 적용
        if (item.itemType === 'character' && item.pixelData) {
            const emptyIdx = Player.characters.findIndex(c => !c.pixels);
            if (emptyIdx !== -1) {
                Player.characters[emptyIdx] = {
                    name: item.name,
                    pixels: item.pixelData,
                    equipped: {},
                };
                Player.activeCharIdx = emptyIdx;
            }
        }

        Player.save();
        Player.refreshUI();
        item.salesCount++;
        return true;
    },

    // ── 교사: 대기 중인 아이템 로드 ──
    async loadPending() {
        const { data } = await supabase
            .from('student_items')
            .select('*')
            .eq('status', 'pending')
            .order('created_at', { ascending: false });
        this.submissions = data || [];
    },

    // ── 교사: 승인 ──
    async approve(dbId, finalPrice) {
        const { error } = await supabase
            .from('student_items')
            .update({ status: 'approved', final_price: finalPrice })
            .eq('id', dbId);
        if (error) { alert('승인 실패: ' + error.message); return false; }
        return true;
    },

    // ── 교사: 거절 ──
    async reject(dbId, reason) {
        const { error } = await supabase
            .from('student_items')
            .update({ status: 'rejected', reject_reason: reason })
            .eq('id', dbId);
        if (error) { alert('거절 실패: ' + error.message); return false; }
        return true;
    },

    // ── 등록 UI 렌더 ──
    renderSubmitScreen() {
        const inner = document.getElementById('market-submit-inner');
        if (!inner) return;

        // 도트 에디터 초기화
        this._ed.pixels = Array.from({ length: GRID }, () => Array(GRID).fill(null));
        this._ed.tool = 'pen';
        this._ed.color = '#6C5CE7';
        this._selectedType = 'hat';
        this._selectedEmoji = null;

        inner.innerHTML = `
            <div class="mks-section">
                <div class="mks-title">📦 아이템 유형 선택</div>
                <div class="mks-type-grid">
                    <button class="mks-type-btn active" data-type="hat" onclick="Marketplace.selectType('hat',this)">🎩 모자</button>
                    <button class="mks-type-btn" data-type="pet" onclick="Marketplace.selectType('pet',this)">🐾 펫</button>
                    <button class="mks-type-btn" data-type="character" onclick="Marketplace.selectType('character',this)">🧑 캐릭터</button>
                </div>
            </div>
            <div class="mks-section">
                <div class="mks-title">🎨 도트 아트 그리기 (32x32)</div>
                <div class="mks-editor-row">
                    <div class="mks-canvas-wrap" id="mks-canvas-wrap"><canvas id="mks-canvas" width="${CANVAS_PX}" height="${CANVAS_PX}"></canvas></div>
                    <div class="mks-ed-tools">
                        <div class="mks-ed-btns">
                            <button class="tool-btn active" data-tool="pen" onclick="Marketplace.edSetTool('pen',this)">✏️ 펜</button>
                            <button class="tool-btn" data-tool="eraser" onclick="Marketplace.edSetTool('eraser',this)">🧹 지우개</button>
                            <button class="tool-btn" data-tool="fill" onclick="Marketplace.edSetTool('fill',this)">🪣 채우기</button>
                        </div>
                        <div class="mks-palette" id="mks-palette"></div>
                        <canvas id="mks-preview" width="64" height="64" style="image-rendering:pixelated;border-radius:6px;border:2px solid rgba(255,255,255,.1);width:48px;height:48px;"></canvas>
                        <div class="mks-zoom-bar">
                            <button class="btn sm outline" onclick="Marketplace.edZoom(-0.5)">🔍−</button>
                            <span id="mks-zoom-label" style="color:#aaa;font-size:.8rem;min-width:28px;text-align:center">1x</span>
                            <button class="btn sm outline" onclick="Marketplace.edZoom(0.5)">🔍+</button>
                        </div>
                        <button class="btn sm outline" onclick="Marketplace.edClear()">🗑️ 전체 지우기</button>
                    </div>
                </div>
            </div>
            <div class="mks-section" id="mks-extra-area"></div>
            <div class="mks-section">
                <div class="mks-title">📝 아이템 정보</div>
                <label class="mks-label">이름 (최대 20자)
                    <input type="text" id="mks-name" maxlength="20" class="mks-input" placeholder="아이템 이름">
                </label>
                <label class="mks-label">설명 (최대 50자)
                    <input type="text" id="mks-desc" maxlength="50" class="mks-input" placeholder="간단한 설명">
                </label>
                <label class="mks-label">희망 가격 (코인)
                    <input type="number" id="mks-price" min="1" max="9999" value="50" class="mks-input" style="width:120px">
                    <span style="font-size:.85rem;color:#aaa;margin-top:2px">1 ~ 9,999 코인 범위에서 입력 가능</span>
                </label>
            </div>
            <div style="display:flex;gap:.5rem;margin-bottom:.4rem;">
                <button class="btn big outline" onclick="Marketplace._openDraftDashboard()" style="flex:1">📂 불러오기</button>
                <button class="btn big teal" onclick="Marketplace._saveDraftNow()" style="flex:1">💾 임시저장</button>
            </div>
            <button class="btn big purple" onclick="Marketplace.doSubmit()" style="width:100%">📤 판매 등록 요청</button>
        `;

        this._setupEditorCanvas();
        this._renderEdPalette();
        this._ed.zoom = 1;
        this._currentDraftId = null;
        this._edDraw();
        // 폼 입력 시 자동 저장 연결
        ['mks-name','mks-desc','mks-price'].forEach(id=>{
            const el=document.getElementById(id);
            if(el) el.oninput=()=>this._scheduleDraftSave();
        });
    },

    selectType(type, btn) {
        this._selectedType = type;
        this._selectedEmoji = null;
        document.querySelectorAll('.mks-type-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        // 펫 유형일 때만 이모지 선택 영역 표시
        const extra = document.getElementById('mks-extra-area');
        if (!extra) return;
        if (type === 'pet') {
            extra.innerHTML = `
                <div class="mks-title">🐾 펫 이모지 선택</div>
                <div class="mks-emoji-grid" id="mks-emoji-grid">
                    ${this._petEmojis.map(e => `<button class="mks-emoji-btn" onclick="Marketplace.selectEmoji('${e}',this)">${e}</button>`).join('')}
                </div>
            `;
        } else {
            extra.innerHTML = '';
        }
    },

    selectEmoji(emoji, btn) {
        this._selectedEmoji = emoji;
        document.querySelectorAll('.mks-emoji-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
    },

    // ── 도트 에디터 헬퍼 ──
    _setupEditorCanvas() {
        const c = document.getElementById('mks-canvas');
        if (!c) return;
        c.onpointerdown = e => { this._ed.drawing = true; this._edPaint(e); };
        c.onpointermove = e => { if (this._ed.drawing) this._edPaint(e); };
        c.onpointerup = () => this._ed.drawing = false;
        c.onpointerleave = () => this._ed.drawing = false;
    },
    _edPaint(e) {
        const c = document.getElementById('mks-canvas');
        const r = c.getBoundingClientRect();
        const x = Math.floor((e.clientX - r.left) / (r.width / GRID));
        const y = Math.floor((e.clientY - r.top) / (r.height / GRID));
        if (x < 0 || x >= GRID || y < 0 || y >= GRID) return;
        if (this._ed.tool === 'pen') this._ed.pixels[y][x] = this._ed.color;
        else if (this._ed.tool === 'eraser') this._ed.pixels[y][x] = null;
        else if (this._ed.tool === 'fill') this._edFlood(x, y, this._ed.pixels[y][x], this._ed.color);
        this._edDraw();
        this._scheduleDraftSave();
    },
    _edFlood(x, y, t, r) {
        if (t === r || x < 0 || x >= GRID || y < 0 || y >= GRID || this._ed.pixels[y][x] !== t) return;
        this._ed.pixels[y][x] = r;
        this._edFlood(x + 1, y, t, r); this._edFlood(x - 1, y, t, r);
        this._edFlood(x, y + 1, t, r); this._edFlood(x, y - 1, t, r);
    },
    _edDraw() {
        const c = document.getElementById('mks-canvas');
        if (!c) return;
        const ctx = c.getContext('2d');
        ctx.clearRect(0, 0, CANVAS_PX, CANVAS_PX);
        for (let y = 0; y < GRID; y++) for (let x = 0; x < GRID; x++) {
            if (this._ed.pixels[y][x]) { ctx.fillStyle = this._ed.pixels[y][x]; ctx.fillRect(x * CELL, y * CELL, CELL, CELL); }
        }
        ctx.strokeStyle = 'rgba(255,255,255,.08)'; ctx.lineWidth = .5;
        for (let i = 0; i <= GRID; i++) { ctx.beginPath(); ctx.moveTo(i * CELL, 0); ctx.lineTo(i * CELL, CANVAS_PX); ctx.stroke(); ctx.beginPath(); ctx.moveTo(0, i * CELL); ctx.lineTo(CANVAS_PX, i * CELL); ctx.stroke(); }
        // Preview
        const p = document.getElementById('mks-preview');
        if (p) {
            p.width = 64; p.height = 64;
            const pc = p.getContext('2d'); pc.clearRect(0, 0, 64, 64);
            const s = 64 / GRID;
            for (let y = 0; y < GRID; y++) for (let x = 0; x < GRID; x++) {
                if (this._ed.pixels[y][x]) { pc.fillStyle = this._ed.pixels[y][x]; pc.fillRect(Math.floor(x * s), Math.floor(y * s), Math.ceil(s), Math.ceil(s)); }
            }
        }
    },
    edSetTool(t, btn) {
        this._ed.tool = t;
        document.querySelectorAll('#mks-editor-area .tool-btn').forEach(b => b.classList.toggle('active', b.dataset.tool === t));
    },
    edClear() {
        this._ed.pixels = Array.from({ length: GRID }, () => Array(GRID).fill(null));
        this._edDraw();
        this._currentDraftId = null;
    },
    _renderEdPalette() {
        const p = document.getElementById('mks-palette');
        if (!p) return;
        p.innerHTML = '';
        this._edPalette.forEach(h => {
            const s = document.createElement('div');
            s.className = 'pal-swatch' + (h === this._ed.color ? ' active' : '');
            s.style.background = h;
            s.onclick = () => {
                this._ed.color = h;
                p.querySelectorAll('.pal-swatch').forEach(x => x.classList.remove('active'));
                s.classList.add('active');
            };
            p.appendChild(s);
        });
    },

    // ── 줌 ──
    edZoom(delta) {
        this._ed.zoom = Math.max(1, Math.min(4, this._ed.zoom + delta));
        const c = document.getElementById('mks-canvas');
        const wrap = document.getElementById('mks-canvas-wrap');
        if (c) {
            c.style.transform = `scale(${this._ed.zoom})`;
            c.style.transformOrigin = '0 0';
        }
        if (wrap) {
            wrap.style.width = (240 * this._ed.zoom) + 'px';
            wrap.style.height = (240 * this._ed.zoom) + 'px';
        }
        const label = document.getElementById('mks-zoom-label');
        if (label) label.textContent = this._ed.zoom + 'x';
    },

    // ── 임시저장 (DB) ──
    _scheduleDraftSave() {
        clearTimeout(this._draftTimer);
        this._draftTimer = setTimeout(() => this._saveDraftToDB(), 5000);
    },
    async _saveDraftToDB() {
        if (!DB.userId) return;
        const hasPixels = this._ed.pixels && this._ed.pixels.some(r => r.some(c => c !== null));
        if (!hasPixels) return;
        try {
            const row = {
                user_id: DB.userId,
                item_type: this._selectedType || 'hat',
                name: document.getElementById('mks-name')?.value || '',
                description: document.getElementById('mks-desc')?.value || '',
                proposed_price: parseInt(document.getElementById('mks-price')?.value) || 50,
                pixel_data: this._ed.pixels,
                icon: this._selectedEmoji || null,
                updated_at: new Date().toISOString(),
            };
            if (this._currentDraftId) {
                await supabase.from('item_drafts').update(row).eq('id', this._currentDraftId);
            } else {
                const { data } = await supabase.from('item_drafts').insert(row).select('id').single();
                if (data) this._currentDraftId = data.id;
            }
        } catch (e) { /* ignore */ }
    },
    async _saveDraftNow() {
        if (!DB.userId) { alert('로그인이 필요합니다.'); return; }
        clearTimeout(this._draftTimer);
        await this._saveDraftToDB();
        alert('임시저장 완료!');
    },
    async _openDraftDashboard() {
        if (!DB.userId) { alert('로그인이 필요합니다.'); return; }
        const { data } = await supabase
            .from('item_drafts')
            .select('*')
            .eq('user_id', DB.userId)
            .order('updated_at', { ascending: false });
        this._renderDraftDashboard(data || []);
    },
    _renderDraftDashboard(drafts) {
        const overlay = document.createElement('div');
        overlay.className = 'mks-draft-overlay';
        overlay.id = 'mks-draft-overlay';
        let cardsHtml = '';
        if (!drafts.length) {
            cardsHtml = '<div class="mks-draft-empty">저장된 작품이 없습니다.</div>';
        } else {
            drafts.forEach(d => {
                const typeLabel = {hat:'🎩 모자', pet:'🐾 펫', character:'🧑 캐릭터', effect:'✨ 효과', title:'🏷️ 타이틀', skin:'🎨 스킨'}[d.item_type] || d.item_type;
                const name = d.name || '(이름 없음)';
                const date = new Date(d.updated_at).toLocaleDateString('ko-KR', {month:'short', day:'numeric', hour:'2-digit', minute:'2-digit'});
                cardsHtml += `
                    <div class="mks-draft-card" data-draft-id="${d.id}">
                        <canvas class="mks-draft-preview" width="64" height="64" data-pixels='${JSON.stringify(d.pixel_data)}'></canvas>
                        <div class="mks-draft-info">
                            <div class="mks-draft-name">${name}</div>
                            <div class="mks-draft-meta">${typeLabel} · 🪙${d.proposed_price}</div>
                            <div class="mks-draft-date">${date}</div>
                        </div>
                        <div class="mks-draft-actions">
                            <button class="btn sm purple mks-draft-load" data-id="${d.id}">불러오기</button>
                            <button class="btn sm outline mks-draft-del" data-id="${d.id}">🗑️</button>
                        </div>
                    </div>`;
            });
        }
        overlay.innerHTML = `
            <div class="mks-draft-panel">
                <div class="mks-draft-header">
                    <span style="font-size:.95rem;font-weight:800;">📂 내 임시저장 작품</span>
                    <button class="btn sm outline" onclick="document.getElementById('mks-draft-overlay')?.remove()">✕ 닫기</button>
                </div>
                <div class="mks-draft-list">${cardsHtml}</div>
            </div>`;
        document.body.appendChild(overlay);

        // Draw pixel previews
        overlay.querySelectorAll('.mks-draft-preview').forEach(cvs => {
            try {
                const pd = JSON.parse(cvs.dataset.pixels || 'null');
                if (!pd) return;
                const ctx = cvs.getContext('2d');
                const s = 64 / GRID;
                for (let y = 0; y < GRID; y++) for (let x = 0; x < GRID; x++) {
                    if (pd[y] && pd[y][x]) { ctx.fillStyle = pd[y][x]; ctx.fillRect(Math.floor(x*s), Math.floor(y*s), Math.ceil(s), Math.ceil(s)); }
                }
            } catch(e) {}
        });

        // Load handlers
        overlay.querySelectorAll('.mks-draft-load').forEach(btn => {
            btn.onclick = () => {
                const id = parseInt(btn.dataset.id);
                const draft = drafts.find(d => d.id === id);
                if (draft) { this._applyDraft(draft); overlay.remove(); }
            };
        });
        // Delete handlers
        overlay.querySelectorAll('.mks-draft-del').forEach(btn => {
            btn.onclick = async () => {
                const id = parseInt(btn.dataset.id);
                if (!confirm('이 작품을 삭제하시겠습니까?')) return;
                await supabase.from('item_drafts').delete().eq('id', id);
                btn.closest('.mks-draft-card')?.remove();
                if (this._currentDraftId === id) this._currentDraftId = null;
                if (!overlay.querySelector('.mks-draft-card')) {
                    overlay.querySelector('.mks-draft-list').innerHTML = '<div class="mks-draft-empty">저장된 작품이 없습니다.</div>';
                }
            };
        });
    },
    _applyDraft(d) {
        if (d.pixel_data && Array.isArray(d.pixel_data)) {
            this._ed.pixels = d.pixel_data.map(r => [...r]);
        }
        if (d.item_type) {
            this._selectedType = d.item_type;
            document.querySelectorAll('.mks-type-btn').forEach(b => {
                b.classList.toggle('active', b.dataset.type === d.item_type);
            });
            if (d.item_type === 'pet') {
                const petBtn = document.querySelector('.mks-type-btn[data-type="pet"]');
                if (petBtn) this.selectType('pet', petBtn);
                if (d.icon) {
                    this._selectedEmoji = d.icon;
                    setTimeout(() => {
                        const emojiBtn = [...document.querySelectorAll('.mks-emoji-btn')].find(b => b.textContent === d.icon);
                        if (emojiBtn) emojiBtn.classList.add('active');
                    }, 50);
                }
            }
        }
        const nameEl = document.getElementById('mks-name');
        const descEl = document.getElementById('mks-desc');
        const priceEl = document.getElementById('mks-price');
        if (nameEl) nameEl.value = d.name || '';
        if (descEl) descEl.value = d.description || '';
        if (priceEl) priceEl.value = d.proposed_price || 50;
        this._currentDraftId = d.id;
        this._edDraw();
    },

    // ── 등록 실행 ──
    async doSubmit() {
        const type = this._selectedType;
        const name = document.getElementById('mks-name')?.value?.trim();
        const desc = document.getElementById('mks-desc')?.value?.trim();
        const price = parseInt(document.getElementById('mks-price')?.value) || 0;

        if (!name) { alert('아이템 이름을 입력해주세요.'); return; }
        if (price < 1) { alert('가격은 1코인 이상이어야 합니다.'); return; }

        const hasPixels = this._ed.pixels.some(row => row.some(c => c !== null));
        if (!hasPixels) { alert('도트 아트를 그려주세요!'); return; }

        const params = { type, name, desc, price, pixelData: this._ed.pixels };

        if (type === 'pet') {
            if (!this._selectedEmoji) { alert('펫 이모지를 선택해주세요!'); return; }
            params.emoji = this._selectedEmoji;
        }

        const ok = await this.submitItem(params);
        if (ok) {
            if (this._currentDraftId) {
                supabase.from('item_drafts').delete().eq('id', this._currentDraftId).then(() => {});
                this._currentDraftId = null;
            }
            this.renderMySubmissions();
        }
    },

    // ── 내 등록 현황 렌더 ──
    async renderMySubmissions() {
        await this.loadMySubmissions();
        const inner = document.getElementById('market-submit-inner');
        if (!inner) return;

        if (!this.mySubmissions.length) {
            this.renderSubmitScreen();
            return;
        }

        let html = `
            <div class="mks-section">
                <div class="mks-title">📋 내 등록 현황</div>
                <div class="mks-list">
        `;
        this.mySubmissions.forEach(s => {
            const statusLabel = s.status === 'pending' ? '⏳ 심사 중' :
                s.status === 'approved' ? '✅ 승인됨' : '❌ 거절됨';
            const statusClass = s.status;
            const priceInfo = s.status === 'approved' && s.final_price
                ? `최종가: 🪙${s.final_price}` : `희망가: 🪙${s.proposed_price}`;
            const rejectInfo = s.status === 'rejected' && s.reject_reason
                ? `<div class="mks-reject-reason">사유: ${s.reject_reason}</div>` : '';
            let preview = '';
            if (s.pixel_data) {
                preview = `<canvas class="mks-item-preview" data-pixels='${JSON.stringify(s.pixel_data)}' width="48" height="48"></canvas>`;
            } else {
                preview = `<span class="mks-item-icon">${s.icon || '🎨'}</span>`;
            }
            html += `
                <div class="mks-item-card ${statusClass}">
                    ${preview}
                    <div class="mks-item-info">
                        <div class="mks-item-name">${s.name}</div>
                        <div class="mks-item-meta">${s.item_type} · ${priceInfo}</div>
                        ${rejectInfo}
                    </div>
                    <div class="mks-item-status ${statusClass}">${statusLabel}</div>
                </div>
            `;
        });
        html += `</div></div>
            <button class="btn big purple" onclick="Marketplace.renderSubmitScreen()" style="width:100%;margin-top:.5rem">➕ 새 아이템 등록</button>
        `;
        inner.innerHTML = html;

        // Render pixel previews
        inner.querySelectorAll('.mks-item-preview').forEach(cvs => {
            const pd = JSON.parse(cvs.dataset.pixels);
            const ctx = cvs.getContext('2d');
            const sz = 48, s = sz / GRID;
            for (let y = 0; y < GRID; y++) for (let x = 0; x < GRID; x++) {
                if (pd[y] && pd[y][x]) { ctx.fillStyle = pd[y][x]; ctx.fillRect(Math.floor(x * s), Math.floor(y * s), Math.ceil(s), Math.ceil(s)); }
            }
        });
    },

    // ── si_ 아이템 정보 조회 (inventory, player에서 사용) ──
    getItemInfo(itemId) {
        return this.approvedItems.find(i => i.id === itemId) || null;
    },
};

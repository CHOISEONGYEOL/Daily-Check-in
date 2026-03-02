import { Player } from './player.js';
import { LS } from './storage.js';
import { CharRender } from './char-render.js';
import { PixelCodec } from './pixel-codec.js';

let Nav = null;
export function setNav(n) { Nav = n; }

export const Auction = {
    currentTab: 'register',
    bidState: LS.get('auctionBid', null), // {code, name, price, seller, myBid, pixels}

    _selectedCharIdx: -1,

    render() {
        Player.refreshUI();
        const inner = document.getElementById('auction-inner');
        if (!inner) return;
        // Update tab active states
        document.querySelectorAll('.auction-tab').forEach(t =>
            t.classList.toggle('active', t.dataset.tab === this.currentTab));
        if (this.currentTab === 'register') this._renderRegister(inner);
        else if (this.currentTab === 'char-register') this._renderCharRegister(inner);
        else if (this.currentTab === 'buy') this._renderBuy(inner);
        else if (this.currentTab === 'gallery') this._renderGallery(inner);
    },

    switchTab(btn, tab) {
        this.currentTab = tab;
        document.querySelectorAll('.auction-tab').forEach(t => t.classList.remove('active'));
        btn.classList.add('active');
        this.render();
    },

    // ─── 등록 탭 ───
    _renderRegister(el) {
        const hasPixels = Player.pixels && Player.pixels.some(r => r.some(c => c));
        el.innerHTML = `
            <div class="auction-form">
                <div class="tool-title">🎨 등록할 작품</div>
                <div class="auction-source-row">
                    <button class="btn sm ${hasPixels ? 'purple' : 'outline'}" onclick="Auction._setRegSource('current')" id="reg-src-current">현재 캐릭터</button>
                    <button class="btn sm outline" onclick="Auction._setRegSource('draw')" id="reg-src-draw">새로 그리기</button>
                </div>
                <div id="reg-preview-wrap" style="display:flex;justify-content:center;margin:.8rem 0">
                    <canvas id="reg-preview" width="128" height="128" style="image-rendering:pixelated;border-radius:10px;border:2px solid var(--glass-b);background:#111;"></canvas>
                </div>
                <label class="auction-label">작품 이름
                    <input type="text" id="reg-name" maxlength="20" placeholder="예: 귀여운 고양이" class="auction-input">
                </label>
                <label class="auction-label">시작 가격 (코인)
                    <input type="number" id="reg-price" min="1" max="99999" value="50" class="auction-input">
                </label>
                <label class="auction-label">등록자 이름
                    <input type="text" id="reg-seller" maxlength="12" placeholder="이름 / 별명" class="auction-input">
                </label>
                <button class="btn big purple" onclick="Auction._doRegister()" style="margin-top:.8rem;width:100%">📋 코드 생성</button>
                <div id="reg-code-result" style="margin-top:.8rem"></div>
            </div>`;
        this._regSource = 'current';
        if (hasPixels) {
            setTimeout(() => CharRender.toCanvas('reg-preview', 128), 0);
        }
    },

    _regSource: 'current',
    _setRegSource(src) {
        this._regSource = src;
        document.getElementById('reg-src-current').className = 'btn sm ' + (src === 'current' ? 'purple' : 'outline');
        document.getElementById('reg-src-draw').className = 'btn sm ' + (src === 'draw' ? 'purple' : 'outline');
        if (src === 'draw') {
            Nav.go('editor');
        } else {
            CharRender.toCanvas('reg-preview', 128);
        }
    },

    _doRegister() {
        const name = document.getElementById('reg-name').value.trim();
        const price = parseInt(document.getElementById('reg-price').value) || 0;
        const seller = document.getElementById('reg-seller').value.trim();
        if (!name) { alert('작품 이름을 입력하세요!'); return; }
        if (price < 1) { alert('가격은 1코인 이상이어야 합니다!'); return; }
        if (!seller) { alert('등록자 이름을 입력하세요!'); return; }
        if (!Player.pixels || !Player.pixels.some(r => r.some(c => c))) {
            alert('먼저 캐릭터를 만들어주세요!'); return;
        }
        const code = PixelCodec.encode({ pixels: Player.pixels, name, price, seller });
        const resultEl = document.getElementById('reg-code-result');
        resultEl.innerHTML = `
            <div class="tool-title">📋 공유 코드 (프로젝터에 띄워주세요!)</div>
            <div class="auction-code-box" id="auction-code-text">${code}</div>
            <button class="btn sm purple" onclick="Auction._copyCode()" style="margin-top:.5rem">📋 코드 복사</button>
            <div id="copy-msg" style="font-size:.7rem;color:var(--green);margin-top:.3rem"></div>
        `;
    },

    _copyCode() {
        const text = document.getElementById('auction-code-text').textContent;
        navigator.clipboard.writeText(text).then(() => {
            document.getElementById('copy-msg').textContent = '복사 완료!';
        }).catch(() => {
            // Fallback: select text
            const range = document.createRange();
            range.selectNodeContents(document.getElementById('auction-code-text'));
            window.getSelection().removeAllRanges();
            window.getSelection().addRange(range);
            document.getElementById('copy-msg').textContent = '텍스트를 선택했습니다. Ctrl+C로 복사하세요.';
        });
    },

    // ─── 캐릭터 등록 탭 ───
    _renderCharRegister(el) {
        const chars = Player.characters.filter(c => c.pixels && c.pixels.some(r => r.some(v => v)));
        if (!chars.length) {
            el.innerHTML = '<div style="text-align:center;padding:2rem;color:rgba(255,255,255,.3)"><div style="font-size:3rem;margin-bottom:.5rem">👤</div><p>판매할 캐릭터가 없습니다</p><p style="font-size:.75rem;margin-top:.3rem">먼저 에디터에서 캐릭터를 만들어주세요!</p></div>';
            return;
        }
        if (Player.characters.length <= 1) {
            el.innerHTML = '<div style="text-align:center;padding:2rem;color:rgba(255,255,255,.3)"><div style="font-size:3rem;margin-bottom:.5rem">⚠️</div><p>캐릭터가 1개뿐이라 판매할 수 없습니다</p><p style="font-size:.75rem;margin-top:.3rem">최소 1개의 캐릭터는 보유해야 합니다!</p></div>';
            return;
        }
        el.innerHTML = `
            <div class="auction-form">
                <div class="tool-title">👤 판매할 캐릭터 선택</div>
                <div class="char-pick-grid" id="char-pick-grid"></div>
                <div id="char-reg-preview-wrap" style="display:flex;justify-content:center;margin:.5rem 0">
                    <canvas id="char-reg-preview" width="128" height="128" style="image-rendering:pixelated;border-radius:10px;border:2px solid var(--glass-b);background:#111;"></canvas>
                </div>
                <label class="auction-label">등록 제목
                    <input type="text" id="char-reg-name" maxlength="20" placeholder="예: 멋진 전사 캐릭터" class="auction-input">
                </label>
                <label class="auction-label">시작 가격 (코인)
                    <input type="number" id="char-reg-price" min="1" max="99999" value="100" class="auction-input">
                </label>
                <label class="auction-label">등록자 이름
                    <input type="text" id="char-reg-seller" maxlength="12" placeholder="이름 / 별명" class="auction-input" value="${Player.nickname || ''}">
                </label>
                <button class="btn big gold" onclick="Auction._doCharRegister()" style="margin-top:.8rem;width:100%">📋 캐릭터 코드 생성</button>
                <div id="char-reg-result" style="margin-top:.8rem"></div>
            </div>`;
        // Render character picker
        const grid = document.getElementById('char-pick-grid');
        Player.characters.forEach((ch, i) => {
            if (!ch.pixels || !ch.pixels.some(r => r.some(v => v))) return;
            const wrap = document.createElement('div');
            wrap.className = 'char-pick-item' + (i === this._selectedCharIdx ? ' selected' : '');
            const cvs = CharRender.toTinyCanvas(ch.pixels, 48);
            wrap.appendChild(cvs);
            const name = document.createElement('div');
            name.className = 'char-pick-name';
            name.textContent = ch.name || `캐릭터 ${i + 1}`;
            wrap.appendChild(name);
            wrap.onclick = () => this._selectRegChar(i);
            grid.appendChild(wrap);
        });
        // Show preview of selected character
        if (this._selectedCharIdx >= 0 && Player.characters[this._selectedCharIdx]?.pixels) {
            setTimeout(() => {
                const cvs = document.getElementById('char-reg-preview');
                if (!cvs) return;
                const px = Player.characters[this._selectedCharIdx].pixels;
                const ctx = cvs.getContext('2d'), cell = 128 / 32;
                ctx.clearRect(0, 0, 128, 128);
                for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
                    if (px[y] && px[y][x]) {
                        ctx.fillStyle = px[y][x];
                        ctx.fillRect(Math.floor(x * cell), Math.floor(y * cell), Math.ceil(cell), Math.ceil(cell));
                    }
                }
            }, 0);
        }
    },

    _selectRegChar(idx) {
        this._selectedCharIdx = idx;
        this.render();
    },

    _doCharRegister() {
        const idx = this._selectedCharIdx;
        if (idx < 0 || !Player.characters[idx]?.pixels) { alert('판매할 캐릭터를 선택하세요!'); return; }
        const name = document.getElementById('char-reg-name').value.trim();
        const price = parseInt(document.getElementById('char-reg-price').value) || 0;
        const seller = document.getElementById('char-reg-seller').value.trim();
        if (!name) { alert('등록 제목을 입력하세요!'); return; }
        if (price < 1) { alert('가격은 1코인 이상이어야 합니다!'); return; }
        if (!seller) { alert('등록자 이름을 입력하세요!'); return; }
        const ch = Player.characters[idx];
        const code = PixelCodec.encodeChar({
            pixels: ch.pixels,
            charName: ch.name || `캐릭터 ${idx + 1}`,
            name, price, seller
        });
        const resultEl = document.getElementById('char-reg-result');
        resultEl.innerHTML = `
            <div class="tool-title">📋 공유 코드 (프로젝터에 띄워주세요!)</div>
            <div class="auction-code-box" id="auction-code-text">${code}</div>
            <button class="btn sm purple" onclick="Auction._copyCode()" style="margin-top:.5rem">📋 코드 복사</button>
            <div id="copy-msg" style="font-size:.7rem;color:var(--green);margin-top:.3rem"></div>
            <div class="auction-sale-area">
                <div class="tool-title">경매 완료 후</div>
                <label class="auction-label">낙찰가 (코인)
                    <input type="number" id="char-sale-price" min="0" max="99999" value="${price}" class="auction-input">
                </label>
                <button class="btn big green" onclick="Auction._confirmSale(${idx})" style="width:100%">판매 완료 (캐릭터 삭제 + 코인 수령)</button>
                <button class="btn sm outline" onclick="Auction._selectedCharIdx=-1;Auction.render()" style="width:100%">유찰 (판매 취소)</button>
            </div>`;
    },

    _confirmSale(charIdx) {
        const ch = Player.characters[charIdx];
        if (!ch) { alert('캐릭터를 찾을 수 없습니다!'); return; }
        if (Player.characters.length <= 1) { alert('캐릭터가 1개뿐이라 판매할 수 없습니다!'); return; }
        const salePrice = parseInt(document.getElementById('char-sale-price').value) || 0;
        const charName = ch.name || `캐릭터 ${charIdx + 1}`;
        if (!confirm(`"${charName}"을(를) ${salePrice}코인에 판매하시겠습니까?\n\n⚠️ 캐릭터가 영구 삭제됩니다!`)) return;
        Player.removeCharacter(charIdx);
        if (salePrice > 0) {
            Player.addCoins(salePrice, 'auction_sell');
            Player.save();
        }
        this._selectedCharIdx = -1;
        alert(`"${charName}" 판매 완료! +${salePrice}코인`);
        this.render();
    },

    // ─── 구매 탭 ───
    _renderBuy(el) {
        const bid = this.bidState;
        if (bid && bid.name) {
            // Already have a bid in progress
            this._renderBidView(el, bid);
        } else {
            el.innerHTML = `
                <div class="auction-form">
                    <div class="tool-title">📥 작품 코드 입력</div>
                    <p style="font-size:.75rem;color:rgba(255,255,255,.4);margin-bottom:.5rem">선생님이 보여주는 코드를 입력하세요</p>
                    <textarea id="bid-code-input" class="auction-input auction-textarea" placeholder="코드를 여기에 붙여넣기..." rows="3"></textarea>
                    <button class="btn big teal" onclick="Auction._loadCode()" style="margin-top:.6rem;width:100%">🔍 작품 불러오기</button>
                    <div id="bid-error" style="font-size:.8rem;color:var(--red);margin-top:.4rem"></div>
                </div>`;
        }
    },

    _loadCode() {
        const code = document.getElementById('bid-code-input').value.trim();
        if (!code) { document.getElementById('bid-error').textContent = '코드를 입력하세요!'; return; }
        const result = PixelCodec.decode(code);
        if (!result) { document.getElementById('bid-error').textContent = '잘못된 코드입니다!'; return; }
        this.bidState = { ...result, code, myBid: result.price, isChar: result.type === 'char', charName: result.charName || '' };
        LS.set('auctionBid', this.bidState);
        this.render();
    },

    _renderBidView(el, bid) {
        const canAfford = Player.coins >= bid.myBid;
        const typeBadge = bid.isChar ? '<span class="char-badge">👤 캐릭터</span>' : '';
        const charNameLine = bid.isChar && bid.charName ? `<div style="font-size:.75rem;color:var(--purple-l)">캐릭터명: ${bid.charName}</div>` : '';
        el.innerHTML = `
            <div class="auction-preview-card">
                <canvas id="bid-preview" width="160" height="160" style="image-rendering:pixelated;border-radius:10px;border:2px solid var(--glass-b);background:#111;"></canvas>
                <div class="auction-preview-info">
                    <div style="font-size:1.1rem;font-weight:800">${bid.name}${typeBadge}</div>
                    ${charNameLine}
                    <div style="font-size:.8rem;color:rgba(255,255,255,.4)">판매자: ${bid.seller}</div>
                    <div style="font-size:.85rem;color:var(--yellow);font-weight:700">시작가: 🪙 ${bid.price}</div>
                </div>
            </div>
            <div class="bid-section">
                <div class="tool-title">💰 입찰 금액</div>
                <div class="bid-controls">
                    <button class="btn sm outline" onclick="Auction._adjustBid(-10)">-10</button>
                    <button class="btn sm outline" onclick="Auction._adjustBid(-1)">-1</button>
                    <div class="bid-display" id="bid-amount">${bid.myBid}</div>
                    <button class="btn sm outline" onclick="Auction._adjustBid(1)">+1</button>
                    <button class="btn sm outline" onclick="Auction._adjustBid(10)">+10</button>
                </div>
                <div style="font-size:.7rem;color:rgba(255,255,255,.3);margin-top:.3rem">보유: 🪙 ${Player.coins}</div>
                <button class="btn big pink" onclick="Auction._placeBid()" style="margin-top:.8rem;width:100%" ${canAfford ? '' : 'disabled'}>
                    🏷️ ${canAfford ? '입찰하기!' : '코인 부족'}
                </button>
            </div>
            <div id="bid-result-area"></div>
            <div style="display:flex;gap:.5rem;margin-top:.8rem">
                <button class="btn sm green" onclick="Auction._confirmWin()" id="btn-win" style="flex:1;display:none;background:var(--green)">🎉 낙찰! 구매 확정</button>
                <button class="btn sm outline" onclick="Auction._cancelBid()" style="flex:1">🔄 다른 작품 보기</button>
            </div>`;
        // Render preview
        setTimeout(() => {
            const cvs = document.getElementById('bid-preview');
            if (!cvs || !bid.pixels) return;
            cvs.width = 160; cvs.height = 160;
            const ctx = cvs.getContext('2d'), cell = 160 / 32;
            ctx.clearRect(0, 0, 160, 160);
            for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
                if (bid.pixels[y] && bid.pixels[y][x]) {
                    ctx.fillStyle = bid.pixels[y][x];
                    ctx.fillRect(Math.floor(x * cell), Math.floor(y * cell), Math.ceil(cell), Math.ceil(cell));
                }
            }
        }, 0);
    },

    _adjustBid(delta) {
        if (!this.bidState) return;
        this.bidState.myBid = Math.max(this.bidState.price, this.bidState.myBid + delta);
        LS.set('auctionBid', this.bidState);
        const amtEl = document.getElementById('bid-amount');
        if (amtEl) amtEl.textContent = this.bidState.myBid;
    },

    _placeBid() {
        if (!this.bidState) return;
        if (Player.coins < this.bidState.myBid) { alert('코인이 부족합니다!'); return; }
        // Show bid result prominently
        const area = document.getElementById('bid-result-area');
        if (area) {
            area.innerHTML = `
                <div class="bid-placed-box">
                    <div style="font-size:2rem">🏷️</div>
                    <div style="font-size:1.5rem;font-weight:900;color:var(--yellow)">${this.bidState.myBid} 코인</div>
                    <div style="font-size:.85rem;color:rgba(255,255,255,.5)">입찰 완료! 선생님 발표를 기다리세요</div>
                </div>`;
        }
        // Show win button
        const winBtn = document.getElementById('btn-win');
        if (winBtn) winBtn.style.display = 'block';
    },

    _confirmWin() {
        if (!this.bidState) return;
        const cost = this.bidState.myBid;
        if (Player.coins < cost) { alert('코인이 부족합니다!'); return; }

        if (this.bidState.isChar) {
            // Character auction: add to character slots
            const hasSlot = Player.characters.findIndex(c => !c.pixels) !== -1 || Player.characters.length < Player.MAX_SLOTS;
            if (!hasSlot) {
                alert('빈 캐릭터 슬롯이 없습니다!\n슬롯을 추가하거나 기존 캐릭터를 판매하세요.');
                return;
            }
            Player.addCoins(-cost, 'auction_buy');
            const charData = {
                name: this.bidState.charName || this.bidState.name,
                pixels: this.bidState.pixels.map(r => [...r]),
                equipped: {}
            };
            Player.addCharacter(charData);
            this.bidState = null;
            LS.set('auctionBid', null);
            alert(`🎉 낙찰! "${charData.name}" 캐릭터를 ${cost}코인에 구매했습니다!\n캐릭터 슬롯에 추가되었습니다.`);
            this.currentTab = 'gallery';
            this.render();
        } else {
            // Artwork auction: add to gallery
            Player.addCoins(-cost, 'auction_buy');
            Player.auctionGallery.push({
                name: this.bidState.name,
                seller: this.bidState.seller,
                price: cost,
                pixels: this.bidState.pixels,
                date: new Date().toLocaleDateString('ko-KR')
            });
            Player.save();
            this.bidState = null;
            LS.set('auctionBid', null);
            alert(`🎉 낙찰! "${Player.auctionGallery[Player.auctionGallery.length - 1].name}" 작품을 ${cost}코인에 구매했습니다!`);
            this.currentTab = 'gallery';
            this.render();
        }
    },

    _cancelBid() {
        this.bidState = null;
        LS.set('auctionBid', null);
        this.render();
    },

    // ─── 갤러리 탭 ───
    _renderGallery(el) {
        const gallery = Player.auctionGallery;
        if (!gallery.length) {
            el.innerHTML = '<div style="text-align:center;padding:2rem;color:rgba(255,255,255,.3)"><div style="font-size:3rem;margin-bottom:.5rem">🖼️</div><p>아직 구매한 작품이 없습니다</p><p style="font-size:.75rem;margin-top:.3rem">경매에서 작품을 구매하면 여기에 표시됩니다!</p></div>';
            return;
        }
        let html = '<div class="gallery-grid">';
        gallery.forEach((item, idx) => {
            html += `
                <div class="gallery-card">
                    <canvas id="gal-${idx}" width="96" height="96" style="image-rendering:pixelated;border-radius:8px;background:#111;"></canvas>
                    <div class="gallery-info">
                        <div style="font-weight:700;font-size:.85rem">${item.name}</div>
                        <div style="font-size:.7rem;color:rgba(255,255,255,.4)">by ${item.seller} · 🪙${item.price}</div>
                    </div>
                    <div class="gallery-btns">
                        <button class="btn sm purple" onclick="Auction._useArt(${idx})">🎨 사용</button>
                        <button class="btn sm outline" onclick="Auction._deleteArt(${idx})">🗑️</button>
                    </div>
                </div>`;
        });
        html += '</div>';
        el.innerHTML = html;
        // Render gallery thumbnails
        setTimeout(() => {
            gallery.forEach((item, idx) => {
                const cvs = document.getElementById('gal-' + idx);
                if (!cvs || !item.pixels) return;
                const ctx = cvs.getContext('2d'), cell = 96 / 32;
                for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
                    if (item.pixels[y] && item.pixels[y][x]) {
                        ctx.fillStyle = item.pixels[y][x];
                        ctx.fillRect(Math.floor(x * cell), Math.floor(y * cell), Math.ceil(cell), Math.ceil(cell));
                    }
                }
            });
        }, 0);
    },

    _useArt(idx) {
        const item = Player.auctionGallery[idx];
        if (!item) return;
        Player.pixels = item.pixels.map(r => [...r]);
        Player.save();
        alert(`🎨 "${item.name}" 작품을 캐릭터로 설정했습니다!`);
        CharRender.toCanvas('lobby-preview', 128);
    },

    _deleteArt(idx) {
        if (!confirm('정말 이 작품을 삭제하시겠습니까?')) return;
        Player.auctionGallery.splice(idx, 1);
        Player.save();
        this.render();
    }
};

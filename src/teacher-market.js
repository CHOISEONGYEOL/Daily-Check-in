import { supabase } from './supabase.js';
import { GRID } from './constants.js';

// Forward reference (set from teacher.js via setTeacherMarketMarketplace)
let Marketplace = null;
export function setTeacherMarketMarketplace(m) { Marketplace = m; }

export const TeacherMarket = {
    // ── 판매 요청 로드 + 렌더 ──
    async loadMarketItems() {
        if (!Marketplace) return;
        await Marketplace.loadPending();
        this.renderMarketItems();
    },

    renderMarketItems() {
        if (!Marketplace) return;
        const grid = document.getElementById('teacher-market-grid');
        const count = document.getElementById('t-market-count');
        const items = Marketplace.submissions;
        if (count) count.textContent = `${items.length}건 대기 중`;
        if (!grid) return;

        if (!items.length) {
            grid.innerHTML = '<div class="teacher-empty">대기 중인 판매 요청이 없습니다</div>';
            return;
        }

        grid.innerHTML = '';
        items.forEach(s => {
            const card = document.createElement('div');
            card.className = 'tmr-card';

            let previewHtml;
            if (s.pixel_data) {
                previewHtml = `<div class="tmr-preview tmr-preview-pixel"><canvas class="tmr-pixel-cvs" data-pixels='${JSON.stringify(s.pixel_data)}' width="128" height="128"></canvas></div>`;
            } else {
                previewHtml = `<div class="tmr-preview"><span class="tmr-emoji">${s.icon || '🎨'}</span></div>`;
            }

            const typeLabel = { hat: '모자', pet: '펫', character: '캐릭터', effect: '효과', title: '칭호', skin: '스킨' }[s.item_type] || s.item_type;
            const titleInfo = s.title_text ? ` · "${s.title_text}"` : '';

            card.innerHTML = `
                ${previewHtml}
                <div class="tmr-info">
                    <div class="tmr-name">${s.name}</div>
                    <div class="tmr-meta">${typeLabel}${titleInfo} · by ${s.creator_name}</div>
                    <div class="tmr-desc">${s.description || '(설명 없음)'}</div>
                    <div class="tmr-price-row">
                        <span class="tmr-proposed">희망가: 🪙${s.proposed_price}</span>
                        <span class="tmr-final-label">최종가:</span>
                        <input type="number" class="tmr-price-input" value="${s.proposed_price}" min="1" max="9999" data-id="${s.id}">
                    </div>
                    <div class="tmr-actions">
                        <button class="tmr-approve" onclick="Teacher.approveItem(${s.id}, this)">✅ 승인</button>
                        <button class="tmr-reject" onclick="Teacher.rejectItem(${s.id})">❌ 거절</button>
                    </div>
                </div>
            `;
            grid.appendChild(card);

            // Render pixel preview (128x128 원본 크기)
            const cvs = card.querySelector('.tmr-pixel-cvs');
            if (cvs) {
                const pd = JSON.parse(cvs.dataset.pixels);
                const ctx = cvs.getContext('2d'), sz = 128, sc = sz / GRID;
                for (let y = 0; y < GRID; y++) for (let x = 0; x < GRID; x++) {
                    if (pd[y] && pd[y][x]) { ctx.fillStyle = pd[y][x]; ctx.fillRect(Math.floor(x * sc), Math.floor(y * sc), Math.ceil(sc), Math.ceil(sc)); }
                }
            }
        });
    },

    async approveItem(dbId, btn) {
        if (!Marketplace) return;
        const input = document.querySelector(`.tmr-price-input[data-id="${dbId}"]`);
        const finalPrice = parseInt(input?.value) || 0;
        if (finalPrice < 1) { alert('최종 가격은 1코인 이상이어야 합니다.'); return; }
        if (btn) btn.disabled = true;
        const ok = await Marketplace.approve(dbId, finalPrice);
        if (ok) {
            alert('승인 완료!');
            this.loadMarketItems();
        }
        if (btn) btn.disabled = false;
    },

    async rejectItem(dbId) {
        if (!Marketplace) return;
        const reason = prompt('거절 사유를 입력하세요:');
        if (reason === null) return;
        const ok = await Marketplace.reject(dbId, reason || '사유 없음');
        if (ok) {
            alert('거절 처리 완료');
            this.loadMarketItems();
        }
    },
};

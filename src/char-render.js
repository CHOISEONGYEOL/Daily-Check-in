import { GRID } from './constants.js';
import { Player } from './player.js';

// Forward references (to avoid circular dependency)
let Inventory = null;
export function setInventory(inv) { Inventory = inv; }
let Marketplace = null;
export function setCharRenderMarketplace(m) { Marketplace = m; }

export const CharRender = {
    _pixelHatCache: {},
    toCanvas(id, size) {
        const c = document.getElementById(id); if (!c) return;
        c.width = size; c.height = size;
        const ctx = c.getContext('2d'), px = Player.pixels, cell = size / GRID;
        ctx.clearRect(0, 0, size, size);
        if (!px) { ctx.fillStyle='rgba(255,255,255,.1)'; ctx.beginPath(); ctx.arc(size/2,size*.35,size*.2,0,Math.PI*2); ctx.fill(); ctx.fillRect(size*.35,size*.55,size*.3,size*.3); ctx.fillStyle='rgba(255,255,255,.3)'; ctx.font=`${size*.11}px sans-serif`; ctx.textAlign='center'; ctx.fillText('캐릭터를 만드세요!',size/2,size*.92); return; }
        for (let y=0;y<GRID;y++) for (let x=0;x<GRID;x++) if(px[y]&&px[y][x]){ctx.fillStyle=px[y][x];ctx.fillRect(Math.floor(x*cell),Math.floor(y*cell),Math.ceil(cell),Math.ceil(cell));}
    },
    toOffscreen(pxData, size) {
        const c = document.createElement('canvas'); c.width = size; c.height = size;
        if (!pxData) return c;
        const ctx = c.getContext('2d'), cell = size / GRID;
        for (let y=0;y<GRID;y++) for (let x=0;x<GRID;x++) if(pxData[y]&&pxData[y][x]){ctx.fillStyle=pxData[y][x];ctx.fillRect(Math.floor(x*cell),Math.floor(y*cell),Math.ceil(cell),Math.ceil(cell));}
        return c;
    },
    toTinyCanvas(pxData, s) { return this.toOffscreen(pxData, s); },
    renderHat(ctx, hatId, cx, cy, fontSize){
        if(!hatId) return;
        // 학생 제작 픽셀 모자 (si_ prefix)
        if(hatId.startsWith('si_')){
            const item = Marketplace && Marketplace.getItemInfo(hatId);
            if(!item || !item.pixelData) return;
            const key = hatId + '_' + Math.round(fontSize);
            if(!this._pixelHatCache[key]){
                this._pixelHatCache[key] = this.toOffscreen(item.pixelData, Math.round(fontSize));
            }
            const img = this._pixelHatCache[key];
            ctx.drawImage(img, cx - img.width/2, cy - img.height/2);
            return;
        }
        if(!Inventory || !Inventory.HAT_EMOJI[hatId]) return;
        ctx.save();
        ctx.font=`${fontSize}px sans-serif`; ctx.textAlign='center'; ctx.textBaseline='middle';
        ctx.fillText(Inventory.HAT_EMOJI[hatId], cx, cy);
        ctx.restore();
    },
    toCanvasWithHat(id, size){
        this.toCanvas(id, size);
        const hatId = Player.equipped.hat;
        if(!hatId) return;
        const c = document.getElementById(id); if(!c) return;
        const ctx = c.getContext('2d');
        this.renderHat(ctx, hatId, size/2, size*0.12, size*0.3);
    }
};

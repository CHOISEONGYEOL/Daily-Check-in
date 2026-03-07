export const GamePhysics = {
    applyPhysics(){
        if(!this.player) return;
        const all = [this.player, ...(this.npcs || [])];
        all.forEach(e=>{
            if(!e) return;
            if(e.enteredDoor) return;
            if(e.dead && !this.ghostMode) return;
            // ★ 원격 플레이어는 물리 스킵 (위치를 네트워크에서 받음)
            if(e.isRemote) return;
            // Gravity
            e.vy += this.GRAVITY;
            if(e.vy > 14) e.vy = 14;
            e.x += e.vx;
            e.y += e.vy;
            // World boundaries
            e.x = Math.max(e.w/2, Math.min(this.W - e.w/2, e.x));
            // Fall off bottom → respawn
            if(e.y > this.H + 50){
                this.killEntity(e);
            }
            // Platform collision
            this.checkPlatforms(e);
            // Bridge collision (only if visible)
            (this.bridges || []).forEach(br=>{
                if(!br.visible) return;
                if(e.vy >= 0 &&
                   e.x+e.w/2 > br.x && e.x-e.w/2 < br.x+br.w &&
                   e.y+e.h >= br.y && e.y+e.h <= br.y+br.h+e.vy+2){
                    e.y = br.y - e.h;
                    e.vy = 0;
                    e.onGround = true;
                    e.jumpCount = 0;
                }
            });
            // Elevator collision
            (this.elevators || []).forEach(elev=>{
                if(e.vy >= 0 &&
                   e.x+e.w/2 > elev.x && e.x-e.w/2 < elev.x+elev.w &&
                   e.y+e.h >= elev.y && e.y+e.h <= elev.y+elev.h+e.vy+2){
                    e.y = elev.y - e.h;
                    e.vy = 0;
                    e.onGround = true;
                    e.jumpCount = 0;
                }
            });
        });
    },

    checkPlatforms(e){
        e.onGround = false;
        for(const p of this.platforms){
            // Wall type: horizontal collision
            if(p.type === 'wall'){
                if(e.x+e.w/2 > p.x && e.x-e.w/2 < p.x+p.w &&
                   e.y+e.h > p.y && e.y < p.y+p.h){
                    // Push out horizontally
                    const fromLeft = (e.x + e.w/2) - p.x;
                    const fromRight = (p.x + p.w) - (e.x - e.w/2);
                    if(fromLeft < fromRight){
                        e.x = p.x - e.w/2;
                    } else {
                        e.x = p.x + p.w + e.w/2;
                    }
                    e.vx = 0;
                }
                continue;
            }
            // Standard platform: top collision only
            if(e.vy >= 0 &&
               e.x+e.w/2 > p.x && e.x-e.w/2 < p.x+p.w &&
               e.y+e.h >= p.y && e.y+e.h <= p.y+p.h+e.vy+2){
                e.y = p.y - e.h;
                e.vy = 0;
                e.onGround = true;
                e.jumpCount = 0;
                return;
            }
        }
    },

    // ── Entity-to-Entity collision (Pico Park stacking!) ──
    // 30명 밀집 최적화: 수평 겹침 허용, 수직 스태킹 간소화, 반복 상한
    resolveEntityCollisions(){
        if(!this.player) return;
        const all = [this.player, ...(this.npcs || [])].filter(e=>e && !e.enteredDoor && (!e.dead || this.ghostMode));
        const len = all.length;
        // 반복 상한: 최대 2패스 (무한 루프 방지)
        const MAX_PASSES = 2;
        for(let pass = 0; pass < MAX_PASSES; pass++){
            let resolved = 0;
            for(let i=0;i<len;i++){
                for(let j=i+1;j<len;j++){
                    const a=all[i], b=all[j];
                    const aL=a.x-a.w/2, aR=a.x+a.w/2, aT=a.y, aB=a.y+a.h;
                    const bL=b.x-b.w/2, bR=b.x+b.w/2, bT=b.y, bB=b.y+b.h;
                    if(aR<=bL||aL>=bR||aB<=bT||aT>=bB) continue;
                    const overlapX = Math.min(aR-bL, bR-aL);
                    const overlapY = Math.min(aB-bT, bB-aT);
                    if(overlapY < overlapX){
                        // ── 수직 충돌: 머리 위에 안착 (단순 Y 고정) ──
                        if(aB - bT < bB - aT){
                            if(a.vy >= 0){
                                a.y = b.y - a.h;
                                a.vy = 0;
                                a.onGround = true;
                                a.jumpCount = 0;
                                resolved++;
                            }
                        } else {
                            if(b.vy >= 0){
                                b.y = a.y - b.h;
                                b.vy = 0;
                                b.onGround = true;
                                b.jumpCount = 0;
                                resolved++;
                            }
                        }
                    } else if(overlapX > 4){
                        // ── 수평 충돌: 4px 이하 겹침은 허용 (밀집 시 튕김 방지) ──
                        // 초과분만 부드럽게 밀어냄 (25% 씩, 속도 감속 완화)
                        const push = (overlapX - 4) * 0.25;
                        if(a.x < b.x){ a.x -= push; b.x += push; }
                        else { a.x += push; b.x -= push; }
                        a.vx *= 0.7; b.vx *= 0.7;
                    }
                    // overlapX <= 4: 무시 (겹침 허용)
                }
            }
            // 충돌이 없었으면 추가 패스 불필요
            if(resolved === 0) break;
        }
    },
};

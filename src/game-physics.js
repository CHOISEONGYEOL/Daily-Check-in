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
    resolveEntityCollisions(){
        if(!this.player) return;
        const all = [this.player, ...(this.npcs || [])].filter(e=>e && !e.enteredDoor && (!e.dead || this.ghostMode));
        const len = all.length;
        for(let i=0;i<len;i++){
            for(let j=i+1;j<len;j++){
                const a=all[i], b=all[j];
                const aL=a.x-a.w/2, aR=a.x+a.w/2, aT=a.y, aB=a.y+a.h;
                const bL=b.x-b.w/2, bR=b.x+b.w/2, bT=b.y, bB=b.y+b.h;
                if(aR<=bL||aL>=bR||aB<=bT||aT>=bB) continue;
                const overlapX = Math.min(aR-bL, bR-aL);
                const overlapY = Math.min(aB-bT, bB-aT);
                if(overlapY < overlapX){
                    if(aB - bT < bB - aT){
                        // A lands on B's head
                        if(a.vy >= 0){
                            a.y = bT - a.h;
                            a.vy = 0;
                            a.onGround = true;
                            a.jumpCount = 0;
                        }
                    } else {
                        // B lands on A's head
                        if(b.vy >= 0){
                            b.y = aT - b.h;
                            b.vy = 0;
                            b.onGround = true;
                            b.jumpCount = 0;
                        }
                    }
                } else {
                    const half = overlapX / 2;
                    if(a.x < b.x){ a.x -= half; b.x += half; }
                    else { a.x += half; b.x -= half; }
                    a.vx *= 0.3; b.vx *= 0.3;
                }
            }
        }
    },
};

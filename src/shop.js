import { Player } from './player.js';
import { CharRender } from './char-render.js';
import { CANVAS_PX } from './constants.js';
import { esc } from './sanitize.js';
import { ShopData } from './shop-data.js';
import { ShopFitting, setFittingMarketplace } from './shop-fitting.js';

// Forward references (set from main.js to avoid circular dep)
let Inventory = null;
export function setShopInventory(inv) { Inventory = inv; }
let Marketplace = null;
export function setShopMarketplace(m) { Marketplace = m; setFittingMarketplace(m); }

export const Shop = {
    currentTab:'colors',
    DEPRECIATION: 0.7, // 70% of original price on resale

    // ── Color Editor (mini editor) state ──
    ce: {
        active: false,
        tool: 'pen',
        color: '#6C5CE7',
        trialColor: null,   // color being previewed from shop
        trialId: null,
        pixels: null,        // copy of Player.pixels
        origPixels: null,    // backup for reset
        drawing: false,
    },
    defaultPalette:['#2D3436','#636E72','#B2BEC3','#DFE6E9','#FFFFFF','#D63031','#E17055','#FDCB6E','#FFEAA7','#00B894','#00CEC9','#0984E3','#6C5CE7','#A29BFE','#FD79A8','#E84393','#74B9FF','#FAB1A0','#855E42','#A0522D'],

    render(){
        const g=document.getElementById('shop-grid');g.innerHTML='';document.getElementById('S-coins').textContent=Player.coins;
        // Auto-start idle loop when rendering shop (not for colors tab)
        if(this.currentTab!=='colors' && !this.fitting.idleRunning) this.startIdleLoop();

        // ── 학생 작품 탭 ──
        if(this.currentTab==='student'){
            this._renderStudentTab(g);
            return;
        }

        (this.allItems[this.currentTab]||[]).forEach(item=>{
            const isTitle = this.currentTab==='titles';
            const isConsumable = item.consumable;
            const owned = isConsumable ? false : Player.owned.includes(item.id);
            const ownCount = isConsumable ? Player.owned.filter(x=>x===item.id).length : 0;
            const can = Player.coins>=item.price && !owned;
            const isEq = (this.currentTab==='hats'&&Player.equipped.hat===item.id) ||
                         (this.currentTab==='effects'&&Player.equipped.effect===item.id) ||
                         (this.currentTab==='pets'&&Player.equipped.pet===item.id) ||
                         (isTitle && Player.activeTitle===item.titleText);
            const d=document.createElement('div');d.className='shop-card'+(owned?' owned':'');
            let btnHtml='';
            if(isConsumable){
                btnHtml=`<button class="btn-buy" ${can?'':'disabled'} onclick="Shop.buy('${item.id}',${item.price})">${can?'구매':'코인 부족'}</button>`;
                if(ownCount>0) btnHtml=`<div style="font-size:.72rem;color:var(--green);margin-bottom:.3rem">보유: ${ownCount}장</div>`+btnHtml;
            } else if(this.currentTab==='colors'){
                // Colors tab: trial button + buy
                if(owned){
                    btnHtml=`<div style="font-size:.68rem;color:var(--green)">✅ 팔레트에 추가됨</div>`;
                } else {
                    btnHtml=`<button class="btn-try" ${can?'':'disabled'} onclick="Shop.ceTrialColor('${item.id}')">${can?'🎨 사용해보기':'코인 부족'}</button>`;
                }
            } else if(owned){
                if(isTitle) btnHtml=`<button class="btn-buy" onclick="Shop.equipTitle('${item.titleText}')">${isEq?'해제':'장착'}</button>`;
                else btnHtml=`<button class="btn-buy" onclick="Shop.equip('${item.id}','${this.currentTab}')">${isEq?'해제':'장착'}</button>`;
            } else {
                btnHtml=`<button class="btn-try" ${can?'':'disabled'} onclick="Shop.openFitting('${item.id}','${this.currentTab}')">${can?'착용해보기':'코인 부족'}</button>`;
            }
            const sellPrice = owned && !isConsumable ? Math.floor(item.price * this.DEPRECIATION) : 0;
            const priceText = owned && !isConsumable ? `보유 중 <span style="font-size:.65rem;color:rgba(255,150,150,.6)">(판매가: ${sellPrice})</span>` : '🪙 '+item.price;
            d.innerHTML=`<div class="shop-icon">${esc(item.icon)}</div><div class="shop-name">${esc(item.name)}</div><div style="font-size:.72rem;color:rgba(255,255,255,.4)">${esc(item.desc)}</div><div class="shop-price">${priceText}</div>${btnHtml}`;
            g.appendChild(d);
        });
    },

    // ── 학생 작품 탭 렌더링 ──
    _renderStudentTab(g){
        if(!Marketplace) return;
        const items = Marketplace.approvedItems;

        // 헤더: 내 작품 판매하기 버튼
        const header = document.createElement('div');
        header.style.cssText = 'grid-column:1/-1;display:flex;justify-content:space-between;align-items:center;margin-bottom:.2rem';
        header.innerHTML = `
            <span style="font-size:.82rem;color:rgba(255,255,255,.5)">${items.length}개의 학생 작품</span>
            <button class="btn sm purple" onclick="Nav.go('marketplace-submit');Marketplace.renderMySubmissions()">🎨 내 작품 판매하기</button>
        `;
        g.appendChild(header);

        if(!items.length){
            const empty = document.createElement('div');
            empty.style.cssText = 'grid-column:1/-1;text-align:center;color:rgba(255,255,255,.3);padding:2rem;font-size:.9rem';
            empty.textContent = '아직 등록된 학생 작품이 없습니다.';
            g.appendChild(empty);
            return;
        }

        items.forEach(item => {
            const owned = Player.owned.includes(item.id);
            const can = Player.coins >= item.price && !owned;
            const isMine = item.creatorId === (window.DB && window.DB.userId);
            const d = document.createElement('div');
            d.className = 'shop-card' + (owned ? ' owned' : '');

            let iconHtml;
            if(item.pixelData){
                const cvs = CharRender.toTinyCanvas(item.pixelData, 48);
                cvs.style.cssText = 'image-rendering:pixelated;border-radius:4px;border:1px solid rgba(255,255,255,.1);width:48px;height:48px;';
                iconHtml = cvs.outerHTML;
            } else {
                iconHtml = `<div class="shop-icon">${item.icon}</div>`;
            }

            let btnHtml;
            if(isMine) btnHtml = `<div style="font-size:.68rem;color:var(--yellow)">내 작품</div>`;
            else if(owned) btnHtml = `<div style="font-size:.68rem;color:var(--green)">✅ 보유 중</div>`;
            else btnHtml = `<button class="btn-buy" ${can?'':'disabled'} onclick="Shop.buyStudentItem('${item.id}')">${can?'구매':'코인 부족'}</button>`;

            d.innerHTML = `${iconHtml}<div class="shop-name">${esc(item.name)}</div><div style="font-size:.72rem;color:rgba(255,255,255,.4)">${esc(item.desc)}</div><div class="shop-creator">by ${esc(item.creator)}</div><div class="shop-price">🪙 ${item.price}</div>${item.salesCount>0?`<div class="shop-sales">${item.salesCount}명 구매</div>`:''}${btnHtml}`;
            g.appendChild(d);
        });
    },

    // ── 학생 아이템 구매 ──
    async buyStudentItem(itemId){
        if(!Marketplace) return;
        if(!confirm('이 아이템을 구매하시겠습니까?')) return;
        const ok = await Marketplace.buyStudentItem(itemId);
        if(ok){ alert('구매 완료!'); this.render(); }
    },

    // ── Fitting Room Methods ──
    openFitting(itemId, tab){
        const item = Object.values(this.allItems).flat().find(i=>i.id===itemId);
        if(!item) return;
        if(Player.coins < item.price) return;
        if(!item.consumable && Player.owned.includes(itemId)) return;

        const f = this.fitting;
        f.active = true;
        f.itemId = itemId;
        f.item = item;
        f.tab = tab;
        f.particles = [];

        // Refresh sprite in case character changed
        f.player.sprite = CharRender.toOffscreen(Player.pixels, 32);

        // Update UI
        const el = document.getElementById('fitting-room');
        el.classList.add('active');
        document.getElementById('fitting-info').textContent = `${item.icon} ${item.name}`;
        document.getElementById('fitting-price').textContent = `🪙 ${item.price} 코인`;
        const sellPrice = Math.floor(item.price * this.DEPRECIATION);
        document.getElementById('fitting-depreciation').textContent = `📉 환불 시 ${sellPrice}코인 (원가의 ${Math.round(this.DEPRECIATION*100)}%)`;
        const buyBtn = document.getElementById('fitting-buy');
        buyBtn.textContent = `🛒 구입 (${item.price}코인)`;
        buyBtn.classList.remove('hidden');
    },

    closeFitting(){
        this.clearFittingItem();
    },

    buyFromFitting(){
        const f = this.fitting;
        if(!f.active || !f.item) return;
        const item = f.item;
        this.buy(item.id, item.price);
        this.clearFittingItem();
    },

    fittingUpdate(){
        const f = this.fitting;
        const p = f.player;
        if(!p) return;

        // Movement
        if(f.keys['ArrowLeft']||f.keys['a']||f.keys['A']){ p.vx = -f.MOVE_SPD; p.dir = -1; }
        else if(f.keys['ArrowRight']||f.keys['d']||f.keys['D']){ p.vx = f.MOVE_SPD; p.dir = 1; }
        else p.vx *= 0.7;
        if(Math.abs(p.vx)<0.2) p.vx=0;

        // Jump
        if((f.keys['ArrowUp']||f.keys['w']||f.keys['W']||f.keys[' ']) && p.onGround){
            p.vy = f.JUMP_FORCE;
            p.onGround = false;
            p.jumpCount = 1;
        }
        // Double jump
        if((f.keys['ArrowUp']||f.keys['w']||f.keys['W']||f.keys[' ']) && !p.onGround && p.jumpCount===1 && p.vy>0){
            p.vy = f.JUMP_FORCE*0.85;
            p.jumpCount = 2;
            f.keys['ArrowUp']=false; f.keys['w']=false; f.keys['W']=false; f.keys[' ']=false;
        }

        // Gravity
        p.vy += f.GRAVITY;
        if(p.vy > 20) p.vy = 20;
        p.x += p.vx;
        p.y += p.vy;

        // Wrap
        if(p.x < -5) p.x = f.W + 5;
        if(p.x > f.W + 5) p.x = -5;

        // Platform collision
        p.onGround = false;
        for(const plat of f.platforms){
            if(p.x+p.w/2 > plat.x && p.x-p.w/2 < plat.x+plat.w){
                if(p.vy >= 0 && p.y+p.h >= plat.y && p.y+p.h <= plat.y+plat.h+p.vy+2){
                    p.y = plat.y - p.h;
                    p.vy = 0;
                    p.onGround = true;
                    p.jumpCount = 0;
                }
            }
        }

        // Effect particles — type-specific spawning
        if(f.tab === 'effects' && Inventory){
            const effId = f.itemId;
            const colors = Inventory.EFFECT_COLORS[effId];
            if(colors){
                const isMoving = Math.abs(p.vx)>0.5;
                const chance = isMoving ? 0.45 : 0.08;
                if(Math.random() < chance){
                    const c = colors[Math.floor(Math.random()*colors.length)];
                    const base = {x:p.x+(Math.random()-.5)*32, y:p.y+p.h/2+Math.random()*20};
                    if(effId==='e_sparkle'){
                        f.particles.push({...base,vx:-p.vx*0.2+(Math.random()-.5)*3,vy:-Math.random()*3-1,color:c,size:16+Math.random()*12,life:30+Math.random()*25,maxLife:55,type:'sparkle'});
                    } else if(effId==='e_heart'){
                        f.particles.push({x:p.x+(Math.random()-.5)*40,y:p.y+Math.random()*20,vx:(Math.random()-.5)*1.5,vy:-Math.random()*3-1,color:c,size:12+Math.random()*10,life:45+Math.random()*25,maxLife:70,type:'heart'});
                    } else if(effId==='e_fire'){
                        f.particles.push({x:p.x+(Math.random()-.5)*28,y:p.y+p.h+Math.random()*10,vx:(Math.random()-.5)*2.4,vy:-Math.random()*5-2,color:c,size:14+Math.random()*10,life:22+Math.random()*18,maxLife:40,type:'fire'});
                    } else if(effId==='e_dragon'){
                        // 용의 숨결: 넓은 범위 + 거대 화염 + 연기
                        for(let i=0;i<2;i++){
                            f.particles.push({x:p.x+(Math.random()-.5)*50,y:p.y+p.h*0.3+Math.random()*30,vx:-p.vx*0.3+(Math.random()-.5)*4,vy:-Math.random()*4-1,color:c,size:18+Math.random()*14,life:28+Math.random()*20,maxLife:48,type:'dragonflame'});
                        }
                        if(Math.random()<0.4) f.particles.push({x:p.x+(Math.random()-.5)*30,y:p.y+p.h*0.5,vx:(Math.random()-.5)*2,vy:-Math.random()*2-1,color:'rgba(80,60,80,0.6)',size:20+Math.random()*10,life:20+Math.random()*15,maxLife:35,type:'smoke'});
                    } else if(effId==='e_bubble'){
                        f.particles.push({...base,vx:(Math.random()-.5)*1.6,vy:-Math.random()*3-.6,color:c,size:14+Math.random()*14,life:45+Math.random()*35,maxLife:80,type:'bubble'});
                    } else if(effId==='e_leaf'||effId==='e_petal'){
                        f.particles.push({...base,vx:(Math.random()-.5)*4,vy:-Math.random()+1,color:c,size:14+Math.random()*10,life:40+Math.random()*30,maxLife:70,type:effId==='e_petal'?'petal':'leaf'});
                    } else if(effId==='e_snow'){
                        f.particles.push({x:p.x+(Math.random()-.5)*60,y:p.y-10,vx:(Math.random()-.5)*1.2,vy:Math.random()*1.6+.6,color:c,size:10+Math.random()*8,life:50+Math.random()*35,maxLife:85,type:'snow'});
                    } else if(effId==='e_star'){
                        f.particles.push({...base,vx:(Math.random()-.5)*5,vy:-Math.random()*6-2,color:c,size:16+Math.random()*10,life:25+Math.random()*20,maxLife:45,type:'sparkle'});
                    } else if(effId==='e_music'){
                        f.particles.push({x:p.x+(Math.random()-.5)*40,y:p.y,vx:(Math.random()-.5)*3,vy:-Math.random()*4-2,color:c,size:18+Math.random()*10,life:35+Math.random()*25,maxLife:60,type:'music'});
                    } else if(effId==='e_lightning'){
                        for(let i=0;i<2;i++) f.particles.push({x:p.x+(Math.random()-.5)*20,y:p.y+Math.random()*40,vx:(Math.random()-.5)*6,vy:(Math.random()-.5)*6,color:c,size:10+Math.random()*8,life:10+Math.random()*12,maxLife:22,type:'lightning'});
                    } else if(effId==='e_rainbow'){
                        // 무지개 리본 — 긴 잔상
                        const t=Date.now()*0.003;
                        for(let i=0;i<3;i++){
                            const ci=colors[i%colors.length];
                            f.particles.push({x:p.x-p.vx*(2+i*1.5),y:p.y+p.h*0.3+i*5,vx:-p.vx*0.12,vy:0,color:ci,size:22+Math.random()*6,life:60+Math.random()*30,maxLife:90,type:'ribbon',phase:t+i*0.8,baseY:p.y+p.h*0.3+i*5});
                        }
                    } else if(effId==='e_galaxy'){
                        // 은하수 리본 — 긴 잔상
                        const t2=Date.now()*0.002;
                        f.particles.push({x:p.x-p.vx*2,y:p.y+p.h*0.2,vx:-p.vx*0.08,vy:0,color:'#0D0D2B',size:26+Math.random()*6,life:70+Math.random()*30,maxLife:100,type:'galaxyribbon',phase:t2,baseY:p.y+p.h*0.2});
                        if(Math.random()<0.5){
                            f.particles.push({x:p.x-p.vx*2+(Math.random()-.5)*24,y:p.y+p.h*0.2+(Math.random()-.5)*14,vx:-p.vx*0.06+(Math.random()-.5),vy:(Math.random()-.5)*0.5,color:'#FFFFFF',size:4+Math.random()*3,life:35+Math.random()*20,maxLife:55,type:'sparkle'});
                        }
                    } else if(effId==='e_pixel'){
                        f.particles.push({...base,vx:(Math.random()-.5)*6,vy:(Math.random()-.5)*6,color:c,size:12+Math.random()*8,life:20+Math.random()*18,maxLife:38,type:'pixel'});
                    } else if(effId==='e_ghost'){
                        f.particles.push({x:p.x+(Math.random()-.5)*40,y:p.y+Math.random()*30,vx:(Math.random()-.5)*1.6,vy:-Math.random()*2-.6,color:c,size:18+Math.random()*14,life:35+Math.random()*25,maxLife:60,type:'ghost'});
                    }
                }
            }
        }
        // Update particles (cap at 80 to prevent lag — ribbon trails need more)
        if(f.particles.length > 80) f.particles.splice(0, f.particles.length - 80);
        f.particles = f.particles.filter(pt => {
            pt.x += pt.vx; pt.y += pt.vy; pt.vy += 0.05; pt.life--;
            return pt.life > 0;
        });
    },

    fittingRender(){
        const f = this.fitting;
        const cvs = document.getElementById('fitting-canvas');
        if(!cvs) return;
        const ctx = cvs.getContext('2d');
        const W = f.W, H = f.H;

        // Background gradient
        const grad = ctx.createLinearGradient(0,0,0,H);
        grad.addColorStop(0,'#0c0c24');
        grad.addColorStop(0.6,'#1a1a3e');
        grad.addColorStop(1,'#1a3a4a');
        ctx.fillStyle = grad;
        ctx.fillRect(0,0,W,H);

        // Stars
        ctx.fillStyle='rgba(255,255,255,.15)';
        for(let i=0;i<16;i++){
            const sx=(i*67+20)%W, sy=(i*43+10)%(H-80);
            ctx.fillRect(sx,sy,2,2);
        }

        // Platforms
        f.platforms.forEach((p,i) => {
            if(i===0){
                // Ground
                ctx.fillStyle='#4a7c59'; ctx.fillRect(p.x,p.y,p.w,p.h);
                ctx.fillStyle='#6ab04c'; ctx.fillRect(p.x,p.y,p.w,6);
            } else {
                ctx.fillStyle='#795548';
                ctx.beginPath();ctx.roundRect(p.x,p.y,p.w,p.h,6);ctx.fill();
                ctx.fillStyle='#8D6E63';
                ctx.fillRect(p.x+2,p.y,p.w-4,6);
            }
        });

        // Effect particles (behind character) — type-specific rendering
        f.particles.forEach(pt => {
            const alpha = pt.maxLife ? pt.life/pt.maxLife : Math.min(1, pt.life/15);
            ctx.globalAlpha = alpha;
            if(pt.type==='heart'){
                // Canvas-drawn heart (no emoji — much faster)
                ctx.fillStyle=pt.color;const s=pt.size*alpha;
                ctx.save();ctx.translate(pt.x,pt.y);
                ctx.beginPath();
                ctx.moveTo(0,-s*0.4);
                ctx.bezierCurveTo(-s*0.5,-s,  -s,-s*0.4,  0,s*0.5);
                ctx.moveTo(0,-s*0.4);
                ctx.bezierCurveTo(s*0.5,-s,  s,-s*0.4,  0,s*0.5);
                ctx.fill();ctx.restore();
            } else if(pt.type==='sparkle'){
                ctx.fillStyle=pt.color;const s=pt.size*alpha;
                ctx.save();ctx.translate(pt.x,pt.y);ctx.rotate(Date.now()*0.005+pt.x);
                ctx.fillRect(-s/2,-1.5,s,3);ctx.fillRect(-1.5,-s/2,3,s);ctx.restore();
            } else if(pt.type==='fire'){
                ctx.fillStyle=pt.color;const s=pt.size*alpha;
                ctx.beginPath();ctx.arc(pt.x,pt.y,s,0,Math.PI*2);ctx.fill();
            } else if(pt.type==='bubble'){
                const s=pt.size*alpha;
                ctx.strokeStyle=pt.color;ctx.lineWidth=2;ctx.globalAlpha=alpha*0.7;
                ctx.beginPath();ctx.arc(pt.x,pt.y,s,0,Math.PI*2);ctx.stroke();
                ctx.globalAlpha=alpha*0.12;ctx.fillStyle=pt.color;ctx.fill();
                // Highlight
                ctx.globalAlpha=alpha*0.5;ctx.fillStyle='#fff';
                ctx.beginPath();ctx.arc(pt.x-s*0.3,pt.y-s*0.3,s*0.2,0,Math.PI*2);ctx.fill();
            } else if(pt.type==='leaf'){
                ctx.fillStyle=pt.color;ctx.save();ctx.translate(pt.x,pt.y);ctx.rotate(Date.now()*0.003+pt.x);
                ctx.beginPath();ctx.ellipse(0,0,pt.size*alpha,pt.size*alpha*0.45,0,0,Math.PI*2);ctx.fill();ctx.restore();
            } else if(pt.type==='petal'){
                ctx.fillStyle=pt.color;ctx.save();ctx.translate(pt.x,pt.y);ctx.rotate(Date.now()*0.002+pt.y);
                ctx.beginPath();ctx.ellipse(0,0,pt.size*alpha*0.4,pt.size*alpha,0,0,Math.PI*2);ctx.fill();ctx.restore();
            } else if(pt.type==='snow'){
                ctx.fillStyle=pt.color;const s=pt.size*alpha;
                ctx.beginPath();ctx.arc(pt.x,pt.y,s,0,Math.PI*2);ctx.fill();
                // Soft glow
                ctx.globalAlpha=alpha*0.2;ctx.beginPath();ctx.arc(pt.x,pt.y,s*1.8,0,Math.PI*2);ctx.fill();
            } else if(pt.type==='music'){
                // Canvas-drawn note (no emoji — much faster)
                ctx.fillStyle=pt.color;const s=pt.size*alpha;
                ctx.beginPath();ctx.ellipse(pt.x,pt.y,s*0.45,s*0.35,Math.PI*-0.3,0,Math.PI*2);ctx.fill();
                ctx.strokeStyle=pt.color;ctx.lineWidth=2;
                ctx.beginPath();ctx.moveTo(pt.x+s*0.35,pt.y);ctx.lineTo(pt.x+s*0.35,pt.y-s);ctx.stroke();
                // Flag
                ctx.beginPath();ctx.moveTo(pt.x+s*0.35,pt.y-s);ctx.quadraticCurveTo(pt.x+s*0.8,pt.y-s*0.7,pt.x+s*0.35,pt.y-s*0.5);ctx.fill();
            } else if(pt.type==='lightning'){
                ctx.strokeStyle=pt.color;ctx.lineWidth=3;ctx.globalAlpha=alpha;
                const ls=pt.size;
                ctx.beginPath();ctx.moveTo(pt.x,pt.y);
                ctx.lineTo(pt.x+(Math.random()-.5)*ls*3,pt.y+(Math.random()-.5)*ls*3);ctx.stroke();
                ctx.fillStyle=pt.color;ctx.beginPath();ctx.arc(pt.x,pt.y,ls*0.5,0,Math.PI*2);ctx.fill();
            } else if(pt.type==='ribbon'){
                // Flowing rainbow cloth — sine-wave flutter
                const s=pt.size*alpha;
                const t=Date.now()*0.004;
                const waveY=Math.sin(t+pt.phase)*6;
                ctx.fillStyle=pt.color;ctx.globalAlpha=alpha*0.75;
                ctx.save();ctx.translate(pt.x,pt.y+waveY);
                ctx.beginPath();
                // Cloth shape: wide flowing curve
                ctx.moveTo(-s*0.6,-3);
                ctx.quadraticCurveTo(-s*0.2, -6+Math.sin(t+pt.phase+1)*4, s*0.2, -2);
                ctx.quadraticCurveTo(s*0.5, 2+Math.sin(t+pt.phase+2)*3, s*0.6, 0);
                ctx.lineTo(s*0.6, 5);
                ctx.quadraticCurveTo(s*0.3, 3+Math.sin(t+pt.phase+1.5)*3, 0, 6);
                ctx.quadraticCurveTo(-s*0.3, 4+Math.sin(t+pt.phase+0.5)*2, -s*0.6, 3);
                ctx.closePath();ctx.fill();
                // Subtle highlight
                ctx.globalAlpha=alpha*0.3;ctx.fillStyle='#FFFFFF';
                ctx.beginPath();ctx.ellipse(0,-1,s*0.2,2,0,0,Math.PI*2);ctx.fill();
                ctx.restore();
            } else if(pt.type==='galaxyribbon'){
                // Dark galaxy cloth with embedded starlight
                const s2=pt.size*alpha;
                const t3=Date.now()*0.003;
                const waveY2=Math.sin(t3+pt.phase)*5;
                ctx.save();ctx.translate(pt.x,pt.y+waveY2);
                // Dark cloth body
                ctx.fillStyle=pt.color;ctx.globalAlpha=alpha*0.65;
                ctx.beginPath();
                ctx.moveTo(-s2*0.6,-4);
                ctx.quadraticCurveTo(-s2*0.2, -7+Math.sin(t3+pt.phase+1)*5, s2*0.2, -3);
                ctx.quadraticCurveTo(s2*0.5, 1+Math.sin(t3+pt.phase+2)*4, s2*0.7, -1);
                ctx.lineTo(s2*0.7, 5);
                ctx.quadraticCurveTo(s2*0.3, 3+Math.sin(t3+pt.phase+1.5)*3, 0, 7);
                ctx.quadraticCurveTo(-s2*0.3, 5+Math.sin(t3+pt.phase+0.5)*3, -s2*0.6, 4);
                ctx.closePath();ctx.fill();
                // Deep purple glow
                ctx.globalAlpha=alpha*0.3;ctx.fillStyle='#4A0E78';
                ctx.beginPath();ctx.ellipse(0,1,s2*0.35,3.5,0,0,Math.PI*2);ctx.fill();
                // Tiny embedded stars twinkling on cloth
                ctx.globalAlpha=alpha*(0.5+Math.sin(t3*2+pt.phase)*0.3);ctx.fillStyle='#FFFFFF';
                for(let si=0;si<3;si++){
                    const sx=(si-1)*s2*0.3+Math.sin(t3+si*2)*2;
                    const sy=(si%2)*4-2+Math.cos(t3+si*1.5)*1.5;
                    ctx.beginPath();ctx.arc(sx,sy,1+Math.sin(t3*3+si)*0.5,0,Math.PI*2);ctx.fill();
                }
                ctx.restore();
            } else if(pt.type==='dragonflame'){
                // 용의 숨결: 거대한 불꽃 + 내부 밝은 코어
                const s=pt.size*alpha;
                ctx.fillStyle=pt.color;ctx.globalAlpha=alpha*0.7;
                ctx.beginPath();ctx.arc(pt.x,pt.y,s,0,Math.PI*2);ctx.fill();
                // 밝은 코어
                ctx.globalAlpha=alpha*0.5;ctx.fillStyle='#FFF8E0';
                ctx.beginPath();ctx.arc(pt.x,pt.y,s*0.4,0,Math.PI*2);ctx.fill();
                // 외곽 아우라
                ctx.globalAlpha=alpha*0.15;ctx.fillStyle=pt.color;
                ctx.beginPath();ctx.arc(pt.x,pt.y,s*1.6,0,Math.PI*2);ctx.fill();
            } else if(pt.type==='smoke'){
                const s=pt.size*alpha;
                ctx.fillStyle='#3d3d3d';ctx.globalAlpha=alpha*0.25;
                ctx.beginPath();ctx.arc(pt.x,pt.y,s,0,Math.PI*2);ctx.fill();
            } else if(pt.type==='pixel'){
                ctx.fillStyle=pt.color;const s=Math.ceil(pt.size*alpha);
                ctx.fillRect(Math.floor(pt.x),Math.floor(pt.y),s,s);
            } else if(pt.type==='ghost'){
                ctx.fillStyle=pt.color;ctx.globalAlpha=alpha*0.35;const s=pt.size*alpha;
                // Ghost body
                ctx.beginPath();ctx.arc(pt.x,pt.y-s*0.3,s,Math.PI,0);
                ctx.lineTo(pt.x+s,pt.y+s*0.5);ctx.lineTo(pt.x+s*0.5,pt.y+s*0.2);
                ctx.lineTo(pt.x,pt.y+s*0.5);ctx.lineTo(pt.x-s*0.5,pt.y+s*0.2);
                ctx.lineTo(pt.x-s,pt.y+s*0.5);ctx.closePath();ctx.fill();
            } else {
                ctx.fillStyle=pt.color;ctx.beginPath();ctx.arc(pt.x,pt.y,pt.size,0,Math.PI*2);ctx.fill();
            }
        });
        ctx.globalAlpha = 1;

        // Character
        const p = f.player;
        if(p && p.sprite){
            ctx.save();
            if(p.dir===-1){ctx.translate(p.x,0);ctx.scale(-1,1);ctx.drawImage(p.sprite,-32,p.y-32,64,64);}
            else ctx.drawImage(p.sprite,p.x-32,p.y-32,64,64);
            ctx.restore();

            // Hat (trial or existing)
            const hatId = f.tab==='hats' ? f.itemId : Player.equipped.hat;
            if(hatId && Inventory && Inventory.HAT_EMOJI[hatId]){
                ctx.save();
                ctx.font='22px sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle';
                ctx.fillText(Inventory.HAT_EMOJI[hatId], p.x, p.y-32);
                ctx.restore();
            }

            // Title (trial or existing)
            const titleText = (f.tab==='titles' && f.item) ? f.item.titleText : Player.activeTitle;
            if(titleText){
                ctx.fillStyle='rgba(162,155,254,.9)';ctx.font='bold 14px sans-serif';ctx.textAlign='center';
                ctx.fillText(titleText, p.x, p.y+p.h+16);
            }

            // Pet (trial or existing)
            const petId = f.tab==='pets' ? f.itemId : Player.equipped.pet;
            if(petId && Inventory && Inventory.PET_EMOJI[petId]){
                const petX = p.x + (p.dir===-1 ? 30 : -30);
                const petBounce = Math.sin(Date.now()*0.004)*3;
                ctx.font='20px sans-serif';ctx.textAlign='center';
                ctx.fillText(Inventory.PET_EMOJI[petId], petX, p.y+p.h-5+petBounce);
            }

            // Player indicator arrow
            const ay = p.y - 48 + Math.sin(Date.now()*0.005)*3;
            ctx.fillStyle='#FDCB6E';ctx.font='16px sans-serif';ctx.textAlign='center';
            ctx.fillText('▼', p.x, ay);

            // Nickname
            if(Player.nickname){
                ctx.fillStyle='rgba(255,255,255,.7)';ctx.font='bold 14px sans-serif';ctx.textAlign='center';
                ctx.fillText(Player.nickname, p.x, p.y-36);
            }
        }

        // Color preview (for color tab items)
        if(f.tab==='colors' && f.item && f.item.hex){
            ctx.fillStyle=f.item.hex;
            ctx.beginPath();ctx.roundRect(W-52,10,44,44,8);ctx.fill();
            ctx.strokeStyle='rgba(255,255,255,.3)';ctx.lineWidth=2;
            ctx.beginPath();ctx.roundRect(W-52,10,44,44,8);ctx.stroke();
        }
    },

    // ══════════════════════════════════════
    // COLOR EDITOR (mini pixel editor in shop)
    // ══════════════════════════════════════
    ceInit(){
        const ce = this.ce;
        ce.active = true;
        ce.tool = 'pen';
        ce.color = '#6C5CE7';
        ce.trialColor = null;
        ce.trialId = null;
        ce.grid = Player.pixels ? Player.pixels.length : 32;
        ce.cell = CANVAS_PX / ce.grid;
        ce.pixels = Player.pixels ? Player.pixels.map(r=>[...r]) : Array.from({length:ce.grid},()=>Array(ce.grid).fill(null));
        ce.origPixels = ce.pixels.map(r=>[...r]);
        ce.drawing = false;

        const cvs = document.getElementById('color-editor-canvas');
        cvs.width = CANVAS_PX; cvs.height = CANVAS_PX;
        cvs.onpointerdown = e => { ce.drawing=true; this.cePaint(e); };
        cvs.onpointermove = e => { if(ce.drawing) this.cePaint(e); };
        cvs.onpointerup = () => ce.drawing=false;
        cvs.onpointerleave = () => ce.drawing=false;

        this.ceRenderPalette();
        this.ceDraw();
        // Hide buy area
        const buyArea = document.getElementById('ce-buy-area');
        if(buyArea) buyArea.classList.add('hidden');
    },

    cePaint(e){
        const ce = this.ce;
        const cvs = document.getElementById('color-editor-canvas');
        const r = cvs.getBoundingClientRect();
        // Account for object-fit:contain scaling
        const dispW = cvs.clientWidth, dispH = cvs.clientHeight;
        const scale = Math.min(dispW/CANVAS_PX, dispH/CANVAS_PX);
        const offX = (dispW - CANVAS_PX*scale)/2, offY = (dispH - CANVAS_PX*scale)/2;
        const mx = (e.clientX - r.left - offX)/scale, my = (e.clientY - r.top - offY)/scale;
        const x = Math.floor(mx/ce.cell), y = Math.floor(my/ce.cell);
        if(x<0||x>=ce.grid||y<0||y>=ce.grid) return;
        if(ce.tool==='pen') ce.pixels[y][x] = ce.color;
        else if(ce.tool==='eraser') ce.pixels[y][x] = null;
        else if(ce.tool==='fill') this.ceFlood(x,y,ce.pixels[y][x],ce.color);
        this.ceDraw();
    },

    ceFlood(x,y,target,rep){
        const ce = this.ce;
        if(target===rep||x<0||x>=ce.grid||y<0||y>=ce.grid||ce.pixels[y][x]!==target) return;
        ce.pixels[y][x]=rep;
        this.ceFlood(x+1,y,target,rep);this.ceFlood(x-1,y,target,rep);
        this.ceFlood(x,y+1,target,rep);this.ceFlood(x,y-1,target,rep);
    },

    ceDraw(){
        const ce = this.ce;
        const cvs = document.getElementById('color-editor-canvas');
        if(!cvs) return;
        const ctx = cvs.getContext('2d');
        const g = ce.grid, cl = ce.cell;
        ctx.clearRect(0,0,CANVAS_PX,CANVAS_PX);
        for(let y=0;y<g;y++) for(let x=0;x<g;x++) if(ce.pixels[y][x]){
            ctx.fillStyle=ce.pixels[y][x]; ctx.fillRect(x*cl,y*cl,cl,cl);
        }
        // Grid lines
        ctx.strokeStyle='rgba(255,255,255,.08)';ctx.lineWidth=.5;
        for(let i=0;i<=g;i++){ctx.beginPath();ctx.moveTo(i*cl,0);ctx.lineTo(i*cl,CANVAS_PX);ctx.stroke();ctx.beginPath();ctx.moveTo(0,i*cl);ctx.lineTo(CANVAS_PX,i*cl);ctx.stroke();}
        // Preview
        const p=document.getElementById('ce-preview');
        if(p){p.width=64;p.height=64;const pc=p.getContext('2d');pc.clearRect(0,0,64,64);const s=64/g;
        for(let y=0;y<g;y++) for(let x=0;x<g;x++) if(ce.pixels[y][x]){pc.fillStyle=ce.pixels[y][x];pc.fillRect(Math.floor(x*s),Math.floor(y*s),Math.ceil(s),Math.ceil(s));}}
    },

    ceTool(tool, btn){
        this.ce.tool = tool;
        document.querySelectorAll('.ce-tool').forEach(b=>b.classList.remove('active'));
        btn.classList.add('active');
    },

    ceRenderPalette(){
        const pal = document.getElementById('ce-palette');
        if(!pal) return;
        pal.innerHTML = '';
        const ce = this.ce;
        // Owned shop colors
        const owned = this.allItems.colors.filter(c=>Player.owned.includes(c.id)).map(c=>c.hex);
        const all = [...this.defaultPalette, ...owned];
        // Trial color first (if any)
        if(ce.trialColor && !all.includes(ce.trialColor)){
            const s = document.createElement('div');
            s.className = 'pal-swatch trial' + (ce.trialColor===ce.color?' active':'');
            s.style.background = ce.trialColor;
            s.title = '시험용 색상';
            s.onclick = () => { ce.color=ce.trialColor; this.ceRenderPalette(); };
            pal.appendChild(s);
        }
        all.forEach(h => {
            const s = document.createElement('div');
            s.className = 'pal-swatch' + (h===ce.color?' active':'');
            s.style.background = h;
            s.onclick = () => { ce.color=h; this.ceRenderPalette(); };
            pal.appendChild(s);
        });
    },

    /** Called when user clicks a color item in the shop grid while on colors tab */
    ceTrialColor(itemId){
        const item = this.allItems.colors.find(c=>c.id===itemId);
        if(!item) return;
        const ce = this.ce;
        ce.trialColor = item.hex;
        ce.trialId = itemId;
        ce.color = item.hex;
        this.ceRenderPalette();
        // Show buy area
        const area = document.getElementById('ce-buy-area');
        area.classList.remove('hidden');
        document.getElementById('ce-buy-info').textContent = `${item.icon} ${item.name}`;
        document.getElementById('ce-buy-price').textContent = `🪙 ${item.price}`;
        const btn = document.getElementById('ce-buy-btn');
        btn.textContent = `🛒 구입 (${item.price}코인)`;
        btn.disabled = Player.coins < item.price;
    },

    ceBuy(){
        const ce = this.ce;
        if(!ce.trialId) return;
        const item = this.allItems.colors.find(c=>c.id===ce.trialId);
        if(!item || Player.coins < item.price || Player.owned.includes(item.id)) return;
        this.buy(item.id, item.price);
        // Color now owned — move from trial to palette
        ce.trialColor = null;
        ce.trialId = null;
        document.getElementById('ce-buy-area').classList.add('hidden');
        this.ceRenderPalette();
    },

    ceSave(){
        Player.pixels = this.ce.pixels.map(r=>[...r]);
        Player.save();
        // Refresh sprite if fitting room is active
        if(this.fitting.player) this.fitting.player.sprite = CharRender.toOffscreen(Player.pixels, 32);
    },

    ceReset(){
        this.ce.pixels = this.ce.origPixels.map(r=>[...r]);
        this.ceDraw();
    },

    buy(id,p){
        if(Player.coins<p)return;
        const item = Object.values(this.allItems).flat().find(i=>i.id===id);
        if(!item) return;
        if(!item.consumable && Player.owned.includes(id)) return;
        Player.addCoins(-p, 'purchase');
        Player.owned.push(id);
        if(item.titleText) Player.titles.push(item.titleText);
        Player.save(); this.render();
    },
    equip(id,tab){const k=tab==='hats'?'hat':tab==='pets'?'pet':'effect';Player.equipped[k]=Player.equipped[k]===id?null:id;Player.save();this.render();},
    equipTitle(titleText){
        Player.activeTitle = Player.activeTitle===titleText ? null : titleText;
        Player.save(); Player.refreshUI(); this.render();
    },
    useReward(id){
        const idx = Player.owned.indexOf(id);
        if(idx===-1)return false;
        Player.owned.splice(idx,1);
        Player.save(); this.render();
        return true;
    }
};

Object.assign(Shop, ShopData, ShopFitting);

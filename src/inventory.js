import { Player } from './player.js';
import { CharRender } from './char-render.js';
import { Shop } from './shop.js';
// GRID no longer needed — derived from pixel data length

// Forward reference
let Marketplace = null;
export function setInventoryMarketplace(m) { Marketplace = m; }

export const Inventory = {
    currentTab: 'hats',
    // ── Fitting Room State ──
    fit: {
        running: false,
        player: null,
        animRef: null,
        keys: {},
        particles: [],
        platforms: [
            {x:0, y:680, w:600, h:100},
            {x:30, y:520, w:160, h:14},
            {x:220, y:420, w:160, h:14},
            {x:420, y:520, w:160, h:14},
        ],
        W: 600, H: 780,
        GRAVITY: 0.8, JUMP_FORCE: -14, MOVE_SPD: 5,
    },
    _fitKeyDown: null,
    _fitKeyUp: null,
    HAT_EMOJI: {
        h_cap:'🧢',h_ribbon:'🎀',h_flower:'🌸',h_leaf:'🍀',h_mushroom:'🍄',h_cherry2:'🍒',
        h_star:'⭐',h_moon:'🌙',h_sun:'☀️',h_rainbow:'🌈',h_cloud:'☁️',h_snowflake:'❄️',
        h_fire2:'🔥',h_lightning:'⚡',h_heart:'❤️',
        h_crown:'👑',h_tiara:'👸',h_halo:'😇',h_devil:'😈',
        h_cat:'🐱',h_bunny:'🐰',h_bear:'🐻',h_fox:'🦊',h_unicorn:'🦄',h_dragon2:'🐉',
        h_galaxy2:'🌌',h_diamond2:'💎',h_phoenix:'🔶',h_sakura:'🌺',h_alien:'👽'
    },
    EFFECT_COLORS: {
        e_sparkle:['#FFD700','#FFF9C4','#E0E0E0'],
        e_heart:['#FD79A8','#FF6B81','#FFB8C6'],
        e_fire:['#FF4500','#FF8C00','#FFD700'],
        e_bubble:['#87CEEB','#B0E0E6','#E0F7FA'],
        e_leaf:['#4CAF50','#8BC34A','#A5D6A7'],
        e_snow:['#FFFFFF','#E3F2FD','#BBDEFB'],
        e_star:['#FFD700','#FFA500','#FFEB3B'],
        e_music:['#E040FB','#7C4DFF','#536DFE'],
        e_lightning:['#FFEB3B','#00E5FF','#FFFFFF'],
        e_rainbow:['#FF0000','#FF8C00','#FFEB3B','#00E676','#2979FF','#7C4DFF'],
        e_petal:['#FFB7C5','#FF8FAB','#FFC0CB'],
        e_aurora:['#00E676','#00BCD4','#7C4DFF','#E040FB'],
        e_galaxy:['#7C4DFF','#536DFE','#E040FB','#FF4081'],
        e_pixel:['#00E676','#76FF03','#B2FF59'],
        e_ghost:['#B0BEC5','#78909C','#455A64'],
        e_dragon:['#FF4500','#FF8C00','#FFD700','#FF1744']
    },
    EFFECT_EMOJI: {
        e_sparkle:'✨',e_heart:'💖',e_fire:'🔥',
        e_bubble:'🫧',e_leaf:'🍃',e_snow:'❄️',
        e_star:'⭐',e_music:'🎵',e_lightning:'⚡',
        e_rainbow:'🌈',e_petal:'🌸',
        e_aurora:'🌌',e_galaxy:'🔮',e_pixel:'🟩',
        e_ghost:'👻',e_dragon:'🐉'
    },
    PET_EMOJI: {
        p_dog:'🐶',p_cat:'🐱',p_hamster:'🐹',p_rabbit:'🐰',p_bird:'🐦',
        p_turtle:'🐢',p_fish:'🐟',p_bee:'🐝',p_ladybug:'🐞',p_butterfly:'🦋',
        p_panda:'🐼',p_koala:'🐨',p_fox:'🦊',p_raccoon:'🦝',p_penguin:'🐧',
        p_chick:'🐥',p_unicorn:'🦄',p_pig:'🐷',p_frog:'🐸',p_hedgehog:'🦔',
        p_lion:'🦁',p_tiger:'🐯',p_bear:'🐻',p_eagle:'🦅',p_wolf:'🐺',
        p_shark:'🦈',p_croc:'🐊',p_elephant:'🐘',p_flamingo:'🦩',p_parrot:'🦜',
        p_dragon:'🐉',p_bat:'🦇',p_dragon2:'🐲',p_scorpion:'🦂',p_spider:'🕷️',
        p_octopus:'🐙',p_squid:'🦑',p_snake:'🐍',p_lizard:'🦎',p_pawprint:'🐾',
        p_alien:'👾',p_robot:'🤖',p_ufo:'🛸',p_star:'🌟',p_skull:'💀',
        p_ghost:'👻',p_pumpkin:'🎃',p_tooth:'🦷',p_teddy:'🧸',p_matryoshka:'🪆',
    },

    // ── Fitting Room: start / stop / update / render ──
    startFitting(){
        const f = this.fit;
        if(f.running) return;
        f.running = true;
        f.particles = [];
        const sprite = CharRender.toOffscreen(Player.pixels, 32);
        f.player = {x:f.W/2, y:f.H-160, vx:0, vy:0, dir:1, onGround:false, sprite, w:32, h:48, jumpCount:0};
        f.keys = {};
        this._fitKeyDown = e => { f.keys[e.key]=true; };
        this._fitKeyUp = e => { f.keys[e.key]=false; };
        window.addEventListener('keydown', this._fitKeyDown);
        window.addEventListener('keyup', this._fitKeyUp);
        const loop = () => {
            if(!f.running) return;
            this._fitUpdate(); this._fitRender();
            f.animRef = requestAnimationFrame(loop);
        };
        f.animRef = requestAnimationFrame(loop);
    },
    stopFitting(){
        const f = this.fit;
        f.running = false;
        if(f.animRef) cancelAnimationFrame(f.animRef);
        f.animRef = null;
        if(this._fitKeyDown) window.removeEventListener('keydown', this._fitKeyDown);
        if(this._fitKeyUp) window.removeEventListener('keyup', this._fitKeyUp);
        this._fitKeyDown = null; this._fitKeyUp = null;
        f.keys = {};
    },
    refreshFittingSprite(){
        const f = this.fit;
        if(f.player) f.player.sprite = CharRender.toOffscreen(Player.pixels, 32);
    },
    _fitUpdate(){
        const f = this.fit, p = f.player;
        if(!p) return;
        if(f.keys['ArrowLeft']||f.keys['a']||f.keys['A']){p.vx=-f.MOVE_SPD;p.dir=-1;}
        else if(f.keys['ArrowRight']||f.keys['d']||f.keys['D']){p.vx=f.MOVE_SPD;p.dir=1;}
        else p.vx*=0.7;
        if(Math.abs(p.vx)<0.2) p.vx=0;
        if((f.keys['ArrowUp']||f.keys['w']||f.keys['W']||f.keys[' '])&&p.onGround){p.vy=f.JUMP_FORCE;p.onGround=false;p.jumpCount=1;}
        if((f.keys['ArrowUp']||f.keys['w']||f.keys['W']||f.keys[' '])&&!p.onGround&&p.jumpCount===1&&p.vy>0){p.vy=f.JUMP_FORCE*0.85;p.jumpCount=2;f.keys['ArrowUp']=false;f.keys['w']=false;f.keys['W']=false;f.keys[' ']=false;}
        p.vy+=f.GRAVITY; if(p.vy>20)p.vy=20;
        p.x+=p.vx; p.y+=p.vy;
        if(p.x<-5)p.x=f.W+5; if(p.x>f.W+5)p.x=-5;
        p.onGround=false;
        for(const pl of f.platforms){
            if(p.x+p.w/2>pl.x&&p.x-p.w/2<pl.x+pl.w&&p.vy>=0&&p.y+p.h>=pl.y&&p.y+p.h<=pl.y+pl.h+p.vy+2){
                p.y=pl.y-p.h;p.vy=0;p.onGround=true;p.jumpCount=0;
            }
        }
        // Effect particles
        const effId = Player.equipped.effect;
        const colors = this.EFFECT_COLORS[effId];
        if(colors){
            const moving = Math.abs(p.vx)>0.5;
            if(Math.random()<(moving?0.45:0.08)){
                const c=colors[Math.floor(Math.random()*colors.length)];
                const base={x:p.x+(Math.random()-.5)*32, y:p.y+p.h/2+Math.random()*20};
                if(effId==='e_sparkle') f.particles.push({...base,vx:(Math.random()-.5)*3,vy:-Math.random()*3-1,color:c,size:14+Math.random()*10,life:30+Math.random()*25,maxLife:55,type:'sparkle'});
                else if(effId==='e_heart') f.particles.push({x:p.x+(Math.random()-.5)*40,y:p.y+Math.random()*20,vx:(Math.random()-.5)*1.5,vy:-Math.random()*3-1,color:c,size:12+Math.random()*10,life:45+Math.random()*25,maxLife:70,type:'heart'});
                else if(effId==='e_fire'||effId==='e_dragon') f.particles.push({x:p.x+(Math.random()-.5)*28,y:p.y+p.h+Math.random()*10,vx:(Math.random()-.5)*2.4,vy:-Math.random()*5-2,color:c,size:14+Math.random()*10,life:22+Math.random()*18,maxLife:40,type:'fire'});
                else if(effId==='e_bubble') f.particles.push({...base,vx:(Math.random()-.5)*1.6,vy:-Math.random()*3-.6,color:c,size:14+Math.random()*14,life:45+Math.random()*35,maxLife:80,type:'bubble'});
                else if(effId==='e_leaf'||effId==='e_petal') f.particles.push({...base,vx:(Math.random()-.5)*4,vy:-Math.random()+1,color:c,size:14+Math.random()*10,life:40+Math.random()*30,maxLife:70,type:effId==='e_petal'?'petal':'leaf'});
                else if(effId==='e_snow') f.particles.push({x:p.x+(Math.random()-.5)*60,y:p.y-10,vx:(Math.random()-.5)*1.2,vy:Math.random()*1.6+.6,color:c,size:10+Math.random()*8,life:50+Math.random()*35,maxLife:85,type:'snow'});
                else if(effId==='e_star') f.particles.push({...base,vx:(Math.random()-.5)*5,vy:-Math.random()*6-2,color:c,size:16+Math.random()*10,life:25+Math.random()*20,maxLife:45,type:'sparkle'});
                else if(effId==='e_music') f.particles.push({x:p.x+(Math.random()-.5)*40,y:p.y,vx:(Math.random()-.5)*3,vy:-Math.random()*4-2,color:c,size:16+Math.random()*10,life:35+Math.random()*25,maxLife:60,type:'music'});
                else if(effId==='e_lightning') f.particles.push({x:p.x+(Math.random()-.5)*20,y:p.y+Math.random()*40,vx:(Math.random()-.5)*6,vy:(Math.random()-.5)*6,color:c,size:10+Math.random()*8,life:10+Math.random()*12,maxLife:22,type:'lightning'});
                else if(effId==='e_rainbow'){const t=Date.now()*0.003;for(let i=0;i<3;i++){f.particles.push({x:p.x-p.vx*(2+i*1.5),y:p.y+p.h*0.3+i*5,vx:-p.vx*0.12,vy:0,color:colors[i%colors.length],size:20+Math.random()*6,life:60+Math.random()*30,maxLife:90,type:'ribbon',phase:t+i*0.8,baseY:p.y+p.h*0.3+i*5});}}
                else if(effId==='e_galaxy'){const t2=Date.now()*0.002;f.particles.push({x:p.x-p.vx*2,y:p.y+p.h*0.2,vx:-p.vx*0.08,vy:0,color:'#0D0D2B',size:24+Math.random()*6,life:70+Math.random()*30,maxLife:100,type:'galaxyribbon',phase:t2,baseY:p.y+p.h*0.2});}
                else if(effId==='e_pixel') f.particles.push({...base,vx:(Math.random()-.5)*6,vy:(Math.random()-.5)*6,color:c,size:12+Math.random()*8,life:20+Math.random()*18,maxLife:38,type:'pixel'});
                else if(effId==='e_ghost') f.particles.push({x:p.x+(Math.random()-.5)*40,y:p.y+Math.random()*30,vx:(Math.random()-.5)*1.6,vy:-Math.random()*2-.6,color:c,size:18+Math.random()*14,life:35+Math.random()*25,maxLife:60,type:'ghost'});
                else if(effId==='e_aurora') f.particles.push({...base,vx:(Math.random()-.5)*.8,vy:-Math.random()*1.2-.4,color:c,size:16+Math.random()*12,life:40+Math.random()*30,maxLife:70,type:'aurora'});
            }
        }
        if(f.particles.length>120) f.particles.splice(0,f.particles.length-120);
        f.particles=f.particles.filter(pt=>{pt.x+=pt.vx;pt.y+=pt.vy;pt.vy+=0.05;pt.life--;return pt.life>0;});
    },
    _fitRender(){
        const f=this.fit;
        const cvs=document.getElementById('inv-fitting-canvas');
        if(!cvs) return;
        const ctx=cvs.getContext('2d');
        const W=f.W, H=f.H;
        // Background
        const grad=ctx.createLinearGradient(0,0,0,H);
        grad.addColorStop(0,'#0c0c24');grad.addColorStop(0.6,'#1a1a3e');grad.addColorStop(1,'#1a3a4a');
        ctx.fillStyle=grad;ctx.fillRect(0,0,W,H);
        // Stars
        ctx.fillStyle='rgba(255,255,255,.15)';
        for(let i=0;i<12;i++){const sx=(i*67+20)%W,sy=(i*43+10)%(H-60);ctx.fillRect(sx,sy,2,2);}
        // Platforms
        f.platforms.forEach((pl,i)=>{
            if(i===0){ctx.fillStyle='#4a7c59';ctx.fillRect(pl.x,pl.y,pl.w,pl.h);ctx.fillStyle='#6ab04c';ctx.fillRect(pl.x,pl.y,pl.w,6);}
            else{ctx.fillStyle='#795548';ctx.beginPath();ctx.roundRect(pl.x,pl.y,pl.w,pl.h,6);ctx.fill();ctx.fillStyle='#8D6E63';ctx.fillRect(pl.x+2,pl.y,pl.w-4,4);}
        });
        // Particles
        f.particles.forEach(pt=>{
            const alpha=pt.maxLife?pt.life/pt.maxLife:Math.min(1,pt.life/15);
            ctx.globalAlpha=alpha;
            if(pt.type==='heart'){ctx.fillStyle=pt.color;const s=pt.size*alpha;ctx.save();ctx.translate(pt.x,pt.y);ctx.beginPath();ctx.moveTo(0,-s*0.4);ctx.bezierCurveTo(-s*0.5,-s,-s,-s*0.4,0,s*0.5);ctx.moveTo(0,-s*0.4);ctx.bezierCurveTo(s*0.5,-s,s,-s*0.4,0,s*0.5);ctx.fill();ctx.restore();}
            else if(pt.type==='sparkle'){ctx.fillStyle=pt.color;const s=pt.size*alpha;ctx.save();ctx.translate(pt.x,pt.y);ctx.rotate(Date.now()*0.005+pt.x);ctx.fillRect(-s/2,-1.5,s,3);ctx.fillRect(-1.5,-s/2,3,s);ctx.restore();}
            else if(pt.type==='fire'){ctx.fillStyle=pt.color;const s=pt.size*alpha;ctx.beginPath();ctx.arc(pt.x,pt.y,s,0,Math.PI*2);ctx.fill();}
            else if(pt.type==='bubble'){const s=pt.size*alpha;ctx.strokeStyle=pt.color;ctx.lineWidth=2;ctx.globalAlpha=alpha*0.7;ctx.beginPath();ctx.arc(pt.x,pt.y,s,0,Math.PI*2);ctx.stroke();ctx.globalAlpha=alpha*0.12;ctx.fillStyle=pt.color;ctx.fill();}
            else if(pt.type==='leaf'){ctx.fillStyle=pt.color;ctx.save();ctx.translate(pt.x,pt.y);ctx.rotate(Date.now()*0.003+pt.x);ctx.beginPath();ctx.ellipse(0,0,pt.size*alpha,pt.size*alpha*0.45,0,0,Math.PI*2);ctx.fill();ctx.restore();}
            else if(pt.type==='petal'){ctx.fillStyle=pt.color;ctx.save();ctx.translate(pt.x,pt.y);ctx.rotate(Date.now()*0.002+pt.y);ctx.beginPath();ctx.ellipse(0,0,pt.size*alpha*0.4,pt.size*alpha,0,0,Math.PI*2);ctx.fill();ctx.restore();}
            else if(pt.type==='snow'){ctx.fillStyle=pt.color;const s=pt.size*alpha;ctx.beginPath();ctx.arc(pt.x,pt.y,s,0,Math.PI*2);ctx.fill();}
            else if(pt.type==='music'){ctx.fillStyle=pt.color;const s=pt.size*alpha;ctx.beginPath();ctx.ellipse(pt.x,pt.y,s*0.45,s*0.35,Math.PI*-0.3,0,Math.PI*2);ctx.fill();ctx.strokeStyle=pt.color;ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(pt.x+s*0.35,pt.y);ctx.lineTo(pt.x+s*0.35,pt.y-s);ctx.stroke();ctx.beginPath();ctx.moveTo(pt.x+s*0.35,pt.y-s);ctx.quadraticCurveTo(pt.x+s*0.8,pt.y-s*0.7,pt.x+s*0.35,pt.y-s*0.5);ctx.fill();}
            else if(pt.type==='lightning'){ctx.strokeStyle=pt.color;ctx.lineWidth=3;const ls=pt.size;ctx.beginPath();ctx.moveTo(pt.x,pt.y);ctx.lineTo(pt.x+(Math.random()-.5)*ls*3,pt.y+(Math.random()-.5)*ls*3);ctx.stroke();ctx.fillStyle=pt.color;ctx.beginPath();ctx.arc(pt.x,pt.y,ls*0.5,0,Math.PI*2);ctx.fill();}
            else if(pt.type==='ribbon'){const s=pt.size*alpha,t=Date.now()*0.004,wy=Math.sin(t+pt.phase)*6;ctx.fillStyle=pt.color;ctx.globalAlpha=alpha*0.75;ctx.save();ctx.translate(pt.x,pt.y+wy);ctx.beginPath();ctx.moveTo(-s*0.6,-3);ctx.quadraticCurveTo(-s*0.2,-6+Math.sin(t+pt.phase+1)*4,s*0.2,-2);ctx.quadraticCurveTo(s*0.5,2+Math.sin(t+pt.phase+2)*3,s*0.6,0);ctx.lineTo(s*0.6,5);ctx.quadraticCurveTo(s*0.3,3+Math.sin(t+pt.phase+1.5)*3,0,6);ctx.quadraticCurveTo(-s*0.3,4+Math.sin(t+pt.phase+0.5)*2,-s*0.6,3);ctx.closePath();ctx.fill();ctx.restore();}
            else if(pt.type==='galaxyribbon'){const s2=pt.size*alpha,t3=Date.now()*0.003,wy2=Math.sin(t3+pt.phase)*5;ctx.save();ctx.translate(pt.x,pt.y+wy2);ctx.fillStyle=pt.color;ctx.globalAlpha=alpha*0.65;ctx.beginPath();ctx.moveTo(-s2*0.6,-4);ctx.quadraticCurveTo(-s2*0.2,-7+Math.sin(t3+pt.phase+1)*5,s2*0.2,-3);ctx.quadraticCurveTo(s2*0.5,1+Math.sin(t3+pt.phase+2)*4,s2*0.7,-1);ctx.lineTo(s2*0.7,5);ctx.quadraticCurveTo(s2*0.3,3+Math.sin(t3+pt.phase+1.5)*3,0,7);ctx.quadraticCurveTo(-s2*0.3,5+Math.sin(t3+pt.phase+0.5)*3,-s2*0.6,4);ctx.closePath();ctx.fill();ctx.globalAlpha=alpha*(0.5+Math.sin(t3*2+pt.phase)*0.3);ctx.fillStyle='#FFFFFF';for(let si=0;si<3;si++){const sx2=(si-1)*s2*0.3+Math.sin(t3+si*2)*2,sy2=(si%2)*4-2+Math.cos(t3+si*1.5)*1.5;ctx.beginPath();ctx.arc(sx2,sy2,1+Math.sin(t3*3+si)*0.5,0,Math.PI*2);ctx.fill();}ctx.restore();}
            else if(pt.type==='pixel'){ctx.fillStyle=pt.color;const s=Math.ceil(pt.size*alpha);ctx.fillRect(Math.floor(pt.x),Math.floor(pt.y),s,s);}
            else if(pt.type==='ghost'){ctx.fillStyle=pt.color;ctx.globalAlpha=alpha*0.35;const s=pt.size*alpha;ctx.beginPath();ctx.arc(pt.x,pt.y-s*0.3,s,Math.PI,0);ctx.lineTo(pt.x+s,pt.y+s*0.5);ctx.lineTo(pt.x+s*0.5,pt.y+s*0.2);ctx.lineTo(pt.x,pt.y+s*0.5);ctx.lineTo(pt.x-s*0.5,pt.y+s*0.2);ctx.lineTo(pt.x-s,pt.y+s*0.5);ctx.closePath();ctx.fill();}
            else if(pt.type==='aurora'){ctx.fillStyle=pt.color;ctx.globalAlpha=alpha*0.4;const s=pt.size*alpha;ctx.beginPath();ctx.ellipse(pt.x,pt.y,s*1.5,s*0.6,0,0,Math.PI*2);ctx.fill();}
            else{ctx.fillStyle=pt.color;ctx.beginPath();ctx.arc(pt.x,pt.y,pt.size,0,Math.PI*2);ctx.fill();}
        });
        ctx.globalAlpha=1;
        // Character
        const p=f.player;
        if(p&&p.sprite){
            ctx.save();
            if(p.dir===-1){ctx.translate(p.x,0);ctx.scale(-1,1);ctx.drawImage(p.sprite,-32,p.y-32,64,64);}
            else ctx.drawImage(p.sprite,p.x-32,p.y-32,64,64);
            ctx.restore();
            // Hat (equipped)
            const hatId=Player.equipped.hat;
            if(hatId){
                CharRender.renderHat(ctx, hatId, p.x, p.y-32, 22);
            }
            // Title (equipped)
            if(Player.activeTitle){
                ctx.fillStyle='rgba(162,155,254,.9)';ctx.font='bold 12px sans-serif';ctx.textAlign='center';
                ctx.fillText(Player.activeTitle, p.x, p.y+p.h+14);
            }
            // Pet (equipped)
            const petId=Player.equipped.pet;
            if(petId&&this.PET_EMOJI[petId]){
                const petX=p.x+(p.dir===-1?28:-28);
                const petBounce=Math.sin(Date.now()*0.004)*3;
                ctx.font='18px sans-serif';ctx.textAlign='center';
                ctx.fillText(this.PET_EMOJI[petId], petX, p.y+p.h-5+petBounce);
            }
            // Arrow
            const ay=p.y-46+Math.sin(Date.now()*0.005)*3;
            ctx.fillStyle='#FDCB6E';ctx.font='14px sans-serif';ctx.textAlign='center';
            ctx.fillText('▼',p.x,ay);
            // Nickname
            if(Player.nickname){
                ctx.fillStyle='rgba(255,255,255,.7)';ctx.font='bold 12px sans-serif';ctx.textAlign='center';
                ctx.fillText(Player.nickname,p.x,p.y-34);
            }
        }
    },

    switchTab(btn, tab){
        this.currentTab=tab;
        document.querySelectorAll('.inv-tab').forEach(b=>b.classList.remove('active'));
        btn.classList.add('active');
        this.render();
    },

    render(){
        this.renderCharSlots();
        this.refreshFittingSprite();
        this.renderEquipSummary();
        const g=document.getElementById('inv-grid');
        const empty=document.getElementById('inv-empty');
        g.innerHTML='';
        const items=Shop.allItems[this.currentTab]||[];
        let ownedItems=items.filter(i=>Player.owned.includes(i.id));
        // si_ 학생 제작 아이템도 인벤토리에 표시
        if(Marketplace){
            const tabTypeMap = {hats:'hat',effects:'effect',pets:'pet',titles:'title'};
            const targetType = tabTypeMap[this.currentTab];
            if(targetType){
                Player.owned.filter(id=>id.startsWith('si_')).forEach(id=>{
                    if(ownedItems.find(i=>i.id===id)) return;
                    const si = Marketplace.getItemInfo(id);
                    if(si && si.itemType === targetType) ownedItems.push(si);
                });
            }
        }
        if(ownedItems.length===0){
            empty.classList.remove('hidden'); g.classList.add('hidden'); return;
        }
        empty.classList.add('hidden'); g.classList.remove('hidden');
        ownedItems.forEach(item=>{
            const isTitle=this.currentTab==='titles';
            // Check if equipped on active character
            const isEq=(this.currentTab==='hats'&&Player.equipped.hat===item.id)||
                       (this.currentTab==='effects'&&Player.equipped.effect===item.id)||
                       (this.currentTab==='pets'&&Player.equipped.pet===item.id)||
                       (isTitle&&Player.activeTitle===item.titleText);
            // Check which other characters have this equipped
            const otherChars=[];
            if(!isTitle){
                const key=this.currentTab==='hats'?'hat':this.currentTab==='pets'?'pet':'effect';
                Player.characters.forEach((ch,i)=>{
                    if(i!==Player.activeCharIdx && ch.equipped && ch.equipped[key]===item.id){
                        otherChars.push(ch.name||`캐릭터 ${i+1}`);
                    }
                });
            }
            const d=document.createElement('div');
            d.className='inv-card'+(isEq?' equipped':'');
            let statusHtml='';
            if(isEq){
                statusHtml=`<div class="inv-status equipped">⚡ 장착 중</div>`;
            } else if(otherChars.length>0){
                statusHtml=`<div class="inv-status other">${otherChars.join(', ')} 장착 중</div>`;
            } else {
                statusHtml=`<div class="inv-status">장착 가능</div>`;
            }
            const isSi = item.id.startsWith('si_');
            const sellPrice = isSi ? 0 : Math.floor(item.price * Shop.DEPRECIATION);
            const sellHtml = isSi ? '' : `<div class="inv-sell-area"><span class="inv-sell-price">판매가: 🪙${sellPrice}</span><button class="inv-sell-btn" data-id="${item.id}">판매</button></div>`;
            const creatorHtml = isSi && item.creator ? `<div class="inv-desc" style="color:var(--purple-l)">by ${item.creator}</div>` : '';
            let iconHtml;
            if(isSi && item.pixelData){
                iconHtml = `<canvas class="inv-si-preview" data-pixels='${JSON.stringify(item.pixelData)}' width="48" height="48" style="image-rendering:pixelated;border-radius:4px;width:48px;height:48px;"></canvas>`;
            } else {
                iconHtml = `<div class="inv-icon">${item.icon}</div>`;
            }
            d.innerHTML=`${iconHtml}<div class="inv-name">${item.name}</div><div class="inv-desc">${item.desc}</div>${creatorHtml}${statusHtml}${sellHtml}`;
            // Equip on click (not on sell button)
            d.addEventListener('click', (e)=>{
                if(e.target.classList.contains('inv-sell-btn')) return;
                if(isEq) return;
                if(isTitle) Shop.equipTitle(item.titleText);
                else Shop.equip(item.id,this.currentTab);
                this.render();
            });
            // Sell button handler (not for si_ items)
            const sellBtn = d.querySelector('.inv-sell-btn');
            if(sellBtn) sellBtn.addEventListener('click', (e)=>{
                e.stopPropagation();
                if(!confirm(`'${item.name}'을(를) ${sellPrice}코인에 판매하시겠습니까?\n(원가: ${item.price}코인, 감가상각 ${Math.round((1-Shop.DEPRECIATION)*100)}%)`)) return;
                if(Player.sell(item.id, Shop.allItems, Shop.DEPRECIATION)){
                    this.render();
                }
            });
            g.appendChild(d);
            // Render pixel previews for si_ items
            const siCvs = d.querySelector('.inv-si-preview');
            if(siCvs){
                const pd = JSON.parse(siCvs.dataset.pixels);
                const pg = pd.length, ctx = siCvs.getContext('2d'), sz = 48, s = sz / pg;
                for(let y=0;y<pg;y++) for(let x=0;x<pg;x++){
                    if(pd[y]&&pd[y][x]){ ctx.fillStyle=pd[y][x]; ctx.fillRect(Math.floor(x*s),Math.floor(y*s),Math.ceil(s),Math.ceil(s)); }
                }
            }
        });
    },

    renderCharSlots(){
        const el = document.getElementById('inv-char-slots');
        if(!el) return;
        el.innerHTML = '';
        Player.characters.forEach((ch, i) => {
            const wrap = document.createElement('div');
            wrap.className = 'inv-char-wrap';
            const isActive = i === Player.activeCharIdx;
            if(ch.pixels){
                const cvs = CharRender.toTinyCanvas(ch.pixels, 48);
                cvs.className = 'inv-char-slot' + (isActive ? ' active' : '');
                cvs.onclick = () => {
                    Player.switchChar(i);
                    this.render();
                };
                wrap.appendChild(cvs);
            } else {
                const emptyDiv = document.createElement('div');
                emptyDiv.className = 'inv-char-slot-empty';
                emptyDiv.textContent = '?';
                wrap.appendChild(emptyDiv);
            }
            const label = document.createElement('div');
            label.className = 'inv-char-name';
            label.textContent = ch.name || `캐릭터 ${i+1}`;
            wrap.appendChild(label);
            // Show equipped badges under each character
            const eq = ch.equipped || {};
            const badges = document.createElement('div');
            badges.className = 'inv-char-badges';
            if(eq.hat){
                if(this.HAT_EMOJI[eq.hat]) badges.innerHTML += `<span class="inv-badge">${this.HAT_EMOJI[eq.hat]}</span>`;
                else if(eq.hat.startsWith('si_')) badges.innerHTML += `<span class="inv-badge">🖼️</span>`;
            }
            if(eq.effect){
                if(this.EFFECT_EMOJI[eq.effect]) badges.innerHTML += `<span class="inv-badge">${this.EFFECT_EMOJI[eq.effect]}</span>`;
                else if(eq.effect.startsWith('si_') && Marketplace) { const si = Marketplace.getItemInfo(eq.effect); if(si) badges.innerHTML += `<span class="inv-badge">${si.icon||'✨'}</span>`; }
            }
            if(eq.pet){
                if(this.PET_EMOJI[eq.pet]) badges.innerHTML += `<span class="inv-badge">${this.PET_EMOJI[eq.pet]}</span>`;
                else if(eq.pet.startsWith('si_') && Marketplace) { const si = Marketplace.getItemInfo(eq.pet); if(si) badges.innerHTML += `<span class="inv-badge">${si.icon||'🐾'}</span>`; }
            }
            if(badges.innerHTML) wrap.appendChild(badges);
            el.appendChild(wrap);
        });
    },

    renderPreview(){},

    renderEquipSummary(){
        const el=document.getElementById('inv-equip-summary');
        if(!el) return;
        const hat=Player.equipped.hat;
        const eff=Player.equipped.effect;
        const pet=Player.equipped.pet;
        const title=Player.activeTitle;
        const _siName = (id) => Marketplace ? Marketplace.getItemInfo(id)?.name : null;
        const hatName=hat?(Shop.allItems.hats.find(i=>i.id===hat)?.name || _siName(hat) || '???'):'없음';
        const effName=eff?(Shop.allItems.effects.find(i=>i.id===eff)?.name || _siName(eff) || '???'):'없음';
        const petName=pet?(Shop.allItems.pets.find(i=>i.id===pet)?.name || _siName(pet) || '???'):'없음';
        el.innerHTML=
            `<span>🎩 모자: <span class="${hat?'eq-active':''}">${hatName}</span></span>`+
            `<span>✨ 효과: <span class="${eff?'eq-active':''}">${effName}</span></span>`+
            `<span>🐾 펫: <span class="${pet?'eq-active':''}">${petName}</span></span>`+
            `<span>🏷️ 칭호: <span class="${title?'eq-active':''}">${title||'없음'}</span></span>`;
    },

    useReward(id){
        const item=Shop.allItems.rewards.find(i=>i.id===id);
        if(!item) return;
        if(!confirm(`"${item.name}"을(를) 사용하시겠습니까?`)) return;
        if(Shop.useReward(id)){
            alert(`🎉 "${item.name}" 사용 완료!`);
            this.render();
        }
    }
};

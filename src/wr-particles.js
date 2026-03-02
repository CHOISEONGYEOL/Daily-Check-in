// ── Particle & Minimap System (extracted from wr-render.js) ──
// Effect trails, particle rendering, minimap
import { Player } from './player.js';
import { Inventory } from './inventory.js';

export const WrParticles = {
    _spawnEffectTrail(){
        if(!this.player) return;
        const effId = Player.equipped.effect;
        if(!effId || !Inventory.EFFECT_COLORS[effId]) return;
        const P = this.player;
        const isMoving = Math.abs(P.vx) > 0.5 || Math.abs(P.vy) > 1;
        const chance = isMoving ? 0.4 : 0.06;
        if(Math.random() > chance) return;
        const colors = Inventory.EFFECT_COLORS[effId];
        const c = colors[Math.floor(Math.random()*colors.length)];
        const base = {x:P.x+(Math.random()-.5)*16, y:P.y+Math.random()*20};
        if(effId==='e_sparkle'){
            this.particles.push({...base,vx:-P.vx*0.2+(Math.random()-.5)*1.5,vy:-Math.random()*1.5-.5,color:c,size:2+Math.random()*3,life:25+Math.random()*20,maxLife:45,type:'sparkle'});
        } else if(effId==='e_heart'){
            this.particles.push({x:P.x+(Math.random()-.5)*20,y:P.y+Math.random()*10,vx:(Math.random()-.5)*1,vy:-Math.random()*2-.8,color:c,size:0,life:35+Math.random()*25,maxLife:60,type:'heart'});
        } else if(effId==='e_fire'||effId==='e_dragon'){
            for(let i=0;i<2;i++) this.particles.push({x:P.x+(Math.random()-.5)*14,y:P.y+15+Math.random()*10,vx:(Math.random()-.5)*1.2,vy:-Math.random()*2.5-1,color:c,size:3+Math.random()*3,life:18+Math.random()*15,maxLife:33,type:'fire'});
        } else if(effId==='e_bubble'){
            this.particles.push({...base,vx:(Math.random()-.5)*.8,vy:-Math.random()*1.5-.3,color:c,size:3+Math.random()*4,life:40+Math.random()*30,maxLife:70,type:'bubble'});
        } else if(effId==='e_leaf'||effId==='e_petal'){
            this.particles.push({...base,vx:(Math.random()-.5)*2,vy:-Math.random()*.5+.5,color:c,size:3+Math.random()*3,life:35+Math.random()*25,maxLife:60,type:effId==='e_petal'?'petal':'leaf'});
        } else if(effId==='e_snow'){
            this.particles.push({x:P.x+(Math.random()-.5)*30,y:P.y-5,vx:(Math.random()-.5)*.6,vy:Math.random()*.8+.3,color:c,size:2+Math.random()*3,life:40+Math.random()*30,maxLife:70,type:'snow'});
        } else if(effId==='e_star'){
            this.particles.push({...base,vx:(Math.random()-.5)*2.5,vy:-Math.random()*3-1,color:c,size:2+Math.random()*3,life:20+Math.random()*20,maxLife:40,type:'sparkle'});
        } else if(effId==='e_music'){
            this.particles.push({x:P.x+(Math.random()-.5)*20,y:P.y,vx:(Math.random()-.5)*1.5,vy:-Math.random()*2-1,color:c,size:0,life:30+Math.random()*20,maxLife:50,type:'music'});
        } else if(effId==='e_lightning'){
            for(let i=0;i<2;i++) this.particles.push({x:P.x+(Math.random()-.5)*10,y:P.y+Math.random()*20,vx:(Math.random()-.5)*3,vy:(Math.random()-.5)*3,color:c,size:2+Math.random()*2,life:8+Math.random()*10,maxLife:18,type:'lightning'});
        } else if(effId==='e_rainbow'){
            this.particles.push({x:P.x-P.vx*2+(Math.random()-.5)*6,y:P.y+10+Math.random()*10,vx:(Math.random()-.5)*.5,vy:-Math.random()*.3,color:c,size:3+Math.random()*3,life:25+Math.random()*15,maxLife:40,type:'rainbow'});
        } else if(effId==='e_aurora'){
            this.particles.push({x:P.x+(Math.random()-.5)*24,y:P.y-5+Math.random()*25,vx:(Math.random()-.5)*.4,vy:-Math.random()*.6-.2,color:c,size:4+Math.random()*4,life:30+Math.random()*25,maxLife:55,type:'aurora'});
        } else if(effId==='e_galaxy'){
            this.particles.push({...base,vx:(Math.random()-.5)*2,vy:(Math.random()-.5)*2,color:c,size:1.5+Math.random()*2.5,life:25+Math.random()*25,maxLife:50,type:'sparkle'});
        } else if(effId==='e_pixel'){
            this.particles.push({...base,vx:(Math.random()-.5)*3,vy:(Math.random()-.5)*3,color:c,size:3+Math.random()*2,life:15+Math.random()*15,maxLife:30,type:'pixel'});
        } else if(effId==='e_ghost'){
            this.particles.push({x:P.x+(Math.random()-.5)*20,y:P.y+Math.random()*15,vx:(Math.random()-.5)*.8,vy:-Math.random()*1-.3,color:c,size:4+Math.random()*4,life:30+Math.random()*20,maxLife:50,type:'ghost'});
        }
    },

    _renderParticles(ctx){
        this.particles.forEach(p => {
            const alpha = p.life / p.maxLife;
            ctx.globalAlpha = alpha;
            if(p.type==='heart'){
                ctx.font=`${10+alpha*4}px sans-serif`;ctx.textAlign='center';ctx.fillText('\u{1F496}',p.x,p.y);
            } else if(p.type==='sparkle'){
                ctx.fillStyle=p.color;const s=p.size*alpha;
                ctx.save();ctx.translate(p.x,p.y);ctx.rotate((this._frameNow||Date.now())*0.005+p.x);
                ctx.fillRect(-s/2,-0.5,s,1);ctx.fillRect(-0.5,-s/2,1,s);ctx.restore();
            } else if(p.type==='fire'){
                ctx.fillStyle=p.color;const s=p.size*alpha;
                ctx.beginPath();ctx.arc(p.x,p.y,s,0,Math.PI*2);ctx.fill();
            } else if(p.type==='bubble'){
                ctx.strokeStyle=p.color;ctx.lineWidth=1;ctx.globalAlpha=alpha*0.7;
                ctx.beginPath();ctx.arc(p.x,p.y,p.size*alpha,0,Math.PI*2);ctx.stroke();
                ctx.globalAlpha=alpha*0.15;ctx.fillStyle=p.color;ctx.fill();
            } else if(p.type==='leaf'){
                ctx.fillStyle=p.color;ctx.save();ctx.translate(p.x,p.y);ctx.rotate((this._frameNow||Date.now())*0.003+p.x);
                ctx.beginPath();ctx.ellipse(0,0,p.size*alpha,p.size*alpha*0.5,0,0,Math.PI*2);ctx.fill();ctx.restore();
            } else if(p.type==='petal'){
                ctx.fillStyle=p.color;ctx.save();ctx.translate(p.x,p.y);ctx.rotate((this._frameNow||Date.now())*0.002+p.y);
                ctx.beginPath();ctx.ellipse(0,0,p.size*alpha*0.4,p.size*alpha,0,0,Math.PI*2);ctx.fill();ctx.restore();
            } else if(p.type==='snow'){
                ctx.fillStyle=p.color;const s=p.size*alpha;
                ctx.beginPath();ctx.arc(p.x,p.y,s,0,Math.PI*2);ctx.fill();
            } else if(p.type==='music'){
                ctx.font=`${8+alpha*5}px sans-serif`;ctx.textAlign='center';
                const notes=['\u266A','\u266B','\u266A'];ctx.fillText(notes[Math.floor(p.x)%3],p.x,p.y);
            } else if(p.type==='lightning'){
                ctx.strokeStyle=p.color;ctx.lineWidth=1.5;ctx.globalAlpha=alpha;
                ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(p.x+(Math.random()-.5)*8,p.y+(Math.random()-.5)*8);ctx.stroke();
                ctx.fillStyle=p.color;ctx.beginPath();ctx.arc(p.x,p.y,1.5,0,Math.PI*2);ctx.fill();
            } else if(p.type==='rainbow'){
                ctx.fillStyle=p.color;ctx.globalAlpha=alpha*0.6;const s=p.size*alpha;
                ctx.fillRect(p.x-s/2,p.y-1,s,2);
            } else if(p.type==='aurora'){
                ctx.fillStyle=p.color;ctx.globalAlpha=alpha*0.35;const s=p.size*alpha;
                ctx.beginPath();ctx.ellipse(p.x,p.y,s*1.5,s*0.6,0,0,Math.PI*2);ctx.fill();
            } else if(p.type==='pixel'){
                ctx.fillStyle=p.color;const s=Math.ceil(p.size*alpha);
                ctx.fillRect(Math.floor(p.x),Math.floor(p.y),s,s);
            } else if(p.type==='ghost'){
                ctx.fillStyle=p.color;ctx.globalAlpha=alpha*0.3;const s=p.size*alpha;
                ctx.beginPath();ctx.arc(p.x,p.y,s,0,Math.PI*2);ctx.fill();
            } else {
                ctx.fillStyle=p.color;ctx.fillRect(p.x,p.y,p.size*alpha,p.size*alpha);
            }
        });
        ctx.globalAlpha = 1;
    },

    _renderMinimap(ctx){
        const z=this.cameraZoom;
        const mw=280/z, mh=48/z, mx=this.VW-mw-6, my=5;
        const scale=mw/this.W;
        ctx.fillStyle='rgba(0,0,0,.45)';
        ctx.beginPath();ctx.roundRect(mx,my,mw,mh,4);ctx.fill();
        ctx.fillStyle='rgba(255,255,255,.2)';
        this.platforms.forEach(p=>{
            if(p.type==='ground') return;
            ctx.fillRect(mx+p.x*scale, my+p.y/this.H*mh, Math.max(p.w*scale,1), 2);
        });
        ctx.strokeStyle='rgba(255,255,255,.5)';ctx.lineWidth=1;
        const vx=mx+this.camera.x*scale, vw=this.VW*scale;
        ctx.strokeRect(vx, my, vw, mh);
        if(this.ball&&this.ballResetTimer<=0){
            ctx.fillStyle='#FFE082';
            ctx.beginPath();ctx.arc(mx+this.ball.x*scale, my+mh/2, 3, 0, Math.PI*2);ctx.fill();
        }
        if(this.player){
            ctx.fillStyle='#FDCB6E';
            ctx.beginPath();ctx.arc(mx+this.player.x*scale, my+mh/2, 3, 0, Math.PI*2);ctx.fill();
        }
        ctx.fillStyle='rgba(108,92,231,.7)';
        this._rtGetRemoteArray().forEach(n=>{
            ctx.beginPath();ctx.arc(mx+n.x*scale, my+mh/2, 2, 0, Math.PI*2);ctx.fill();
        });
        // 축구 규칙 상시 공지 (미니맵 바로 아래)
        let noticeY = my + mh + 4;
        if(this.ballGameStarted){
            ctx.globalAlpha = 0.7;
            ctx.fillStyle='rgba(0,0,0,.5)';
            ctx.beginPath();ctx.roundRect(mx, noticeY, mw, 18, 5);ctx.fill();
            ctx.fillStyle='#aaa';ctx.font='bold 9px "Segoe UI",sans-serif';ctx.textAlign='center';
            ctx.fillText('\u26BD \uACE8 +3 \uD83E\uDE99  |  \uD83E\uDEE3 \uC790\uCC45\uACE8 -3 \uD83E\uDE99', mx+mw/2, noticeY+13);
            ctx.globalAlpha = 1;
            noticeY += 22;
        }
        // 골 보상/패널티 알림 (공지 아래)
        if(this._goalRewardMsg && this._goalRewardMsg.timer > 0){
            const msg = this._goalRewardMsg;
            const alpha = Math.min(msg.timer / 30, 1);
            ctx.globalAlpha = alpha;
            const isOG = msg.text.includes('\uC790\uCC45\uACE8');
            ctx.fillStyle = isOG ? 'rgba(80,0,0,.6)' : 'rgba(0,0,0,.5)';
            ctx.beginPath();ctx.roundRect(mx, noticeY, mw, 20, 6);ctx.fill();
            ctx.fillStyle = isOG ? '#FF6666' : '#FFD700';
            ctx.font='bold 11px "Segoe UI",sans-serif';ctx.textAlign='center';
            ctx.fillText(msg.text, mx+mw/2, noticeY+15);
            ctx.globalAlpha = 1;
            msg.timer--;
        }
        // (RT 디버그 표시 제거됨 — 최적화 완료)
    },
};

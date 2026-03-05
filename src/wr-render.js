// ── Rendering System (extracted from waiting-room.js) ──
// Obstacle rendering, emotes, decorations, main render, particles, minimap
import { Player } from './player.js';
import { CharRender } from './char-render.js';
import { Inventory } from './inventory.js';
import { PerfMonitor } from './perf-monitor.js';

export const WrRender = {
    renderObstacles(ctx){
        this.obstacles.forEach(obs=>{
            if(obs.type==='rotatingPlatform'){
                const p=obs.platform;
                const cx=p.x+p.w/2, cy=p.y+p.h/2;
                const intensity=0.5+Math.sin((this._frameNow||Date.now())*0.012)*0.4;
                ctx.save();
                ctx.translate(cx, cy);
                ctx.rotate(obs.angle);
                ctx.fillStyle=`rgba(255,165,0,${intensity*0.2})`;
                ctx.fillRect(-p.w/2-6,-p.h/2-6,p.w+12,p.h+12);
                const grad=ctx.createLinearGradient(0,-p.h/2,0,p.h/2);
                grad.addColorStop(0,'#6c5ce7');grad.addColorStop(1,'#4834d4');
                ctx.fillStyle=grad;
                ctx.fillRect(-p.w/2,-p.h/2,p.w,p.h);
                ctx.strokeStyle=`rgba(255,255,255,${0.3+intensity*0.2})`;
                ctx.lineWidth=2;
                for(let s=-p.w/2;s<p.w/2;s+=20){
                    ctx.beginPath();ctx.moveTo(s,-p.h/2);ctx.lineTo(s+10,p.h/2);ctx.stroke();
                }
                ctx.strokeStyle=`rgba(255,200,0,${intensity})`;
                ctx.lineWidth=3;ctx.strokeRect(-p.w/2,-p.h/2,p.w,p.h);
                ctx.restore();
                ctx.fillStyle=`rgba(255,200,0,0.4)`;
                ctx.fillRect(p.x,p.y-8,p.w*(obs.timer/420),3);
                ctx.fillStyle=`rgba(255,165,0,${intensity})`;ctx.font='bold 11px sans-serif';ctx.textAlign='center';
                ctx.fillText('🌀 회전!',cx,p.y-14);
            } else if(obs.type==='meteor'){
                if(obs.warningTimer>0){
                    const a=0.3+Math.sin((this._frameNow||Date.now())*0.015)*0.3;
                    const pulse=1+Math.sin((this._frameNow||Date.now())*0.02)*0.15;
                    ctx.fillStyle=`rgba(255,0,0,${a*0.5})`;
                    ctx.beginPath();ctx.arc(obs.x,this.H-15,60*pulse,0,Math.PI*2);ctx.fill();
                    ctx.fillStyle=`rgba(255,0,0,${a})`;
                    ctx.beginPath();ctx.arc(obs.x,this.H-15,35*pulse,0,Math.PI*2);ctx.fill();
                    ctx.strokeStyle=`rgba(255,50,50,${a+0.3})`;ctx.lineWidth=2.5;
                    ctx.beginPath();ctx.moveTo(obs.x-35,this.H-15);ctx.lineTo(obs.x+35,this.H-15);ctx.stroke();
                    ctx.beginPath();ctx.moveTo(obs.x,this.H-50);ctx.lineTo(obs.x,this.H+5);ctx.stroke();
                    ctx.fillStyle='#FF2222';ctx.font='bold 18px sans-serif';ctx.textAlign='center';
                    ctx.fillText('⚠️ 운석!',obs.x,this.H-57);
                } else if(!obs.impacted){
                    const glow=0.5+Math.sin((this._frameNow||Date.now())*0.02)*0.3;
                    ctx.fillStyle=`rgba(255,100,0,${glow*0.3})`;ctx.beginPath();ctx.arc(obs.x,obs.y,45,0,Math.PI*2);ctx.fill();
                    ctx.fillStyle='#FF4500';ctx.beginPath();ctx.arc(obs.x,obs.y,28,0,Math.PI*2);ctx.fill();
                    ctx.fillStyle='#FFD700';ctx.beginPath();ctx.arc(obs.x,obs.y,16,0,Math.PI*2);ctx.fill();
                    ctx.fillStyle='rgba(255,69,0,0.5)';
                    ctx.beginPath();ctx.moveTo(obs.x-18,obs.y);ctx.lineTo(obs.x,obs.y-70);ctx.lineTo(obs.x+18,obs.y);ctx.fill();
                    ctx.fillStyle='rgba(255,200,0,0.3)';
                    ctx.beginPath();ctx.moveTo(obs.x-10,obs.y);ctx.lineTo(obs.x,obs.y-50);ctx.lineTo(obs.x+10,obs.y);ctx.fill();
                } else {
                    const a=obs.craterTimer/300;
                    ctx.fillStyle=`rgba(60,30,0,${a*0.6})`;
                    ctx.beginPath();ctx.ellipse(obs.x,this.H-13,70,14,0,0,Math.PI*2);ctx.fill();
                    ctx.fillStyle=`rgba(40,20,0,${a*0.4})`;
                    ctx.beginPath();ctx.ellipse(obs.x,this.H-13,50,10,0,0,Math.PI*2);ctx.fill();
                    if(obs.shockwaveRadius < 450){
                        const sa=1-obs.shockwaveRadius/450;
                        ctx.strokeStyle=`rgba(255,150,50,${sa*0.6})`;ctx.lineWidth=3;
                        ctx.beginPath();ctx.arc(obs.x,this.H-15,obs.shockwaveRadius,0,Math.PI*2);ctx.stroke();
                        ctx.strokeStyle=`rgba(255,255,200,${sa*0.3})`;ctx.lineWidth=1.5;
                        ctx.beginPath();ctx.arc(obs.x,this.H-15,obs.shockwaveRadius*0.7,0,Math.PI*2);ctx.stroke();
                    }
                    ctx.fillStyle=`rgba(255,80,0,${a*0.15})`;
                    ctx.beginPath();ctx.arc(obs.x,this.H-15,50+(1-a)*30,0,Math.PI*2);ctx.fill();
                }
            } else if(obs.type==='bouncyZone'){
                const a=0.25+Math.sin((this._frameNow||Date.now())*0.006)*0.15;
                ctx.fillStyle=`rgba(0,255,128,${a*0.4})`;
                ctx.fillRect(obs.x,this.H-35,obs.w,20);
                ctx.fillStyle=`rgba(0,255,128,${a+0.15})`;
                ctx.fillRect(obs.x,this.H-20,obs.w,8);
                ctx.fillStyle=`rgba(0,255,128,${a+0.3})`;ctx.font='bold 20px sans-serif';ctx.textAlign='center';
                for(let bx=obs.x+25;bx<obs.x+obs.w;bx+=35){
                    ctx.fillText('▲',bx,this.H-27+Math.sin((this._frameNow||Date.now())*0.01+bx)*5);
                }
                ctx.fillStyle='rgba(0,255,128,0.7)';ctx.font='bold 12px sans-serif';
                ctx.fillText('🟢 슈퍼 바운스!',obs.x+obs.w/2,this.H-40);
                ctx.fillStyle='rgba(0,255,128,0.4)';
                ctx.fillRect(obs.x,this.H-11,obs.w*(obs.timer/300),3);
            } else if(obs.type==='windGust'){
                obs.streaks.forEach(s=>{
                    ctx.strokeStyle=`rgba(200,230,255,${s.alpha})`;
                    ctx.lineWidth=s.thickness||1.5;
                    ctx.globalAlpha=s.alpha;
                    ctx.beginPath();ctx.moveTo(s.x,s.y);ctx.lineTo(s.x+obs.direction*s.length,s.y);ctx.stroke();
                    ctx.strokeStyle=`rgba(180,210,255,${s.alpha*0.4})`;
                    ctx.lineWidth=(s.thickness||1.5)*2;
                    ctx.beginPath();ctx.moveTo(s.x,s.y);ctx.lineTo(s.x+obs.direction*s.length*0.6,s.y);ctx.stroke();
                });
                ctx.globalAlpha=1;
                ctx.fillStyle='rgba(200,230,255,0.15)';ctx.font='bold 40px sans-serif';ctx.textAlign='center';
                const windText = obs.direction>0?'→ → →':'← ← ←';
                ctx.fillText(windText,this.W/2,this.H/2+Math.sin((this._frameNow||Date.now())*0.005)*10);
            } else if(obs.type==='blackHole'){
                const t=(this._frameNow||Date.now())*0.003,pulse=1+Math.sin(t)*0.1;
                ctx.save();ctx.translate(obs.x,obs.y);ctx.rotate(t*0.5);
                for(let ring=3;ring>0;ring--){
                    const r=20+ring*25;
                    ctx.strokeStyle=`rgba(139,92,246,${0.1+ring*0.05})`;ctx.lineWidth=2+ring;
                    ctx.beginPath();ctx.arc(0,0,r*pulse,0,Math.PI*2);ctx.stroke();
                }
                ctx.restore();
                for(let c=5;c>0;c--){
                    ctx.fillStyle=`rgba(0,0,0,${c*0.06})`;
                    ctx.beginPath();ctx.arc(obs.x,obs.y,c*12*pulse,0,Math.PI*2);ctx.fill();
                }
                ctx.fillStyle='#000';ctx.beginPath();ctx.arc(obs.x,obs.y,15*pulse,0,Math.PI*2);ctx.fill();
                ctx.strokeStyle='rgba(139,92,246,0.8)';ctx.lineWidth=2;
                ctx.beginPath();ctx.arc(obs.x,obs.y,16*pulse,0,Math.PI*2);ctx.stroke();
                ctx.fillStyle='rgba(139,92,246,0.4)';ctx.fillRect(obs.x-30,obs.y-50,60*(obs.timer/480),3);
                ctx.fillStyle='rgba(139,92,246,0.8)';ctx.font='bold 12px sans-serif';ctx.textAlign='center';
                ctx.fillText('🕳️ 블랙홀',obs.x,obs.y-55);
            } else if(obs.type==='ghostPlatforms'){
                if(this.ghostLightningVisible){
                    this.ghostPlatforms.forEach(gp=>{
                        const a=0.5+Math.sin((this._frameNow||Date.now())*0.005)*0.2;
                        ctx.fillStyle=`rgba(200,220,255,${a*0.6})`;
                        ctx.fillRect(gp.x,gp.y,gp.w,gp.h);
                        ctx.strokeStyle=`rgba(180,200,255,${a})`;ctx.lineWidth=2;
                        ctx.strokeRect(gp.x,gp.y,gp.w,gp.h);
                        ctx.fillStyle=`rgba(255,255,255,${a*0.3})`;
                        ctx.fillRect(gp.x+3,gp.y+1,gp.w-6,2);
                    });
                } else {
                    this.ghostPlatforms.forEach(gp=>{
                        ctx.strokeStyle='rgba(150,170,200,0.05)';ctx.lineWidth=1;
                        ctx.setLineDash([4,8]);ctx.strokeRect(gp.x,gp.y,gp.w,gp.h);ctx.setLineDash([]);
                    });
                }
            } else if(obs.type==='redLightGreenLight'){
                const rl=this.redLightGreenLight;
                if(!rl)return;
                const ex=rl.eyeX,ey=rl.eyeY,isRed=rl.phase==='red';
                // 배경 원
                ctx.fillStyle=isRed?'rgba(255,0,0,0.15)':'rgba(0,255,0,0.1)';
                ctx.beginPath();ctx.arc(ex,ey,80,0,Math.PI*2);ctx.fill();
                // 눈
                const eyeGrad=ctx.createRadialGradient(ex,ey,10,ex,ey,50);
                eyeGrad.addColorStop(0,isRed?'#FF0000':'#00FF00');
                eyeGrad.addColorStop(0.5,isRed?'#AA0000':'#00AA00');
                eyeGrad.addColorStop(1,'rgba(0,0,0,0.8)');
                ctx.fillStyle=eyeGrad;
                ctx.beginPath();ctx.ellipse(ex,ey,50,35,0,0,Math.PI*2);ctx.fill();
                if(isRed && this.player){
                    const dx=this.player.x-ex,dy=this.player.y-ey;
                    const angle=Math.atan2(dy,dx),pd=12;
                    const px=ex+Math.cos(angle)*pd,py=ey+Math.sin(angle)*pd;
                    ctx.fillStyle='#000';ctx.beginPath();ctx.ellipse(px,py,12,16,0,0,Math.PI*2);ctx.fill();
                    ctx.fillStyle='#FF0000';ctx.beginPath();ctx.arc(px,py,5,0,Math.PI*2);ctx.fill();
                } else {
                    ctx.fillStyle='#000';ctx.beginPath();ctx.ellipse(ex,ey,10,14,0,0,Math.PI*2);ctx.fill();
                    ctx.fillStyle='#00FF00';ctx.beginPath();ctx.arc(ex,ey,4,0,Math.PI*2);ctx.fill();
                }
                ctx.strokeStyle=isRed?'#FF4444':'#44FF44';ctx.lineWidth=3;
                ctx.beginPath();ctx.ellipse(ex,ey,50,35,0,0,Math.PI*2);ctx.stroke();
                // 글자 표시
                if(isRed){
                    ctx.fillStyle='#FF4444';ctx.font='bold 18px sans-serif';ctx.textAlign='center';
                    ctx.fillText('🔴 멈춰!!!',ex,ey+55);
                } else if(rl.chars && rl.displayedChars > 0){
                    // 한 글자씩 나타나는 문장
                    const shown = rl.chars.slice(0, rl.displayedChars);
                    const text = shown.join('. ') + '.';
                    ctx.font='bold 16px sans-serif';ctx.textAlign='center';
                    // 마지막 글자 강조
                    const lastChar = shown[shown.length-1];
                    const fullText = text;
                    const prevText = shown.length > 1 ? shown.slice(0,-1).join('. ') + '. ' : '';
                    // 이전 글자들
                    ctx.fillStyle='#44FF44';
                    ctx.fillText(fullText, ex, ey+55);
                    // 마지막 글자 펄스 효과
                    const pulse = 1 + Math.sin(this.frameCount*0.3)*0.15;
                    const tw = ctx.measureText(fullText).width;
                    const lw = ctx.measureText(lastChar+'.').width;
                    ctx.save();
                    ctx.fillStyle='#FFFFFF';
                    ctx.font=`bold ${16*pulse}px sans-serif`;
                    ctx.fillText(lastChar, ex + tw/2 - lw/2, ey+55);
                    ctx.restore();
                } else {
                    ctx.fillStyle='#44FF44';ctx.font='bold 14px sans-serif';ctx.textAlign='center';
                    ctx.fillText('🟢 준비...',ex,ey+55);
                }
                // 진행 바
                ctx.fillStyle=isRed?'rgba(255,0,0,0.4)':'rgba(0,255,0,0.4)';
                ctx.fillRect(ex-40,ey+62,80*(obs.timer/720),3);
                // 걸렸을 때 레이저
                if(rl.caught&&rl.caughtTimer>0&&this.player){
                    const fa=rl.caughtTimer/40;
                    ctx.strokeStyle=`rgba(255,0,0,${fa})`;ctx.lineWidth=4;
                    ctx.beginPath();ctx.moveTo(ex,ey);ctx.lineTo(this.player.x,this.player.y+this.player.h/2);ctx.stroke();
                }
            } else if(obs.type==='tsunami'){
                if(obs.warningTimer>0){
                    const a=0.3+Math.sin((this._frameNow||Date.now())*0.01)*0.4;
                    const warnX=obs.direction>0?80:this.W-80;
                    ctx.fillStyle=`rgba(0,100,255,${a})`;ctx.font='bold 32px sans-serif';ctx.textAlign='center';
                    ctx.fillText(obs.direction>0?'🌊 →':'← 🌊',warnX,this.H/2);
                    ctx.fillStyle=`rgba(30,144,255,${a})`;ctx.font='bold 16px sans-serif';
                    ctx.fillText('⚠️ 해일 경보!',this.W/2,55);
                    ctx.strokeStyle=`rgba(0,100,255,${a*0.5})`;ctx.lineWidth=3;
                    ctx.beginPath();ctx.moveTo(0,this.H-5);
                    for(let wx=0;wx<this.W;wx+=10) ctx.lineTo(wx,this.H-5+Math.sin(wx*0.05+(this._frameNow||Date.now())*0.01)*4);
                    ctx.stroke();
                } else if(obs.active){
                    const waveX=obs.x;
                    const ww=80;
                    const bodyL=obs.direction>0?waveX-ww:waveX;
                    const grad=ctx.createLinearGradient(bodyL,0,bodyL+ww,0);
                    if(obs.direction>0){grad.addColorStop(0,'rgba(0,50,150,0)');grad.addColorStop(0.4,'rgba(0,80,200,0.4)');grad.addColorStop(0.8,'rgba(30,144,255,0.7)');grad.addColorStop(1,'rgba(0,191,255,0.9)');}
                    else{grad.addColorStop(0,'rgba(0,191,255,0.9)');grad.addColorStop(0.2,'rgba(30,144,255,0.7)');grad.addColorStop(0.6,'rgba(0,80,200,0.4)');grad.addColorStop(1,'rgba(0,50,150,0)');}
                    ctx.fillStyle=grad;
                    ctx.fillRect(bodyL,this.H-obs.waveHeight,ww,obs.waveHeight);
                    const crestX=obs.direction>0?waveX:waveX;
                    ctx.fillStyle='rgba(255,255,255,0.6)';
                    ctx.beginPath();ctx.arc(crestX,this.H-obs.waveHeight,25,0,Math.PI,obs.direction<0);ctx.fill();
                    ctx.fillStyle='rgba(255,255,255,0.5)';
                    for(let fy=this.H-obs.waveHeight+10;fy<this.H;fy+=25){
                        const fx=waveX+Math.sin(fy*0.1+(this._frameNow||Date.now())*0.008)*8;
                        ctx.beginPath();ctx.arc(fx,fy,3+Math.sin(fy+(this._frameNow||Date.now())*0.005)*2,0,Math.PI*2);ctx.fill();
                    }
                    ctx.fillStyle='rgba(200,230,255,0.4)';
                    for(let s=0;s<4;s++){
                        ctx.beginPath();ctx.arc(waveX+obs.direction*(5+Math.random()*35),this.H-obs.waveHeight-Math.random()*30,2+Math.random()*3,0,Math.PI*2);ctx.fill();
                    }
                }
            } else if(obs.type==='earthquake'){
                // 관전자 모드: 지진 이펙트 전체 스킵 (화면 흔들림 + 잔해 = 렉 유발)
                if(this._inSpectator) return;
                const crackAlpha=Math.min(1,obs.timer/100);
                ctx.strokeStyle=`rgba(100,50,0,${crackAlpha*0.6})`;ctx.lineWidth=2;
                for(let c=0;c<6;c++){
                    const cx=(this.W/7)*(c+1)+Math.sin(obs.rumblePhase+c)*15;
                    ctx.beginPath();ctx.moveTo(cx,this.H-10);
                    ctx.lineTo(cx+(Math.sin(c*2.3)*20),this.H-35-Math.sin(c*1.7)*15);
                    ctx.lineTo(cx+(Math.cos(c*1.5)*30),this.H-55-Math.sin(c*3.1)*20);
                    ctx.stroke();
                }
                obs.debris.forEach(d=>{
                    if(d.delay>0) return;
                    if(!d.fallen){
                        const rg=ctx.createLinearGradient(d.x,d.y,d.x+d.w,d.y+d.h);
                        rg.addColorStop(0,'#8B7355');rg.addColorStop(1,'#6B4226');
                        ctx.fillStyle=rg;
                        ctx.save();ctx.translate(d.x+d.w/2,d.y+d.h/2);ctx.rotate(d.vy*0.1);
                        ctx.fillRect(-d.w/2,-d.h/2,d.w,d.h);ctx.restore();
                        const sa=Math.max(0,1-(this.H-30-d.y)/400);
                        ctx.fillStyle=`rgba(0,0,0,${sa*0.3})`;
                        ctx.beginPath();ctx.ellipse(d.x+d.w/2,this.H-12,d.w*0.8,5,0,0,Math.PI*2);ctx.fill();
                    } else if(d.craterTimer>0){
                        const ca=d.craterTimer/180;
                        ctx.fillStyle=`rgba(80,50,20,${ca*0.5})`;
                        ctx.beginPath();ctx.ellipse(d.x+d.w/2,this.H-12,d.w*1.2,6,0,0,Math.PI*2);ctx.fill();
                    }
                });
                const da=0.04+Math.sin(obs.rumblePhase*2)*0.02;
                ctx.fillStyle=`rgba(180,160,120,${da})`;ctx.fillRect(0,0,this.W,this.H);
                const la=0.5+Math.sin((this._frameNow||Date.now())*0.008)*0.3;
                ctx.fillStyle=`rgba(200,100,0,${la})`;ctx.font='bold 14px sans-serif';ctx.textAlign='center';
                ctx.fillText('🌍 지진!',this.W/2,40);
                ctx.fillStyle='rgba(200,100,0,0.4)';ctx.fillRect(this.W/2-40,48,80*(obs.timer/480),3);
            } else if(obs.type==='typhoon'){
                const t=(this._frameNow||Date.now())*0.003,pulse=1+Math.sin(t)*0.1;
                ctx.save();ctx.translate(obs.x,obs.y);
                for(let ring=5;ring>0;ring--){
                    const r=30+ring*50;
                    ctx.strokeStyle=`rgba(135,206,235,${0.04+ring*0.025})`;ctx.lineWidth=2+ring;
                    ctx.beginPath();ctx.arc(0,0,r*pulse,obs.angle+ring*0.3,obs.angle+ring*0.3+Math.PI*1.5);ctx.stroke();
                }
                ctx.restore();
                obs.spiralStreaks.forEach(s=>{
                    const sx=obs.x+Math.cos(s.angle)*s.radius,sy=obs.y+Math.sin(s.angle)*s.radius;
                    const ex=obs.x+Math.cos(s.angle+0.3)*(s.radius*0.85),ey=obs.y+Math.sin(s.angle+0.3)*(s.radius*0.85);
                    ctx.strokeStyle=`rgba(200,220,240,${s.alpha*(s.life/70)})`;ctx.lineWidth=1.5;
                    ctx.beginPath();ctx.moveTo(sx,sy);ctx.lineTo(ex,ey);ctx.stroke();
                });
                const eg=0.3+Math.sin(t*2)*0.15;
                ctx.fillStyle=`rgba(100,149,237,${eg})`;ctx.beginPath();ctx.arc(obs.x,obs.y,25*pulse,0,Math.PI*2);ctx.fill();
                ctx.strokeStyle=`rgba(176,196,222,${eg+0.2})`;ctx.lineWidth=3;
                ctx.beginPath();ctx.arc(obs.x,obs.y,26*pulse,0,Math.PI*2);ctx.stroke();
                ctx.fillStyle='rgba(135,206,235,0.8)';ctx.font='bold 12px sans-serif';ctx.textAlign='center';
                ctx.fillText('🌪️ 태풍',obs.x,obs.y-40);
                ctx.fillStyle='rgba(135,206,235,0.4)';ctx.fillRect(obs.x-30,obs.y-32,60*(obs.timer/480),3);
            }
        });
    },

    renderDecoration(ctx, d){
        if(d.type==='tree'){
            ctx.fillStyle='#5D4037';
            ctx.fillRect(d.x-4,d.y-50,8,50);
            ctx.fillStyle='#2E7D32';
            ctx.beginPath();ctx.arc(d.x,d.y-60,22,0,Math.PI*2);ctx.fill();
            ctx.fillStyle='#388E3C';
            ctx.beginPath();ctx.arc(d.x-10,d.y-50,16,0,Math.PI*2);ctx.fill();
            ctx.beginPath();ctx.arc(d.x+10,d.y-50,16,0,Math.PI*2);ctx.fill();
            ctx.fillStyle='#43A047';
            ctx.beginPath();ctx.arc(d.x,d.y-70,14,0,Math.PI*2);ctx.fill();
        } else if(d.type==='lamp'){
            ctx.fillStyle='#455A64';
            ctx.fillRect(d.x-2,d.y-55,4,55);
            ctx.fillStyle='#FFE082';
            ctx.beginPath();ctx.arc(d.x,d.y-58,7,0,Math.PI*2);ctx.fill();
            ctx.fillStyle='rgba(255,224,130,.1)';
            ctx.beginPath();ctx.arc(d.x,d.y-58,25,0,Math.PI*2);ctx.fill();
        } else if(d.type==='sign'){
            ctx.fillStyle='#5D4037';
            ctx.fillRect(d.x-2,d.y-40,4,40);
            ctx.fillStyle='#8D6E63';
            ctx.fillRect(d.x-25,d.y-52,50,20);
            ctx.fillStyle='#D7CCC8';
            ctx.fillRect(d.x-23,d.y-50,46,16);
            ctx.fillStyle='#3E2723';ctx.font='bold 10px sans-serif';ctx.textAlign='center';
            ctx.fillText(d.text,d.x,d.y-39);
        } else if(d.type==='star'){
            const t = (this._frameNow||Date.now())*0.002+d.x;
            ctx.globalAlpha = 0.3+Math.sin(t)*0.2;
            ctx.fillStyle='#fff';ctx.font='10px sans-serif';ctx.textAlign='center';
            ctx.fillText('✦',d.x,d.y);
            ctx.globalAlpha=1;
        } else if(d.type==='cloud'){
            ctx.fillStyle='rgba(255,255,255,.06)';
            const cx=d.x+Math.sin((this._frameNow||Date.now())*0.0003+d.x)*20;
            ctx.beginPath();ctx.ellipse(cx,d.y,40,14,0,0,Math.PI*2);ctx.fill();
            ctx.beginPath();ctx.ellipse(cx-20,d.y+5,20,10,0,0,Math.PI*2);ctx.fill();
            ctx.beginPath();ctx.ellipse(cx+25,d.y+3,22,11,0,0,Math.PI*2);ctx.fill();
        }
    },

    render(){
        if(!this.ctx || !this.camera) return;
        const ctx = this.ctx;
        const camX = this.camera.x;
        const camY = this.camera.y;
        const VW = this.VW;
        const VH = this.VH;
        const P = this.player;
        // 프레임 시작 시 1회만 Date.now() 호출 (이후 this._frameNow 참조)
        this._frameNow = Date.now();
        const now = this._frameNow;
        // Sky gradient (캐시 — VH 변경 시에만 재생성)
        if(!this._skyGrad || this._skyGradVH !== VH){
            this._skyGrad = ctx.createLinearGradient(0,0,0,VH);
            this._skyGrad.addColorStop(0,'#050520');
            this._skyGrad.addColorStop(0.25,'#0d0d30');
            this._skyGrad.addColorStop(0.5,'#151540');
            this._skyGrad.addColorStop(0.75,'#152238');
            this._skyGrad.addColorStop(1,'#1a3a4a');
            this._skyGradVH = VH;
        }
        ctx.fillStyle=this._skyGrad;ctx.fillRect(0,0,VW,VH);
        // Vignette (캐시)
        if(!this._vigGrad || this._vigVW !== VW || this._vigVH !== VH){
            this._vigGrad=ctx.createRadialGradient(VW/2,VH/2,VH*0.3,VW/2,VH/2,VH*0.9);
            this._vigGrad.addColorStop(0,'rgba(0,0,0,0)');this._vigGrad.addColorStop(1,'rgba(0,0,0,0.3)');
            this._vigVW = VW; this._vigVH = VH;
        }
        ctx.fillStyle=this._vigGrad;ctx.fillRect(0,0,VW,VH);
        // Parallax mountains
        this.bgLayers.forEach(layer=>{
            const lx = layer.x - camX * layer.speed;
            const baseY = VH - 30;
            ctx.fillStyle = layer.color;
            ctx.beginPath();
            ctx.moveTo(lx, baseY);
            ctx.lineTo(lx + layer.w * 0.2, baseY - layer.h * 0.6);
            ctx.lineTo(lx + layer.w * 0.4, baseY - layer.h);
            ctx.lineTo(lx + layer.w * 0.6, baseY - layer.h * 0.7);
            ctx.lineTo(lx + layer.w * 0.8, baseY - layer.h * 0.9);
            ctx.lineTo(lx + layer.w, baseY);
            ctx.closePath(); ctx.fill();
        });
        // Screen flip
        if(this.screenFlip && !this._inSpectator){
            ctx.save();
            if(this.screenFlip==='horizontal'){ctx.translate(VW,0);ctx.scale(-1,1);}
            else{ctx.translate(0,VH);ctx.scale(1,-1);}
        }
        // Camera transform
        ctx.save();
        const shakeAmt = (this.screenShake > 0 && !this._inSpectator && !this.godMode) ? this.screenShake : 0;
        const shakeX = shakeAmt > 0 ? (Math.random()-.5) * shakeAmt : 0;
        const shakeY = shakeAmt > 0 ? (Math.random()-.5) * shakeAmt : 0;
        ctx.translate(-camX + shakeX, -camY + shakeY);
        // Decorations (뷰포트 밖은 건너뜀)
        for(let di=0;di<this.decorations.length;di++){
            const d=this.decorations[di];
            if(d.x<camX-80||d.x>camX+VW+80) continue;
            this.renderDecoration(ctx,d);
        }
        // Platforms (그라디언트 캐시 + shadow 배치)
        ctx.shadowColor='rgba(0,0,0,.35)';ctx.shadowBlur=6;ctx.shadowOffsetX=2;ctx.shadowOffsetY=3;
        for(let pi=0;pi<this.platforms.length;pi++){
            const p=this.platforms[pi];
            if(p._ghostHidden) continue;
            if(p.x + p.w < camX - 50 || p.x > camX + VW + 50) continue;
            if(p.type==='ground'){
                // 그라디언트 캐시
                if(!p._grad){p._grad=ctx.createLinearGradient(0,p.y,0,p.y+p.h);p._grad.addColorStop(0,p.top);p._grad.addColorStop(0.15,p.color);p._grad.addColorStop(1,'#3a5c3a');}
                ctx.fillStyle=p._grad;
                ctx.fillRect(p.x,p.y,p.w,p.h);
                ctx.shadowColor='transparent';ctx.shadowBlur=0;ctx.shadowOffsetX=0;ctx.shadowOffsetY=0;
                ctx.fillStyle=p.top;
                ctx.fillRect(p.x,p.y,p.w,3);
                ctx.fillStyle='rgba(255,255,255,.12)';
                ctx.fillRect(p.x,p.y,p.w,1);
                const grassStart = Math.max(10, Math.floor((camX - p.x) / 30) * 30);
                const grassEnd = Math.min(p.w, camX + VW - p.x + 30);
                for(let gx=grassStart;gx<grassEnd;gx+=20+Math.sin(gx)*8){
                    ctx.fillStyle='#81C784';
                    ctx.fillRect(p.x+gx,p.y-4,2,5);
                    ctx.fillStyle='#A5D6A7';
                    ctx.fillRect(p.x+gx+4,p.y-3,2,4);
                    ctx.fillStyle='#66BB6A';
                    ctx.fillRect(p.x+gx+8,p.y-2,2,3);
                }
                ctx.shadowColor='rgba(0,0,0,.35)';ctx.shadowBlur=6;ctx.shadowOffsetX=2;ctx.shadowOffsetY=3;
            } else {
                if(!p._grad){p._grad=ctx.createLinearGradient(0,p.y,0,p.y+p.h);p._grad.addColorStop(0,p.top);p._grad.addColorStop(0.3,p.color);p._grad.addColorStop(1,'rgba(0,0,0,.15)');}
                ctx.fillStyle=p._grad;
                ctx.beginPath();ctx.roundRect(p.x,p.y,p.w,p.h,5);ctx.fill();
                ctx.shadowColor='transparent';ctx.shadowBlur=0;ctx.shadowOffsetX=0;ctx.shadowOffsetY=0;
                ctx.fillStyle='rgba(255,255,255,.15)';
                ctx.fillRect(p.x+3,p.y+1,p.w-6,2);
                ctx.fillStyle='rgba(0,0,0,.1)';
                ctx.fillRect(p.x+3,p.y+p.h-2,p.w-6,2);
                if(p.type==='magic'){
                    ctx.fillStyle='rgba(108,92,231,.12)';
                    ctx.fillRect(p.x-5,p.y-8,p.w+10,p.h+16);
                    ctx.strokeStyle='rgba(108,92,231,.2)';ctx.lineWidth=1;
                    ctx.beginPath();ctx.roundRect(p.x-1,p.y-1,p.w+2,p.h+2,6);ctx.stroke();
                }
                if(p.type==='spectator'){
                    ctx.fillStyle='rgba(255,215,0,.08)';
                    ctx.fillRect(p.x-3,p.y-6,p.w+6,p.h+12);
                    ctx.fillStyle='rgba(218,165,32,.5)';
                    for(let rx=p.x+10;rx<p.x+p.w;rx+=25) ctx.fillRect(rx,p.y-18,2,18);
                    ctx.fillRect(p.x+5,p.y-18,p.w-10,2);
                    ctx.fillStyle='rgba(255,215,0,.7)';ctx.font='bold 9px sans-serif';ctx.textAlign='center';
                    ctx.fillText('📺 관람석',p.x+p.w/2,p.y-22);
                }
            }
        }
        ctx.shadowColor='transparent';ctx.shadowBlur=0;ctx.shadowOffsetX=0;ctx.shadowOffsetY=0;
        // ── 관람석 박스 테두리 ──
        if(this.spectatorBoxes){
            this.spectatorBoxes.forEach(box=>{
                if(box.x+box.w<camX-50||box.x>camX+VW+50) return;
                ctx.strokeStyle='rgba(255,215,0,.2)';ctx.lineWidth=2;
                ctx.strokeRect(box.x,box.y,box.w,box.h);
            });
        }
        // ── 엘리베이터 3개 (올라가기 + 내려가기) ──
        if(this.elevators){
            const pulse=0.4+Math.sin(this.frameCount*0.06)*0.3;
            this.elevators.forEach(ev=>{
                if(ev.x+ev.w<camX-50||ev.x>camX+VW+50) return;
                const isUp = ev.dir === 'up';
                const col = isUp ? '255,215,0' : '100,200,255';
                // 패드
                ctx.fillStyle=`rgba(${col},${0.12+pulse*0.08})`;
                ctx.fillRect(ev.x,ev.y,ev.w,ev.h);
                // 테두리
                ctx.strokeStyle=`rgba(${col},${0.4+pulse*0.25})`;ctx.lineWidth=2;
                ctx.strokeRect(ev.x,ev.y,ev.w,ev.h);
                // 화살표
                ctx.fillStyle=`rgba(${col},${0.5+pulse*0.3})`;
                ctx.textAlign='center';ctx.font='bold 14px "Segoe UI",sans-serif';
                const arrow = isUp ? '▲' : '▼';
                ctx.fillText(arrow,ev.x+ev.w/2,ev.y+20);
                ctx.fillText(arrow,ev.x+ev.w/2,ev.y+36);
                ctx.fillText(arrow,ev.x+ev.w/2,ev.y+52);
                // 라벨
                ctx.font='bold 8px "Segoe UI",sans-serif';
                ctx.fillStyle=`rgba(${col},${0.6+pulse*0.2})`;
                ctx.fillText(isUp?'▲ 관람석':'▼ 내려가기',ev.x+ev.w/2,ev.y-5);
            });
        }
        // Goals
        this.goals.forEach(g=>{
            if(g.x+g.w<camX-50||g.x>camX+VW+50) return;
            const flash=this.goalFlash>0&&this.goalFlashSide===g.side;
            ctx.fillStyle=flash?'rgba(255,215,0,.25)':'rgba(255,255,255,.06)';
            ctx.fillRect(g.x,g.y,g.w,g.h);
            ctx.fillStyle=flash?'#FFD700':'#ccc';
            ctx.fillRect(g.side==='left'?g.x+g.w-4:g.x,g.y,4,g.h);
            ctx.fillRect(g.x,g.y,g.w,4);
            ctx.strokeStyle='rgba(255,255,255,.12)';ctx.lineWidth=.5;
            for(let ny=g.y+15;ny<g.y+g.h;ny+=15){ctx.beginPath();ctx.moveTo(g.x,ny);ctx.lineTo(g.x+g.w,ny);ctx.stroke();}
        });
        // Ball spawn zones
        this.renderZones(ctx);
        // Obstacles
        this.renderObstacles(ctx);
        // Ball (moon design, cached to offscreen canvas for performance)
        if(this.ball&&this.ballResetTimer<=0){
            const b=this.ball;
            if(b.x>camX-60&&b.x<camX+VW+60){
                // Cache moon sprite once
                if(!this._moonCache || this._moonCache._r !== b.r){
                    const pad=22, sz=(b.r+pad)*2;
                    const mc=document.createElement('canvas'); mc.width=sz; mc.height=sz;
                    const m=mc.getContext('2d'), c=sz/2;
                    m.shadowColor='rgba(255,255,200,0.5)';m.shadowBlur=18;
                    const gr=m.createRadialGradient(c-b.r*.2,c-b.r*.2,b.r*.05,c,c,b.r);
                    gr.addColorStop(0,'#FFFDE7');gr.addColorStop(0.3,'#FFF9C4');gr.addColorStop(0.7,'#F0E68C');gr.addColorStop(1,'#D4AA00');
                    m.fillStyle=gr;m.beginPath();m.arc(c,c,b.r,0,Math.PI*2);m.fill();
                    m.shadowBlur=0;
                    m.fillStyle='rgba(180,160,60,0.35)';
                    m.beginPath();m.arc(c-b.r*.3,c-b.r*.15,b.r*.2,0,Math.PI*2);m.fill();
                    m.beginPath();m.arc(c+b.r*.3,c+b.r*.2,b.r*.15,0,Math.PI*2);m.fill();
                    m.beginPath();m.arc(c-b.r*.05,c+b.r*.4,b.r*.12,0,Math.PI*2);m.fill();
                    m.fillStyle='rgba(180,160,60,0.25)';
                    m.beginPath();m.arc(c+b.r*.15,c-b.r*.4,b.r*.08,0,Math.PI*2);m.fill();
                    m.beginPath();m.arc(c+b.r*.42,c-b.r*.2,b.r*.06,0,Math.PI*2);m.fill();
                    m.beginPath();m.arc(c-b.r*.4,c+b.r*.25,b.r*.07,0,Math.PI*2);m.fill();
                    m.strokeStyle='rgba(200,180,60,0.4)';m.lineWidth=1.5;m.beginPath();m.arc(c,c,b.r,0,Math.PI*2);m.stroke();
                    mc._r=b.r; this._moonCache=mc;
                }
                // Shadow
                ctx.fillStyle='rgba(0,0,0,.15)';
                ctx.beginPath();ctx.ellipse(b.x,this.H-13,b.r*.7,5,0,0,Math.PI*2);ctx.fill();
                // Stamp cached moon with rotation
                ctx.save();ctx.translate(b.x,b.y);ctx.rotate(this.ballAngle);
                ctx.drawImage(this._moonCache,-this._moonCache.width/2,-this._moonCache.height/2);
                ctx.restore();
            }
        }
        // Entities (sorted by y for depth) — 실제 원격 플레이어 (객체 재사용, 스프레드 없음)
        const remotes = this._rtGetRemoteArray();
        // 재사용 가능한 렌더 리스트 (매 프레임 new Array 방지)
        if(!this._renderList) this._renderList = [];
        const rl = this._renderList;
        rl.length = 0;
        for(let i=0;i<remotes.length;i++){
            const r = remotes[i];
            if(!r.sprite || r.x < camX - 50 || r.x > camX + VW + 50) continue;
            r._isRemote = true; r._isPlayer = false;
            rl.push(r);
        }
        if(this.player && this.player.sprite){
            this.player._isPlayer = true; this.player._isRemote = false;
            rl.push(this.player);
        }
        // 삽입 정렬 (거의 정렬된 상태이므로 O(n)에 가까움)
        for(let i=1;i<rl.length;i++){
            const e=rl[i]; let j=i-1;
            while(j>=0 && rl[j].y>e.y){ rl[j+1]=rl[j]; j--; }
            rl[j+1]=e;
        }
        for(let ei=0;ei<rl.length;ei++){
            const e=rl[ei];

            // POV 대상 하이라이트 (교사 관전 모드)
            const isFollowed = this.godMode && this._followTarget && this._followTarget === e;
            if(isFollowed){
                ctx.save();
                ctx.strokeStyle = '#FFD700';
                ctx.lineWidth = 2;
                ctx.shadowColor = '#FFD700';
                ctx.shadowBlur = 12;
                ctx.beginPath(); ctx.arc(e.x, e.y, 22, 0, Math.PI*2); ctx.stroke();
                ctx.restore();
                const ay = e.y - 38 + Math.sin(now*0.005)*3;
                ctx.fillStyle='#FFD700'; ctx.font='bold 14px sans-serif'; ctx.textAlign='center';
                ctx.fillText('▼', e.x, ay);
            }
            if(e._isPlayer&&this.player.explodeTimer>0){
                if(this.player.explodeTimer<=20) ctx.globalAlpha=1-this.player.explodeTimer/20;
                else continue;
            }
            const isStunned = (e._isPlayer && this.player.stunTimer>0) || (e._isRemote && e.stunTimer>0);
            const sx = e.dir===-1;
            ctx.save();
            if(isStunned){
                ctx.globalAlpha=0.7+Math.sin(now*0.02)*0.2;
            }
            const emote = e._isPlayer ? this.player.emote : (e._isRemote ? e.emote : null);
            if(emote==='flat'){
                ctx.translate(e.x,e.y+e.h);if(sx)ctx.scale(-1,1);ctx.scale(1.5,0.3);
                ctx.drawImage(e.sprite,-16,-32,32,32);
            } else if(emote==='inflate'){
                ctx.globalAlpha=0.85;ctx.translate(e.x,e.y+e.h);if(sx)ctx.scale(-1,1);ctx.scale(2,2);
                ctx.drawImage(e.sprite,-16,-32,32,32);
            } else {
                const sc = (e._isPlayer&&this.sizeChange&&!this._inSpectator) ? (this.sizeChange==='giant'?2.2:0.5) : 1;
                if(sc!==1){
                    ctx.translate(e.x,e.y+e.h);if(sx)ctx.scale(-1,1);ctx.scale(sc,sc);
                    ctx.drawImage(e.sprite,-16,-32,32,32);
                } else if(sx){ctx.translate(e.x,0);ctx.scale(-1,1);ctx.drawImage(e.sprite,-16,e.y-16,32,32);}
                else ctx.drawImage(e.sprite,e.x-16,e.y-16,32,32);
            }
            ctx.restore();ctx.globalAlpha=1;
            // Player indicator + hat + nickname
            if(e._isPlayer){
                CharRender.renderHat(ctx, Player.equipped.hat, e.x, e.y-20, 14);
                const ay=e.y-34+Math.sin(now*0.005)*4;
                ctx.fillStyle='#FDCB6E';ctx.font='12px sans-serif';ctx.textAlign='center';
                ctx.fillText('▼',e.x,ay);
                if(Player.nickname){
                    ctx.font='bold 11px "Segoe UI",sans-serif';
                    // measureText 캐시
                    if(this._nickW===undefined||this._nickCached!==Player.nickname){
                        this._nickW=ctx.measureText(Player.nickname).width+10;
                        this._nickCached=Player.nickname;
                    }
                    const nw=this._nickW;
                    ctx.fillStyle='rgba(0,0,0,.4)';
                    ctx.beginPath();ctx.roundRect(e.x-nw/2,e.y-32,nw,16,6);ctx.fill();
                    ctx.fillStyle='#fff';
                    ctx.fillText(Player.nickname,e.x,e.y-20);
                }
                if(Player.activeTitle){
                    ctx.fillStyle='rgba(162,155,254,.95)';ctx.font='bold 10px "Segoe UI",sans-serif';
                    ctx.fillText(Player.activeTitle,e.x,e.y+22);
                }
            }
            // 원격 플레이어 닉네임 + 모자 + 칭호
            if(e._isRemote){
                if(e.hat) CharRender.renderHat(ctx, e.hat, e.x, e.y-20, 14);
                if(e.displayName){
                    ctx.font='bold 11px "Segoe UI",sans-serif';ctx.textAlign='center';
                    // measureText 캐시 (원격 플레이어별)
                    if(e._nameW===undefined||e._nameCached!==e.displayName){
                        e._nameW=ctx.measureText(e.displayName).width+10;
                        e._nameCached=e.displayName;
                    }
                    const nw=e._nameW;
                    ctx.fillStyle='rgba(0,0,0,.4)';
                    ctx.beginPath();ctx.roundRect(e.x-nw/2,e.y-32,nw,16,6);ctx.fill();
                    ctx.fillStyle='#ddd';
                    ctx.fillText(e.displayName,e.x,e.y-20);
                }
                if(e.activeTitle){
                    ctx.fillStyle='rgba(162,155,254,.75)';ctx.font='bold 10px "Segoe UI",sans-serif';ctx.textAlign='center';
                    ctx.fillText(e.activeTitle,e.x,e.y+22);
                }
            }
            // POV 대상 이름표 (교사 관전 모드)
            if(isFollowed && e.displayName){
                ctx.font='bold 11px "Segoe UI",sans-serif';
                if(e._nameW===undefined) e._nameW=ctx.measureText(e.displayName).width+10;
                const nw=e._nameW;
                ctx.fillStyle='rgba(0,0,0,.5)';
                ctx.beginPath();ctx.roundRect(e.x-nw/2,e.y-32,nw,16,6);ctx.fill();
                ctx.fillStyle='#FFD700';
                ctx.fillText(e.displayName,e.x,e.y-20);
            }
            // Team indicator
            if(this.ballGameStarted){
                const eTeam = e._isPlayer ? this.player.team : e.team;
                if(eTeam){
                    ctx.fillStyle = eTeam === 'left' ? 'rgba(78,205,196,0.7)' : 'rgba(255,107,107,0.7)';
                    ctx.beginPath();ctx.ellipse(e.x,e.y+e.h+2,e.w/2+3,4,0,0,Math.PI*2);ctx.fill();
                }
            }
            // Stun stars
            if(isStunned){
                const st = now*0.008;
                ctx.font='bold 14px sans-serif';ctx.textAlign='center';
                for(let si=0;si<3;si++){
                    const sa=st+si*Math.PI*2/3;
                    const starX=e.x+Math.cos(sa)*18;
                    const starY=(e.y-22)+Math.sin(sa*1.5)*5;
                    ctx.fillStyle=`rgba(255,215,0,${0.6+Math.sin(sa*2)*0.3})`;
                    ctx.fillText('⭐',starX,starY);
                }
                ctx.font='bold 10px "Segoe UI",sans-serif';
                ctx.fillStyle='rgba(255,100,100,.9)';
                ctx.fillText('스턴!',e.x,e.y-36);
            }
        }
        // Pet
        if(Player.equipped.pet && Inventory.PET_EMOJI[Player.equipped.pet] && this.petTrail && this.petTrail.length > 0){
            const pidx = Math.max(0, this.petTrail.length - 18);
            const pp = this.petTrail[pidx];
            const bounce = Math.sin(this.frameCount * 0.08) * 3;
            const petDir = pp.dir || 1;
            ctx.save();
            ctx.font='16px sans-serif';ctx.textAlign='center';
            if(petDir === -1){
                ctx.translate(pp.x + 18, 0);ctx.scale(-1,1);
                ctx.fillText(Inventory.PET_EMOJI[Player.equipped.pet], 0, pp.y - 4 + bounce);
            } else {
                ctx.fillText(Inventory.PET_EMOJI[Player.equipped.pet], pp.x - 18, pp.y - 4 + bounce);
            }
            ctx.restore();
        }
        // Particles
        this._renderParticles(ctx);
        // Chat bubbles
        this.chatBubbles.forEach(b=>{
            if(b.x < camX - 100 || b.x > camX + VW + 100) return;
            ctx.globalAlpha=Math.min(1,b.timer/25);
            ctx.font='bold 12px "Segoe UI",sans-serif';ctx.textAlign='center';
            const tw=ctx.measureText(b.text).width+18;
            const bx=b.x, by=b.y-12;
            ctx.shadowColor='rgba(0,0,0,.3)';ctx.shadowBlur=4;ctx.shadowOffsetY=2;
            ctx.fillStyle = b.isPlayer ? 'rgba(108,92,231,.9)' : 'rgba(20,20,30,.8)';
            ctx.beginPath();ctx.roundRect(bx-tw/2,by-14,tw,22,10);ctx.fill();
            ctx.shadowColor='transparent';ctx.shadowBlur=0;ctx.shadowOffsetY=0;
            ctx.strokeStyle = b.isPlayer ? 'rgba(140,120,255,.4)' : 'rgba(255,255,255,.12)';
            ctx.lineWidth=0.5;
            ctx.beginPath();ctx.roundRect(bx-tw/2,by-14,tw,22,10);ctx.stroke();
            ctx.fillStyle = b.isPlayer ? 'rgba(108,92,231,.9)' : 'rgba(20,20,30,.8)';
            ctx.beginPath();
            ctx.moveTo(bx-4,by+8);ctx.lineTo(bx,by+14);ctx.lineTo(bx+4,by+8);
            ctx.fill();
            ctx.fillStyle='#fff';
            ctx.fillText(b.text,bx,by+3);
        });
        ctx.globalAlpha=1;
        ctx.restore(); // End camera transform
        // Unflip
        if(this.screenFlip && !this._inSpectator) ctx.restore();

        // Ghost lightning flash (screen space)
        if(this.ghostLightningVisible&&this.ghostLightningTimer<8){
            const fa=(8-this.ghostLightningTimer)/8*0.3;
            ctx.fillStyle=`rgba(200,220,255,${fa})`;ctx.fillRect(0,0,VW,VH);
        }
        // Gravity reverse tint
        if(this.gravityReversed){
            ctx.fillStyle='rgba(100,60,200,0.06)';ctx.fillRect(0,0,VW,VH);
        }
        // Frog curse edge tint
        if(this.reversedControls){
            const fa=0.04+Math.sin((this._frameNow||Date.now())*0.005)*0.02;
            ctx.fillStyle=`rgba(0,200,50,${fa})`;ctx.fillRect(0,0,VW,VH);
        }
        // ── 무궁화 꽃이 피었습니다 — 화면 테두리 경고 + 플레이어 추적 문구 ──
        if(this.redLightGreenLight){
            const rl=this.redLightGreenLight;
            const isRed=rl.phase==='red';
            if(isRed){
                // 빨간 테두리 깜빡임 (강렬한 펄스)
                const pulse=0.35+Math.sin(this.frameCount*0.25)*0.25;
                const bw=8; // 테두리 두께
                ctx.fillStyle=`rgba(255,0,0,${pulse})`;
                ctx.fillRect(0,0,VW,bw);        // 상단
                ctx.fillRect(0,VH-bw,VW,bw);    // 하단
                ctx.fillRect(0,0,bw,VH);         // 좌측
                ctx.fillRect(VW-bw,0,bw,VH);     // 우측
                // 모서리 강조 (더 넓은 그라디언트)
                const cornerSize=60;
                const cAlpha=pulse*0.6;
                ctx.fillStyle=`rgba(255,0,0,${cAlpha})`;
                ctx.fillRect(0,0,cornerSize,cornerSize);
                ctx.fillRect(VW-cornerSize,0,cornerSize,cornerSize);
                ctx.fillRect(0,VH-cornerSize,cornerSize,cornerSize);
                ctx.fillRect(VW-cornerSize,VH-cornerSize,cornerSize,cornerSize);
                // 화면 전체 빨간 틴트
                ctx.fillStyle=`rgba(255,0,0,${pulse*0.15})`;
                ctx.fillRect(0,0,VW,VH);
            }
            // 플레이어 머리 위 추적 문구
            if(P && !this._inSpectator){
                const px=P.x-camX, py=P.y-camY;
                if(isRed){
                    // 빨간 단계: "멈춰!!!" 깜빡임
                    const blink=Math.sin(this.frameCount*0.3)>0;
                    if(blink){
                        ctx.save();
                        ctx.font='bold 22px "Segoe UI",sans-serif';ctx.textAlign='center';
                        ctx.fillStyle='#FF0000';
                        ctx.shadowColor='#FF0000';ctx.shadowBlur=15;
                        ctx.fillText('🔴 멈춰!!!',px,py-50);
                        ctx.restore();
                    }
                } else if(rl.chars && rl.displayedChars>0){
                    // 초록 단계: 한 글자씩 나타나는 문장 (플레이어 머리 위)
                    const shown=rl.chars.slice(0,rl.displayedChars);
                    const text=shown.join('.')+'.';
                    ctx.save();
                    ctx.font='bold 18px "Segoe UI",sans-serif';ctx.textAlign='center';
                    ctx.fillStyle='#44FF44';
                    ctx.shadowColor='#00FF00';ctx.shadowBlur=10;
                    ctx.fillText(text,px,py-50);
                    // 마지막 글자 강조 펄스
                    const lc=shown[shown.length-1];
                    const pulseS=1+Math.sin(this.frameCount*0.3)*0.2;
                    ctx.font=`bold ${18*pulseS}px "Segoe UI",sans-serif`;
                    ctx.fillStyle='#FFFFFF';
                    const fullW=ctx.measureText(text).width;
                    const lcW=ctx.measureText(lc+'.').width;
                    ctx.fillText(lc,px+fullW/2-lcW/2,py-50);
                    ctx.restore();
                }
            }
        }

        // HUD
        const hudX = this.godMode ? 10 : 10;
        const hudTopY = this.godMode ? 44 : 8;
        if(this.godMode){
            // 교사 관전 모드 배지 (모드별 텍스트)
            let badgeText, badgeW;
            if(this._spectatorCamMode === 'pov' && this._followTarget){
                const name = this._followTarget.displayName || '학생';
                badgeText = `👁️ ${name} 시점`;
                badgeW = Math.max(160, ctx.measureText?.(badgeText)?.width + 30 || 200);
            } else {
                badgeText = '🌐 전지적 시점';
                badgeW = 160;
            }
            ctx.fillStyle='rgba(108,92,231,.7)';ctx.beginPath();ctx.roundRect(10,8,badgeW,28,10);ctx.fill();
            ctx.fillStyle='#fff';ctx.font='bold 13px "Segoe UI",sans-serif';ctx.textAlign='center';
            ctx.fillText(badgeText,10+badgeW/2,27);
        }
        ctx.fillStyle='rgba(0,0,0,.5)';
        ctx.beginPath();ctx.roundRect(hudX,hudTopY,130,28,10);ctx.fill();
        ctx.strokeStyle='rgba(255,255,255,.1)';ctx.lineWidth=0.5;
        ctx.beginPath();ctx.roundRect(hudX,hudTopY,130,28,10);ctx.stroke();
        ctx.fillStyle='#fff';ctx.font='bold 13px "Segoe UI",sans-serif';ctx.textAlign='center';
        ctx.fillText('👥 '+this.readyCount+' / '+this.totalStudents,hudX+65,hudTopY+19);
        // Ball score
        if(this.ballGameStarted){
            ctx.fillStyle='rgba(0,0,0,.5)';ctx.beginPath();ctx.roundRect(10,40,130,26,10);ctx.fill();
            ctx.strokeStyle='rgba(255,255,255,.1)';ctx.lineWidth=0.5;
            ctx.beginPath();ctx.roundRect(10,40,130,26,10);ctx.stroke();
            ctx.textAlign='center';
            ctx.font=this.goalFlash>60?'bold 16px "Segoe UI",sans-serif':'bold 13px "Segoe UI",sans-serif';
            ctx.fillStyle='#4ECDC4';ctx.fillText(this.score.left,50,57);
            ctx.fillStyle='#fff';ctx.fillText('⚽  :  ',75,57);
            ctx.fillStyle='#FF6B6B';ctx.fillText(this.score.right,100,57);
            if(this.player && this.player.team){
                const atkRight = this.player.team === 'left';
                const atkColor = atkRight ? '#FF6B6B' : '#4ECDC4';
                const atkText = atkRight ? '공격 ▶▶' : '◀◀ 공격';
                const pulse = 0.7 + 0.3 * Math.sin(this.frameCount * 0.06);
                ctx.globalAlpha = pulse;
                ctx.fillStyle='rgba(0,0,0,.5)';ctx.beginPath();ctx.roundRect(145,40,80,26,10);ctx.fill();
                ctx.fillStyle=atkColor;ctx.font='bold 12px "Segoe UI",sans-serif';ctx.textAlign='center';
                ctx.fillText(atkText,185,57);
                ctx.globalAlpha = 1;
            }
        }
        // Goal log (스코어 아래)
        if(this.goalLog && this.goalLog.length > 0){
            const logStartY = 70;
            const maxShow = Math.min(this.goalLog.length, 8);
            const logs = this.goalLog.slice(-maxShow);
            for(let gi=0;gi<logs.length;gi++){
                const g = logs[gi];
                const ly = logStartY + gi*18;
                ctx.fillStyle=g.hasOG?'rgba(80,0,0,.5)':'rgba(0,0,0,.4)';ctx.beginPath();ctx.roundRect(10,ly,220,16,6);ctx.fill();
                ctx.font='10px "Segoe UI",sans-serif';ctx.textAlign='left';
                ctx.fillStyle='rgba(255,255,255,.5)';ctx.fillText(g.time,14,ly+12);
                ctx.fillStyle=g.hasOG?'#FF6666':g.teamColor;ctx.font='bold 10px "Segoe UI",sans-serif';
                ctx.fillText((g.hasOG?'🫣 ':'⚽ ')+g.scorers.join(', '),108,ly+12);
            }
        }
        // Wind indicator
        const goalLogOffset = this.goalLog ? Math.min(this.goalLog.length,8)*18 : 0;
        if(this.activeWind){
            ctx.fillStyle='rgba(0,0,0,.5)';ctx.beginPath();ctx.roundRect(10,70+goalLogOffset,100,22,8);ctx.fill();
            ctx.fillStyle='#B0D4FF';ctx.font='bold 12px "Segoe UI",sans-serif';ctx.textAlign='center';
            ctx.fillText(this.activeWind.direction>0?'💨 바람 →':'💨 ← 바람',60,85+goalLogOffset);
        }
        // Active gimmick HUD badges
        {
            let hudY = (this.activeWind ? 96 : 72) + goalLogOffset;
            const effs=[];
            if(this.reversedControls) effs.push('🐸 좌우상하 반전');
            if(this.gravityReversed) effs.push('🔃 중력 역전');
            if(this.blackHole) effs.push('🕳️ 블랙홀');
            if(this._hiddenPlatforms) effs.push('👻 발판 사라짐');
            if(this.redLightGreenLight) effs.push(this.redLightGreenLight.phase==='red'?'🔴 무궁화':'🟢 무궁화');
            effs.forEach(txt=>{
                ctx.fillStyle='rgba(0,0,0,.5)';ctx.beginPath();ctx.roundRect(10,hudY,110,20,8);ctx.fill();
                ctx.fillStyle='#fff';ctx.font='bold 11px "Segoe UI",sans-serif';ctx.textAlign='center';
                ctx.fillText(txt,65,hudY+14);
                hudY+=24;
            });
        }
        // Overlay indicator
        if(this.overlayActive && P){
            const px = P.x - camX, py = P.y - camY - 40;
            const label = this.overlayScreen==='shop' ? '🛒 쇼핑 중...' :
                          this.overlayScreen==='inventory' ? '🎒 정리 중...' : '✏️ 편집 중...';
            ctx.fillStyle='rgba(255,215,0,.6)';
            ctx.font='bold 10px "Segoe UI",sans-serif';ctx.textAlign='center';
            ctx.fillText(label, px, py);
        }
        // Minimap
        this._renderMinimap(ctx);
        // Countdown
        if(this.countdown > 0){
            ctx.fillStyle='rgba(0,0,0,.6)';ctx.fillRect(0,0,VW,VH);
            ctx.shadowColor='rgba(255,255,255,.3)';ctx.shadowBlur=30;
            ctx.fillStyle='#fff';ctx.font='bold 100px "Segoe UI",sans-serif';ctx.textAlign='center';
            ctx.fillText(this.countdown,VW/2,VH/2+30);
            ctx.shadowColor='transparent';ctx.shadowBlur=0;
            ctx.font='bold 22px "Segoe UI",sans-serif';ctx.fillStyle='rgba(255,255,255,.8)';
            ctx.fillText('게임 시작!',VW/2,VH/2+70);
        }
        // Chat hint
        if(document.activeElement?.tagName !== 'INPUT'){
            ctx.fillStyle='rgba(255,255,255,.2)';ctx.font='12px "Segoe UI",sans-serif';ctx.textAlign='center';
            if(this.godMode){
                ctx.fillText('WASD/←→↑↓ 카메라 이동 / +/- 줌 조절',VW/2,VH-8);
            } else {
                ctx.fillText('Enter 채팅 / ←→ 이동 / ↑ 점프 / 1납작 2부풀기 3폭발',VW/2,VH-8);
            }
        }
        // FPS overlay
        if(PerfMonitor.enabled) PerfMonitor.renderOverlay(ctx);
        // ── [SpecDebug] 관람석 플레이어 시각 오버레이 (F9 토글) ──
        if(window._isSpecDebugOn && window._isSpecDebugOn()){
            ctx.save();
            // 1) 관람석 리모트 플레이어에 상태 표시
            const rArr = this._rtGetRemoteArray();
            for(let i=0;i<rArr.length;i++){
                const r=rArr[i];
                if(!r._inSpectator || !r._dbg) continue;
                const sx=r.x-camX, sy=r.y-camY;
                if(sx<-40||sx>VW+40||sy<-40||sy>VH+40) continue;
                const d=r._dbg;
                // onGround 상태에 따라 색상
                ctx.fillStyle = d.onGround ? 'rgba(0,255,0,0.7)' : 'rgba(255,0,0,0.7)';
                ctx.beginPath(); ctx.arc(sx, sy - 26, 4, 0, Math.PI*2); ctx.fill();
                // 텍스트 배경
                ctx.fillStyle='rgba(0,0,0,0.75)';
                ctx.fillRect(sx-50, sy-58, 100, 28);
                // 상태 텍스트
                ctx.fillStyle='#fff'; ctx.font='bold 9px monospace'; ctx.textAlign='center';
                ctx.fillText(`gnd:${d.onGround?'Y':'N'} vy:${d.vy.toFixed(1)} corr:${d.corrY.toFixed(1)}`, sx, sy-47);
                ctx.fillText(`grav:${d.gravRev?'REV':'NOR'}`, sx, sy-38);
            }
            // 2) 좌상단 디버그 로그 패널
            const logs = window._specDebugLog || [];
            if(logs.length > 0){
                const lh = 13, pad = 6;
                const ph = Math.min(logs.length, 15) * lh + pad*2;
                ctx.fillStyle='rgba(0,0,0,0.8)'; ctx.fillRect(4, 60, 420, ph);
                ctx.fillStyle='#FFD700'; ctx.font='bold 10px monospace'; ctx.textAlign='left';
                ctx.fillText('[SpecDebug] F9 OFF | 관람석 바운스 추적', 8, 60+pad+10);
                ctx.fillStyle='#ccc'; ctx.font='9px monospace';
                const start = Math.max(0, logs.length - 14);
                for(let li=start; li<logs.length; li++){
                    ctx.fillText(logs[li].substring(0,60), 8, 60+pad+10+lh*(li-start+1));
                }
            }
            ctx.restore();
        }
    },

};

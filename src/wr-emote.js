// ── Emote System (extracted from wr-render.js) ──
// triggerEmote, clearEmote, updateEmote, spawnExplosion

export const WrEmote = {
    triggerEmote(type){
        if(!this.player) return;
        const P=this.player;
        if(P.emoteCooldown>0||P.explodeTimer>0) return;
        if(this.sizeChange&&(type==='flat'||type==='inflate')) return;
        if(P.emote===type&&type!=='explode'){this.clearEmote();P.emoteCooldown=30;return;}
        this.clearEmote();
        if(type==='explode'){
            P.explodeTimer=60; P.emoteCooldown=this.EMOTE_COOLDOWN;
            this.spawnExplosion(P.x,P.y);
            this._rtGetRemoteArray().forEach(n=>{
                const dx=n.x-P.x,dy=n.y-P.y,dist=Math.sqrt(dx*dx+dy*dy);
                if(dist<80&&dist>0){const f=(80-dist)/80*6;n.vx+=(dx/dist)*f;n.vy+=(dy/dist)*f-3;}
            });
            this._rtBroadcastEmote('explode');
            if(this.ball&&this.ballResetTimer<=0){
                const dx=this.ball.x-P.x,dy=this.ball.y-P.y,dist=Math.sqrt(dx*dx+dy*dy);
                if(dist<120&&dist>0){const f=(120-dist)/120*10;this.ball.vx+=(dx/dist)*f;this.ball.vy+=(dy/dist)*f-4;}
            }
            this.chatBubbles.push({x:P.x,y:P.y-45,text:'\uD83D\uDCA5 \uD3D9!',timer:60,follow:null,isPlayer:true});
        } else {
            P.emote=type; P.emoteTimer=this.EMOTE_DURATION;
            const botY=P.y+P.h;
            if(type==='flat'){P.w=40;P.h=8;P.y=botY-8;this.chatBubbles.push({x:P.x,y:P.y-45,text:'\uCC30\uC2F9!',timer:40,follow:P,isPlayer:true});}
            else if(type==='inflate'){P.w=52;P.h=60;P.y=botY-60;this.chatBubbles.push({x:P.x,y:P.y-45,text:'\uBD80\uD480~!',timer:40,follow:P,isPlayer:true});}
            this._rtBroadcastEmote(type);
        }
    },

    clearEmote(){
        const P=this.player;
        if(P.emote){const botY=P.y+P.h;P.w=26;P.h=30;P.y=botY-30;P.emote=null;P.emoteTimer=0;}
    },

    updateEmote(){
        const P=this.player;
        if(P.emoteCooldown>0) P.emoteCooldown--;
        if(P.explodeTimer>0){P.explodeTimer--;if(P.explodeTimer<=0) P.emoteCooldown=this.EMOTE_COOLDOWN;}
        if(P.emote){P.emoteTimer--;if(P.emoteTimer<=0) this.clearEmote();}
    },

    spawnExplosion(x,y){
        const cols=['#FF6B6B','#FFD93D','#6BCB77','#4D96FF','#FF6EC7','#A29BFE'];
        for(let i=0;i<25;i++){
            const a=Math.random()*Math.PI*2,s=2+Math.random()*5;
            this.particles.push({x,y:y+15,vx:Math.cos(a)*s,vy:Math.sin(a)*s-2,
                color:cols[Math.floor(Math.random()*cols.length)],size:2+Math.random()*4,life:30+Math.random()*25,maxLife:55,type:'fire'});
        }
    },
};

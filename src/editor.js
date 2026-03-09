import { CANVAS_PX } from './constants.js';
import { Player } from './player.js';
import { CharRender } from './char-render.js';
import { TemplateCategories, parseTemplate } from './templates.js';

// Forward references
let Shop = null;
export function setShop(s) { Shop = s; }
let Nav = null;
export function setNav(n) { Nav = n; }
let WaitingRoom = null;
export function setWaitingRoom(wr) { WaitingRoom = wr; }

export const Editor = {
    tool:'pen', color:'#6C5CE7', pixels:null, drawing:false,
    grid:32, cell:CANVAS_PX/32,
    history:[], redoStack:[], maxHistory:80,
    copyPixels(p){return p.map(r=>[...r]);},
    pushHistory(){this.history.push(this.copyPixels(this.pixels));if(this.history.length>this.maxHistory)this.history.shift();this.redoStack=[];this.updateBtns();},
    undo(){if(!this.history.length)return;this.redoStack.push(this.copyPixels(this.pixels));this.pixels=this.history.pop();this.updateBtns();this.draw();},
    redo(){if(!this.redoStack.length)return;this.history.push(this.copyPixels(this.pixels));this.pixels=this.redoStack.pop();this.updateBtns();this.draw();},
    updateBtns(){document.getElementById('btn-undo').disabled=!this.history.length;document.getElementById('btn-redo').disabled=!this.redoStack.length;},
    defaultPalette:['#2D3436','#636E72','#B2BEC3','#DFE6E9','#FFFFFF','#D63031','#E17055','#FDCB6E','#FFEAA7','#00B894','#00CEC9','#0984E3','#6C5CE7','#A29BFE','#FD79A8','#E84393','#74B9FF','#FAB1A0','#855E42','#A0522D','#FF9FF3','#FDA7DF','#FFD8E4','#FFC312','#F8C291','#7158E2','#B53471','#3D3D3D'],
    init(gridOverride){
        const isEdit = Player.pixels != null;
        // 그리드 크기 결정: 수정 모드면 기존 캐릭터 크기, 새로 만들기면 gridOverride 또는 32
        this.grid = isEdit ? (Player.pixels.length || 32) : (gridOverride || 32);
        this.cell = CANVAS_PX / this.grid;
        this.pixels=Player.pixels?Player.pixels.map(r=>[...r]):Array.from({length:this.grid},()=>Array(this.grid).fill(null));
        this.history=[];this.redoStack=[];this.updateBtns();
        const c=document.getElementById('pixel-canvas');c.width=CANVAS_PX;c.height=CANVAS_PX;
        c.onpointerdown=e=>{this.pushHistory();this.drawing=true;this.paint(e);};
        c.onpointermove=e=>{if(this.drawing)this.paint(e);};
        c.onpointerup=()=>this.drawing=false;
        c.onpointerleave=()=>this.drawing=false;
        this.renderPalette();
        // 수정 모드: 템플릿 숨김 / 만들기 모드: 표시
        const tmplSec = document.querySelector('.tmpl-sec');
        const clearBtn = document.getElementById('btn-clear');
        if(tmplSec) tmplSec.style.display = isEdit ? 'none' : '';
        if(clearBtn) clearBtn.style.display = '';
        // 64x64에서는 템플릿 숨김 (32x32 전용)
        if(!isEdit && this.grid <= 32) this.renderTemplates();
        else if(!isEdit && tmplSec) tmplSec.style.display = 'none';
        // 해상도 선택 UI
        this._renderResolutionPicker(isEdit);
        this.draw();
        // 저장 버튼 텍스트
        const saveBtn = document.getElementById('btn-editor-save');
        if(saveBtn) saveBtn.textContent = isEdit ? '💾 수정 완료' : '💾 저장하기';
    },
    _renderResolutionPicker(isEdit){
        const picker = document.getElementById('resolution-picker');
        if(!picker) return;
        // 수정 모드에서는 해상도 변경 불가
        if(isEdit || !Player.owned.includes('u_64grid')){
            picker.style.display = 'none';
            return;
        }
        picker.style.display = '';
        picker.innerHTML = `<button class="res-btn${this.grid===32?' active':''}" onclick="window.Editor.switchResolution(32)">32×32 기본</button><button class="res-btn${this.grid===64?' active':''}" onclick="window.Editor.switchResolution(64)">64×64 HD</button>`;
    },
    switchResolution(g){
        if(g === this.grid) return;
        this.grid = g;
        this.cell = CANVAS_PX / g;
        this.pixels = Array.from({length:g},()=>Array(g).fill(null));
        this.history=[];this.redoStack=[];this.updateBtns();
        // 템플릿은 32x32에서만
        const tmplSec = document.querySelector('.tmpl-sec');
        if(tmplSec) tmplSec.style.display = g <= 32 ? '' : 'none';
        if(g <= 32) this.renderTemplates();
        this._renderResolutionPicker(false);
        this.draw();
    },
    paint(e){
        const c=document.getElementById('pixel-canvas'),r=c.getBoundingClientRect();
        const x=Math.floor((e.clientX-r.left)/(r.width/this.grid)),y=Math.floor((e.clientY-r.top)/(r.height/this.grid));
        if(x<0||x>=this.grid||y<0||y>=this.grid)return;
        if(this.tool==='pen')this.pixels[y][x]=this.color;
        else if(this.tool==='eraser')this.pixels[y][x]=null;
        else if(this.tool==='fill')this.flood(x,y,this.pixels[y][x],this.color);
        this.draw();
    },
    flood(x,y,t,r){if(t===r||x<0||x>=this.grid||y<0||y>=this.grid||this.pixels[y][x]!==t)return;this.pixels[y][x]=r;this.flood(x+1,y,t,r);this.flood(x-1,y,t,r);this.flood(x,y+1,t,r);this.flood(x,y-1,t,r);},
    draw(){
        const c=document.getElementById('pixel-canvas'),ctx=c.getContext('2d');ctx.clearRect(0,0,CANVAS_PX,CANVAS_PX);
        for(let y=0;y<this.grid;y++)for(let x=0;x<this.grid;x++)if(this.pixels[y][x]){ctx.fillStyle=this.pixels[y][x];ctx.fillRect(x*this.cell,y*this.cell,this.cell,this.cell);}
        ctx.strokeStyle='rgba(255,255,255,.08)';ctx.lineWidth=.5;
        for(let i=0;i<=this.grid;i++){ctx.beginPath();ctx.moveTo(i*this.cell,0);ctx.lineTo(i*this.cell,CANVAS_PX);ctx.stroke();ctx.beginPath();ctx.moveTo(0,i*this.cell);ctx.lineTo(CANVAS_PX,i*this.cell);ctx.stroke();}
        const p=document.getElementById('editor-preview');p.width=64;p.height=64;const pc=p.getContext('2d');pc.clearRect(0,0,64,64);const s=64/this.grid;
        for(let y=0;y<this.grid;y++)for(let x=0;x<this.grid;x++)if(this.pixels[y][x]){pc.fillStyle=this.pixels[y][x];pc.fillRect(Math.floor(x*s),Math.floor(y*s),Math.ceil(s),Math.ceil(s));}
    },
    setTool(t){this.tool=t;document.querySelectorAll('.tool-btn[data-tool]').forEach(b=>b.classList.toggle('active',b.dataset.tool===t));},
    renderPalette(){
        const p=document.getElementById('palette');p.innerHTML='';
        const sp=Shop.allItems.colors.filter(c=>Player.owned.includes(c.id)).map(c=>c.hex);
        [...this.defaultPalette,...sp].forEach(h=>{const s=document.createElement('div');s.className='pal-swatch'+(h===this.color?' active':'');s.style.background=h;s.onclick=()=>{this.color=h;p.querySelectorAll('.pal-swatch').forEach(x=>x.classList.remove('active'));s.classList.add('active');};p.appendChild(s);});
    },
    pickCustomColor(){this.color=document.getElementById('custom-color').value;this.renderPalette();},
    currentTmplTab:'cute',
    switchTmplTab(btn, tab){
        this.currentTmplTab=tab;
        document.querySelectorAll('.tmpl-tab').forEach(b=>b.classList.remove('active'));
        btn.classList.add('active');
        this.renderTemplates();
    },
    renderTemplates(){
        const g=document.getElementById('template-grid');g.innerHTML='';
        const cat=TemplateCategories[this.currentTmplTab];
        if(!cat)return;
        cat.items.forEach(t=>{
            const px=parseTemplate(t),c=CharRender.toTinyCanvas(px,96);
            c.className='template-thumb';c.title=t.name;
            c.onclick=()=>{this.pushHistory();this.pixels=px.map(r=>[...r]);this.draw();};
            g.appendChild(c);
        });
    },
    clearCanvas(){this.pushHistory();this.pixels=Array.from({length:this.grid},()=>Array(this.grid).fill(null));this.draw();},
    mirror(){this.pushHistory();for(let y=0;y<this.grid;y++)this.pixels[y].reverse();this.draw();},
    save(){
        Player.pixels=this.pixels.map(r=>[...r]);
        // grid 크기 저장
        const ch = Player.characters[Player.activeCharIdx];
        if(ch) ch.grid = this.grid;
        Player.save();
        if(WaitingRoom&&WaitingRoom.overlayActive)WaitingRoom.closeOverlay();else Nav.go('lobby');
    }
};

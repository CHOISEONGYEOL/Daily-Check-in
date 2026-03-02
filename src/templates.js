import { GRID } from './constants.js';
import { LS } from './storage.js';
import { Player } from './player.js';

// Full color map for templates (editor palette is separate/reduced)
const TCOL_FULL = {
    '_':null,
    '1':'#2D3436','2':'#FFEAA7','3':'#D63031','4':'#855E42','5':'#6C5CE7',
    '6':'#FDCB6E','7':'#636E72','8':'#0984E3','9':'#B2BEC3','A':'#00CEC9',
    'B':'#DFE6E9','C':'#E17055','D':'#FD79A8','E':'#FAB1A0','F':'#FFFFFF',
    'G':'#00B894','H':'#E84393','I':'#74B9FF','J':'#A29BFE','K':'#FF9FF3',
    'L':'#FFC312','M':'#12CBC4','N':'#FDA7DF','O':'#B53471','P':'#ED4C67',
    'Q':'#F8C291','R':'#6AB04C','S':'#F6E58D','T':'#30336B','U':'#C4E538',
    'V':'#7158E2','W':'#3D3D3D','X':'#E1B382','Y':'#FFD8E4','Z':'#A0522D',
    'a':'#000000','b':'#FFB6C1','c':'#FFE4E1','d':'#FFDAB9','e':'#FFF0F5',
    'f':'#FF69B4','g':'#FFD700','h':'#87CEEB','i':'#F5F5DC','j':'#FF8C00',
    'k':'#98FB98','l':'#DDA0DD','m':'#FF6347','n':'#778899','o':'#FFA07A',
    'p':'#E8D5B7','q':'#B0C4DE','r':'#F0E68C','s':'#CD853F','t':'#708090'
};

// ── 카테고리별 템플릿 ──
export const TemplateCategories = {
    cute: { label:'🐰 귀여운', items:[] },
    fantasy: { label:'🧙 판타지', items:[] },
    cool: { label:'😎 독특한', items:[] }
};

// ── Kawaii 32x32 template generator (shared helpers) ──
(function buildAllTemplates(){
    const G=32;
    function mk(){ return Array.from({length:G},()=>Array(G).fill('_')); }
    function set(d,x,y,c){ if(x>=0&&x<G&&y>=0&&y<G) d[y][x]=c; }
    function get(d,x,y){ return (x>=0&&x<G&&y>=0&&y<G)?d[y][x]:'_'; }
    // filled circle
    function circle(d,cx,cy,r,c){
        for(let y=-r;y<=r;y++) for(let x=-r;x<=r;x++)
            if(x*x+y*y<=r*r) set(d,cx+x,cy+y,c);
    }
    // filled ellipse
    function ellipse(d,cx,cy,rx,ry,c){
        for(let y=-ry;y<=ry;y++) for(let x=-rx;x<=rx;x++)
            if((x*x)/(rx*rx)+(y*y)/(ry*ry)<=1) set(d,cx+x,cy+y,c);
    }
    // rounded rect
    function rrect(d,x1,y1,w,h,c){
        for(let y=y1;y<y1+h;y++) for(let x=x1;x<x1+w;x++) set(d,x,y,c);
    }
    // triangle (pointing down)
    function triDown(d,cx,cy,size,c){
        for(let i=0;i<size;i++) for(let x=cx-i;x<=cx+i;x++) set(d,x,cy+i,c);
    }
    // add 1px outline: replace body color neighbors of empty with outline color
    function outline(d, bodyChars, outlineChar){
        const copy=d.map(r=>[...r]);
        for(let y=0;y<G;y++) for(let x=0;x<G;x++){
            if(copy[y][x]==='_'){
                let adj=false;
                for(const[dx,dy] of [[-1,0],[1,0],[0,-1],[0,1]]){
                    const nx=x+dx, ny=y+dy;
                    if(nx>=0&&nx<G&&ny>=0&&ny<G && bodyChars.includes(copy[ny][nx])) adj=true;
                }
                if(adj) d[y][x]=outlineChar;
            }
        }
    }
    // kawaii face: eyes + blush + mouth
    function face(d,cx,cy,eyeSpacing){
        const es=eyeSpacing||4;
        // eyes (2x2 black)
        set(d,cx-es,cy,'1'); set(d,cx-es+1,cy,'1');
        set(d,cx-es,cy+1,'1'); set(d,cx-es+1,cy+1,'1');
        set(d,cx+es-1,cy,'1'); set(d,cx+es,cy,'1');
        set(d,cx+es-1,cy+1,'1'); set(d,cx+es,cy+1,'1');
        // eye highlights
        set(d,cx-es,cy,'F');
        set(d,cx+es-1,cy,'F');
        // blush (pink dots under eyes)
        set(d,cx-es-1,cy+2,'b'); set(d,cx-es,cy+2,'b');
        set(d,cx+es,cy+2,'b'); set(d,cx+es+1,cy+2,'b');
        // mouth (small 'w' shape)
        set(d,cx-1,cy+4,'1'); set(d,cx,cy+3,'1'); set(d,cx+1,cy+4,'1');
    }
    function toData(d){ return d.map(r=>r.join('')); }

    const items=[];

    // 1. 아기 고양이 (Baby Cat) - light gray body
    (function(){
        const d=mk();
        // ears (triangular)
        circle(d,10,6,3,'B'); circle(d,22,6,3,'B');
        circle(d,10,6,2,'Y'); circle(d,22,6,2,'Y'); // inner ear pink
        // head
        circle(d,16,13,8,'B');
        // body
        ellipse(d,16,23,7,5,'B');
        // face
        face(d,16,12,4);
        // whiskers
        set(d,8,14,'1'); set(d,7,14,'1');
        set(d,8,16,'1'); set(d,7,16,'1');
        set(d,24,14,'1'); set(d,25,14,'1');
        set(d,24,16,'1'); set(d,25,16,'1');
        // tail
        set(d,24,22,'B'); set(d,25,21,'B'); set(d,26,20,'B'); set(d,27,20,'B');
        // bottom fill (cover ellipse taper fully)
        rrect(d,11,25,10,5,'B');
        // feet
        circle(d,13,27,2,'B'); circle(d,19,27,2,'B');
        outline(d,['B','Y','b'],'a');
        items.push({name:'아기 고양이',data:toData(d)});
    })();

    // 2. 핑크 토끼 (Pink Rabbit)
    (function(){
        const d=mk();
        // long ears
        rrect(d,10,0,4,10,'K'); rrect(d,19,0,4,10,'K');
        rrect(d,11,1,2,8,'D'); rrect(d,20,1,2,8,'D'); // inner
        // head
        circle(d,16,14,8,'K');
        // body
        ellipse(d,16,24,7,5,'K');
        // face
        face(d,16,13,4);
        // bottom fill (cover ellipse taper fully)
        rrect(d,10,25,12,5,'K');
        // feet
        ellipse(d,12,28,2,1,'K'); ellipse(d,20,28,2,1,'K');
        outline(d,['K','D','b'],'a');
        items.push({name:'핑크 토끼',data:toData(d)});
    })();

    // 3. 아기 곰 (Baby Bear) - warm brown
    (function(){
        const d=mk();
        // round ears
        circle(d,9,6,4,'Q'); circle(d,23,6,4,'Q');
        circle(d,9,6,2,'E'); circle(d,23,6,2,'E'); // inner
        // head
        circle(d,16,13,8,'Q');
        // muzzle
        ellipse(d,16,16,3,2,'E');
        // body
        ellipse(d,16,24,7,5,'Q');
        // face
        face(d,16,12,4);
        // nose
        set(d,15,15,'1'); set(d,16,15,'1');
        // bottom fill (cover ellipse taper fully)
        rrect(d,10,25,12,5,'Q');
        // feet
        circle(d,12,28,2,'Q'); circle(d,20,28,2,'Q');
        outline(d,['Q','E','b'],'a');
        items.push({name:'아기 곰',data:toData(d)});
    })();

    // 4. 병아리 (Chick)
    (function(){
        const d=mk();
        // hair tuft
        set(d,16,3,'2'); set(d,15,4,'2'); set(d,16,4,'2'); set(d,17,4,'2');
        // head
        circle(d,16,10,6,'2');
        // body
        ellipse(d,16,20,8,6,'2');
        // face
        face(d,16,9,3);
        // beak
        set(d,15,13,'C'); set(d,16,13,'C'); set(d,17,13,'C');
        set(d,15,14,'C'); set(d,16,14,'C');
        // wings
        ellipse(d,7,19,2,3,'2'); ellipse(d,25,19,2,3,'2');
        // bottom fill (cover ellipse taper fully)
        rrect(d,10,23,12,5,'2');
        // feet
        set(d,13,26,'C'); set(d,14,26,'C'); set(d,12,27,'C'); set(d,13,27,'C'); set(d,14,27,'C');
        set(d,18,26,'C'); set(d,19,26,'C'); set(d,18,27,'C'); set(d,19,27,'C'); set(d,20,27,'C');
        outline(d,['2','C','b'],'a');
        items.push({name:'병아리',data:toData(d)});
    })();

    // 5. 판다 (Panda)
    (function(){
        const d=mk();
        // ears
        circle(d,9,6,3,'1'); circle(d,23,6,3,'1');
        // head
        circle(d,16,13,8,'F');
        // eye patches (black circles around eyes)
        circle(d,12,12,3,'1'); circle(d,20,12,3,'1');
        // eyes inside patches
        set(d,12,12,'F'); set(d,13,12,'F');
        set(d,20,12,'F'); set(d,21,12,'F');
        // eye pupils
        set(d,12,12,'1'); set(d,20,12,'1');
        // eye highlights
        set(d,12,11,'F'); set(d,20,11,'F');
        // blush
        set(d,9,14,'b'); set(d,10,14,'b');
        set(d,22,14,'b'); set(d,23,14,'b');
        // nose & mouth
        set(d,15,15,'1'); set(d,16,15,'1');
        set(d,15,17,'1'); set(d,16,16,'1'); set(d,17,17,'1');
        // body
        ellipse(d,16,24,7,5,'F');
        // arms
        ellipse(d,8,22,2,3,'1'); ellipse(d,24,22,2,3,'1');
        // bottom fill (cover ellipse taper fully)
        rrect(d,10,25,12,5,'F');
        // feet
        circle(d,12,28,2,'1'); circle(d,20,28,2,'1');
        outline(d,['F','1','b'],'a');
        items.push({name:'판다',data:toData(d)});
    })();

    // 6. 하트 냥이 (Heart Kitty) - cream/pink with heart on chest
    (function(){
        const d=mk();
        // ears
        circle(d,10,6,3,'Y'); circle(d,22,6,3,'Y');
        circle(d,10,6,2,'D'); circle(d,22,6,2,'D');
        // head
        circle(d,16,13,8,'Y');
        // body
        ellipse(d,16,24,7,5,'Y');
        // face
        face(d,16,12,4);
        // whiskers
        set(d,8,14,'1'); set(d,7,14,'1');
        set(d,24,14,'1'); set(d,25,14,'1');
        // tail curving up with heart
        set(d,24,23,'Y'); set(d,25,22,'Y'); set(d,26,21,'Y'); set(d,27,20,'Y');
        set(d,27,19,'D'); set(d,28,19,'D');
        // bottom fill (cover ellipse taper fully)
        rrect(d,10,25,12,5,'Y');
        // feet
        circle(d,13,28,2,'Y'); circle(d,19,28,2,'Y');
        outline(d,['Y','D','b'],'a');
        items.push({name:'하트 냥이',data:toData(d)});
    })();

    // 7. 아기 펭귄 (Baby Penguin)
    (function(){
        const d=mk();
        // head + body (one oval - penguin shape)
        circle(d,16,11,7,'1'); // black head
        ellipse(d,16,22,8,7,'1'); // black body
        // white belly
        ellipse(d,16,14,4,3,'F'); // face white
        ellipse(d,16,22,5,5,'F'); // belly white
        // eyes
        set(d,13,11,'F'); set(d,14,11,'F');
        set(d,18,11,'F'); set(d,19,11,'F');
        set(d,14,11,'1'); set(d,19,11,'1');
        set(d,13,10,'F'); set(d,18,10,'F');
        // blush
        set(d,11,13,'b'); set(d,12,13,'b');
        set(d,20,13,'b'); set(d,21,13,'b');
        // beak
        set(d,15,14,'j'); set(d,16,14,'j'); set(d,17,14,'j');
        set(d,16,15,'j');
        // wings
        ellipse(d,7,20,2,4,'1'); ellipse(d,25,20,2,4,'1');
        // bottom fill (cover ellipse taper fully)
        rrect(d,10,25,12,5,'1');
        // feet
        set(d,13,28,'j'); set(d,14,28,'j'); set(d,15,28,'j');
        set(d,17,28,'j'); set(d,18,28,'j'); set(d,19,28,'j');
        outline(d,['1','F','j','b'],'a');
        items.push({name:'아기 펭귄',data:toData(d)});
    })();

    // 8. 구름이 (Cloud)
    (function(){
        const d=mk();
        // cloud body (overlapping circles)
        circle(d,16,15,7,'F');
        circle(d,10,16,5,'F');
        circle(d,22,16,5,'F');
        circle(d,12,12,4,'F');
        circle(d,20,12,4,'F');
        ellipse(d,16,20,8,3,'F');
        // face
        face(d,16,14,4);
        // rosy cheeks extra
        set(d,10,17,'b'); set(d,11,17,'b');
        set(d,21,17,'b'); set(d,22,17,'b');
        outline(d,['F','b'],'a');
        items.push({name:'구름이',data:toData(d)});
    })();

    // 9. 아기 여우 (Baby Fox) - orange
    (function(){
        const d=mk();
        // ears (pointed)
        circle(d,9,5,3,'C'); circle(d,23,5,3,'C');
        circle(d,9,5,2,'2'); circle(d,23,5,2,'2'); // inner ear
        // head
        circle(d,16,13,8,'C');
        // white muzzle area
        ellipse(d,16,16,4,3,'F');
        // body
        ellipse(d,16,24,7,5,'C');
        // white belly
        ellipse(d,16,24,4,3,'F');
        // face
        face(d,16,12,4);
        // nose
        set(d,16,15,'1');
        // tail (big fluffy)
        circle(d,26,24,3,'C'); set(d,27,23,'F'); set(d,28,23,'F'); set(d,27,22,'F');
        // bottom fill (cover ellipse taper fully)
        rrect(d,10,25,12,5,'C');
        // feet
        circle(d,12,28,2,'1'); circle(d,20,28,2,'1');
        outline(d,['C','2','F','b'],'a');
        items.push({name:'아기 여우',data:toData(d)});
    })();

    // 10. 별이 (Star)
    (function(){
        const d=mk();
        // star shape - diamond + side points
        // center diamond
        for(let i=0;i<=7;i++){
            for(let x=16-i;x<=16+i;x++) set(d,x,8+i,'L');
        }
        for(let i=0;i<=7;i++){
            for(let x=16-7+i;x<=16+7-i;x++) set(d,x,16+i,'L');
        }
        // left point
        for(let i=0;i<4;i++){
            set(d,7-i,14+i,'L'); set(d,7-i,14-i,'L');
            set(d,7-i,14,'L');
        }
        // right point
        for(let i=0;i<4;i++){
            set(d,25+i,14+i,'L'); set(d,25+i,14-i,'L');
            set(d,25+i,14,'L');
        }
        // fill in more star body
        ellipse(d,16,14,9,6,'L');
        // top spike
        for(let i=0;i<4;i++) for(let x=16-i;x<=16+i;x++) set(d,x,12-4+i,'L');
        // bottom points
        set(d,11,22,'L'); set(d,12,23,'L'); set(d,10,23,'L');
        set(d,21,22,'L'); set(d,20,23,'L'); set(d,22,23,'L');
        // face
        face(d,16,13,4);
        outline(d,['L','b'],'a');
        items.push({name:'별이',data:toData(d)});
    })();

    TemplateCategories.cute.items = items;

    // ======================================
    // 🧙 판타지 (Fantasy) – 32x32 chibi fantasy
    // ======================================
    const fan=[];

    // 1. 마법사 (Wizard) – purple robe, hat
    (function(){
        const d=mk();
        // Hat (pointy)
        for(let i=0;i<8;i++) rrect(d,16-i,1+i,1+i*2,1,'5');
        // Hat star
        set(d,16,4,'L'); set(d,15,5,'L'); set(d,17,5,'L');
        // Hat brim
        rrect(d,7,9,18,2,'5');
        // Face
        circle(d,16,14,5,'E');
        face(d,16,13,3);
        // Beard (white)
        ellipse(d,16,19,3,2,'F');
        // Robe
        for(let i=0;i<8;i++) rrect(d,10-i/2|0,21+i,12+i,1,'5');
        // Arms (wide sleeves)
        rrect(d,6,21,4,5,'5'); rrect(d,22,21,4,5,'5');
        // Staff (held in hand)
        rrect(d,5,14,2,16,'4'); circle(d,6,13,2,'L');
        outline(d,['5','E','F','L','4','b'],'a');
        fan.push({name:'마법사',data:toData(d)});
    })();

    // 2. 요정 (Fairy) – green, wings, gold hair
    (function(){
        const d=mk();
        // Wings
        ellipse(d,7,17,4,6,'I'); ellipse(d,25,17,4,6,'I');
        ellipse(d,7,17,3,4,'h'); ellipse(d,25,17,3,4,'h');
        // Hair (golden)
        circle(d,16,8,6,'6');
        ellipse(d,16,6,7,4,'6');
        // Antenna / crown flowers
        set(d,14,2,'L'); set(d,16,1,'L'); set(d,18,2,'L');
        // Face
        circle(d,16,12,5,'E');
        face(d,16,11,3);
        // Body (green dress)
        ellipse(d,16,22,5,5,'G');
        for(let i=0;i<4;i++) rrect(d,11-i,24+i,10+i*2,1,'G');
        // Arms
        rrect(d,9,19,3,5,'E'); rrect(d,20,19,3,5,'E');
        // Legs (solid)
        rrect(d,13,28,7,3,'E');
        rrect(d,12,30,4,2,'G'); rrect(d,17,30,4,2,'G');
        outline(d,['6','E','G','I','h','L','b'],'a');
        fan.push({name:'요정',data:toData(d)});
    })();

    // 3. 유령 (Ghost) – white, ghostly
    (function(){
        const d=mk();
        // Ghost body (blob shape)
        circle(d,16,12,8,'B');
        ellipse(d,16,20,9,7,'B');
        // Wavy bottom
        for(let x=7;x<26;x++){
            const wave = Math.sin(x*0.8)*2|0;
            set(d,x,26+wave,'B'); set(d,x,27+wave,'B');
        }
        // Face
        set(d,12,11,'1'); set(d,13,11,'1'); set(d,12,12,'1'); set(d,13,12,'1');
        set(d,19,11,'1'); set(d,20,11,'1'); set(d,19,12,'1'); set(d,20,12,'1');
        set(d,12,10,'F'); set(d,19,10,'F');
        // Round mouth (O shape)
        circle(d,16,16,2,'1');
        circle(d,16,16,1,'B');
        // Blush
        set(d,10,14,'b'); set(d,11,14,'b');
        set(d,21,14,'b'); set(d,22,14,'b');
        outline(d,['B','b'],'a');
        fan.push({name:'유령',data:toData(d)});
    })();

    // 4. 드래곤 (Dragon) – green, horns, wings, tail
    (function(){
        const d=mk();
        // Horns
        rrect(d,10,2,2,4,'3'); rrect(d,20,2,2,4,'3');
        // Head
        circle(d,16,10,6,'G');
        // Face
        face(d,16,9,3);
        // Snout
        ellipse(d,16,14,3,2,'R');
        set(d,15,13,'1'); set(d,17,13,'1'); // nostrils
        // Wings
        for(let i=0;i<5;i++){
            rrect(d,4-i,11+i,3,1,'G');
            rrect(d,25+i,11+i,3,1,'G');
        }
        // Body
        ellipse(d,16,22,6,6,'G');
        // Belly
        ellipse(d,16,23,4,4,'S');
        // Arms
        rrect(d,8,20,3,5,'G'); rrect(d,21,20,3,5,'G');
        // Legs (solid block, no gap)
        rrect(d,11,26,10,5,'G');
        // Tail
        set(d,24,25,'G'); set(d,25,24,'G'); set(d,26,23,'G'); set(d,27,22,'G');
        set(d,28,21,'G'); set(d,28,22,'3'); // tail tip fire
        outline(d,['G','R','S','3','b'],'a');
        fan.push({name:'드래곤',data:toData(d)});
    })();

    // 5. 공주 (Princess) – golden hair, pink dress, tiara
    (function(){
        const d=mk();
        // Tiara
        set(d,14,2,'L'); set(d,16,1,'L'); set(d,18,2,'L');
        rrect(d,12,3,8,2,'L');
        // Hair (golden, long)
        circle(d,16,8,6,'6');
        ellipse(d,16,6,7,4,'6');
        rrect(d,8,9,4,12,'6'); rrect(d,20,9,4,12,'6');
        // Face
        circle(d,16,12,5,'E');
        face(d,16,11,3);
        // Dress (big pink ball gown)
        ellipse(d,16,24,9,6,'D');
        for(let i=0;i<3;i++) rrect(d,8-i,26+i,16+i*2,1,'D');
        rrect(d,11,19,10,4,'D');
        // Dress decoration
        rrect(d,14,20,4,1,'H');
        // Arms
        rrect(d,8,19,3,5,'E'); rrect(d,21,19,3,5,'E');
        outline(d,['6','E','D','L','H','b'],'a');
        fan.push({name:'공주',data:toData(d)});
    })();

    // 6. 천사 (Angel) – white, halo, wings
    (function(){
        const d=mk();
        // Halo
        ellipse(d,16,2,4,1,'L');
        set(d,12,2,'_'); set(d,20,2,'_');
        ellipse(d,16,2,3,0,'_'); // hollow center
        set(d,13,2,'L'); set(d,19,2,'L');
        // Hair (golden)
        circle(d,16,8,6,'6');
        ellipse(d,16,6,7,4,'6');
        // Wings (white, spread)
        ellipse(d,6,18,4,6,'F'); ellipse(d,26,18,4,6,'F');
        ellipse(d,5,16,3,4,'B'); ellipse(d,27,16,3,4,'B');
        // Face
        circle(d,16,12,5,'E');
        face(d,16,11,3);
        // White robe
        ellipse(d,16,22,6,5,'F');
        for(let i=0;i<4;i++) rrect(d,11-i,24+i,10+i*2,1,'F');
        // Arms
        rrect(d,9,19,3,5,'E'); rrect(d,20,19,3,5,'E');
        // Feet (solid)
        rrect(d,12,29,8,2,'E');
        outline(d,['6','E','F','B','L','b'],'a');
        fan.push({name:'천사',data:toData(d)});
    })();

    // 7. 슬라임 (Slime) – green blob
    (function(){
        const d=mk();
        // Slime body (large blob)
        ellipse(d,16,17,10,8,'G');
        // Puddle base
        ellipse(d,16,25,11,3,'G');
        // Highlights
        circle(d,12,13,2,'M'); // light green highlight
        // Face
        set(d,12,16,'F'); set(d,13,16,'F');
        set(d,13,16,'1'); set(d,13,17,'1');
        set(d,19,16,'F'); set(d,20,16,'F');
        set(d,20,16,'1'); set(d,20,17,'1');
        set(d,12,15,'F'); set(d,19,15,'F');
        // Blush
        set(d,10,18,'b'); set(d,11,18,'b');
        set(d,21,18,'b'); set(d,22,18,'b');
        // Mouth (happy curve)
        set(d,15,20,'1'); set(d,16,21,'1'); set(d,17,20,'1');
        outline(d,['G','M','b'],'a');
        fan.push({name:'슬라임',data:toData(d)});
    })();

    // 8. 마녀 (Witch) – purple hat, dark robe
    (function(){
        const d=mk();
        // Witch hat (pointy, bent)
        for(let i=0;i<6;i++) rrect(d,15-i,2+i,3+i*2,1,'V');
        rrect(d,14,3,2,3,'V'); // tip bent left
        set(d,13,2,'V');
        // Hat brim
        rrect(d,7,8,18,2,'V');
        // Buckle
        set(d,15,8,'L'); set(d,16,8,'L'); set(d,17,8,'L');
        // Hair (purple, wavy)
        rrect(d,9,9,3,9,'O'); rrect(d,20,9,3,9,'O');
        // Face
        circle(d,16,13,5,'E');
        face(d,16,12,3);
        // Robe (dark purple)
        for(let i=0;i<7;i++) rrect(d,10-i/2|0,21+i,12+i,1,'V');
        rrect(d,11,19,10,3,'V');
        // Arms
        rrect(d,7,20,4,5,'V'); rrect(d,21,20,4,5,'V');
        // Broom in hand
        rrect(d,25,18,1,12,'4');
        rrect(d,23,17,5,2,'S');
        outline(d,['V','O','E','L','4','S','b'],'a');
        fan.push({name:'마녀',data:toData(d)});
    })();

    TemplateCategories.fantasy.items = fan;

    // ======================================
    // 😎 독특한 (Cool) – 32x32 chibi cool characters
    // ======================================
    const cool=[];

    // 1. 닌자 (Ninja) – all black, red headband
    (function(){
        const d=mk();
        // Head wrap
        circle(d,16,10,6,'1');
        // Red headband
        rrect(d,9,9,14,2,'3');
        rrect(d,23,10,3,1,'3'); rrect(d,24,11,3,1,'3'); // trailing
        // Eyes showing
        set(d,13,10,'F'); set(d,14,11,'F');
        set(d,18,10,'F'); set(d,19,11,'F');
        // Body
        ellipse(d,16,22,6,5,'1');
        rrect(d,11,19,10,4,'1');
        // Belt
        rrect(d,10,23,12,1,'7');
        // Arms
        rrect(d,7,19,4,6,'1'); rrect(d,21,19,4,6,'1');
        // Shuriken in hand
        set(d,5,19,'9'); set(d,6,20,'9'); set(d,7,19,'9'); set(d,6,18,'9');
        // Pants (solid block, no gap)
        rrect(d,12,26,8,4,'1');
        rrect(d,11,30,4,2,'1'); rrect(d,17,30,4,2,'1');
        // Scarf
        rrect(d,18,15,2,6,'3');
        outline(d,['1','3','7','9'],'W');
        cool.push({name:'닌자',data:toData(d)});
    })();

    // 2. 로봇 (Robot) – silver/gray, antenna
    (function(){
        const d=mk();
        // Antenna
        rrect(d,15,1,2,4,'9'); circle(d,16,1,1,'3');
        // Head (boxy)
        rrect(d,9,5,14,10,'9');
        // Visor
        rrect(d,11,8,10,4,'A');
        // Eyes in visor
        set(d,13,9,'F'); set(d,14,10,'F');
        set(d,18,9,'F'); set(d,19,10,'F');
        // Mouth grid
        rrect(d,13,13,6,1,'7');
        // Body (wider, boxy)
        rrect(d,8,16,16,10,'9');
        // Chest panel
        rrect(d,12,18,8,4,'7');
        circle(d,14,20,1,'3'); circle(d,18,20,1,'A');
        // Arms (tube-like)
        rrect(d,5,17,3,8,'9'); rrect(d,24,17,3,8,'9');
        // Clamp hands
        rrect(d,4,24,4,2,'7'); rrect(d,24,24,4,2,'7');
        // Legs (solid block, no gap)
        rrect(d,11,26,10,4,'9');
        // Feet (heavy)
        rrect(d,10,30,6,2,'7'); rrect(d,16,30,6,2,'7');
        outline(d,['9','A','7','3'],'a');
        cool.push({name:'로봇',data:toData(d)});
    })();

    // 3. 기사 (Knight) – silver armor, plume
    (function(){
        const d=mk();
        // Plume on helmet
        rrect(d,18,1,3,5,'3');
        // Helmet
        circle(d,16,9,7,'9');
        // Visor slit
        rrect(d,12,9,8,2,'1');
        set(d,13,9,'F'); set(d,18,9,'F'); // eye glints
        // Body armor
        rrect(d,9,16,14,10,'9');
        // Chest cross
        rrect(d,15,17,2,6,'L');
        rrect(d,12,19,8,2,'L');
        // Shield arm
        rrect(d,4,17,5,8,'8');
        rrect(d,5,18,3,6,'I'); // shield face
        // Sword arm
        rrect(d,23,17,4,7,'9');
        rrect(d,25,10,2,10,'7'); // sword blade
        rrect(d,24,9,4,2,'L'); // hilt
        // Legs (solid block, no gap)
        rrect(d,11,26,10,4,'9');
        rrect(d,10,30,5,2,'9'); rrect(d,17,30,5,2,'9');
        outline(d,['9','1','L','8','I','7'],'a');
        cool.push({name:'기사',data:toData(d)});
    })();

    // 4. 해적 (Pirate) – bandana, eyepatch
    (function(){
        const d=mk();
        // Bandana
        rrect(d,9,4,14,3,'1');
        rrect(d,23,6,3,2,'1'); // dangling tail
        set(d,15,4,'F'); set(d,16,4,'F'); // skull on bandana
        // Hair
        rrect(d,9,7,3,6,'4'); rrect(d,20,7,3,6,'4');
        // Face
        circle(d,16,11,5,'E');
        // One eye + eye patch
        set(d,13,10,'F'); set(d,14,11,'1'); set(d,14,10,'1'); // left = patch
        set(d,18,10,'F'); set(d,19,10,'1'); set(d,19,11,'1'); // right eye
        rrect(d,12,10,3,2,'1'); // patch
        // Blush & mouth
        set(d,11,13,'b'); set(d,21,13,'b');
        set(d,15,14,'1'); set(d,16,15,'1'); set(d,17,14,'1');
        // Grin
        set(d,14,14,'1'); set(d,18,14,'1');
        // Body (red vest over white)
        ellipse(d,16,22,6,5,'F');
        rrect(d,9,19,4,8,'3'); rrect(d,19,19,4,8,'3'); // vest sides
        // Arms
        rrect(d,7,19,3,6,'E'); rrect(d,22,19,3,6,'E');
        // Hook hand
        set(d,6,24,'L'); set(d,5,23,'L'); set(d,5,24,'L');
        // Pants (solid block, no gap)
        rrect(d,12,26,8,4,'4');
        rrect(d,11,30,4,2,'4'); rrect(d,17,30,4,2,'4');
        outline(d,['1','4','E','3','F','L','b'],'a');
        cool.push({name:'해적',data:toData(d)});
    })();

    // 5. 우주인 (Astronaut) – white suit, glass helmet
    (function(){
        const d=mk();
        // Helmet (round glass dome)
        circle(d,16,10,8,'9');
        // Visor (blue glass)
        circle(d,16,10,6,'I');
        // Face inside visor
        circle(d,16,11,4,'E');
        face(d,16,10,3);
        // Helmet reflection
        set(d,11,7,'F'); set(d,12,8,'F');
        // Body (white suit, bulky)
        rrect(d,8,18,16,10,'F');
        // Chest control panel
        rrect(d,12,20,8,4,'9');
        circle(d,14,22,1,'3'); circle(d,18,22,1,'A');
        set(d,16,21,'L');
        // Arms (puffy)
        rrect(d,4,19,4,7,'F'); rrect(d,24,19,4,7,'F');
        // Gloves
        rrect(d,3,25,5,2,'9'); rrect(d,24,25,5,2,'9');
        // Legs (wide)
        rrect(d,10,28,5,3,'F'); rrect(d,17,28,5,3,'F');
        // Boots
        rrect(d,9,30,6,2,'9'); rrect(d,17,30,6,2,'9');
        // Backpack
        rrect(d,19,19,2,6,'9');
        outline(d,['9','I','E','F','3','A','L','b'],'a');
        cool.push({name:'우주인',data:toData(d)});
    })();

    // 6. 좀비 (Zombie) – green skin, torn clothes
    (function(){
        const d=mk();
        // Messy hair
        circle(d,16,7,5,'R');
        set(d,12,3,'R'); set(d,14,4,'R'); set(d,19,3,'R'); set(d,20,4,'R');
        // Face (greenish)
        circle(d,16,12,5,'R');
        // Different sized eyes (one bigger)
        set(d,13,11,'F'); set(d,14,11,'1'); set(d,14,12,'1');
        set(d,19,10,'F'); set(d,19,11,'1'); set(d,20,11,'1'); set(d,19,12,'1'); set(d,20,12,'1');
        // Blush (grayish instead of pink)
        set(d,11,14,'7'); set(d,22,14,'7');
        // Stitched mouth
        set(d,14,15,'1'); set(d,15,15,'1'); set(d,16,15,'1'); set(d,17,15,'1'); set(d,18,15,'1');
        set(d,15,14,'1'); set(d,17,14,'1'); // stitches
        // Body (torn shirt - gray)
        ellipse(d,16,22,6,5,'7');
        rrect(d,11,19,10,4,'7');
        // Torn edges
        set(d,10,26,'_'); set(d,22,24,'_'); set(d,11,25,'_');
        // Arms (outstretched)
        rrect(d,5,19,6,3,'R'); rrect(d,21,19,6,3,'R');
        rrect(d,3,19,3,3,'R'); // hand
        // Pants (solid block, no gap)
        rrect(d,12,26,8,4,'7');
        rrect(d,11,30,4,2,'1'); rrect(d,17,30,4,2,'1');
        outline(d,['R','7','1'],'a');
        cool.push({name:'좀비',data:toData(d)});
    })();

    // 7. 밴드 보이 (Band Boy) – black outfit, guitar
    (function(){
        const d=mk();
        // Spiky hair
        circle(d,16,8,5,'1');
        set(d,12,3,'1'); set(d,14,2,'1'); set(d,16,1,'1'); set(d,18,2,'1'); set(d,20,3,'1');
        set(d,13,3,'1'); set(d,15,2,'1'); set(d,17,2,'1'); set(d,19,3,'1');
        // Face
        circle(d,16,12,5,'E');
        face(d,16,11,3);
        // Cool smirk
        set(d,17,14,'1'); set(d,18,14,'1');
        // Body (black t-shirt)
        ellipse(d,16,22,6,5,'1');
        rrect(d,11,19,10,4,'1');
        // Skull on shirt
        set(d,15,20,'F'); set(d,16,20,'F'); set(d,17,20,'F');
        set(d,15,21,'F'); set(d,17,21,'F');
        // Arms
        rrect(d,7,19,4,6,'E'); rrect(d,21,19,4,6,'E');
        // Guitar (on right side)
        ellipse(d,26,22,3,4,'3');
        rrect(d,25,12,2,10,'4'); // neck
        rrect(d,24,11,4,2,'4'); // head
        // Jeans (solid block, no gap)
        rrect(d,12,26,8,4,'8');
        rrect(d,11,30,4,2,'1'); rrect(d,17,30,4,2,'1');
        outline(d,['1','E','3','4','8','F','b'],'a');
        cool.push({name:'밴드 보이',data:toData(d)});
    })();

    // 8. 탐험가 (Explorer) – khaki outfit, big hat
    (function(){
        const d=mk();
        // Explorer hat
        rrect(d,9,4,14,3,'X');
        rrect(d,6,7,20,2,'X'); // wide brim
        // Hat band
        rrect(d,10,6,12,1,'4');
        // Hair peeking
        rrect(d,9,9,14,2,'4');
        // Face
        circle(d,16,13,5,'E');
        face(d,16,12,3);
        // Body (khaki jacket)
        ellipse(d,16,23,6,5,'X');
        rrect(d,11,19,10,5,'X');
        // Belt
        rrect(d,10,24,12,1,'4');
        set(d,16,24,'L'); // buckle
        // Pockets
        rrect(d,12,21,3,2,'s'); rrect(d,17,21,3,2,'s');
        // Arms
        rrect(d,7,19,4,6,'X'); rrect(d,21,19,4,6,'X');
        // Backpack (visible on side)
        rrect(d,22,19,3,6,'4');
        // Pants (solid block, no gap)
        rrect(d,12,26,8,4,'X');
        // Boots
        rrect(d,11,30,4,2,'4'); rrect(d,17,30,4,2,'4');
        outline(d,['X','E','4','s','L','b'],'a');
        cool.push({name:'탐험가',data:toData(d)});
    })();

    TemplateCategories.cool.items = cool;

})();

// Flat list for NPC use
export const Templates = Object.values(TemplateCategories).flatMap(c => c.items);

// Migrate saved Player.pixels from 16x16 to 32x32 if needed
export function migratePlayerPixels() {
    // Migrate old single-character pixels to multi-character system
    const oldPixels = LS.get('pixels', null);
    if (oldPixels && !Player.characters.length) {
        let px = oldPixels;
        if (px.length === 16) px = upscale16to32(px);
        Player.characters.push({ name: '캐릭터 1', pixels: px });
        Player.activeCharIdx = 0;
        Player.maxSlots = Math.max(Player.maxSlots, 1);
        Player.save();
    }
    // Upscale any 16x16 characters to 32x32
    Player.characters.forEach(ch => {
        if (ch.pixels && ch.pixels.length === 16) {
            ch.pixels = upscale16to32(ch.pixels);
        }
    });
    Player.save();
}

// Upscale 16x16 pixel data to 32x32 (each pixel becomes 2x2)
export function upscale16to32(data16) {
    const out = [];
    for (let y = 0; y < 16; y++) {
        const row1 = [], row2 = [];
        for (let x = 0; x < 16; x++) {
            const c = data16[y] ? data16[y][x] : null;
            row1.push(c, c);
            row2.push(c, c);
        }
        out.push(row1, row2);
    }
    return out;
}

export function parseTemplate(t) {
    const rows = t.data.length;
    const cols = (t.data[0]||'').length;
    // If this is a 16x16 template, parse at 16 then upscale to 32
    if (rows <= 16 && cols <= 16) {
        const px16 = [];
        for (let y = 0; y < 16; y++) {
            const row = [];
            for (let x = 0; x < 16; x++) {
                row.push(TCOL_FULL[(t.data[y]||'')[x]||'_']||null);
            }
            px16.push(row);
        }
        return upscale16to32(px16);
    }
    // Native 32x32 template
    const px = [];
    for (let y = 0; y < GRID; y++) { const row = []; for (let x = 0; x < GRID; x++) { row.push(TCOL_FULL[(t.data[y]||'')[x]||'_']||null); } px.push(row); }
    return px;
}

// Run migration on load
migratePlayerPixels();

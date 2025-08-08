import React, { useEffect, useRef, useState } from "react";

/**
 * Fruit Box — Add to 10 (v1.6, no BGM)
 * - Score = apples removed (each apple = 1 뽀뽀)
 * - Snap-to-grid box; exact sum = 10 highlights green
 * - Start / Play / Over screens
 * - 2-minute timer bar on the right
 * - Uploads: custom apple sprite, end-screen pictures (3–5)
 * - Touch + mouse input
 * - Spring→fall + fade animation; +N 뽀뽀 toast
 */

type Apple = { id: number; x: number; y: number; r: number; v: number };
type Toast = { id: number; x: number; y: number; life: number; max: number; text: string };
type FlyingApple = { x:number; y:number; r:number; life:number; max:number; vx:number; vy:number };

const W = 740, H = 520, TIMER_MAX = 120_000; // 2 min

// --- Defaults from /public (optional). Put images in public/images and list them here.
const DEFAULT_ENDING_IMAGES: string[] = [
   "/images/JY1.png",
   "/images/JY2.png",
   "/images/JY3.png",
   "/images/JY4.png",
];
const DEFAULT_APPLE_SPRITE: string | null = null; // e.g. "/images/apple.png"

export default function FruitBoxClean() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [apples, setApples] = useState<Apple[]>([]);
  const [kisses, setKisses] = useState(0); // apples removed
  const [light, setLight] = useState(false);
  const [spriteImg, setSpriteImg] = useState<HTMLImageElement | null>(null);
  const [mode, setMode] = useState<"start"|"play"|"over">("start");
  const [timeLeft, setTimeLeft] = useState(TIMER_MAX);
  const [gallery, setGallery] = useState<HTMLImageElement[]>([]);

  // Refs (avoid stale closures)
  const applesRef = useRef<Apple[]>([]);
  const modeRef = useRef<typeof mode>(mode);
  const timeLeftRef = useRef<number>(timeLeft);
  const spriteRef = useRef<HTMLImageElement | null>(null);
  const lightRef = useRef<boolean>(light);
  const galleryRef = useRef<HTMLImageElement[]>([]);
  const kissesRef = useRef<number>(kisses);

  useEffect(()=>{ applesRef.current = apples; }, [apples]);
  useEffect(()=>{ modeRef.current = mode; }, [mode]);
  useEffect(()=>{ timeLeftRef.current = timeLeft; }, [timeLeft]);
  useEffect(()=>{ spriteRef.current = spriteImg; }, [spriteImg]);
  useEffect(()=>{ lightRef.current = light; }, [light]);
  useEffect(()=>{ galleryRef.current = gallery; }, [gallery]);
  useEffect(()=>{ kissesRef.current = kisses; }, [kisses]);

  // Grid
  const margin = 28, cols = 18, rows = 10, rDefault = 14;
  const cellW = (W - margin*2)/cols;
  const cellH = (H - margin*2)/rows;

  useEffect(()=>{ resetBoard(); },[]);

  // (Optional) preload defaults
  useEffect(() => {
    if (!DEFAULT_ENDING_IMAGES.length) return;
    const imgs: HTMLImageElement[] = [];
    let loaded = 0;
    DEFAULT_ENDING_IMAGES.forEach((u) => {
      const img = new Image();
      img.onload = () => { imgs.push(img); loaded++; if (loaded === DEFAULT_ENDING_IMAGES.length) setGallery(imgs); };
      img.src = u;
    });
  }, []);
  useEffect(() => {
    if (!DEFAULT_APPLE_SPRITE) return;
    const img = new Image();
    img.onload = () => setSpriteImg(img);
    img.src = DEFAULT_APPLE_SPRITE;
  }, []);

  function resetBoard(){
    const r = Math.min(rDefault, Math.max(10, Math.min(cellW, cellH)*0.36));
    const list: Apple[] = [];
    let id=1;
    for (let ry=0; ry<rows; ry++){
      for (let cx=0; cx<cols; cx++){
        const x = margin + cellW*(cx + 0.5);
        const y = margin + cellH*(ry + 0.5);
        const v = 1 + Math.floor(Math.random()*9);
        list.push({ id:id++, x, y, r, v });
      }
    }
    setApples(list);
    setKisses(0);
    setTimeLeft(TIMER_MAX);
  }

  // Timer
  useEffect(()=>{
    if (mode !== "play") return;
    let raf=0, last=performance.now();
    const step = (t:number)=>{
      const dt = t - last; last = t;
      setTimeLeft(prev => Math.max(0, prev - dt));
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return ()=> cancelAnimationFrame(raf);
  }, [mode]);
  useEffect(()=>{ if (timeLeft<=0 && mode==="play") setMode("over"); }, [timeLeft, mode]);

  // Drag
  const [drag, setDrag] = useState({ sx:0, sy:0, x:0, y:0, active:false, liveGood:false });
  const dragRef = useRef(drag);
  useEffect(()=>{ dragRef.current = drag; }, [drag]);

  // Toasts/Flying
  const toastsRef = useRef<Toast[]>([]);
  let toastId = 1;
  const addToast = (x:number,y:number,count:number)=>{
    toastsRef.current.push({ id: toastId++, x, y, life:0, max:50, text: `+${count} 뽀뽀` });
  };
  const flyingRef = useRef<FlyingApple[]>([]);

  // Render
  useEffect(()=>{
    const ctx = canvasRef.current?.getContext("2d"); if (!ctx) return;
    let raf=0;

    // DPR + resize
    const resize = ()=>{
      const cvs = canvasRef.current!;
      const dpr = Math.max(1, (window.devicePixelRatio || 1));
      const parent = cvs.parentElement as HTMLElement;
      const targetW = Math.min(parent.clientWidth, W);
      const scale = targetW / W;
      const cssW = Math.round(W*scale), cssH = Math.round(H*scale);
      cvs.style.width = cssW+"px"; cvs.style.height = cssH+"px";
      cvs.width = Math.round(W*dpr); cvs.height = Math.round(H*dpr);
      ctx.setTransform(dpr,0,0,dpr,0,0);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvasRef.current!.parentElement as Element);

    const render = ()=>{
      ctx.clearRect(0,0,W,H);
      const bg = ctx.createLinearGradient(0,0,0,H);
      bg.addColorStop(0, lightRef.current? "#f9fbff":"#eef6ff");
      bg.addColorStop(1, lightRef.current? "#fff6fb":"#f3ecff");
      ctx.fillStyle = bg; ctx.fillRect(0,0,W,H);

      // border + grid
      ctx.strokeStyle = lightRef.current? "#9ad":"#2a2a2a"; ctx.lineWidth = 12; ctx.strokeRect(6,6,W-12,H-12);
      ctx.save(); ctx.strokeStyle = lightRef.current? "#cfe5ff":"#d9d9d9"; ctx.lineWidth = 1; ctx.translate(margin, margin);
      for (let i=1;i<cols;i++){ ctx.beginPath(); ctx.moveTo(i*cellW,0); ctx.lineTo(i*cellW,H - margin*2); ctx.stroke(); }
      for (let j=1;j<rows;j++){ ctx.beginPath(); ctx.moveTo(0,j*cellH); ctx.lineTo(W - margin*2,j*cellH); ctx.stroke(); }
      ctx.restore();

      // apples
      for (const a of applesRef.current) drawApple(ctx, a, spriteRef.current, lightRef.current);

      // selection
      if (dragRef.current.active){
        const d = dragRef.current;
        const {x1,y1,x2,y2} = snappedRect(d.sx,d.sy,d.x,d.y,margin,cellW,cellH,cols,rows);
        const good = d.liveGood;
        ctx.fillStyle = good? "rgba(0,180,120,0.22)":"rgba(255,165,0,0.15)";
        ctx.fillRect(x1,y1,x2-x1,y2-y1);
        ctx.strokeStyle = good? "#00b478":"#ff9800"; ctx.lineWidth=2; ctx.setLineDash([6,4]);
        ctx.strokeRect(x1,y1,x2-x1,y2-y1); ctx.setLineDash([]);
      }

      // timer
      drawTimerBar(ctx, timeLeftRef.current / TIMER_MAX);

      // flying
      const nextFly: FlyingApple[] = [];
      for (const f of flyingRef.current){
        const life = f.life+1;
        const vy = f.vy + 0.5, vx = f.vx*0.995;
        const x = f.x + vx, y = f.y + vy;
        const t = life / f.max;
        const alpha = Math.max(0,1-t);
        const scale = 1 + 0.35*Math.sin(Math.min(1,t)*Math.PI);
        drawApple(ctx, {id:-1,x,y,r:f.r*scale,v:0}, spriteRef.current, lightRef.current, alpha);
        if (life < f.max) nextFly.push({...f, life, x, y, vx, vy});
      }
      flyingRef.current = nextFly;

      // toasts
      const nextToasts: Toast[] = [];
      for (const t of toastsRef.current){
        const life = t.life+1, p = life/t.max;
        const y = t.y - life*0.7, alpha = Math.max(0, 1-p);
        ctx.save(); ctx.globalAlpha = alpha; ctx.fillStyle = p>0.5? "#9ca3af":"#111827";
        ctx.font = "bold 16px ui-sans-serif, system-ui"; ctx.textAlign = "center"; ctx.textBaseline="middle";
        ctx.fillText(t.text, t.x, y); ctx.restore();
        if (life < t.max) nextToasts.push({...t, life});
      }
      toastsRef.current = nextToasts;

      // overlays
      if (modeRef.current !== "play"){
        ctx.fillStyle = "rgba(0,0,0,0.5)"; ctx.fillRect(0,0,W,H);
        ctx.fillStyle = "#fff"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.font = "24px ui-sans-serif, system-ui";
        if (modeRef.current === "start"){
          ctx.fillText("우리 둘만의 뽀뽀 박스", W/2, H/2 - 30);
          drawButton(ctx, W/2 - 60, H/2, 120, 40, "Play");
        }
        if (modeRef.current === "over"){
          const cx = W/2 - 60, cy = H/2 - 30;
          ctx.fillText(`Time up! 뽀뽀: ${kissesRef.current}`, cx, cy);
          const imgX = W/2 + 90, imgY = H/2 - 68, imgSize = 96;
          const imgs = galleryRef.current;
          if (imgs.length>0){
            const img = imgs[0];
            ctx.save(); roundRectPath(ctx, imgX, imgY, imgSize, imgSize, 16); ctx.clip(); ctx.drawImage(img, imgX, imgY, imgSize, imgSize); ctx.restore();
          } else {
            ctx.save(); roundRectPath(ctx, imgX, imgY, imgSize, imgSize, 16); ctx.fillStyle="#ffffff33"; ctx.fill();
            ctx.font="64px ui-sans-serif, system-ui"; ctx.fillStyle="#fff"; ctx.textAlign="center"; ctx.textBaseline="middle";
            ctx.fillText("😊", imgX+imgSize/2, imgY+imgSize/2+4); ctx.restore();
          }
          drawButton(ctx, W/2 - 60, H/2 + 20, 120, 40, "Play again");
        }
      }

      raf = requestAnimationFrame(render);
    };
    raf = requestAnimationFrame(render);
    return ()=>{ cancelAnimationFrame(raf); ro.disconnect(); };
  }, []);

  // Input (mouse + touch)
  useEffect(()=>{
    const cvs = canvasRef.current; if (!cvs) return;
    const rectFor = ()=> cvs.getBoundingClientRect();
    const toLocal = (x:number,y:number)=>{ const r = rectFor(); return { x: x - r.left, y: y - r.top }; };

    const mdown = (x:number,y:number)=>{
      if (modeRef.current !== "play"){
        if (hitButton(x,y, W/2 - 60, H/2, 120, 40) || hitButton(x,y, W/2 - 60, H/2 + 20, 120, 40)){
          resetBoard(); setMode("play"); return;
        }
      } else {
        setDrag({ sx:x, sy:y, x, y, active:true, liveGood:false });
      }
    };
    const mmove = (x:number,y:number)=>{
      if (modeRef.current !== "play" || !dragRef.current.active) return;
      const d = dragRef.current;
      const rect = snappedRect(d.sx,d.sy,x,y,margin,cellW,cellH,cols,rows);
      const chosen = applesRef.current.filter(a => a.x>rect.x1 && a.x<rect.x2 && a.y>rect.y1 && a.y<rect.y2);
      const good = chosen.reduce((s,a)=> s+a.v, 0) === 10;
      const next = { ...d, x, y, active:true, liveGood: good };
      dragRef.current = next; setDrag(next);
    };
    const mup = ()=>{
      if (modeRef.current !== "play" || !dragRef.current.active) return;
      const d = dragRef.current;
      const rect = snappedRect(d.sx,d.sy,d.x,d.y,margin,cellW,cellH,cols,rows);
      const chosen = applesRef.current.filter(a => a.x>rect.x1 && a.x<rect.x2 && a.y>rect.y1 && a.y<rect.y2);
      const sum = chosen.reduce((s,a)=> s+a.v, 0);
      if (sum === 10){
        for (const ch of chosen){
          flyingRef.current.push({ x: ch.x, y: ch.y, r: ch.r, life:0, max:70, vx:(Math.random()-0.5)*1.2, vy:-7 - Math.random()*2 });
        }
        const ids = new Set(chosen.map(c=>c.id));
        setApples(prev => prev.filter(a => !ids.has(a.id)));
        const removed = chosen.length; setKisses(k => k + removed);
        addToast((rect.x1+rect.x2)/2, (rect.y1+rect.y2)/2, removed);
      }
      const next = { ...d, active:false };
      dragRef.current = next; setDrag(next);
    };

    // Mouse
    const onMouseDown = (e: MouseEvent)=>{ const p = toLocal(e.clientX, e.clientY); mdown(p.x, p.y); };
    const onMouseMove = (e: MouseEvent)=>{ const p = toLocal(e.clientX, e.clientY); mmove(p.x, p.y); };
    const onMouseUp = ()=> mup();
    cvs.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);

    // Touch
    const onTouchStart = (e: TouchEvent)=>{ e.preventDefault(); const t = e.changedTouches[0]; const p = toLocal(t.clientX,t.clientY); mdown(p.x, p.y); };
    const onTouchMove  = (e: TouchEvent)=>{ e.preventDefault(); const t = e.changedTouches[0]; const p = toLocal(t.clientX,t.clientY); mmove(p.x, p.y); };
    const onTouchEnd   = (e: TouchEvent)=>{ e.preventDefault(); mup(); };
    cvs.addEventListener("touchstart", onTouchStart, { passive:false });
    window.addEventListener("touchmove", onTouchMove, { passive:false });
    window.addEventListener("touchend", onTouchEnd, { passive:false });

    return ()=>{
      cvs.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      cvs.removeEventListener("touchstart", onTouchStart as any);
      window.removeEventListener("touchmove", onTouchMove as any);
      window.removeEventListener("touchend", onTouchEnd as any);
    };
  }, []);

  // Uploads
  function onSprite(file: File){
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = ()=> setSpriteImg(img);
    img.src = url;
  }
  function onGallery(files: FileList | null){
    if (!files) return;
    const imgs: HTMLImageElement[] = [];
    let loaded = 0;
    for (const f of Array.from(files)){
      const url = URL.createObjectURL(f);
      const img = new Image();
      img.onload = ()=>{ imgs.push(img); loaded++; if (loaded===files.length) setGallery(imgs); };
      img.src = url;
    }
  }

  return (
    <div className="w-full min-h-screen flex items-center justify-center bg-gradient-to-br from-pink-50 via-rose-50 to-purple-50 py-8">
      <div className="max-w-[1040px] w-full grid grid-cols-1 lg:grid-cols-[auto,320px] gap-6 p-4">
        <div className="bg-white rounded-2xl shadow-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h1 className="text-2xl font-semibold">우리 둘만의 뽀뽀 박스</h1>
              <p className="text-sm text-neutral-600">합계 10 — v1.6</p>
            </div>
            <div className="flex gap-2">
              <button onClick={()=>{ resetBoard(); setMode("start"); }} className="px-3 py-1.5 rounded-xl bg-neutral-900 text-white text-sm shadow">Reset</button>
            </div>
          </div>

          <div className="relative flex items-center justify-center">
            <canvas ref={canvasRef} width={W} height={H} className="rounded-xl border border-neutral-300 bg-white" />
          </div>

          <div className="mt-2 flex items-center gap-4 text-sm text-neutral-700">
            <span className="rounded-xl bg-neutral-100 px-3 py-2">뽀뽀: {kisses}</span>
            <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={light} onChange={(e)=>setLight(e.target.checked)} /><span>Light colors</span></label>
            <span className="text-xs text-neutral-500 ml-auto">Timer: {(timeLeft/1000).toFixed(0)}s</span>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-4">
          <h2 className="text-lg font-semibold mb-3">Personalize</h2>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">Custom apple sprite</label>
              <input className="mt-1 block w-full text-sm" type="file" accept="image/*" onChange={(e)=>{ const f=e.target.files?.[0]; if (f) onSprite(f); }} />
              <p className="text-xs text-neutral-500 mt-1">PNG with transparency recommended (256–512px). Rounded clipping is applied.</p>
            </div>
            <div>
              <label className="text-sm font-medium">End screen pictures (3–5)</label>
              <input className="mt-1 block w-full text-sm" type="file" accept="image/*" multiple onChange={(e)=> onGallery(e.target.files)} />
              <p className="text-xs text-neutral-500 mt-1">Shown next to the final score. If none, a 😊 placeholder appears.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Helpers
function drawApple(
  ctx: CanvasRenderingContext2D,
  a: Apple,
  sprite: HTMLImageElement | null,
  light: boolean,
  alpha = 1
){
  const {x,y,r,v} = a;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2); ctx.closePath(); ctx.clip();
  if (sprite){ ctx.drawImage(sprite, x-r, y-r, r*2, r*2); }
  else { const g = ctx.createRadialGradient(x - r*0.4, y - r*0.4, r*0.1, x, y, r);
         g.addColorStop(0, light? "#ff8f8f":"#ff5a5a"); g.addColorStop(1, light? "#ff4d4d":"#cc2b2b");
         ctx.fillStyle = g; ctx.fillRect(x-r, y-r, r*2, r*2); }
  ctx.restore();
  ctx.save(); ctx.globalAlpha = alpha; ctx.fillStyle="#fff";
  ctx.font = `${Math.max(12,r)}px ui-sans-serif, system-ui`; ctx.textAlign="center"; ctx.textBaseline="middle";
  ctx.fillText(String(v), x, y+1); ctx.restore();
}

function snappedRect(sx:number, sy:number, ex:number, ey:number, margin:number, cellW:number, cellH:number, cols:number, rows:number){
  const toCol = (x:number)=> Math.max(0, Math.min(cols-1, Math.floor((x - margin)/cellW)));
  const toRow = (y:number)=> Math.max(0, Math.min(rows-1, Math.floor((y - margin)/cellH)));
  const c1 = toCol(Math.min(sx,ex)), c2 = toCol(Math.max(sx,ex));
  const r1 = toRow(Math.min(sy,ey)), r2 = toRow(Math.max(sy,ey));
  const x1 = margin + c1*cellW, x2 = margin + (c2+1)*cellW;
  const y1 = margin + r1*cellH, y2 = margin + (r2+1)*cellH;
  return { x1,y1,x2,y2 };
}

function drawTimerBar(ctx:CanvasRenderingContext2D, ratio:number){
  const x =  W - 22, y = 16, w = 8, h = H - 32;
  ctx.save(); ctx.fillStyle="#e6e6e6"; ctx.fillRect(x,y,w,h);
  const fillH = Math.max(0, h*ratio), fillY = y + (h - fillH);
  const g = ctx.createLinearGradient(0,y,0,y+h); g.addColorStop(0,"#7be495"); g.addColorStop(1,"#00b894");
  ctx.fillStyle = g; ctx.fillRect(x,fillY,w,fillH); ctx.restore();
}

function drawButton(ctx:CanvasRenderingContext2D, x:number, y:number, w:number, h:number, label:string){
  ctx.save(); ctx.fillStyle="#1f2937"; ctx.fillRect(x,y,w,h);
  ctx.fillStyle="#fff"; ctx.font="16px ui-sans-serif, system-ui"; ctx.textAlign="center"; ctx.textBaseline="middle";
  ctx.fillText(label, x+w/2, y+h/2); ctx.restore();
}
function hitButton(px:number, py:number, x:number, y:number, w:number, h:number){
  return px>=x && px<=x+w && py>=y && py<=y+h;
}
function roundRectPath(ctx:CanvasRenderingContext2D, x:number, y:number, w:number, h:number, r:number){
  const rr = Math.min(r, w/2, h/2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.lineTo(x + w - rr, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
  ctx.lineTo(x + w, y + h - rr);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
  ctx.lineTo(x + rr, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
  ctx.lineTo(x, y + rr);
  ctx.quadraticCurveTo(x, y, x + rr, y);
  ctx.closePath();
}

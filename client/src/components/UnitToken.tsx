import type { UnitView } from '@/types/game';
import { PlayerTag } from '@/types/game';
import { useEffect, useRef } from 'react';

type DrawCallback = (now: number) => void;
const drawRegistry = new Set<DrawCallback>();
let sharedRafId: number | null = null;

function sharedTick(now: number) {
  for (const cb of drawRegistry) cb(now);
  sharedRafId = requestAnimationFrame(sharedTick);
}

function registerDraw(cb: DrawCallback) {
  drawRegistry.add(cb);
  if (sharedRafId === null) sharedRafId = requestAnimationFrame(sharedTick);
}

function unregisterDraw(cb: DrawCallback) {
  drawRegistry.delete(cb);
  if (drawRegistry.size === 0 && sharedRafId !== null) {
    cancelAnimationFrame(sharedRafId);
    sharedRafId = null;
  }
}

const IDLE_FRAME_MS = 83;

interface UnitTokenProps {
  unit: UnitView;
  isSelected: boolean;
  isWalking?: boolean;
  isAttacking?: boolean;
  onClick: () => void;
}

const unitFacingMap = new Map<string, boolean>();

interface AnimPersist {
  frame: number;
  lastMs: number;
  state: string;
  deathDone: boolean;
  lastIdleDraw: number;
}

const swordsmanAnimState = new Map<string, AnimPersist>();
const pikemanAnimState = new Map<string, AnimPersist>();
const archerAnimState = new Map<string, AnimPersist>();
const knightAnimState = new Map<string, AnimPersist>();
const saboteurAnimState = new Map<string, AnimPersist>();

function getActiveState(isWalking: boolean, isAttacking: boolean): string {
  if (isAttacking) return 'standAttack';
  if (isWalking) return 'run';
  return 'idle';
}

type AnimDef = { row: number; frames: number; duration: number };
type AnimMap = Record<string, AnimDef>;

function getAnimPersist(persistMap: Map<string, AnimPersist>, uid: string, now: number): AnimPersist {
  if (!persistMap.has(uid)) {
    persistMap.set(uid, { frame: 0, lastMs: now, state: 'idle', deathDone: false, lastIdleDraw: 0 });
  }
  return persistMap.get(uid)!;
}

function advanceFrame(persist: AnimPersist, anim: AnimDef, newState: string, now: number) {
  if (newState !== persist.state) {
    if (persist.state === 'death') persist.deathDone = false;
    persist.state = newState;
    persist.frame = 0;
    persist.lastMs = now;
  }
  if (now - persist.lastMs >= anim.duration) {
    persist.lastMs = now;
    if (persist.state === 'death') {
      if (!persist.deathDone) {
        if (persist.frame < anim.frames - 1) persist.frame += 1;
        else persist.deathDone = true;
      }
    } else if (persist.state === 'standAttack') {
      if (persist.frame < anim.frames - 1) persist.frame += 1;
    } else {
      persist.frame = (persist.frame + 1) % anim.frames;
    }
  }
}

function drawSpriteFrame(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  persist: AnimPersist,
  anim: AnimDef,
  fw: number,
  fh: number,
  fc: string,
  flip = false,
) {
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, 48, 48);
  if (flip) { ctx.save(); ctx.scale(-1, 1); ctx.translate(-48, 0); }
  ctx.drawImage(img, persist.frame * fw, anim.row * fh, fw, fh, 0, 0, 48, 48);
  if (flip) ctx.restore();
  ctx.fillStyle = `${fc}e6`;
  ctx.fillRect(0, 45, 48, 3);
  ctx.fillStyle = '#00000055';
  ctx.fillRect(0, 45, 48, 1);
}

type PixelRect = { x: number; y: number; w: number; h: number; c: string };

function px(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
}

function drawSprite(ctx: CanvasRenderingContext2D, rects: PixelRect[], fc: string) {
  for (const r of rects) px(ctx, r.x, r.y, r.w, r.h, r.c);
  px(ctx, 0, 29, 32, 3, `${fc}e6`);
  px(ctx, 0, 29, 32, 1, '#00000055');
}

function useUnitCanvas(draw: (ctx: CanvasRenderingContext2D) => void) {
  const ref = useRef<HTMLCanvasElement>(null);
  const drawRef = useRef(draw);
  drawRef.current = draw;
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, 32, 32);
    drawRef.current(ctx);
  }, []);
  return ref;
}

// SWORDSMAN
const SWORDSMAN_ANIMATIONS: AnimMap = {
  idle: { row: 0, frames: 4, duration: 200 },
  run: { row: 1, frames: 6, duration: 100 },
  standAttack: { row: 3, frames: 6, duration: 120 },
  hit: { row: 4, frames: 3, duration: 100 },
  death: { row: 5, frames: 4, duration: 150 },
};

function SwordsmanSprite({ fc, isWalking = false, isAttacking = false, unitId, spriteSrc = '/assets/miniswordman.png' }: { fc: string; isWalking?: boolean; isAttacking?: boolean; unitId: string; spriteSrc?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const fcRef = useRef(fc); fcRef.current = fc;
  const isWalkingRef = useRef(isWalking); isWalkingRef.current = isWalking;
  const isAttackingRef = useRef(isAttacking); isAttackingRef.current = isAttacking;
  const unitIdRef = useRef(unitId); unitIdRef.current = unitId;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = 48; canvas.height = 48;
    if (!imgRef.current) { const img = new Image(); imgRef.current = img; img.src = spriteSrc; }
    const img = imgRef.current;
    function draw(now: number) {
      const ctx = canvas!.getContext('2d');
      if (!ctx || !img.complete || img.naturalWidth === 0) return;
      const uid = unitIdRef.current;
      const persist = getAnimPersist(swordsmanAnimState, uid, now);
      const newState = getActiveState(isWalkingRef.current, isAttackingRef.current);
      const anim = SWORDSMAN_ANIMATIONS[newState] ?? SWORDSMAN_ANIMATIONS.idle;
      if (persist.state === 'idle' && newState === 'idle') {
        if (now - persist.lastIdleDraw < IDLE_FRAME_MS) return;
        persist.lastIdleDraw = now;
      }
      advanceFrame(persist, anim, newState, now);
      drawSpriteFrame(ctx, img, persist, anim, 32, 32, fcRef.current);
    }
    registerDraw(draw);
    return () => unregisterDraw(draw);
  }, [spriteSrc]);

  return <canvas ref={canvasRef} style={{ imageRendering: 'pixelated', display: 'block', width: '100%', height: '100%' }} />;
}

// PIKEMAN
const PIKEMAN_ANIMATIONS: AnimMap = {
  idle: { row: 0, frames: 4, duration: 200 },
  run: { row: 1, frames: 6, duration: 100 },
  standAttack: { row: 3, frames: 7, duration: 120 },
  hit: { row: 4, frames: 3, duration: 100 },
  death: { row: 5, frames: 5, duration: 150 },
};

function PikemanSprite({ fc, isWalking = false, isAttacking = false, unitId }: { fc: string; isWalking?: boolean; isAttacking?: boolean; unitId: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const fcRef = useRef(fc); fcRef.current = fc;
  const isWalkingRef = useRef(isWalking); isWalkingRef.current = isWalking;
  const isAttackingRef = useRef(isAttacking); isAttackingRef.current = isAttacking;
  const unitIdRef = useRef(unitId); unitIdRef.current = unitId;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = 48; canvas.height = 48;
    if (!imgRef.current) { const img = new Image(); imgRef.current = img; img.src = '/assets/minipikeman.png'; }
    const img = imgRef.current;
    function draw(now: number) {
      const ctx = canvas!.getContext('2d');
      if (!ctx || !img.complete || img.naturalWidth === 0) return;
      const uid = unitIdRef.current;
      const persist = getAnimPersist(pikemanAnimState, uid, now);
      const newState = getActiveState(isWalkingRef.current, isAttackingRef.current);
      const anim = PIKEMAN_ANIMATIONS[newState] ?? PIKEMAN_ANIMATIONS.idle;
      if (persist.state === 'idle' && newState === 'idle') {
        if (now - persist.lastIdleDraw < IDLE_FRAME_MS) return;
        persist.lastIdleDraw = now;
      }
      advanceFrame(persist, anim, newState, now);
      drawSpriteFrame(ctx, img, persist, anim, 32, 32, fcRef.current);
    }
    registerDraw(draw);
    return () => unregisterDraw(draw);
  }, []);

  return <canvas ref={canvasRef} style={{ imageRendering: 'pixelated', display: 'block', width: '100%', height: '100%' }} />;
}

// ARCHER
const ARCHER_ANIMATIONS: AnimMap = {
  idle: { row: 0, frames: 4, duration: 200 },
  run: { row: 1, frames: 6, duration: 100 },
  standAttack: { row: 3, frames: 11, duration: 100 },
  death: { row: 6, frames: 4, duration: 150 },
};

function ArcherSprite({ fc, isWalking = false, isAttacking = false, unitId }: { fc: string; isWalking?: boolean; isAttacking?: boolean; unitId: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const fcRef = useRef(fc); fcRef.current = fc;
  const isWalkingRef = useRef(isWalking); isWalkingRef.current = isWalking;
  const isAttackingRef = useRef(isAttacking); isAttackingRef.current = isAttacking;
  const unitIdRef = useRef(unitId); unitIdRef.current = unitId;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = 48; canvas.height = 48;
    if (!imgRef.current) { const img = new Image(); imgRef.current = img; img.src = '/assets/miniarcherman.png'; }
    const img = imgRef.current;
    function draw(now: number) {
      const ctx = canvas!.getContext('2d');
      if (!ctx || !img.complete || img.naturalWidth === 0) return;
      const uid = unitIdRef.current;
      const persist = getAnimPersist(archerAnimState, uid, now);
      const newState = getActiveState(isWalkingRef.current, isAttackingRef.current);
      const anim = ARCHER_ANIMATIONS[newState] ?? ARCHER_ANIMATIONS.idle;
      if (persist.state === 'idle' && newState === 'idle') {
        if (now - persist.lastIdleDraw < IDLE_FRAME_MS) return;
        persist.lastIdleDraw = now;
      }
      advanceFrame(persist, anim, newState, now);
      drawSpriteFrame(ctx, img, persist, anim, 32, 32, fcRef.current);
    }
    registerDraw(draw);
    return () => unregisterDraw(draw);
  }, []);

  return <canvas ref={canvasRef} style={{ imageRendering: 'pixelated', display: 'block', width: '100%', height: '100%' }} />;
}

// KNIGHT
const KNIGHT_ANIMATIONS: AnimMap = {
  idle: { row: 0, frames: 8, duration: 200 },
  run: { row: 1, frames: 6, duration: 100 },
  standAttack: { row: 4, frames: 7, duration: 120 },
  death: { row: 6, frames: 6, duration: 150 },
};

function KnightSprite({ fc, isWalking = false, isAttacking = false, facingLeft = false, unitId }: { fc: string; isWalking?: boolean; isAttacking?: boolean; facingLeft?: boolean; unitId: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const fcRef = useRef(fc); fcRef.current = fc;
  const isWalkingRef = useRef(isWalking); isWalkingRef.current = isWalking;
  const isAttackingRef = useRef(isAttacking); isAttackingRef.current = isAttacking;
  const facingLeftRef = useRef(facingLeft); facingLeftRef.current = facingLeft;
  const unitIdRef = useRef(unitId); unitIdRef.current = unitId;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = 48; canvas.height = 48;
    if (!imgRef.current) { const img = new Image(); imgRef.current = img; img.src = '/assets/knight.png'; }
    const img = imgRef.current;
    function draw(now: number) {
      const ctx = canvas!.getContext('2d');
      if (!ctx || !img.complete || img.naturalWidth === 0) return;
      const uid = unitIdRef.current;
      const persist = getAnimPersist(knightAnimState, uid, now);
      const newState = getActiveState(isWalkingRef.current, isAttackingRef.current);
      const anim = KNIGHT_ANIMATIONS[newState] ?? KNIGHT_ANIMATIONS.idle;
      if (persist.state === 'idle' && newState === 'idle') {
        if (now - persist.lastIdleDraw < IDLE_FRAME_MS) return;
        persist.lastIdleDraw = now;
      }
      advanceFrame(persist, anim, newState, now);
      drawSpriteFrame(ctx, img, persist, anim, 32, 32, fcRef.current, facingLeftRef.current);
    }
    registerDraw(draw);
    return () => unregisterDraw(draw);
  }, []);

  return <canvas ref={canvasRef} style={{ imageRendering: 'pixelated', display: 'block', width: '100%', height: '100%' }} />;
}

// SABOTEUR (pillager)
const SABOTEUR_ANIMATIONS: AnimMap = {
  idle: { row: 0, frames: 4, duration: 200 },
  run: { row: 2, frames: 6, duration: 100 },
  standAttack: { row: 4, frames: 7, duration: 120 },
  hit: { row: 6, frames: 2, duration: 100 },
  death: { row: 7, frames: 6, duration: 150 },
};

function SaboteurSprite({ fc, isWalking = false, isAttacking = false, unitId, spriteSrc }: { fc: string; isWalking?: boolean; isAttacking?: boolean; unitId: string; spriteSrc: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const fcRef = useRef(fc); fcRef.current = fc;
  const isWalkingRef = useRef(isWalking); isWalkingRef.current = isWalking;
  const isAttackingRef = useRef(isAttacking); isAttackingRef.current = isAttacking;
  const unitIdRef = useRef(unitId); unitIdRef.current = unitId;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = 48; canvas.height = 48;
    if (!imgRef.current) { const img = new Image(); imgRef.current = img; img.src = spriteSrc; }
    const img = imgRef.current;
    function draw(now: number) {
      const ctx = canvas!.getContext('2d');
      if (!ctx || !img.complete || img.naturalWidth === 0) return;
      const uid = unitIdRef.current;
      const persist = getAnimPersist(saboteurAnimState, uid, now);
      const newState = getActiveState(isWalkingRef.current, isAttackingRef.current);
      const anim = SABOTEUR_ANIMATIONS[newState] ?? SABOTEUR_ANIMATIONS.idle;
      if (persist.state === 'idle' && newState === 'idle') {
        if (now - persist.lastIdleDraw < IDLE_FRAME_MS) return;
        persist.lastIdleDraw = now;
      }
      advanceFrame(persist, anim, newState, now);
      drawSpriteFrame(ctx, img, persist, anim, 32, 32, fcRef.current);
    }
    registerDraw(draw);
    return () => unregisterDraw(draw);
  }, [spriteSrc]);

  return <canvas ref={canvasRef} style={{ imageRendering: 'pixelated', display: 'block', width: '100%', height: '100%' }} />;
}

// BRUTE (static pixel art)
function BruteSprite({ fc, fd }: { fc: string; fd: string }) {
  const ref = useUnitCanvas((ctx) => {
    const PD = '#505060'; const PDS = '#787888'; const PDK = '#282830';
    const HM = '#404050'; const HMS = '#686878'; const VS = '#cc2020';
    const SK = '#c0905a'; const SKD = '#8a5a30';
    const TR = '#585868'; const TRD = '#303040'; const TRS = '#707080';
    const HH = '#404050'; const HHS = '#686878';
    const SF = '#8b5a2a'; const SFL = '#b07a40';
    const GR = '#404050'; const GRS = '#606070'; const BT = '#1a1820';
    const rects: PixelRect[] = [
      { x: 5, y: 6, w: 3, h: 18, c: '#181410' }, { x: 6, y: 7, w: 2, h: 16, c: SF }, { x: 6, y: 7, w: 1, h: 14, c: SFL },
      { x: 2, y: 2, w: 10, h: 6, c: '#181820' }, { x: 3, y: 3, w: 8, h: 4, c: HH }, { x: 3, y: 3, w: 5, h: 2, c: HHS },
      { x: 10, y: 2, w: 12, h: 8, c: '#181820' }, { x: 11, y: 3, w: 10, h: 7, c: HM }, { x: 12, y: 3, w: 7, h: 3, c: HMS },
      { x: 12, y: 7, w: 8, h: 2, c: VS }, { x: 13, y: 8, w: 6, h: 1, c: '#ff4040' },
      { x: 3, y: 10, w: 10, h: 5, c: '#181820' }, { x: 4, y: 10, w: 8, h: 4, c: PD }, { x: 4, y: 10, w: 6, h: 2, c: PDS }, { x: 3, y: 12, w: 2, h: 2, c: PDK },
      { x: 19, y: 10, w: 10, h: 5, c: '#181820' }, { x: 20, y: 10, w: 8, h: 4, c: PD }, { x: 21, y: 10, w: 6, h: 2, c: PDS }, { x: 27, y: 12, w: 2, h: 2, c: PDK },
      { x: 9, y: 14, w: 14, h: 9, c: '#181820' }, { x: 10, y: 14, w: 12, h: 8, c: TR }, { x: 11, y: 14, w: 7, h: 6, c: TRS }, { x: 19, y: 16, w: 3, h: 5, c: TRD }, { x: 15, y: 14, w: 2, h: 8, c: TRD },
      { x: 9, y: 22, w: 14, h: 2, c: '#181820' }, { x: 10, y: 22, w: 12, h: 2, c: fc }, { x: 11, y: 23, w: 10, h: 1, c: fd }, { x: 14, y: 22, w: 4, h: 2, c: '#c0a030' }, { x: 15, y: 22, w: 2, h: 2, c: '#e8d060' },
      { x: 4, y: 14, w: 6, h: 9, c: '#181410' }, { x: 5, y: 14, w: 5, h: 8, c: SK }, { x: 5, y: 14, w: 3, h: 6, c: '#d8a870' }, { x: 9, y: 16, w: 2, h: 5, c: SKD },
      { x: 22, y: 14, w: 6, h: 9, c: '#181410' }, { x: 22, y: 14, w: 5, h: 8, c: SK }, { x: 23, y: 14, w: 3, h: 6, c: '#d8a870' }, { x: 22, y: 16, w: 2, h: 5, c: SKD },
      { x: 9, y: 24, w: 6, h: 5, c: '#181820' }, { x: 10, y: 24, w: 5, h: 5, c: GR }, { x: 10, y: 24, w: 3, h: 3, c: GRS },
      { x: 17, y: 24, w: 6, h: 5, c: '#181820' }, { x: 17, y: 24, w: 5, h: 5, c: GR }, { x: 18, y: 24, w: 3, h: 3, c: GRS },
      { x: 8, y: 28, w: 8, h: 2, c: BT }, { x: 16, y: 28, w: 8, h: 2, c: BT }, { x: 7, y: 29, w: 3, h: 1, c: BT }, { x: 22, y: 29, w: 3, h: 1, c: BT },
    ];
    drawSprite(ctx, rects, fc);
  });
  return <canvas ref={ref} width={32} height={32} style={{ imageRendering: 'pixelated', display: 'block' }} />;
}

// CATAPULT (static pixel art)
function CatapultSprite({ fc }: { fc: string }) {
  const ref = useUnitCanvas((ctx) => {
    const FR = '#8b5a2a'; const FRL = '#b07840'; const FRD = '#5a3a10'; const FO = '#181410';
    const WH = '#403020'; const WS = '#6b4a1a'; const WH2 = '#808080';
    const ARM = '#6b4a20'; const ARML = '#9b7040';
    const BK = '#505050'; const BKS = '#787878'; const BLD = '#707070'; const BLDS = '#909090';
    const RP = '#c0a030'; const AX = '#909090';
    const rects: PixelRect[] = [
      { x: 7, y: 3, w: 3, h: 8, c: FO }, { x: 8, y: 4, w: 2, h: 7, c: ARM }, { x: 8, y: 4, w: 1, h: 6, c: ARML },
      { x: 10, y: 7, w: 3, h: 5, c: ARM }, { x: 13, y: 10, w: 3, h: 8, c: ARM }, { x: 12, y: 17, w: 5, h: 3, c: AX },
      { x: 9, y: 6, w: 1, h: 5, c: RP },
      { x: 4, y: 1, w: 8, h: 5, c: FO }, { x: 5, y: 2, w: 6, h: 4, c: BK }, { x: 5, y: 2, w: 4, h: 2, c: BKS }, { x: 6, y: 3, w: 4, h: 2, c: BLD }, { x: 6, y: 3, w: 2, h: 1, c: BLDS },
      { x: 2, y: 18, w: 28, h: 3, c: FO }, { x: 3, y: 18, w: 26, h: 2, c: FR }, { x: 3, y: 18, w: 26, h: 1, c: FRL },
      { x: 3, y: 18, w: 4, h: 9, c: FO }, { x: 4, y: 18, w: 3, h: 8, c: FR },
      { x: 25, y: 18, w: 4, h: 9, c: FO }, { x: 25, y: 18, w: 3, h: 8, c: FR }, { x: 28, y: 19, w: 1, h: 7, c: FRD },
      { x: 13, y: 22, w: 6, h: 2, c: fc },
      { x: 1, y: 24, w: 30, h: 3, c: FO }, { x: 2, y: 24, w: 28, h: 2, c: FRD }, { x: 5, y: 25, w: 22, h: 2, c: AX },
      { x: 0, y: 23, w: 11, h: 9, c: FO }, { x: 1, y: 24, w: 9, h: 7, c: WH }, { x: 4, y: 23, w: 3, h: 9, c: FRD }, { x: 0, y: 26, w: 11, h: 3, c: FRD }, { x: 3, y: 25, w: 5, h: 4, c: WH2 },
      { x: 21, y: 23, w: 11, h: 9, c: FO }, { x: 22, y: 24, w: 9, h: 7, c: WH }, { x: 25, y: 23, w: 3, h: 9, c: FRD }, { x: 21, y: 26, w: 11, h: 3, c: FRD }, { x: 24, y: 25, w: 5, h: 4, c: WH2 },
    ];
    drawSprite(ctx, rects, fc);
  });
  return <canvas ref={ref} width={32} height={32} style={{ imageRendering: 'pixelated', display: 'block' }} />;
}

const BLUE = '#4488ee';
const BLUE_DARK = '#2255aa';
const RED = '#ee4444';
const RED_DARK = '#aa2222';
const NEUTRAL = '#888877';

function HealthBar({ hp, maxHp }: { hp: number; maxHp: number }) {
  const pct = Math.max(0, Math.min(1, hp / maxHp));
  const filled = Math.round(pct * 28);
  const fill = pct > 0.6 ? '#44dd44' : pct > 0.3 ? '#ddcc00' : '#dd2222';
  return (
    <svg width="32" height="6" viewBox="0 0 32 6" style={{ imageRendering: 'pixelated', display: 'block', flexShrink: 0 }} shapeRendering="crispEdges" aria-hidden="true">
      <rect x="0" y="0" width="32" height="6" fill="#111111" />
      <rect x="1" y="1" width="30" height="4" fill="#333333" />
      {filled > 0 && <rect x="1" y="1" width={filled} height="4" fill={fill} />}
      {filled > 0 && <rect x="1" y="1" width={filled} height="1" fill={`${fill}88`} />}
    </svg>
  );
}

export function UnitToken({ unit, isSelected, isWalking = false, isAttacking = false, onClick }: UnitTokenProps) {
  const isBlue = unit.owner === PlayerTag.blue;
  const isDone = unit.moved && unit.attacked;
  const fc = isBlue ? BLUE : RED;
  const fd = isBlue ? BLUE_DARK : RED_DARK;

  const prevXRef = useRef<number | null>(null);
  const facingLeftRef = useRef<boolean>(unitFacingMap.get(String(unit.id)) ?? false);

  const currentX = unit.pos.x;
  if (prevXRef.current !== null && currentX !== prevXRef.current) {
    const movingLeft = currentX < prevXRef.current;
    facingLeftRef.current = movingLeft;
    unitFacingMap.set(String(unit.id), movingLeft);
  }
  prevXRef.current = currentX;

  // 'pillager' maps to the 'saboteur' sprite sheet
  const displayKind = unit.kind === 'pillager' ? 'saboteur' : unit.kind;

  const uid = String(unit.id);
  let sprite: React.ReactNode;
  switch (displayKind) {
    case 'pikeman':   sprite = <PikemanSprite   fc={fc} isWalking={isWalking} isAttacking={isAttacking} unitId={uid} />; break;
    case 'archer':    sprite = <ArcherSprite    fc={fc} isWalking={isWalking} isAttacking={isAttacking} unitId={uid} />; break;
    case 'knight':    sprite = <KnightSprite    fc={fc} isWalking={isWalking} isAttacking={isAttacking} facingLeft={facingLeftRef.current} unitId={uid} />; break;
    case 'saboteur':  sprite = <SaboteurSprite  fc={fc} isWalking={isWalking} isAttacking={isAttacking} unitId={uid} spriteSrc={isBlue ? '/assets/saboteur_blue.png' : '/assets/saboteur_red.png'} />; break;
    case 'brute':     sprite = <BruteSprite     fc={fc} fd={fd} />; break;
    case 'catapult':  sprite = <CatapultSprite  fc={fc} />; break;
    default:          sprite = <SwordsmanSprite fc={fc} isWalking={isWalking} isAttacking={isAttacking} unitId={uid} spriteSrc={isBlue ? '/assets/miniswordman.png' : '/assets/RedMiniSwordMan.png'} />;
  }

  const selectedOutlineColor = isBlue ? '#88aaff' : '#ffaa88';

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`${isBlue ? 'Blue' : 'Red'} ${unit.kind}, ${unit.hp} HP`}
      className="absolute inset-0 m-auto flex flex-col items-center justify-center focus-visible:outline-none cursor-pointer select-none"
      style={{ width: '90%', height: '90%' }}
    >
      <HealthBar hp={unit.hp} maxHp={unit.maxHp} />
      <div style={{ height: 2 }} />
      <div
        style={{
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          opacity: isDone ? 0.45 : 1,
          filter: isDone ? 'saturate(0.3)' : undefined,
          boxShadow: isSelected ? `0 0 0 2px ${selectedOutlineColor}, 0 0 8px 2px ${selectedOutlineColor}88` : undefined,
          borderRadius: 2,
        }}
      >
        {sprite}
      </div>
    </button>
  );
}

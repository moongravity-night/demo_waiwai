import "pixi.js/accessibility";
import {
  Application,
  AccessibilitySystem,
  Container,
  Graphics,
  GraphicsContext,
  type Ticker,
} from "pixi.js";
import type { BoardState, Tetromino, TetrominoType } from "../types/game";
import { createPieceHitArea } from "./pieceHitArea";

const CELL = 40;
const HOVER_HIT_PADDING = 5;
const GRID_COLOR = 0x514b46;
const GRID_ALPHA = 0.065;
const GRID_BOUNDARY_ALPHA = 0.1;
const COLORS: Record<TetrominoType, number> = {
  I: 0x64b6c4,
  J: 0x6379b8,
  L: 0xe8a75c,
  O: 0xe4cf63,
  S: 0x7eb98a,
  T: 0xa782b8,
  Z: 0xd87972,
};

interface PieceView {
  container: Container;
  visual: Container;
  width: number;
  height: number;
  removing: boolean;
  hovered: boolean;
  hoverAmount: number;
  feedbackActive: boolean;
  baseZIndex: number;
}

interface Animation {
  elapsed: number;
  duration: number;
  update: (progress: number) => void;
  complete?: () => void;
}

interface Particle {
  graphic: Graphics;
  velocityX: number;
  velocityY: number;
  gravity: number;
  life: number;
  maxLife: number;
}

export class PixiGame {
  private readonly app = new Application();
  private readonly scene = new Container({ label: "anti-tetris-scene" });
  private readonly environment = new Container({ label: "environment" });
  private readonly piecesLayer = new Container({ label: "pieces", sortableChildren: true });
  private readonly effectsLayer = new Container({ label: "effects" });
  private readonly pieceViews = new Map<string, PieceView>();
  private readonly animations: Animation[] = [];
  private readonly particles: Particle[] = [];
  private readonly particlePool: Graphics[] = [];
  private readonly pressedPieces = new Map<number, string>();
  private board?: BoardState;
  private resizeObserver?: ResizeObserver;
  private reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  constructor(
    private readonly host: HTMLElement,
    private readonly onSelect: (id: string) => void,
  ) {}

  async init(board: BoardState): Promise<void> {
    AccessibilitySystem.defaultOptions.deactivateOnMouseMove = true;
    AccessibilitySystem.defaultOptions.activateOnTab = true;
    AccessibilitySystem.defaultOptions.enabledByDefault = false;
    await this.app.init({
      resizeTo: this.host,
      backgroundAlpha: 0,
      antialias: true,
      autoDensity: true,
      resolution: Math.min(window.devicePixelRatio, 2),
      preference: "webgl",
      failIfMajorPerformanceCaveat: false,
      powerPreference: "high-performance",
      eventFeatures: { move: true, globalMove: false, click: true, wheel: false },
    });

    this.app.canvas.className = "pixi-canvas";
    this.host.appendChild(this.app.canvas);
    this.scene.addChild(this.environment, this.piecesLayer, this.effectsLayer);
    this.app.stage.addChild(this.scene);
    this.setBoard(board);

    this.app.ticker.add((ticker) => this.update(ticker));
    this.resizeObserver = new ResizeObserver(() => this.layout());
    this.resizeObserver.observe(this.host);
    this.layout();

    window.matchMedia("(prefers-reduced-motion: reduce)").addEventListener("change", (event) => {
      this.reducedMotion = event.matches;
    });
  }

  setBoard(board: BoardState): void {
    for (const view of this.pieceViews.values()) view.container.destroy({ children: true });
    this.piecesLayer.removeChildren();
    this.effectsLayer.removeChildren().forEach((child) => child.destroy({ children: true }));
    this.pieceViews.clear();
    this.pressedPieces.clear();
    this.animations.length = 0;
    this.particles.length = 0;
    this.particlePool.length = 0;
    this.piecesLayer.position.set(0, 0);
    this.piecesLayer.alpha = 1;
    this.environment.alpha = 1;
    this.scene.alpha = 1;
    this.board = board;
    this.drawEnvironment(board);
    for (const piece of board.tetrominoes) this.createPiece(piece);
    this.layout();
  }

  onTick(callback: (ticker: Ticker) => void): void {
    this.app.ticker.add(callback);
  }

  setPaused(paused: boolean): void {
    this.scene.alpha = paused ? 0.74 : 1;
    this.piecesLayer.eventMode = paused ? "none" : "passive";
    for (const view of this.pieceViews.values()) {
      view.container.accessible = !paused;
    }
  }

  animateRemoval(piece: Tetromino): void {
    const view = this.pieceViews.get(piece.id);
    if (!view || view.removing) return;
    view.removing = true;
    view.hovered = false;
    view.hoverAmount = 0;
    view.container.eventMode = "none";
    view.visual.position.set(0, 0);
    view.visual.scale.set(1);
    this.spawnParticles(view, COLORS[piece.type]);

    const startY = view.container.y;
    const duration = this.reducedMotion ? 150 : 500;
    this.animate(duration, (progress) => {
      const compressed = Math.min(progress / 0.13, 1);
      const released = Math.min(Math.max((progress - 0.13) / 0.16, 0), 1);
      const flight = Math.max((progress - 0.22) / 0.78, 0);

      if (progress < 0.13) view.container.scale.set(1 + compressed * 0.02, 1 - compressed * 0.04);
      else if (progress < 0.29) view.container.scale.set(1.02 - released * 0.02, 0.96 + released * 0.07);
      else view.container.scale.set(1, 1.03 - flight * 0.03);

      const easedFlight = 1 - Math.pow(1 - flight, 3);
      view.container.y = startY - easedFlight * (this.board!.height * CELL + view.height + 70);
      view.container.alpha = flight > 0.78 ? 1 - (flight - 0.78) / 0.22 : 1;
    }, () => {
      view.container.removeFromParent();
      view.container.destroy({ children: true });
      this.pieceViews.delete(piece.id);
    });
  }

  animateBlocked(pieceId: string, blockerIds: string[]): void {
    const selected = this.pieceViews.get(pieceId);
    if (selected && !selected.removing) {
      selected.feedbackActive = true;
      this.spawnBlockedImpact(selected);
      this.animate(this.reducedMotion ? 120 : 230, (progress) => {
        const resistance = Math.sin(progress * Math.PI) * 4;
        const shake = Math.sin(progress * Math.PI * 5) * (1 - progress) * 1.5;
        selected.visual.x = shake;
        selected.visual.y = -resistance;
      }, () => {
        selected.visual.position.set(0, 0);
        selected.feedbackActive = false;
      });
    }

    for (const blockerId of blockerIds) {
      const blocker = this.pieceViews.get(blockerId);
      if (!blocker || blocker.removing) continue;
      blocker.feedbackActive = true;
      this.animate(this.reducedMotion ? 120 : 300, (progress) => {
        blocker.visual.alpha = 1 - Math.sin(progress * Math.PI) * 0.14;
        blocker.visual.scale.set(1 + Math.sin(progress * Math.PI) * 0.018);
      }, () => {
        blocker.visual.alpha = 1;
        blocker.feedbackActive = false;
      });
    }
  }

  celebrate(campaignComplete = false): void {
    if (!this.board) return;
    const boardWidth = this.board.width * CELL;
    const boardHeight = this.board.height * CELL;
    const centerX = boardWidth / 2;
    const centerY = boardHeight * 0.42;
    const accent = campaignComplete ? 0xd8b45b : 0xe4cf63;
    const duration = this.reducedMotion ? 260 : campaignComplete ? 1550 : 1150;
    const burst = new Container({ label: campaignComplete ? "campaign-complete-effect" : "level-complete-effect" });
    const rays = new Graphics();
    const ring = new Graphics()
      .circle(0, 0, campaignComplete ? 72 : 58)
      .stroke({ color: accent, alpha: 0.52, width: campaignComplete ? 2 : 1.4 });
    const sparkles = new Graphics();
    const rayCount = campaignComplete ? 16 : 10;

    for (let index = 0; index < rayCount; index += 1) {
      const angle = (index / rayCount) * Math.PI * 2;
      const inner = campaignComplete ? 88 : 72;
      const outer = inner + (index % 2 === 0 ? 42 : 24);
      rays.moveTo(Math.cos(angle) * inner, Math.sin(angle) * inner);
      rays.lineTo(Math.cos(angle) * outer, Math.sin(angle) * outer);
    }
    rays.stroke({ color: accent, alpha: campaignComplete ? 0.42 : 0.28, width: 1.5, cap: "round" });

    const sparkleCount = campaignComplete ? 14 : 7;
    for (let index = 0; index < sparkleCount; index += 1) {
      const angle = (index / sparkleCount) * Math.PI * 2 + 0.18;
      const distance = (campaignComplete ? 126 : 98) + (index % 3) * 16;
      sparkles
        .regularPoly(Math.cos(angle) * distance, Math.sin(angle) * distance, campaignComplete ? 3.4 : 2.6, 4, Math.PI / 4)
        .fill({ color: accent, alpha: campaignComplete ? 0.72 : 0.46 });
    }

    burst.addChild(rays, ring, sparkles);
    burst.position.set(centerX, centerY);
    burst.scale.set(0.62);
    burst.alpha = 0;
    const light = new Graphics().rect(0, 0, boardWidth, boardHeight).fill({ color: accent, alpha: 0.08 });
    light.alpha = 0;
    this.effectsLayer.addChild(light, burst);

    this.animate(duration, (progress) => {
      const eased = 1 - Math.pow(1 - progress, 3);
      const wave = Math.sin(progress * Math.PI);
      const fade = progress < 0.72 ? Math.min(progress / 0.18, 1) : (1 - progress) / 0.28;
      burst.alpha = Math.max(0, fade);
      burst.scale.set(0.62 + eased * (campaignComplete ? 1.05 : 0.78));
      burst.rotation = (campaignComplete ? 0.12 : 0.06) * eased;
      light.alpha = wave;
      this.environment.alpha = 1 - wave * (campaignComplete ? 0.24 : 0.16);
      this.piecesLayer.alpha = 1 - wave * 0.12;
    }, () => {
      this.environment.alpha = 1;
      this.piecesLayer.alpha = 1;
      light.destroy();
      burst.destroy({ children: true });
    });
  }

  fail(): void {
    if (!this.board) return;
    const width = this.board.width * CELL;
    const height = this.board.height * CELL;
    const duration = this.reducedMotion ? 180 : 720;
    const veil = new Graphics().rect(0, 0, width, height).fill({ color: 0xa9544f, alpha: 0.16 });
    const line = new Graphics().rect(0, -1, width, 2).fill({ color: 0xb96058, alpha: 0.48 });
    veil.alpha = 0;
    line.alpha = 0;
    this.effectsLayer.addChild(veil, line);
    this.piecesLayer.eventMode = "none";

    this.animate(duration, (progress) => {
      const eased = 1 - Math.pow(1 - progress, 3);
      veil.alpha = eased;
      line.alpha = this.reducedMotion ? 0 : Math.sin(progress * Math.PI) * 0.72;
      line.y = height * eased;
      this.piecesLayer.y = eased * 7;
      this.piecesLayer.alpha = 1 - eased * 0.42;
      this.environment.alpha = 1 - eased * 0.25;
    });
  }

  destroy(): void {
    this.resizeObserver?.disconnect();
    this.app.destroy(
      { removeView: true, releaseGlobalResources: true },
      { children: true, texture: true, textureSource: true },
    );
  }

  private createPiece(piece: Tetromino): void {
    const minX = Math.min(...piece.cells.map((cell) => cell.x));
    const minY = Math.min(...piece.cells.map((cell) => cell.y));
    const maxX = Math.max(...piece.cells.map((cell) => cell.x));
    const maxY = Math.max(...piece.cells.map((cell) => cell.y));
    const width = (maxX - minX + 1) * CELL;
    const height = (maxY - minY + 1) * CELL;
    const container = new Container({ label: piece.id, sortableChildren: false });
    const shadow = new Graphics();
    const body = new Graphics();
    const highlight = new Graphics();
    const visual = new Container({ label: `${piece.id}-visual`, eventMode: "none" });
    const color = COLORS[piece.type];
    const localCells = piece.cells.map((cell) => ({ x: cell.x - minX, y: cell.y - minY }));

    for (const cell of localCells) {
      const x = cell.x * CELL;
      const y = cell.y * CELL;
      shadow.chamferRect(x + 3.5, y + 5, CELL - 2, CELL - 2, 4).fill({ color: 0x453f3a, alpha: 0.12 });
      body
        .chamferRect(x + 1, y + 1, CELL - 2, CELL - 2, 4)
        .fill(color)
        .stroke({ width: 1, color: 0x3d3733, alpha: 0.13, alignment: 1 });
      highlight
        .moveTo(x + 5, y + 5)
        .lineTo(x + CELL - 7, y + 5)
        .lineTo(x + CELL - 10, y + 8)
        .lineTo(x + 7, y + 8)
        .closePath()
        .fill({ color: 0xffffff, alpha: 0.17 });
    }

    visual.addChild(shadow, body, highlight);
    container.addChild(visual);
    container.position.set(minX * CELL, minY * CELL);
    container.origin.set(width / 2, height / 2);
    container.eventMode = "static";
    container.interactiveChildren = false;
    container.cursor = "pointer";
    container.accessible = true;
    container.accessibleTitle = `Фигура ${piece.type}`;
    container.accessibleHint = `Фигура ${piece.type}. Активируйте, чтобы попробовать удалить её`;
    container.tabIndex = piece.placementOrder + 1;
    container.on("pointerenter", () => this.hoverPiece(piece.id, true));
    container.on("pointerleave", () => this.hoverPiece(piece.id, false));
    container.zIndex = piece.placementOrder;
    this.piecesLayer.addChild(container);
    const view: PieceView = {
      container,
      visual,
      width,
      height,
      removing: false,
      hovered: false,
      hoverAmount: 0,
      feedbackActive: false,
      baseZIndex: piece.placementOrder,
    };
    container.hitArea = createPieceHitArea(localCells, CELL, () => view.hovered ? HOVER_HIT_PADDING : 0);
    container.on("pointerdown", (event) => {
      if (event.button === 0) this.pressedPieces.set(event.pointerId, piece.id);
    });
    container.on("pointertap", (event) => {
      const selectedId = this.pressedPieces.get(event.pointerId) ?? piece.id;
      this.pressedPieces.delete(event.pointerId);
      this.onSelect(selectedId);
    });
    container.on("pointerupoutside", (event) => {
      this.app.ticker.addOnce(() => this.pressedPieces.delete(event.pointerId));
    });
    container.on("pointercancel", (event) => this.pressedPieces.delete(event.pointerId));
    this.pieceViews.set(piece.id, view);
  }

  private hoverPiece(id: string, hovered: boolean): void {
    const view = this.pieceViews.get(id);
    if (!view || view.removing) return;
    view.hovered = hovered;
    view.container.zIndex = hovered ? 1000 + view.baseZIndex : view.baseZIndex;
  }

  private drawEnvironment(board: BoardState): void {
    this.environment.removeChildren().forEach((child) => child.destroy());
    const width = board.width * CELL;
    const height = board.height * CELL;
    const architecture = new Graphics();

    architecture
      .moveTo(-36, height + 2)
      .lineTo(width + 36, height + 2)
      .lineTo(width + 18, height + 24)
      .lineTo(-18, height + 24)
      .closePath()
      .fill({ color: 0xd7cfc1, alpha: 0.88 });
    architecture
      .moveTo(-18, height + 24)
      .lineTo(width + 18, height + 24)
      .lineTo(width + 7, height + 34)
      .lineTo(-7, height + 34)
      .closePath()
      .fill({ color: 0xc8bfb1, alpha: 0.66 });

    const grid = new Graphics();
    for (let x = 0; x <= board.width; x += 1) {
      grid.rect(x * CELL - 0.5, 0, 1, height).fill({
        color: GRID_COLOR,
        alpha: x === 0 || x === board.width ? GRID_BOUNDARY_ALPHA : GRID_ALPHA,
      });
    }
    for (let y = 0; y <= board.height; y += 1) {
      grid.rect(0, y * CELL - 0.5, width, 1).fill({
        color: GRID_COLOR,
        alpha: y === 0 || y === board.height ? GRID_BOUNDARY_ALPHA : GRID_ALPHA,
      });
    }

    this.environment.addChild(architecture, grid);
  }

  private layout(): void {
    if (!this.board || !this.app.renderer) return;
    const width = this.app.screen.width;
    const height = this.app.screen.height;
    const boardWidth = this.board.width * CELL;
    const boardHeight = this.board.height * CELL + 38;
    const horizontalPadding = width < 600 ? 26 : 110;
    const verticalPadding = width < 600 ? Math.max(128, height * 0.16) : 128;
    const scale = Math.min((width - horizontalPadding) / boardWidth, (height - verticalPadding) / boardHeight);
    this.scene.scale.set(scale);
    this.scene.position.set((width - this.board.width * CELL * scale) / 2, (height - boardHeight * scale) / 2 + 18);
  }

  private animate(duration: number, update: (progress: number) => void, complete?: () => void): void {
    this.animations.push({ elapsed: 0, duration, update, complete });
  }

  private update(ticker: Ticker): void {
    const hoverResponse = this.reducedMotion ? 1 : 1 - Math.exp(-ticker.deltaMS / 48);
    for (const view of this.pieceViews.values()) {
      if (view.removing || view.feedbackActive) continue;
      const target = view.hovered ? 1 : 0;
      view.hoverAmount += (target - view.hoverAmount) * hoverResponse;
      if (Math.abs(target - view.hoverAmount) < 0.001) view.hoverAmount = target;
      view.visual.y = -4 * view.hoverAmount;
      view.visual.scale.set(1 + 0.012 * view.hoverAmount);
    }

    for (let index = this.animations.length - 1; index >= 0; index -= 1) {
      const animation = this.animations[index]!;
      animation.elapsed += ticker.deltaMS;
      const progress = Math.min(animation.elapsed / animation.duration, 1);
      animation.update(progress);
      if (progress >= 1) {
        this.animations.splice(index, 1);
        animation.complete?.();
      }
    }

    for (let index = this.particles.length - 1; index >= 0; index -= 1) {
      const particle = this.particles[index]!;
      const delta = ticker.deltaMS / 1000;
      particle.life -= ticker.deltaMS;
      particle.velocityY += particle.gravity * delta;
      particle.graphic.x += particle.velocityX * delta;
      particle.graphic.y += particle.velocityY * delta;
      particle.graphic.alpha = Math.max(0, particle.life / particle.maxLife);
      if (particle.life <= 0) {
        particle.graphic.visible = false;
        this.particlePool.push(particle.graphic);
        this.particles.splice(index, 1);
      }
    }
  }

  private spawnParticles(view: PieceView, color: number): void {
    const count = this.reducedMotion ? 4 : 8;
    for (let index = 0; index < count; index += 1) {
      const graphic = this.particlePool.pop() ?? new Graphics(new GraphicsContext().circle(0, 0, 2.2).fill(0xffffff));
      if (!graphic.parent) this.effectsLayer.addChild(graphic);
      graphic.visible = true;
      graphic.tint = color;
      graphic.alpha = 0.8;
      graphic.position.set(
        view.container.x + view.width * (0.2 + Math.random() * 0.6),
        view.container.y + view.height * (0.2 + Math.random() * 0.5),
      );
      const life = 280 + Math.random() * 180;
      this.particles.push({
        graphic,
        velocityX: (Math.random() - 0.5) * 36,
        velocityY: -55 - Math.random() * 85,
        gravity: -25,
        life,
        maxLife: life,
      });
    }
  }

  private spawnBlockedImpact(view: PieceView): void {
    const impact = new Container({ label: "blocked-impact" });
    const frame = new Graphics()
      .roundRect(-view.width / 2 - 6, -view.height / 2 - 6, view.width + 12, view.height + 12, 7)
      .stroke({ color: 0xb96058, alpha: 0.62, width: 2 });
    const pressure = new Graphics()
      .moveTo(-12, -view.height / 2 - 14)
      .lineTo(0, -view.height / 2 - 7)
      .lineTo(12, -view.height / 2 - 14)
      .stroke({ color: 0xb96058, alpha: 0.58, width: 1.7, cap: "round", join: "round" });
    impact.addChild(frame, pressure);
    impact.position.set(view.container.x + view.width / 2, view.container.y + view.height / 2);
    impact.scale.set(0.92);
    impact.alpha = 0.85;
    this.effectsLayer.addChild(impact);

    this.animate(this.reducedMotion ? 120 : 260, (progress) => {
      impact.scale.set(0.92 + progress * 0.18);
      impact.alpha = 0.85 * (1 - progress);
    }, () => impact.destroy({ children: true }));
  }
}

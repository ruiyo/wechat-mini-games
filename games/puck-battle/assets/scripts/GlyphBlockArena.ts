import {
  BoxCollider2D, Collider2D, Color, Contact2DType,
  ERigidBody2DType, Graphics, Label, Node, RigidBody2D, Size, UITransform,
} from 'cc';
import type { AmmoDefinition } from './AmmoFactory';
import type { ArcadeStage, GlyphBlockSeed } from './ArcadeProgression';
import { chainPoints } from './FusionRules';

export interface GlyphShot {
  readonly collider: Collider2D;
  readonly ammo: AmmoDefinition;
  readonly index: number;
}
export interface GlyphBlockHit {
  x: number;
  y: number;
  glyph: string | null;
  broken: boolean;
  boss: boolean;
  chain: number;
  points: number;
  hpLeft: number;
}
interface Block {
  seed: GlyphBlockSeed;
  node: Node;
  body: RigidBody2D;
  collider: BoxCollider2D;
  graphics: Graphics;
  label: Label;
  hp: number;
  x: number;
  y: number;
}
interface PendingHit {
  block: Block;
  shot: GlyphShot;
  damage: number;
}

/**
 * Rigid, breakable Hanzi tiles in the physics arena.
 * Contact callbacks enqueue events; removing physics bodies happens in update,
 * never while Box2D is locked solving the contact manifold.
 */
export class GlyphBlockArena {
  private blocks: Block[] = [];
  private readonly byCollider = new Map<Collider2D, Block>();
  private pucks: GlyphShot[] = [];
  private active: GlyphShot | null = null;
  private pending: PendingHit[] = [];
  private lastHit = new Map<string, number>();
  private elapsed = 0;
  private shotChain = 0;
  private bonusDamage = 0;
  private bonusChain = 0;

  constructor(
    private readonly parent: Node,
    private readonly makeNode: (name: string) => Node,
  ) {}

  get remaining(): number { return this.blocks.length; }
  get chainCount(): number { return this.shotChain; }
  get glyphsRemaining(): string[] { return this.blocks.map((b) => b.seed.glyph); }
  get tiles(): ReadonlyArray<{ x: number; y: number; glyph: string; hp: number; boss: boolean }> {
    return this.blocks.map((block) => ({
      x: block.x, y: block.y, glyph: block.seed.glyph,
      hp: block.hp, boss: block.seed.boss,
    }));
  }

  configure(bonusDamage: number, bonusChain: number): void {
    this.bonusDamage = Math.max(0, Math.floor(bonusDamage));
    this.bonusChain = Math.max(0, bonusChain);
  }

  startStage(stage: ArcadeStage, arenaWidth: number, arenaHeight: number,
    arenaCenterY: number): void {
    this.clear();
    for (const seed of stage.blocks) {
      const x = seed.x * arenaWidth;
      const y = arenaCenterY + seed.y * arenaHeight;
      const width = seed.boss ? 92 : 74;
      const height = seed.boss ? 59 : 51;
      const node = this.makeNode('HanziBlock_' + seed.id);
      this.parent.addChild(node);
      node.setPosition(x, y, 0);
      node.addComponent(UITransform).setContentSize(width, height);
      const graphics = node.addComponent(Graphics);

      const glyphLabelNode = this.makeNode('Hanzi');
      node.addChild(glyphLabelNode);
      glyphLabelNode.addComponent(UITransform).setContentSize(width, height);
      const label = glyphLabelNode.addComponent(Label);
      label.horizontalAlign = Label.HorizontalAlign.CENTER;
      label.verticalAlign = Label.VerticalAlign.CENTER;
      label.fontSize = seed.boss ? 23 : 22;
      label.color = Color.WHITE;

      const body = node.addComponent(RigidBody2D);
      body.type = ERigidBody2DType.Static;
      body.gravityScale = 0;
      body.group = 1;
      body.enabledContactListener = true;
      const collider = node.addComponent(BoxCollider2D);
      collider.size = new Size(width, height);
      collider.group = 1;
      collider.sensor = false;
      collider.friction = 0.14;
      collider.restitution = seed.boss ? 0.45 : 0.64;
      collider.apply();

      const block: Block = {
        seed, node, body, collider, graphics, label,
        x, y, hp: seed.hp,
      };
      this.blocks.push(block);
      this.byCollider.set(collider, block);
      this.redraw(block);
      collider.on(Contact2DType.BEGIN_CONTACT, this.onCollision, this);
    }
  }

  private redraw(block: Block): void {
    const g = block.graphics;
    const w = block.seed.boss ? 92 : 74;
    const h = block.seed.boss ? 59 : 51;
    g.clear();
    g.fillColor = block.seed.boss ? new Color(176, 90, 130, 255)
      : block.hp > 1 ? new Color(84, 137, 202, 255)
      : new Color(76, 176, 176, 255);
    g.roundRect(-w / 2, -h / 2, w, h, block.seed.boss ? 16 : 11);
    g.fill();
    g.lineWidth = block.seed.boss ? 4 : 3;
    g.strokeColor = new Color(255, 255, 255, 250);
    g.roundRect(-w / 2, -h / 2, w, h, 11);
    g.stroke();
    block.label.string = block.seed.glyph + (block.hp > 1 ? ' ' + block.hp : '');
  }

  registerPuck(puck: GlyphShot): void {
    if (this.pucks.some((existing) => existing.collider === puck.collider)) return;
    this.pucks.push(puck);
    puck.collider.on(Contact2DType.BEGIN_CONTACT, this.onCollision, this);
  }

  unregisterPuck(puck: GlyphShot): void {
    const index = this.pucks.indexOf(puck);
    if (index >= 0) this.pucks.splice(index, 1);
    if (puck?.collider && typeof puck.collider.off === 'function') {
      puck.collider.off(Contact2DType.BEGIN_CONTACT, this.onCollision, this);
    }
    this.pending = this.pending.filter((hit) => hit.shot !== puck);
    if (this.active === puck) this.active = null;
  }

  beginShot(puck: GlyphShot): void {
    this.active = puck;
    this.elapsed = 0;
    this.shotChain = 0;
    this.lastHit.clear();
    this.pending.length = 0;
  }
  endShot(): void {
    this.active = null;
    this.pending.length = 0;
    this.lastHit.clear();
  }

  private onCollision(self: Collider2D, other: Collider2D): void {
    if (!this.active) return;
    const block = this.byCollider.get(self) || this.byCollider.get(other);
    const puckCollider = this.byCollider.has(self) ? other : self;
    if (!block || this.active.collider !== puckCollider) return;
    const key = block.seed.id + ':' + this.active.index;
    const last = this.lastHit.get(key);
    if (last !== undefined && this.elapsed - last < 0.22) return;
    this.lastHit.set(key, this.elapsed);
    const bonus = this.active.ammo.type === 'impact' ? 1 : 0;
    this.pending.push({
      block, shot: this.active, damage: 1 + bonus + this.bonusDamage,
    });
  }

  private damage(block: Block, amount: number): GlyphBlockHit | null {
    if (!this.byCollider.has(block.collider) || amount <= 0) return null;
    block.hp = Math.max(0, block.hp - amount);
    this.shotChain += 1;
    const broken = block.hp === 0;
    const basePoints = broken ? (block.seed.boss ? 250 : 50) : 12;
    const result: GlyphBlockHit = {
      x: block.x, y: block.y,
      glyph: broken && !block.seed.boss ? block.seed.glyph : null,
      broken, boss: block.seed.boss,
      chain: this.shotChain,
      points: chainPoints(basePoints, this.shotChain, this.bonusChain),
      hpLeft: block.hp,
    };
    if (broken) {
      this.byCollider.delete(block.collider);
      const index = this.blocks.indexOf(block);
      if (index >= 0) this.blocks.splice(index, 1);
      block.collider.off(Contact2DType.BEGIN_CONTACT, this.onCollision, this);
      block.node.destroy();
    } else {
      this.redraw(block);
    }
    return result;
  }

  update(deltaTime: number): GlyphBlockHit[] {
    if (!this.active) return [];
    this.elapsed += Math.max(0, deltaTime);
    const queued = this.pending.splice(0);
    const events: GlyphBlockHit[] = [];
    for (const hit of queued) {
      if (hit.shot !== this.active) continue;
      const event = this.damage(hit.block, hit.damage);
      if (event) events.push(event);
    }
    return events;
  }

  /** Fusions create a shockwave that can chain across several glyph blocks. */
  applyFusionBurst(x: number, y: number, radius: number,
    damage: number): GlyphBlockHit[] {
    const events: GlyphBlockHit[] = [];
    if (!this.active) return events;
    for (const block of this.blocks.slice()) {
      if (Math.hypot(block.x - x, block.y - y) > radius) continue;
      const event = this.damage(block, damage + this.bonusDamage);
      if (event) events.push(event);
    }
    return events;
  }

  clear(): void {
    this.endShot();
    for (const puck of this.pucks.slice()) this.unregisterPuck(puck);
    for (const block of this.blocks) {
      if (block.collider && typeof block.collider.off === 'function') {
        block.collider.off(Contact2DType.BEGIN_CONTACT, this.onCollision, this);
      }
      block.node.destroy();
    }
    this.blocks.length = 0;
    this.byCollider.clear();
    this.pending.length = 0;
    this.shotChain = 0;
  }
}

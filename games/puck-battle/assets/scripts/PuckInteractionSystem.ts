import {
  CircleCollider2D, Collider2D, Color, Contact2DType, Graphics,
  Node, RigidBody2D, Vec2,
} from 'cc';
import type { AmmoDefinition } from './AmmoFactory';
import {
  INTERACTION_CONFIG, calculatePuckContact, calculateImpactPush,
  calculateMagnetDeltaVelocity,
} from './PuckInteractionRules';
import { StableColliderRegistry } from './StableColliderRegistry';

export interface InteractionPuck {
  readonly node: Node;
  readonly body: RigidBody2D;
  readonly collider: CircleCollider2D;
  readonly ammo: AmmoDefinition;
  readonly index: number;
  freezeRemaining: number;
}
export interface CollisionFeedback {
  text: string;
  color: [number, number, number];
  x: number;
  y: number;
}
interface QueuedContact {
  source: InteractionPuck;
  target: InteractionPuck;
  nx: number;
  ny: number;
  speed: number;
  x: number;
  y: number;
}
interface HitPulse {
  x: number;
  y: number;
  radius: number;
  age: number;
  color: [number, number, number];
}

/**
 * Supplements Box2D (does not replace its ordinary collision solver).
 * Contact callbacks capture events only; contact effects execute in update().
 * No rigid body is modified while Box2D is resolving its contact manifold.
 */
export class PuckInteractionSystem {
  private readonly registered = new StableColliderRegistry<Collider2D, InteractionPuck>();
  private active: InteractionPuck | null = null;
  private pending: QueuedContact[] = [];
  private readonly lastContact = new Map<string, number>();
  private readonly pulses: HitPulse[] = [];
  private elapsed = 0;
  private drawElapsed = 0;
  private collisions = 0;

  get collisionCount(): number { return this.collisions; }

  register(puck: InteractionPuck): void {
    const collider = puck && puck.collider;
    if (!collider || typeof collider.on !== 'function') {
      console.warn('[WordPuck] Skipped invalid puck contact collider');
      return;
    }
    // Calling register twice must never attach duplicate contact listeners.
    if (!this.registered.add(collider, puck)) return;
    collider.on(Contact2DType.BEGIN_CONTACT, this.onPuckBeginContact, this);
  }

  /** Event teardown is safe even when the component was already destroyed. */
  private detachContactListener(collider: Collider2D | null | undefined): void {
    if (!collider || typeof collider.off !== 'function') return;
    try {
      collider.off(Contact2DType.BEGIN_CONTACT, this.onPuckBeginContact, this);
    } catch (error) {
      console.warn('[WordPuck] Unable to detach destroyed puck collider:', error);
    }
  }

  unregister(puck: InteractionPuck): void {
    const collider = puck && puck.collider;
    if (!collider) return;
    const previous = this.registered.remove(collider);
    if (!previous) return; // Already removed, or never registered.
    this.detachContactListener(collider);
    this.pending = this.pending.filter(
      (c) => c.source !== previous && c.target !== previous,
    );
    if (this.active === previous) this.active = null;
  }

  beginShot(puck: InteractionPuck): void {
    this.active = puck;
    this.pending.length = 0;
    this.lastContact.clear();
    this.elapsed = 0;
  }

  endShot(): void {
    this.active = null;
    this.pending.length = 0;
    this.lastContact.clear();
    for (const puck of this.registered.snapshot()) {
      if (puck.freezeRemaining > 0) {
        puck.freezeRemaining = 0;
        puck.body.linearDamping = puck.ammo.linearDamping;
      }
    }
  }

  reset(): void {
    this.endShot();
    // The old [...Map.values()] is not reliable after Cocos transpiles for
    // legacy JavaScript targets. Clear via a normal Array snapshot.
    const removed = this.registered.clear();
    for (const puck of removed) {
      if (puck) this.detachContactListener(puck.collider);
    }
    this.active = null;
    this.pending.length = 0;
    this.lastContact.clear();
    this.pulses.length = 0;
    this.collisions = 0;
    this.elapsed = 0;
    this.drawElapsed = 0;
  }

  /** The filter excludes walls and bumpers: a contact counts only for two registered pucks. */
  private onPuckBeginContact(self: Collider2D, other: Collider2D): void {
    if (!this.active) return;
    const first = this.registered.get(self);
    const second = this.registered.get(other);
    // Every pair sends two callbacks, one from each collider. Count it once.
    if (!first || !second || first === second || first.index > second.index) return;
    const source = first === this.active ? first : second === this.active ? second : first;
    const target = source === first ? second : first;
    const a = source.body.linearVelocity, b = target.body.linearVelocity;
    const normal = calculatePuckContact(
      source.node.position.x, source.node.position.y, a.x, a.y,
      target.node.position.x, target.node.position.y, b.x, b.y,
    );
    if (normal.relativeSpeed < INTERACTION_CONFIG.minContactSpeed) return;
    const pairKey = first.index + ':' + second.index;
    const previous = this.lastContact.get(pairKey);
    if (previous !== undefined &&
        this.elapsed - previous < INTERACTION_CONFIG.contactCooldown) return;
    this.lastContact.set(pairKey, this.elapsed);
    this.pending.push({
      source, target, nx: normal.nx, ny: normal.ny,
      speed: Math.max(normal.closingSpeed, normal.relativeSpeed * 0.45),
      x: (source.node.position.x + target.node.position.x) / 2,
      y: (source.node.position.y + target.node.position.y) / 2,
    });
  }

  update(deltaTime: number): CollisionFeedback[] {
    if (!this.active) return [];
    this.elapsed += deltaTime;
    const feedback: CollisionFeedback[] = [];
    // The callback occurred in a previous physics step. Updating velocities now is safe.
    const contacts = this.pending.splice(0);
    for (const c of contacts) {
      if (!this.registered.has(c.source.collider) ||
          !this.registered.has(c.target.collider)) continue;
      this.collisions += 1;
      let text = '砰！弹药相撞';
      let color: [number, number, number] = [245, 171, 80];
      let radius = 60;
      // Only the currently fired puck applies its one-off contact ability.
      if (this.active === c.source && c.source.ammo.type === 'impact') {
        const extraSpeed = calculateImpactPush(c.speed);
        if (extraSpeed > 0) {
          const velocity = c.target.body.linearVelocity;
          c.target.body.linearVelocity = new Vec2(
            velocity.x + c.nx * extraSpeed,
            velocity.y + c.ny * extraSpeed,
          );
          c.target.body.wakeUp();
        }
        text = '重击！旧弹药被撞飞';
        color = [245, 103, 84];
        radius = 92;
      } else if (this.active === c.source && c.source.ammo.type === 'ice') {
        c.target.freezeRemaining = INTERACTION_CONFIG.iceFreezeSeconds;
        const velocity = c.target.body.linearVelocity;
        c.target.body.linearVelocity = new Vec2(
          velocity.x * INTERACTION_CONFIG.iceVelocityRatio,
          velocity.y * INTERACTION_CONFIG.iceVelocityRatio,
        );
        c.target.body.linearDamping = INTERACTION_CONFIG.iceFrozenDamping;
        c.target.body.wakeUp();
        text = '冰封！旧弹药减速';
        color = [80, 201, 238];
        radius = 77;
      } else if (this.active === c.source && c.source.ammo.type === 'magnet') {
        text = '磁吸！弹药碰撞';
        color = [92, 157, 247];
      } else if (this.active === c.source && c.source.ammo.type === 'bounce') {
        text = '弹开！高弹性碰撞';
        color = [252, 186, 66];
      }
      this.pulses.push({ x: c.x, y: c.y, radius, color, age: 0 });
      if (this.pulses.length > 8) this.pulses.shift();
      feedback.push({ text, color, x: c.x, y: c.y });
    }

    for (const puck of this.registered.snapshot()) {
      if (puck.freezeRemaining <= 0) continue;
      puck.freezeRemaining = Math.max(0, puck.freezeRemaining - deltaTime);
      if (puck.freezeRemaining > 0) {
        puck.body.linearDamping = INTERACTION_CONFIG.iceFrozenDamping;
      } else {
        puck.body.linearDamping = puck.ammo.linearDamping;
      }
    }

    const magnet = this.active;
    if (magnet.ammo.type === 'magnet' &&
        Math.hypot(magnet.body.linearVelocity.x, magnet.body.linearVelocity.y) >= 35) {
      for (const other of this.registered.snapshot()) {
        if (other === magnet) continue;
        const dv = calculateMagnetDeltaVelocity(
          magnet.node.position.x - other.node.position.x,
          magnet.node.position.y - other.node.position.y,
          deltaTime, magnet.ammo.magnetRange,
        );
        if (!dv.x && !dv.y) continue;
        const v = other.body.linearVelocity;
        let vx = v.x + dv.x, vy = v.y + dv.y;
        const speed = Math.hypot(vx, vy);
        if (speed > INTERACTION_CONFIG.magnetMaxTargetSpeed) {
          vx *= INTERACTION_CONFIG.magnetMaxTargetSpeed / speed;
          vy *= INTERACTION_CONFIG.magnetMaxTargetSpeed / speed;
        }
        other.body.linearVelocity = new Vec2(vx, vy);
        other.body.wakeUp();
      }
    }
    return feedback;
  }

  /**
   * Reusable graphics, refreshed at ~30 FPS rather than allocating many nodes.
   * Pulse arcs and fields are visual indicators; actual collisions use Box2D.
   */
  draw(graphics: Graphics | null, dt: number, show: boolean, targetX: number,
    targetY: number, targetRadius: number, puckRadius: number): void {
    if (!graphics) return;
    for (const pulse of this.pulses) pulse.age += dt;
    for (let i = this.pulses.length - 1; i >= 0; i--) {
      if (this.pulses[i].age >= 0.58) this.pulses.splice(i, 1);
    }
    this.drawElapsed += dt;
    if (this.drawElapsed < 1 / 30) return;
    this.drawElapsed = 0;
    graphics.clear();
    if (!show) return;

    const magnet = this.active;
    if (magnet?.ammo.type === 'magnet') {
      const x = magnet.node.position.x, y = magnet.node.position.y;
      const radius = magnet.ammo.magnetRange + Math.sin(this.elapsed * 8) * 5;
      graphics.fillColor = new Color(83, 155, 244, 16);
      graphics.circle(x, y, radius);
      graphics.fill();
      graphics.lineWidth = 3;
      graphics.strokeColor = new Color(69, 147, 235, 135);
      graphics.circle(x, y, radius);
      graphics.stroke();
    }
    for (const puck of this.registered.snapshot()) {
      const x = puck.node.position.x, y = puck.node.position.y;
      if (puck.freezeRemaining > 0) {
        graphics.lineWidth = 4;
        graphics.strokeColor = new Color(91, 212, 248, 230);
        graphics.circle(x, y, puckRadius + 8 + puck.freezeRemaining * 2);
        graphics.stroke();
      }
      if (puck === this.active && puck.ammo.type === 'ice' &&
          Math.hypot(x - targetX, y - targetY) <= targetRadius) {
        graphics.lineWidth = 3;
        graphics.strokeColor = new Color(88, 200, 239, 160);
        graphics.circle(x, y, puckRadius + 14);
        graphics.stroke();
      }
    }
    for (const pulse of this.pulses) {
      const phase = pulse.age / 0.58;
      graphics.lineWidth = Math.max(1, 5 * (1 - phase));
      graphics.strokeColor = new Color(pulse.color[0], pulse.color[1],
        pulse.color[2], Math.max(0, Math.round(220 * (1 - phase))));
      graphics.circle(pulse.x, pulse.y, 12 + phase * pulse.radius);
      graphics.stroke();
    }
  }
}

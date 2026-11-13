import {
  CircleCollider2D, Collider2D, Color, Contact2DType, ERigidBody2DType,
  Graphics, Node, RigidBody2D, Vec2,
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
  private iceBurstUsed = false;
  private iceCloudRemaining = 0;
  private iceCloudCenter = new Vec2();
  private readonly iceCloudTargets = new Set<number>();
  private magnetNoticeSent = false;

  get collisionCount(): number { return this.collisions; }

  /** Keep the shot running while a live magnetic field can still move an old puck. */
  get shouldDelayShotCompletion(): boolean {
    const magnet = this.active;
    if (!magnet || magnet.ammo.type !== 'magnet' ||
        this.elapsed >= INTERACTION_CONFIG.magnetFieldSeconds) return false;
    for (const old of this.registered.snapshot()) {
      if (old === magnet || old.freezeRemaining > 0 ||
          old.body.type !== ERigidBody2DType.Dynamic) continue;
      const dist = Math.hypot(
        old.node.position.x - magnet.node.position.x,
        old.node.position.y - magnet.node.position.y,
      );
      if (dist > 0.001 && dist < magnet.ammo.magnetRange) return true;
    }
    return false;
  }

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
    this.releaseFreeze(previous);
    this.iceCloudTargets.delete(previous.index);
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
    this.iceBurstUsed = false;
    this.magnetNoticeSent = false;
  }

  endShot(): void {
    // A landing ice round creates an area burst even without a direct hit.
    // Frozen old pucks remain locked for their full duration across shots.
    if (this.active?.ammo.type === 'ice' && !this.iceBurstUsed) {
      this.triggerIceBurst(this.active.node.position.x, this.active.node.position.y);
    }
    this.active = null;
    this.pending.length = 0;
    this.lastContact.clear();
  }

  reset(): void {
    // Do not call endShot(): its landing burst would affect a disappearing scene.
    this.active = null;
    this.pending.length = 0;
    this.lastContact.clear();
    for (const puck of this.registered.snapshot()) this.releaseFreeze(puck);
    const removed = this.registered.clear();
    for (const puck of removed) {
      if (puck) this.detachContactListener(puck.collider);
    }
    this.iceCloudTargets.clear();
    this.iceCloudRemaining = 0;
    this.iceBurstUsed = false;
    this.magnetNoticeSent = false;
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
    // Some Cocos backends may deliver only one collider callback.
    // Never discard the event based on callback order: dedupe by sorted IDs.
    if (!first || !second || first === second) return;
    const source = first === this.active ? first : second === this.active ? second : first;
    const target = source === first ? second : first;
    const a = source.body.linearVelocity, b = target.body.linearVelocity;
    const normal = calculatePuckContact(
      source.node.position.x, source.node.position.y, a.x, a.y,
      target.node.position.x, target.node.position.y, b.x, b.y,
    );
    if (normal.relativeSpeed < INTERACTION_CONFIG.minContactSpeed) return;
    const pairKey = Math.min(first.index, second.index) + ':' +
      Math.max(first.index, second.index);
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

  /**
   * A simple freeze changes the physics body to Static, so contact impulses,
   * wall bounces and magnets cannot move it until the timer expires.
   * Type changes happen here, outside Box2D contact callbacks.
   */
  private lockPuck(puck: InteractionPuck): boolean {
    if (puck === this.active) return false;
    const newlyLocked = puck.freezeRemaining <= 0;
    puck.freezeRemaining = INTERACTION_CONFIG.iceFreezeSeconds;
    puck.body.linearVelocity = new Vec2(0, 0);
    puck.body.angularVelocity = 0;
    puck.body.linearDamping = INTERACTION_CONFIG.iceFrozenDamping;
    puck.body.type = ERigidBody2DType.Static;
    return newlyLocked;
  }

  private releaseFreeze(puck: InteractionPuck): void {
    if (puck.freezeRemaining <= 0 &&
        puck.body.type !== ERigidBody2DType.Static) return;
    puck.freezeRemaining = 0;
    puck.body.type = ERigidBody2DType.Dynamic;
    puck.body.linearVelocity = new Vec2(0, 0);
    puck.body.angularVelocity = 0;
    puck.body.linearDamping = puck.ammo.linearDamping;
    puck.body.wakeUp();
  }

  private applyIceCloud(): number {
    if (this.iceCloudRemaining <= 0) return 0;
    let count = 0;
    for (const puck of this.registered.snapshot()) {
      if (puck === this.active || this.iceCloudTargets.has(puck.index)) continue;
      const distance = Math.hypot(
        puck.node.position.x - this.iceCloudCenter.x,
        puck.node.position.y - this.iceCloudCenter.y,
      );
      if (distance > INTERACTION_CONFIG.iceAreaRadius) continue;
      this.iceCloudTargets.add(puck.index);
      if (this.lockPuck(puck)) count += 1;
    }
    return count;
  }

  private triggerIceBurst(x: number, y: number): number {
    this.iceBurstUsed = true;
    this.iceCloudRemaining = INTERACTION_CONFIG.iceAreaActiveSeconds;
    this.iceCloudCenter = new Vec2(x, y);
    this.iceCloudTargets.clear();
    const count = this.applyIceCloud();
    this.addPulse(x, y, INTERACTION_CONFIG.iceAreaRadius, [90, 207, 248]);
    return count;
  }

  private addPulse(x: number, y: number, radius: number,
    color: [number, number, number]): void {
    this.pulses.push({ x, y, radius, color, age: 0 });
    if (this.pulses.length > 8) this.pulses.shift();
  }

  /**
   * Must run even during WORD_SELECT/READY because frozen objects remain
   * physically locked across rounds. The bootstrap skips updates on pause.
   */
  update(deltaTime: number): CollisionFeedback[] {
    if (!Number.isFinite(deltaTime) || deltaTime <= 0) return [];
    const feedback: CollisionFeedback[] = [];
    if (this.active) this.elapsed += deltaTime;

    // All contact responses happen in update, never inside the Box2D callback.
    const contacts = this.pending.splice(0);
    for (const c of contacts) {
      if (!this.registered.has(c.source.collider) ||
          !this.registered.has(c.target.collider)) continue;
      this.collisions += 1;
      let text = '砰！弹药相撞';
      let color: [number, number, number] = [245, 171, 80];
      let radius = 60;
      if (this.active === c.source && c.source.ammo.type === 'impact') {
        if (c.target.freezeRemaining > 0) {
          text = '冰封状态 · 无法推动';
          color = [100, 198, 235];
        } else {
          const extraSpeed = calculateImpactPush(c.speed);
          if (extraSpeed > 0) {
            const velocity = c.target.body.linearVelocity;
            c.target.body.wakeUp();
            c.target.body.linearVelocity = new Vec2(
              velocity.x + c.nx * extraSpeed,
              velocity.y + c.ny * extraSpeed,
            );
          }
          text = '重击！旧弹药被撞飞';
          color = [245, 103, 84];
          radius = 92;
        }
      } else if (this.active === c.source && c.source.ammo.type === 'ice') {
        const frozen = this.iceBurstUsed ? 0 : this.triggerIceBurst(c.x, c.y);
        text = '寒霜爆发 · 冰封 ' + frozen + ' 颗';
        color = [80, 201, 238];
        radius = INTERACTION_CONFIG.iceAreaRadius;
      } else if (this.active === c.source && c.source.ammo.type === 'magnet') {
        text = '磁吸！弹药碰撞';
        color = [92, 157, 247];
      } else if (this.active === c.source && c.source.ammo.type === 'bounce') {
        text = '弹开！高弹性碰撞';
        color = [252, 186, 66];
      }
      this.addPulse(c.x, c.y, radius, color);
      feedback.push({ text, color, x: c.x, y: c.y });
    }

    // Frozen bodies are Static for the full countdown. Never apply magnet
    // acceleration or restore them merely because a shot has settled.
    for (const puck of this.registered.snapshot()) {
      if (puck.freezeRemaining <= 0) continue;
      puck.freezeRemaining = Math.max(0, puck.freezeRemaining - deltaTime);
      if (puck.freezeRemaining <= 0) this.releaseFreeze(puck);
    }

    if (this.iceCloudRemaining > 0) {
      const frozen = this.applyIceCloud();
      if (frozen > 0) {
        feedback.push({
          text: '寒霜区域 · 冰封 ' + frozen + ' 颗',
          color: [82, 204, 243],
          x: this.iceCloudCenter.x, y: this.iceCloudCenter.y,
        });
      }
      this.iceCloudRemaining = Math.max(0, this.iceCloudRemaining - deltaTime);
      if (this.iceCloudRemaining <= 0) this.iceCloudTargets.clear();
    }

    const shot = this.active;
    if (shot?.ammo.type === 'ice' && !this.iceBurstUsed &&
        this.elapsed >= 0.3 && Math.hypot(
          shot.body.linearVelocity.x, shot.body.linearVelocity.y,
        ) <= 40) {
      const frozen = this.triggerIceBurst(shot.node.position.x, shot.node.position.y);
      feedback.push({
        text: frozen > 0 ? '寒霜爆发 · 冰封 ' + frozen + ' 颗' : '寒霜爆发',
        color: [80, 201, 238],
        x: shot.node.position.x, y: shot.node.position.y,
      });
    }

    // The magnet stays energized even after its own rigid body falls asleep.
    // Boost a sleeping old puck with world-space velocity and explicit wakeUp.
    if (shot?.ammo.type === 'magnet' &&
        this.elapsed <= INTERACTION_CONFIG.magnetFieldSeconds) {
      let affected = 0;
      for (const other of this.registered.snapshot()) {
        if (other === shot || other.freezeRemaining > 0 ||
            other.body.type !== ERigidBody2DType.Dynamic) continue;
        const dv = calculateMagnetDeltaVelocity(
          shot.node.position.x - other.node.position.x,
          shot.node.position.y - other.node.position.y,
          deltaTime, shot.ammo.magnetRange, shot.ammo.magnetAcceleration,
        );
        if (!dv.x && !dv.y) continue;
        const velocity = other.body.linearVelocity;
        let vx = velocity.x + dv.x;
        let vy = velocity.y + dv.y;
        const speed = Math.hypot(vx, vy);
        if (speed > INTERACTION_CONFIG.magnetMaxTargetSpeed) {
          vx *= INTERACTION_CONFIG.magnetMaxTargetSpeed / speed;
          vy *= INTERACTION_CONFIG.magnetMaxTargetSpeed / speed;
        }
        other.body.wakeUp();
        other.body.linearVelocity = new Vec2(vx, vy);
        affected += 1;
      }
      if (affected > 0 && !this.magnetNoticeSent) {
        this.magnetNoticeSent = true;
        feedback.push({
          text: '磁力牵引 · 吸附 ' + affected + ' 颗',
          color: [85, 159, 243],
          x: shot.node.position.x, y: shot.node.position.y,
        });
        this.addPulse(shot.node.position.x, shot.node.position.y,
          shot.ammo.magnetRange * 0.45, [77, 159, 247]);
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
    if (magnet?.ammo.type === 'magnet' &&
        this.elapsed <= INTERACTION_CONFIG.magnetFieldSeconds) {
      const x = magnet.node.position.x, y = magnet.node.position.y;
      const radius = magnet.ammo.magnetRange;
      const phase = Math.sin(this.elapsed * 8) * 5;
      graphics.fillColor = new Color(83, 155, 244, 23);
      graphics.circle(x, y, radius + phase);
      graphics.fill();
      graphics.lineWidth = 3;
      graphics.strokeColor = new Color(45, 141, 237, 200);
      graphics.circle(x, y, radius + phase);
      graphics.stroke();
      // Bright pull-lines make the effect visible BEFORE the old puck arrives.
      for (const other of this.registered.snapshot()) {
        if (other === magnet || other.freezeRemaining > 0) continue;
        const px = other.node.position.x, py = other.node.position.y;
        const length = Math.hypot(x - px, y - py);
        if (length >= radius || length < 1) continue;
        graphics.lineWidth = 3;
        graphics.strokeColor = new Color(78, 154, 235, 178);
        graphics.moveTo(px, py);
        graphics.lineTo(x, y);
        graphics.stroke();
        const t = 0.35 + 0.2 * Math.sin(this.elapsed * 9);
        graphics.fillColor = new Color(38, 128, 237, 238);
        graphics.circle(px + (x - px) * t, py + (y - py) * t, 5);
        graphics.fill();
      }
    }

    if (this.iceCloudRemaining > 0) {
      const ratio = this.iceCloudRemaining / INTERACTION_CONFIG.iceAreaActiveSeconds;
      const radius = INTERACTION_CONFIG.iceAreaRadius;
      graphics.fillColor = new Color(80, 202, 244, Math.round(35 * ratio));
      graphics.circle(this.iceCloudCenter.x, this.iceCloudCenter.y, radius);
      graphics.fill();
      graphics.strokeColor = new Color(81, 201, 246, Math.round(190 * ratio));
      graphics.lineWidth = 4;
      graphics.circle(this.iceCloudCenter.x, this.iceCloudCenter.y, radius);
      graphics.stroke();
    }

    for (const puck of this.registered.snapshot()) {
      const x = puck.node.position.x, y = puck.node.position.y;
      if (puck.freezeRemaining > 0) {
        graphics.fillColor = new Color(83, 204, 248, 70);
        graphics.circle(x, y, puckRadius + 6);
        graphics.fill();
        graphics.lineWidth = 4;
        graphics.strokeColor = new Color(54, 174, 234, 242);
        graphics.circle(x, y, puckRadius + 9);
        graphics.stroke();
        // Ice-cross stays fixed while the puck's body type is Static.
        graphics.lineWidth = 3;
        graphics.moveTo(x - 8, y - 8);
        graphics.lineTo(x + 8, y + 8);
        graphics.moveTo(x - 8, y + 8);
        graphics.lineTo(x + 8, y - 8);
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

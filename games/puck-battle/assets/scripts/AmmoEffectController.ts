import { CircleCollider2D, Node, RigidBody2D, Vec2 } from 'cc';
import type { AmmoDefinition } from './AmmoFactory';

export class AmmoEffectController {
  static applyToPuck(
    body: RigidBody2D,
    collider: CircleCollider2D,
    ammo: AmmoDefinition,
  ): void {
    body.gravityScale = 0;
    body.linearDamping = ammo.linearDamping;
    body.angularDamping = 2;
    body.fixedRotation = true;
    body.allowSleep = true;
    body.bullet = true;

    collider.density = ammo.density;
    collider.friction = ammo.friction;
    collider.restitution = ammo.restitution;
    collider.apply();
  }

  static updateFlight(
    body: RigidBody2D,
    node: Node,
    ammo: AmmoDefinition,
    target: Vec2,
    targetOuterRadius: number,
    deltaTime: number,
  ): void {
    const velocity = body.linearVelocity;
    const speed = Math.sqrt(
      velocity.x * velocity.x + velocity.y * velocity.y,
    );

    if (ammo.type === 'ice') {
      const dx = node.position.x - target.x;
      const dy = node.position.y - target.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const desiredDamping =
        distance <= targetOuterRadius ? ammo.targetDamping : ammo.linearDamping;

      if (Math.abs(body.linearDamping - desiredDamping) > 0.05) {
        body.linearDamping = desiredDamping;
      }
    }

    if (ammo.type !== 'magnet' || speed < 45) return;

    const toTargetX = target.x - node.position.x;
    const toTargetY = target.y - node.position.y;
    const targetDistance = Math.sqrt(
      toTargetX * toTargetX + toTargetY * toTargetY,
    );
    if (targetDistance < 1) return;

    const currentX = velocity.x / speed;
    const currentY = velocity.y / speed;
    const desiredX = toTargetX / targetDistance;
    const desiredY = toTargetY / targetDistance;
    const blend = Math.min(0.08, ammo.magnetSteer * deltaTime * 60);

    let nextX = currentX * (1 - blend) + desiredX * blend;
    let nextY = currentY * (1 - blend) + desiredY * blend;
    const nextLength = Math.sqrt(nextX * nextX + nextY * nextY);
    if (nextLength < 0.001) return;

    nextX /= nextLength;
    nextY /= nextLength;
    body.linearVelocity = new Vec2(nextX * speed, nextY * speed);
  }
}

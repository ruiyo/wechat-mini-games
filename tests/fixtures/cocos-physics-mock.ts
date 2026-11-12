/**
 * A tiny physics mock for executing the real PuckInteractionSystem with
 * node:assert. NOT used or imported by Cocos Creator's game build.
 */
export class Vec2 {
  constructor(public x = 0, public y = 0) {}
}
export class Color {
  constructor(public r = 0, public g = 0, public b = 0, public a = 255) {}
}
export class Node {
  position = new Vec2();
  constructor(public name = 'FakePuck') {}
  setPosition(x: number, y: number): void { this.position = new Vec2(x, y); }
}
export class RigidBody2D {
  linearVelocity = new Vec2();
  linearDamping = 0;
  wakeCount = 0;
  wakeUp(): void { this.wakeCount += 1; }
}
type Handler = (self: Collider2D, other: Collider2D) => void;
interface Listener {
  handler: Handler;
  target: object | undefined;
}
export class Collider2D {
  private listeners: Record<string, Listener[]> = {};
  on(event: string, handler: Handler, target?: object): void {
    (this.listeners[event] || (this.listeners[event] = [])).push({ handler, target });
  }
  off(event: string, handler: Handler, target?: object): void {
    this.listeners[event] = (this.listeners[event] || []).filter(
      (listener) => listener.handler !== handler || listener.target !== target,
    );
  }
  emitContact(event: string, other: Collider2D): void {
    for (const listener of (this.listeners[event] || []).slice()) {
      listener.handler.call(listener.target, this, other);
    }
  }
  listenerCount(event: string): number { return (this.listeners[event] || []).length; }
}
export class CircleCollider2D extends Collider2D {}
export const Contact2DType = {
  BEGIN_CONTACT: 'begin-contact',
  END_CONTACT: 'end-contact',
} as const;
export class Graphics {
  clears = 0;
  draws = 0;
  fillColor = new Color();
  strokeColor = new Color();
  lineWidth = 1;
  clear(): void { this.clears += 1; }
  circle(_x: number, _y: number, _radius: number): void { this.draws += 1; }
  fill(): void { this.draws += 1; }
  stroke(): void { this.draws += 1; }
}

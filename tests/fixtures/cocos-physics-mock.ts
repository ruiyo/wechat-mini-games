/**
 * A lightweight Cocos 3.8 UI + physics mock for executing BOTH the real
 * PuckBattleBootstrap lifecycle and PuckInteractionSystem in Node tests.
 * This file is never packaged by the Cocos Creator build.
 */
export class Vec2 {
  constructor(public x = 0, public y = 0) {}
  length(): number { return Math.hypot(this.x, this.y); }
}
export class Size {
  constructor(public width = 0, public height = 0) {}
}
export class Color {
  constructor(public r = 0, public g = 0, public b = 0, public a = 255) {}
  static WHITE = new Color(255, 255, 255, 255);
}
export class Node {
  static EventType = {
    TOUCH_START: 'touch-start', TOUCH_MOVE: 'touch-move',
    TOUCH_END: 'touch-end', TOUCH_CANCEL: 'touch-cancel',
  };
  position = new Vec2();
  layer = 524288;
  active = true;
  destroyed = false;
  parent: Node | null = null;
  children: Node[] = [];
  private components: any[] = [];
  private handlers: Record<string, Array<{ cb: Function; target: object }>> = {};
  constructor(public name = 'FakePuck') {}
  setPosition(x: number, y: number, _z = 0): void {
    this.position = new Vec2(x, y);
  }
  addChild(child: Node): void {
    child.parent = this;
    this.children.push(child);
  }
  addComponent<T>(type: new () => T): T {
    const result = new type();
    (result as any).node = this;
    this.components.push(result);
    return result;
  }
  getComponent<T>(type: new () => T): T | null {
    return this.components.find((entry) => entry instanceof type) || null;
  }
  setSiblingIndex(index: number): void {
    if (!this.parent) return;
    const children = this.parent.children;
    const oldIndex = children.indexOf(this);
    if (oldIndex >= 0) children.splice(oldIndex, 1);
    children.splice(Math.max(0, Math.min(index, children.length)), 0, this);
  }
  on(name: string, cb: Function, target: object): void {
    (this.handlers[name] || (this.handlers[name] = [])).push({ cb, target });
  }
  off(name: string, cb: Function, target: object): void {
    this.handlers[name] = (this.handlers[name] || []).filter(
      (entry) => entry.cb !== cb || entry.target !== target);
  }
  destroy(): void {
    this.destroyed = true;
    if (this.parent) {
      const index = this.parent.children.indexOf(this);
      if (index >= 0) this.parent.children.splice(index, 1);
      this.parent = null;
    }
    for (const child of this.children) child.destroyed = true;
    this.children.length = 0;
  }
}
export class RigidBody2D {
  linearVelocity = new Vec2();
  linearDamping = 0;
  angularDamping = 0;
  angularVelocity = 0;
  gravityScale = 0;
  fixedRotation = false;
  allowSleep = true;
  bullet = false;
  enabledContactListener = false;
  group = 1;
  type: string = 'dynamic';
  wakeCount = 0;
  sleepCount = 0;
  wakeUp(): void { this.wakeCount += 1; }
  sleep(): void { this.sleepCount += 1; }
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
export class CircleCollider2D extends Collider2D {
  radius = 19;
  density = 1;
  friction = 0;
  restitution = 0;
  group = 1;
  sensor = false;
  apply(): void {}
}
export class BoxCollider2D extends CircleCollider2D {
  size = new Size();
}
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
  rect(_x: number, _y: number, _w: number, _h: number): void { this.draws += 1; }
  roundRect(_x: number, _y: number, _w: number, _h: number, _radius: number): void {
    this.draws += 1;
  }
  moveTo(_x: number, _y: number): void {}
  lineTo(_x: number, _y: number): void {}
  close(): void {}
}

export class UITransform {
  width = 0;
  height = 0;
  setContentSize(w: number, h: number): this {
    this.width = w;
    this.height = h;
    return this;
  }
}
export class Label {
  static HorizontalAlign = { CENTER: 1, LEFT: 2 };
  static VerticalAlign = { CENTER: 1 };
  string = '';
  fontSize = 20;
  lineHeight = 28;
  color = Color.WHITE;
  horizontalAlign = Label.HorizontalAlign.CENTER;
  verticalAlign = Label.VerticalAlign.CENTER;
  node!: Node;
}
export class Component {
  node: Node;
  constructor() { this.node = new Node('Canvas'); }
}
export class PhysicsSystem2D {
  static PHYSICS_BOX2D = true;
  static PHYSICS_BOX2D_WASM = false;
  static instance = new PhysicsSystem2D();
  enable = true;
  gravity = new Vec2();
  fixedTimeStep = 1 / 60;
  maxSubSteps = 4;
  velocityIterations = 8;
  positionIterations = 3;
}
export const ERigidBody2DType = { Static: 'static', Dynamic: 'dynamic' };
export const _decorator = { ccclass: (_name: string) => (ctor: any) => ctor };
export const profiler = { hideStats() {} };
export const view = { getVisibleSize: () => ({ width: 720, height: 1280 }) };
const testStorage = new Map<string, string>();
export const sys = {
  localStorage: {
    getItem(key: string): string | null { return testStorage.get(key) || null; },
    setItem(key: string, value: string): void { testStorage.set(key, value); },
    removeItem(key: string): void { testStorage.delete(key); },
    clear(): void { testStorage.clear(); },
  },
};

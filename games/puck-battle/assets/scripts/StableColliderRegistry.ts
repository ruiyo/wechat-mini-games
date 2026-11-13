/**
 * Cocos Creator 3.8 builds may downlevel TypeScript to ES5 without
 * downlevelIteration. Iterating Map.values() with for-of or the spread
 * operator is unsafe in that configuration. Always iterate an Array.
 */
export class StableColliderRegistry<Collider extends object, Puck> {
  private readonly lookup = new Map<Collider, Puck>();
  private readonly order: Collider[] = [];

  add(collider: Collider | null | undefined, puck: Puck | null | undefined): boolean {
    if (!collider || puck == null || this.lookup.has(collider)) return false;
    this.lookup.set(collider, puck);
    this.order.push(collider);
    return true;
  }

  get(collider: Collider): Puck | undefined {
    return this.lookup.get(collider);
  }

  has(collider: Collider): boolean {
    return this.lookup.has(collider);
  }

  remove(collider: Collider | null | undefined): Puck | undefined {
    if (!collider || !this.lookup.has(collider)) return undefined;
    const puck = this.lookup.get(collider);
    this.lookup.delete(collider);
    const index = this.order.indexOf(collider);
    if (index >= 0) this.order.splice(index, 1);
    return puck;
  }

  /** Return an ordinary array, never an ES2015 iterator. */
  snapshot(): Puck[] {
    const result: Puck[] = [];
    for (let i = 0; i < this.order.length; i += 1) {
      const puck = this.lookup.get(this.order[i]);
      if (puck !== undefined) result.push(puck);
    }
    return result;
  }

  /**
   * Produces a stable list of values for detaching listeners even if the
   * underlying Map would otherwise be mutated during the cleanup.
   */
  clear(): Puck[] {
    const snapshot = this.snapshot();
    this.lookup.clear();
    this.order.length = 0;
    return snapshot;
  }

  get size(): number {
    return this.order.length;
  }
}

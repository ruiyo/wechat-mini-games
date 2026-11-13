import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BoxCollider2D, CircleCollider2D, Contact2DType, Node,
} from 'cc';
import { GlyphBlockArena } from '../../games/puck-battle/assets/scripts/GlyphBlockArena';
import { generateArcadeStage } from '../../games/puck-battle/assets/scripts/ArcadeProgression';
import { AmmoFactory } from '../../games/puck-battle/assets/scripts/AmmoFactory';
import { WORD_DEFINITIONS } from '../../games/puck-battle/assets/scripts/WordDictionary';

const ammo = (type: 'bounce' | 'magnet' | 'ice' | 'impact') =>
  AmmoFactory.create(WORD_DEFINITIONS.find((word) => word.ammoType === type)!);

function makeArena() {
  const host = new Node('Host');
  const arena = new GlyphBlockArena(host, (name) => new Node(name));
  return { host, arena };
}
function fakePuck(index = 5, type: 'bounce' | 'magnet' | 'ice' | 'impact' = 'bounce') {
  return { collider: new CircleCollider2D(), ammo: ammo(type), index };
}
function hit(arena: GlyphBlockArena, host: Node, blockId: number,
  puck: ReturnType<typeof fakePuck>) {
  const tileNode = host.children.find((node) => node.name === 'HanziBlock_' + blockId)!;
  assert.ok(tileNode);
  const tileCollider = tileNode.getComponent(BoxCollider2D)!;
  puck.collider.emitContact(Contact2DType.BEGIN_CONTACT, tileCollider);
  tileCollider.emitContact(Contact2DType.BEGIN_CONTACT, puck.collider);
  return arena.update(1 / 60);
}

test('contact with a physical word block damages it once, collects its glyph, and gives chain points', () => {
  const { host, arena } = makeArena();
  const stage = generateArcadeStage(123, 1);
  arena.startStage(stage, 600, 660, 0);
  assert.equal(arena.remaining, 4);
  const puck = fakePuck();
  arena.registerPuck(puck);
  arena.beginShot(puck);
  const effects = hit(arena, host, stage.blocks[0].id, puck);
  assert.equal(effects.length, 1, 'two collider callbacks must not double-hit');
  assert.equal(effects[0].broken, true);
  assert.equal(effects[0].glyph, stage.blocks[0].glyph);
  assert.equal(effects[0].chain, 1);
  assert.equal(arena.remaining, 3);
  assert.ok(effects[0].points >= 50);
  assert.ok(host.children.find((n) => n.name === 'HanziBlock_' + stage.blocks[0].id) === undefined);
  // A second distinct block increases the per-shot chain multiplier.
  const second = hit(arena, host, stage.blocks[1].id, puck);
  assert.equal(second[0].chain, 2);
  assert.ok(second[0].points > effects[0].points);
  arena.clear();
  assert.equal(puck.collider.listenerCount(Contact2DType.BEGIN_CONTACT), 0);
});

test('fusion wave cracks multiple tiles without producing duplicate drops', () => {
  const { arena } = makeArena();
  const stage = generateArcadeStage(123, 1);
  arena.startStage(stage, 600, 660, 0);
  const puck = fakePuck(6, 'impact');
  arena.registerPuck(puck);
  arena.beginShot(puck);
  const hits = arena.applyFusionBurst(0, 0.13 * 660, 230, 3);
  assert.equal(hits.length, 4);
  assert.equal(hits.filter((h) => h.broken).length, 4);
  assert.equal(arena.remaining, 0);
  assert.equal(arena.applyFusionBurst(0, 0, 999, 99).length, 0);
  arena.endShot();
  arena.clear();
});

test('boss is armored and survives weak hits but not a powerful fusion wave', () => {
  const { host, arena } = makeArena();
  const stage = generateArcadeStage(44, 4);
  arena.startStage(stage, 600, 660, 0);
  const puck = fakePuck(5, 'bounce');
  arena.registerPuck(puck);
  arena.beginShot(puck);
  const boss = stage.blocks.find((block) => block.boss)!;
  const first = hit(arena, host, boss.id, puck);
  assert.equal(first[0].hpLeft, boss.hp - 1);
  assert.equal(first[0].broken, false);
  const extra = arena.applyFusionBurst(boss.x * 600, boss.y * 660, 10, 6);
  assert.ok(extra.some((block) => block.boss && block.broken));
  arena.clear();
});

test('replacing stages detaches old bodies and does not leave registered callbacks', () => {
  const { host, arena } = makeArena();
  const first = generateArcadeStage(1, 1);
  arena.startStage(first, 600, 660, 0);
  const puck = fakePuck();
  arena.registerPuck(puck);
  assert.equal(puck.collider.listenerCount(Contact2DType.BEGIN_CONTACT), 1);
  arena.startStage(generateArcadeStage(1, 2), 600, 660, 0);
  assert.equal(puck.collider.listenerCount(Contact2DType.BEGIN_CONTACT), 0);
  assert.equal(arena.remaining, 5);
  assert.equal(host.children.length, 5);
  arena.clear();
  assert.equal(host.children.length, 0);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { Contact2DType, Label, Vec2 } from 'cc';
import { PuckBattleBootstrap } from '../../games/puck-battle/assets/scripts/PuckBattleBootstrap';
import { dailyChallengeSeed } from '../../games/puck-battle/assets/scripts/ArcadeProgression';
import { AmmoFactory } from '../../games/puck-battle/assets/scripts/AmmoFactory';
import { WORD_DEFINITIONS } from '../../games/puck-battle/assets/scripts/WordDictionary';

function create(): any {
  const game: any = new PuckBattleBootstrap();
  game.onLoad();
  return game;
}
function tap(game: any, x: number, y: number) {
  game.onTouchStart({
    getUILocation: () => ({ x: x + 360, y: y + 640 }),
    getID: () => 1,
  });
}
function fire(game: any) {
  const puck = game.currentPuck;
  const p = puck.node.position;
  const evt = (x: number, y: number) => ({
    getUILocation: () => ({ x: x + 360, y: y + 640 }),
    getID: () => 1,
  });
  game.onTouchStart(evt(p.x, p.y));
  game.onTouchMove(evt(p.x, p.y - 150));
  game.onTouchEnd(evt(p.x, p.y - 150));
  assert.equal(game.state, 5);
}

test('default entry becomes playable Hanzi adventure and tile hits grant actual words', () => {
  const game = create();
  tap(game, 0, -124);
  assert.equal(game.adventureMode, true);
  assert.equal(game.practiceMode, false);
  assert.equal(game.arcade.stage, 1);
  assert.equal(game.glyphArena.remaining, 4);
  const original = game.totalScore;
  game.wordPuzzle.suggestWord();
  game.confirmWord();
  assert.equal(game.state, 3);
  fire(game);
  const shot = game.currentPuck;
  const block = game.glyphArena.blocks[0];
  shot.collider.emitContact(Contact2DType.BEGIN_CONTACT, block.collider);
  block.collider.emitContact(Contact2DType.BEGIN_CONTACT, shot.collider);
  game.update(1 / 60);
  assert.equal(game.glyphArena.remaining, 3);
  assert.equal(game.arcade.destroyedBlocks, 1);
  assert.ok(game.totalScore > original);
  assert.equal(game.wordPuzzle.getQueuedGlyphs().length, 1);
  assert.ok(game.hintLabel.string.includes('获得'));
  const earned = game.wordPuzzle.getQueuedGlyphs()[0];
  game.finishCurrentShot();
  assert.equal(game.state, 2);
  game.wordPuzzle.suggestWord();
  game.confirmWord();
  assert.ok(game.wordPuzzle.getLetters().includes(earned));
  game.onDestroy();
});

test('all four chapters can be completed via physics-triggered chain damage and three-card upgrades', () => {
  const game = create();
  tap(game, 0, -124);
  for (let stage = 1; stage <= 4; stage++) {
    game.wordPuzzle.suggestWord();
    game.confirmWord();
    assert.equal(game.state, 3);
    fire(game);
    const hits = game.glyphArena.applyFusionBurst(
      0, game.arenaCenterY, 2000, 10,
    );
    assert.equal(hits.length, game.arcade.totalBlocks);
    game.receiveGlyphHits(hits);
    assert.equal(game.arcade.cleared, true);
    game.finishCurrentShot();
    if (stage < 4) {
      assert.equal(game.state, 8);
      assert.equal(game.upgradeOverlay.active, true);
      assert.equal(game.upgradeChoices.length, 3);
      const firstButton = game.upgradeOverlay.children.find(
        (node: any) => node.name === 'UpgradeChoice_0');
      assert.equal(firstButton.children.find((node: any) =>
        node.name === 'ButtonLabel')?.getComponent(Label)?.string,
        game.upgradeChoices[0].title);
      tap(game, 0, 130);
      assert.equal(game.arcade.stage, stage + 1);
      assert.equal(game.state, 2);
      assert.equal(game.pucks.length, 0);
      assert.equal(game.upgradeOverlay.active, false);
      assert.equal(game.arcade.upgrades.length, stage);
    } else {
      assert.equal(game.state, 7);
      assert.equal(game.arcade.complete, true);
      assert.equal(game.resultOverlay.active, true);
      assert.match(game.resultLabel.string, /闯关成功/);
    }
  }
  assert.ok(game.totalScore > 1000);
  game.returnToHome();
  assert.equal(game.glyphArena.remaining, 0);
  assert.equal(game.arcade, null);
  game.onDestroy();
});

test('classic mode stays intact and daily challenge uses same board and hand for same date', () => {
  const classic = create();
  tap(classic, -720 * 0.20, -439);
  assert.equal(classic.adventureMode, false);
  assert.equal(classic.arcade, null);
  assert.equal(classic.glyphArena.remaining, 0);
  classic.onDestroy();

  const daily = create();
  tap(daily, 720 * 0.20, -439);
  assert.equal(daily.dailyMode, true);
  assert.equal(daily.arcade.seed, dailyChallengeSeed(new Date()));
  const layout = daily.glyphArena.glyphsRemaining;
  const hand = daily.wordPuzzle.getLetters();
  daily.restartRun();
  assert.deepEqual(daily.glyphArena.glyphsRemaining, layout);
  assert.deepEqual(daily.wordPuzzle.getLetters(), hand);
  assert.equal(daily.glyphArena.remaining, 4);
  daily.onDestroy();
});

test('fusion during adventure sends an actual area shockwave to word blocks', () => {
  const game = create();
  tap(game, 0, -124);
  const bounce = AmmoFactory.create(
    WORD_DEFINITIONS.find((entry) => entry.ammoType === 'bounce')!);
  const impact = AmmoFactory.create(
    WORD_DEFINITIONS.find((entry) => entry.ammoType === 'impact')!);
  game.spawnPuck(bounce, new Vec2(-20, game.arenaCenterY + game.arenaHeight * 0.13));
  const old = game.currentPuck;
  game.spawnPuck(impact, new Vec2(-30, game.arenaCenterY + game.arenaHeight * 0.13));
  game.state = 3;
  fire(game);
  const shot = game.currentPuck;
  shot.body.linearVelocity = new Vec2(300, 0);
  const before = game.glyphArena.remaining;
  shot.collider.emitContact(Contact2DType.BEGIN_CONTACT, old.collider);
  game.update(1 / 60);
  assert.ok(game.fusionScore >= 75);
  assert.ok(game.blockScore > 0);
  assert.ok(game.glyphArena.remaining < before);
  game.onDestroy();
});

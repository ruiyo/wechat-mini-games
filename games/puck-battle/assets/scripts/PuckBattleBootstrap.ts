import {
  _decorator,
  BoxCollider2D,
  CircleCollider2D,
  Color,
  Component,
  EventTouch,
  ERigidBody2DType,
  Graphics,
  Label,
  Node,
  PhysicsSystem2D,
  RigidBody2D,
  Size,
  UITransform,
  Vec2,
  view,
  profiler,
} from 'cc';

import { AIM_CONFIG, PUCK_CONFIG, WORD_UI_CONFIG } from './GameConfig';
import { calculateAim, predictWallBouncePath } from './AimRules';
import { PuckInteractionSystem } from './PuckInteractionSystem';
import { pathIntersectsCircle } from './PuckInteractionRules';
import { AmmoFactory } from './AmmoFactory';
import type { AmmoDefinition } from './AmmoFactory';
import { AmmoEffectController } from './AmmoEffectController';
import { distanceBetween, scoreByDistance } from './ScoreRules';
import { SaveManager } from './SaveManager';
import { WordPuzzleController } from './WordPuzzleController';
import { WORD_DEFINITIONS } from './WordDictionary';
import type { AmmoType } from './WordDictionary';

const { ccclass } = _decorator;

const PRACTICE_AMMO_TYPES: AmmoType[] = ['bounce', 'magnet', 'ice', 'impact'];
const PRACTICE_AMMO_LABELS = ['弹跳', '磁吸', '冰冻', '冲击'];

enum GameState {
  MENU,
  PAUSED,
  WORD_SELECT,
  READY,
  AIMING,
  FLYING,
  SETTLING,
  RESULT,
}

interface PuckEntry {
  node: Node;
  body: RigidBody2D;
  collider: CircleCollider2D;
  ammo: AmmoDefinition;
  score: number;
  scoreMultiplier: number;
  index: number;
  freezeRemaining: number;
}

@ccclass('PuckBattleBootstrap')
export class PuckBattleBootstrap extends Component {
  private screenWidth = 720;
  private screenHeight = 1280;

  private arenaWidth = 600;
  private arenaHeight = 760;
  private arenaCenterY = -20;
  private targetCenter = new Vec2(0, 220);
  private launchY = -320;
  private puckRadius = PUCK_CONFIG.puckRadius;
  private scoreRadii = { center: 34, middle: 76, outer: 122 };

  private state = GameState.MENU;
  private pausedFrom = GameState.WORD_SELECT;
  private pucks: PuckEntry[] = [];
  private currentPuck: PuckEntry | null = null;
  private currentAmmo: AmmoDefinition | null = null;
  private wordPuzzle = new WordPuzzleController();
  private interactions = new PuckInteractionSystem();
  private practiceMode = false;
  private nextPuckIndex = 0;

  private shotsFired = 0;
  private totalScore = 0;
  private scoreBeforeShot = 0;
  private bankedScore = 0;
  private bestScore = 0;
  private comboStreak = 0;
  private missCount = 0;
  private discoveredWordCount = 0;
  private runDiscoveredWords = new Set<string>();

  private isDragging = false;
  private activeTouchId: number | null = null;
  private dragStart = new Vec2();
  private dragTouchStart = new Vec2();
  private dragCurrent = new Vec2();
  private aimPowerLabel: Label | null = null;
  private settleElapsed = 0;
  private shotElapsed = 0;
  private effectGraphics: Graphics | null = null;
  private contactNotice: Label | null = null;
  private contactNoticeTimer = 0;

  private aimGraphics: Graphics | null = null;
  private gameTitleLabel: Label | null = null;
  private scoreLabel: Label | null = null;
  private shotsLabel: Label | null = null;
  private bestLabel: Label | null = null;
  private comboLabel: Label | null = null;
  private missLabel: Label | null = null;
  private hintLabel: Label | null = null;
  private ammoLabel: Label | null = null;
  private resultLabel: Label | null = null;
  private warningLabel: Label | null = null;
  private wordTitleLabel: Label | null = null;
  private wordPreviewLabel: Label | null = null;
  private confirmLabel: Label | null = null;
  private confirmGraphics: Graphics | null = null;
  private confirmNode: Node | null = null;
  private wordTrayNode: Node | null = null;
  private wordHintNode: Node | null = null;
  private wordBookButtonNode: Node | null = null;
  private wordBookButtonLabel: Label | null = null;
  private wordBookOverlay: Node | null = null;
  private menuOverlay: Node | null = null;
  private helpOverlay: Node | null = null;
  private pauseOverlay: Node | null = null;
  private resultOverlay: Node | null = null;
  private pauseButtonNode: Node | null = null;
  private menuBestLabel: Label | null = null;
  private wordBookContentLabel: Label | null = null;
  private tileNodes: Node[] = [];
  private tileGraphics: Graphics[] = [];
  private tileLabels: Label[] = [];
  private tileCenters: Vec2[] = [];
  private practiceAmmoNodes: Node[] = [];
  private practiceAmmoCenters: Vec2[] = [];

  private physicsReady = false;

  onLoad(): void {
    const visible = view.getVisibleSize();
    this.screenWidth = visible.width;
    this.screenHeight = visible.height;

    let rootTransform = this.node.getComponent(UITransform);
    if (!rootTransform) {
      rootTransform = this.node.addComponent(UITransform);
    }
    rootTransform.setContentSize(this.screenWidth, this.screenHeight);
    // Keep the Canvas origin centered after device resolution adaptation.
    this.node.setPosition(this.screenWidth / 2, this.screenHeight / 2, 0);

    this.arenaWidth = Math.min(
      this.screenWidth * PUCK_CONFIG.arenaWidthRatio,
      640,
    );
    this.arenaHeight = Math.min(
      this.screenHeight * PUCK_CONFIG.arenaHeightRatio,
      820,
    );
    // A compact playfield leaves independent space for word cards and safe-area controls.
    this.arenaCenterY = this.screenHeight * 0.022;
    this.targetCenter = new Vec2(
      0,
      this.arenaCenterY + this.arenaHeight * 0.285,
    );
    this.launchY = this.arenaCenterY - this.arenaHeight * 0.345;

    const outer = Math.min(this.arenaWidth * 0.195, 112);
    this.scoreRadii = {
      center: outer * 0.28,
      middle: outer * 0.62,
      outer,
    };

    const physics = PhysicsSystem2D.instance;
    physics.enable = true;
    physics.gravity = new Vec2(0, 0);
    physics.fixedTimeStep = 1 / 60;
    physics.maxSubSteps = 4;
    physics.velocityIterations = 8;
    physics.positionIterations = 3;

    this.physicsReady =
      PhysicsSystem2D.PHYSICS_BOX2D ||
      PhysicsSystem2D.PHYSICS_BOX2D_WASM;

    // The default Cocos performance overlay covers the game controls on phones.
    profiler.hideStats();

    this.createBackground();
    this.createArenaVisuals();
    this.createWalls();
    this.createBumpers();
    this.createEffectLayer();
    this.createAimLayer();
    this.createHud();
    this.createWordPanel();
    this.createWordBookOverlay();
    this.createMenuOverlay();
    this.createHelpOverlay();
    this.createPauseOverlay();
    this.createResultOverlay();

    this.bestScore = SaveManager.getBestScore();
    this.discoveredWordCount = 0;
    this.updateHud();

    this.node.on(Node.EventType.TOUCH_START, this.onTouchStart, this);
    this.node.on(Node.EventType.TOUCH_MOVE, this.onTouchMove, this);
    this.node.on(Node.EventType.TOUCH_END, this.onTouchEnd, this);
    this.node.on(Node.EventType.TOUCH_CANCEL, this.onTouchCancel, this);

    if (!this.physicsReady) {
      if (this.warningLabel) {
        this.warningLabel.node.active = true;
        this.warningLabel.string =
          '请在项目设置 → 功能裁剪中启用 2D Physics / Box2D';
      }
      if (this.hintLabel) {
        this.hintLabel.string = '启用 Box2D 后即可开始游戏';
      }
    }

    this.showHome();
  }

  onDestroy(): void {
    this.interactions.reset();
    this.node.off(Node.EventType.TOUCH_START, this.onTouchStart, this);
    this.node.off(Node.EventType.TOUCH_MOVE, this.onTouchMove, this);
    this.node.off(Node.EventType.TOUCH_END, this.onTouchEnd, this);
    this.node.off(Node.EventType.TOUCH_CANCEL, this.onTouchCancel, this);
  }

  update(deltaTime: number): void {
    if (!this.physicsReady || this.state === GameState.PAUSED ||
        this.state === GameState.MENU || this.state === GameState.RESULT) return;

    const activeFlight = this.state === GameState.FLYING ||
      this.state === GameState.SETTLING;
    if (activeFlight) {
      for (const puck of this.pucks) {
        // Frozen bodies are Static. Flight tuning must not undo that lock.
        if (puck.freezeRemaining > 0) continue;
        AmmoEffectController.updateFlight(
          puck.body, puck.node, puck.ammo,
          this.targetCenter, this.scoreRadii.outer, deltaTime,
        );
      }
    }

    // Also update while choosing the next word: ice locks persist across
    // shots and must thaw on time, but pause must not run the countdown.
    // Physics contact callbacks only enqueue events; the solver never
    // receives unsafe velocity/body-type changes while locked.
    const contacts = this.interactions.update(deltaTime);
    if (contacts.length > 0) {
      this.updateHud();
      const latest = contacts[contacts.length - 1];
      if (this.contactNotice) {
        this.contactNotice.string = latest.text;
        this.contactNotice.color = new Color(
          latest.color[0], latest.color[1], latest.color[2], 255);
        this.contactNotice.node.active = true;
        this.contactNotice.node.setSiblingIndex(this.node.children.length - 1);
        this.contactNoticeTimer = 0.9;
      }
    }
    this.updateInteractionVisuals(deltaTime);
    if (!activeFlight) return;

    if (this.interactions.shouldDelayShotCompletion && this.hintLabel) {
      this.hintLabel.string = '磁场牵引中 · 旧弹药正在被吸引';
    }
    this.shotElapsed += deltaTime;

    if (this.shotElapsed >= PUCK_CONFIG.maxShotDuration) {
      this.stopAllPucks();
      this.finishCurrentShot();
      return;
    }

    let moving = false;
    for (const puck of this.pucks) {
      const velocity = puck.body.linearVelocity;
      const speed = Math.sqrt(
        velocity.x * velocity.x + velocity.y * velocity.y,
      );
      if (speed > PUCK_CONFIG.stopSpeed) {
        moving = true;
        break;
      }
    }

    if (moving || this.interactions.shouldDelayShotCompletion) {
      this.state = GameState.FLYING;
      this.settleElapsed = 0;
      return;
    }

    this.state = GameState.SETTLING;
    this.settleElapsed += deltaTime;

    if (this.settleElapsed >= PUCK_CONFIG.stableDuration) {
      this.finishCurrentShot();
    }
  }

  /**
   * The UI camera renders the Canvas layer, not the DEFAULT layer.
   * New Cocos Nodes use DEFAULT (1 << 30) and do not inherit the
   * parent's layer automatically. Keep every runtime-created visual
   * and input target on the serialized Canvas layer.
   */
  private makeRenderNode(name: string): Node {
    const node = new Node(name);
    node.layer = this.node.layer;
    return node;
  }

  private createPanel(
    parent: Node, name: string, x: number, y: number,
    width: number, height: number, radius: number,
    fill: Color = new Color(255, 255, 255, 255),
    outline: Color = new Color(193, 222, 240, 255),
  ): Node {
    const node = this.makeRenderNode(name);
    parent.addChild(node);
    node.setPosition(x, y, 0);
    node.addComponent(UITransform).setContentSize(width, height);
    const g = node.addComponent(Graphics);
    g.fillColor = new Color(52, 102, 145, 26);
    g.roundRect(-width / 2, -height / 2 - 5, width, height, radius);
    g.fill();
    g.fillColor = fill;
    g.roundRect(-width / 2, -height / 2, width, height, radius);
    g.fill();
    g.lineWidth = 2;
    g.strokeColor = outline;
    g.roundRect(-width / 2, -height / 2, width, height, radius);
    g.stroke();
    return node;
  }

  private createActionButton(
    parent: Node, name: string, title: string, x: number, y: number,
    width: number, height: number, accent = false,
  ): Node {
    const node = this.makeRenderNode(name);
    parent.addChild(node);
    node.setPosition(x, y, 0);
    node.addComponent(UITransform).setContentSize(width, height);
    const g = node.addComponent(Graphics);
    g.fillColor = new Color(30, 83, 122, 33);
    g.roundRect(-width / 2, -height / 2 - 4, width, height, 18);
    g.fill();
    g.fillColor = accent
      ? new Color(255, 186, 96, 255)
      : new Color(75, 159, 215, 255);
    g.roundRect(-width / 2, -height / 2, width, height, 18);
    g.fill();
    this.addChildLabel(
      node, title, width - 16, height - 6,
      Math.min(24, height * 0.38),
      accent ? new Color(69, 66, 77, 255) : Color.WHITE,
    );
    return node;
  }

  private createBackground(): void {
    const node = this.makeRenderNode('Background');
    this.node.addChild(node);
    node.addComponent(UITransform).setContentSize(this.screenWidth, this.screenHeight);
    const g = node.addComponent(Graphics);
    g.fillColor = new Color(232, 246, 254, 255);
    g.rect(-this.screenWidth / 2, -this.screenHeight / 2,
      this.screenWidth, this.screenHeight);
    g.fill();
    g.fillColor = new Color(192, 225, 248, 108);
    g.circle(-this.screenWidth * 0.37, this.screenHeight * 0.28, 90);
    g.fill();
    g.circle(this.screenWidth * 0.37, -this.screenHeight * 0.30, 85);
    g.fill();
    g.fillColor = new Color(255, 255, 255, 145);
    g.circle(this.screenWidth * 0.34, this.screenHeight * 0.15, 28);
    g.fill();
    g.circle(-this.screenWidth * 0.31, -this.screenHeight * 0.18, 25);
    g.fill();
  }

  private createArenaVisuals(): void {
    const arenaNode = this.makeRenderNode('ArenaVisual');
    this.node.addChild(arenaNode);
    arenaNode.setPosition(0, this.arenaCenterY, 0);

    const transform = arenaNode.addComponent(UITransform);
    transform.setContentSize(this.arenaWidth, this.arenaHeight);

    const graphics = arenaNode.addComponent(Graphics);
    graphics.fillColor = new Color(51, 108, 153, 28);
    graphics.roundRect(-this.arenaWidth / 2, -this.arenaHeight / 2 - 6,
      this.arenaWidth, this.arenaHeight, 25);
    graphics.fill();
    graphics.fillColor = new Color(250, 253, 255, 255);
    graphics.roundRect(-this.arenaWidth / 2, -this.arenaHeight / 2,
      this.arenaWidth, this.arenaHeight, 25);
    graphics.fill();
    graphics.lineWidth = 5;
    graphics.strokeColor = new Color(140, 191, 228, 255);
    graphics.roundRect(-this.arenaWidth / 2, -this.arenaHeight / 2,
      this.arenaWidth, this.arenaHeight, 25);
    graphics.stroke();

    graphics.lineWidth = 2;
    graphics.strokeColor = new Color(210, 232, 245, 255);
    graphics.moveTo(0, -this.arenaHeight * 0.305);
    graphics.lineTo(0, this.arenaHeight * 0.17);
    graphics.stroke();
    graphics.fillColor = new Color(210, 237, 252, 255);
    graphics.circle(0, -this.arenaHeight * 0.345, 30);
    graphics.fill();
    graphics.fillColor = new Color(239, 249, 253, 255);
    graphics.circle(0, -this.arenaHeight * 0.345, 17);
    graphics.fill();

    const targetNode = this.makeRenderNode('ScoringTarget');
    this.node.addChild(targetNode);
    targetNode.setPosition(this.targetCenter.x, this.targetCenter.y, 0);
    const targetTransform = targetNode.addComponent(UITransform);
    targetTransform.setContentSize(
      this.scoreRadii.outer * 2,
      this.scoreRadii.outer * 2,
    );

    const target = targetNode.addComponent(Graphics);
    target.fillColor = new Color(255, 221, 133, 255);
    target.circle(0, 0, this.scoreRadii.outer);
    target.fill();

    target.fillColor = new Color(119, 194, 238, 255);
    target.circle(0, 0, this.scoreRadii.middle);
    target.fill();

    target.fillColor = new Color(255, 132, 137, 255);
    target.circle(0, 0, this.scoreRadii.center);
    target.fill();

    target.lineWidth = 4;
    target.strokeColor = Color.WHITE;
    target.circle(0, 0, this.scoreRadii.outer);
    target.stroke();
    target.circle(0, 0, this.scoreRadii.middle);
    target.stroke();
    target.circle(0, 0, this.scoreRadii.center);
    target.stroke();

    this.addLabel(
      'TargetHint',
      '外圈10分  ·  中圈30分  ·  中心50分',
      0,
      this.targetCenter.y + this.scoreRadii.outer + 13,
      16,
      new Color(72, 112, 143, 255),
      this.screenWidth * 0.9,
      30,
    );

    this.addLabel(
      'LaunchHint',
      '拖动圆盘 · 松开发射',
      0,
      this.launchY - 43,
      17,
      new Color(91, 133, 164, 255),
      180,
      28,
    );
  }

  private createWalls(): void {
    const thickness = PUCK_CONFIG.wallThickness;
    const halfWidth = this.arenaWidth / 2;
    const halfHeight = this.arenaHeight / 2;

    this.createStaticWall(
      'WallLeft',
      -halfWidth,
      this.arenaCenterY,
      thickness,
      this.arenaHeight + thickness * 2,
    );
    this.createStaticWall(
      'WallRight',
      halfWidth,
      this.arenaCenterY,
      thickness,
      this.arenaHeight + thickness * 2,
    );
    this.createStaticWall(
      'WallTop',
      0,
      this.arenaCenterY + halfHeight,
      this.arenaWidth,
      thickness,
    );
    this.createStaticWall(
      'WallBottom',
      0,
      this.arenaCenterY - halfHeight,
      this.arenaWidth,
      thickness,
    );
  }

  private createStaticWall(
    name: string,
    x: number,
    y: number,
    width: number,
    height: number,
  ): void {
    const node = this.makeRenderNode(name);
    this.node.addChild(node);
    node.setPosition(x, y, 0);

    const transform = node.addComponent(UITransform);
    transform.setContentSize(width, height);

    const body = node.addComponent(RigidBody2D);
    body.type = ERigidBody2DType.Static;
    body.gravityScale = 0;

    const collider = node.addComponent(BoxCollider2D);
    collider.size = new Size(width, height);
    body.group = 1;
    collider.group = 1;
    collider.sensor = false;
    collider.friction = 0.22;
    collider.restitution = 0.28;
    collider.apply();
  }

  private createBumpers(): void {
    const y = this.arenaCenterY + this.arenaHeight * 0.025;
    this.createBumper(
      'BumperLeft',
      -this.arenaWidth * 0.23,
      y,
      22,
      new Color(255, 190, 100, 255),
    );
    this.createBumper(
      'BumperRight',
      this.arenaWidth * 0.23,
      y,
      22,
      new Color(255, 190, 100, 255),
    );
    this.createBumper(
      'BumperCenter',
      0,
      this.arenaCenterY - this.arenaHeight * 0.12,
      18,
      new Color(130, 197, 235, 255),
    );
  }

  private createBumper(
    name: string,
    x: number,
    y: number,
    radius: number,
    color: Color,
  ): void {
    const node = this.makeRenderNode(name);
    this.node.addChild(node);
    node.setPosition(x, y, 0);

    const transform = node.addComponent(UITransform);
    transform.setContentSize(radius * 2, radius * 2);

    const graphics = node.addComponent(Graphics);
    graphics.fillColor = color;
    graphics.circle(0, 0, radius);
    graphics.fill();
    graphics.lineWidth = 3;
    graphics.strokeColor = Color.WHITE;
    graphics.circle(0, 0, radius);
    graphics.stroke();

    const body = node.addComponent(RigidBody2D);
    body.type = ERigidBody2DType.Static;
    body.gravityScale = 0;

    const collider = node.addComponent(CircleCollider2D);
    collider.radius = radius;
    body.group = 1;
    collider.group = 1;
    collider.sensor = false;
    collider.friction = 0.12;
    collider.restitution = 0.78;
    collider.apply();
  }

  private createEffectLayer(): void {
    const node = this.makeRenderNode('PuckCollisionEffects');
    this.node.addChild(node);
    node.addComponent(UITransform).setContentSize(this.screenWidth, this.screenHeight);
    this.effectGraphics = node.addComponent(Graphics);
    this.contactNotice = this.addLabel(
      'PuckContactNotice', '', 0,
      this.targetCenter.y - this.scoreRadii.outer - 48,
      25, new Color(232, 105, 84, 255), this.screenWidth * 0.72, 46,
    );
    this.contactNotice.node.active = false;
  }

  private updateInteractionVisuals(deltaTime: number): void {
    if (this.contactNoticeTimer > 0) {
      this.contactNoticeTimer = Math.max(0, this.contactNoticeTimer - deltaTime);
      if (this.contactNoticeTimer === 0 && this.contactNotice) {
        this.contactNotice.node.active = false;
      }
    }
    this.interactions.draw(
      this.effectGraphics, deltaTime,
      this.state !== GameState.MENU && this.state !== GameState.RESULT,
      this.targetCenter.x, this.targetCenter.y, this.scoreRadii.outer,
      this.puckRadius,
    );
  }

  private createAimLayer(): void {
    const node = this.makeRenderNode('AimLayer');
    this.node.addChild(node);
    const transform = node.addComponent(UITransform);
    transform.setContentSize(this.screenWidth, this.screenHeight);
    this.aimGraphics = node.addComponent(Graphics);
    this.aimPowerLabel = this.addLabel(
      'AimPowerLabel', '力度 0%', 0, this.launchY - 65, 17,
      new Color(40, 101, 150, 255), this.screenWidth * 0.45, 28,
    );
    this.aimPowerLabel.node.active = false;
  }

  private createHud(): void {
    this.createPanel(this.node, 'HudCard', 0, this.screenHeight * 0.344,
      this.screenWidth * 0.92, 164, 22, new Color(255, 255, 255, 247));

    this.gameTitleLabel = this.addLabel(
      'GameTitleLabel', '词弹碰碰局', 0, this.screenHeight * 0.380,
      30, new Color(44, 91, 129, 255), this.screenWidth * 0.63, 45,
    );
    this.scoreLabel = this.addLabel(
      'ScoreLabel', '总分 0', -this.screenWidth * 0.24, this.screenHeight * 0.342,
      27, new Color(46, 93, 132, 255), this.screenWidth * 0.45, 42,
    );
    this.shotsLabel = this.addLabel(
      'ShotsLabel', '发射 0 · 撞击 0', this.screenWidth * 0.23, this.screenHeight * 0.342,
      18, new Color(62, 113, 151, 255), this.screenWidth * 0.40, 42,
    );
    this.bestLabel = this.addLabel(
      'BestLabel', '最高 0', -this.screenWidth * 0.265, this.screenHeight * 0.304,
      16, new Color(104, 148, 177, 255), this.screenWidth * 0.31, 28,
    );
    this.comboLabel = this.addLabel(
      'ComboLabel', '连击 ×0', 0, this.screenHeight * 0.304,
      17, new Color(226, 145, 62, 255), this.screenWidth * 0.30, 28,
    );
    this.missLabel = this.addLabel(
      'MissLabel', '失误 0/5', this.screenWidth * 0.275, this.screenHeight * 0.304,
      17, new Color(215, 96, 100, 255), this.screenWidth * 0.28, 28,
    );
    this.hintLabel = this.addLabel(
      'HintLabel', '选择两个汉字，组合你的弹药', 0,
      -this.screenHeight * 0.255, 18, new Color(53, 104, 145, 255),
      this.screenWidth * 0.92, 34,
    );
    this.ammoLabel = this.addLabel(
      'AmmoLabel', '', 0, -this.screenHeight * 0.416, 18,
      new Color(57, 102, 142, 255), this.screenWidth * 0.88, 50,
    );
    this.ammoLabel.node.active = false;
    this.warningLabel = this.addLabel(
      'PhysicsWarning', '', 0, this.screenHeight * 0.18, 19,
      new Color(190, 72, 72, 255), this.screenWidth * 0.92, 100,
    );
    this.warningLabel.node.active = false;

    this.pauseButtonNode = this.createActionButton(
      this.node, 'PauseButton', '暂停',
      this.screenWidth * 0.36, this.screenHeight * 0.38, 92, 44,
    );
    this.pauseButtonNode.active = false;
  }

  private createWordPanel(): void {
    this.wordTrayNode = this.createPanel(this.node, 'WordTray', 0, -this.screenHeight * 0.372,
      this.screenWidth * 0.92, 258, 24, new Color(252, 254, 255, 248));
    this.wordTitleLabel = this.addLabel(
      'WordTitle',
      '组词装弹',
      0,
      -this.screenHeight * 0.298,
      24,
      new Color(49, 91, 127, 255),
      this.screenWidth * 0.9,
      38,
    );

    this.wordHintNode = this.createActionButton(
      this.node, 'WordHintButton', '提示',
      this.screenWidth * WORD_UI_CONFIG.hintButtonXRatio,
      -this.screenHeight * WORD_UI_CONFIG.hintButtonYRatio,
      WORD_UI_CONFIG.hintButtonWidth, WORD_UI_CONFIG.hintButtonHeight,
    );
    const tileWidth = WORD_UI_CONFIG.tileWidth;
    const tileHeight = WORD_UI_CONFIG.tileHeight;
    const gap = WORD_UI_CONFIG.tileGap;
    const totalWidth = tileWidth * 6 + gap * 5;
    const startX = -totalWidth / 2 + tileWidth / 2;
    const tileY = -this.screenHeight * WORD_UI_CONFIG.tileYRatio;

    for (let i = 0; i < 6; i += 1) {
      const x = startX + i * (tileWidth + gap);
      const node = this.makeRenderNode('WordTile_' + i);
      this.node.addChild(node);
      node.setPosition(x, tileY, 0);

      const transform = node.addComponent(UITransform);
      transform.setContentSize(tileWidth, tileHeight);

      const graphics = node.addComponent(Graphics);
      const labelNode = this.makeRenderNode('Letter');
      node.addChild(labelNode);
      const labelTransform = labelNode.addComponent(UITransform);
      labelTransform.setContentSize(tileWidth, tileHeight);
      const label = labelNode.addComponent(Label);
      label.fontSize = WORD_UI_CONFIG.tileFontSize;
      label.color = new Color(52, 105, 151, 255);
      label.horizontalAlign = Label.HorizontalAlign.CENTER;
      label.verticalAlign = Label.VerticalAlign.CENTER;

      this.tileNodes.push(node);
      this.tileGraphics.push(graphics);
      this.tileLabels.push(label);
      this.tileCenters.push(new Vec2(x, tileY));
    }

    this.wordPreviewLabel = this.addLabel(
      'WordPreview',
      '请选择两个汉字组成词语',
      0,
      -this.screenHeight * WORD_UI_CONFIG.previewYRatio,
      17,
      new Color(76, 112, 143, 255),
      this.screenWidth * 0.92,
      34,
    );

    const buttonWidth = 220;
    const buttonHeight = 48;
    this.confirmNode = this.makeRenderNode('ConfirmWordButton');
    this.node.addChild(this.confirmNode);
    this.confirmNode.setPosition(0, -this.screenHeight * WORD_UI_CONFIG.confirmYRatio, 0);
    const buttonTransform = this.confirmNode.addComponent(UITransform);
    buttonTransform.setContentSize(buttonWidth, buttonHeight);
    this.confirmGraphics = this.confirmNode.addComponent(Graphics);
    this.confirmLabel = this.addChildLabel(
      this.confirmNode,
      '确认组词',
      buttonWidth,
      buttonHeight,
      20,
      Color.WHITE,
    );

    const bookButtonWidth = WORD_UI_CONFIG.wordBookButtonWidth;
    const bookButtonHeight = WORD_UI_CONFIG.wordBookButtonHeight;
    this.wordBookButtonNode = this.makeRenderNode('WordBookButton');
    this.node.addChild(this.wordBookButtonNode);
    this.wordBookButtonNode.setPosition(
      this.screenWidth * WORD_UI_CONFIG.wordBookButtonXRatio,
      -this.screenHeight * WORD_UI_CONFIG.confirmYRatio,
      0,
    );
    const bookTransform = this.wordBookButtonNode.addComponent(UITransform);
    bookTransform.setContentSize(bookButtonWidth, bookButtonHeight);
    const bookGraphics = this.wordBookButtonNode.addComponent(Graphics);
    bookGraphics.fillColor = new Color(94, 163, 208, 255);
    bookGraphics.roundRect(-bookButtonWidth / 2, -bookButtonHeight / 2, bookButtonWidth, bookButtonHeight, 12);
    bookGraphics.fill();
    bookGraphics.lineWidth = 2;
    bookGraphics.strokeColor = Color.WHITE;
    bookGraphics.roundRect(-bookButtonWidth / 2, -bookButtonHeight / 2, bookButtonWidth, bookButtonHeight, 12);
    bookGraphics.stroke();
    this.wordBookButtonLabel = this.addChildLabel(
      this.wordBookButtonNode,
      '图鉴',
      bookButtonWidth,
      bookButtonHeight,
      17,
      Color.WHITE,
    );

    // The practice ammo selector shares the same tray but never consumes words.
    for (let i = 0; i < PRACTICE_AMMO_TYPES.length; i += 1) {
      const x = this.screenWidth * (-0.3 + i * 0.2);
      const y = -this.screenHeight * WORD_UI_CONFIG.tileYRatio;
      const node = this.createActionButton(
        this.node, 'PracticeAmmo_' + PRACTICE_AMMO_TYPES[i],
        PRACTICE_AMMO_LABELS[i], x, y, 118, 64, i === 3,
      );
      node.active = false;
      this.practiceAmmoNodes.push(node);
      this.practiceAmmoCenters.push(new Vec2(x, y));
    }
    this.updateWordPanel();
  }

  private addChildLabel(
    parent: Node,
    text: string,
    width: number,
    height: number,
    fontSize: number,
    color: Color,
  ): Label {
    const node = this.makeRenderNode('ButtonLabel');
    parent.addChild(node);
    const transform = node.addComponent(UITransform);
    transform.setContentSize(width, height);
    const label = node.addComponent(Label);
    label.string = text;
    label.fontSize = fontSize;
    label.color = color;
    label.horizontalAlign = Label.HorizontalAlign.CENTER;
    label.verticalAlign = Label.VerticalAlign.CENTER;
    return label;
  }

  private addLabel(
    name: string,
    text: string,
    x: number,
    y: number,
    fontSize: number,
    color: Color,
    width: number,
    height: number,
  ): Label {
    const node = this.makeRenderNode(name);
    this.node.addChild(node);
    node.setPosition(x, y, 0);

    const transform = node.addComponent(UITransform);
    transform.setContentSize(width, height);

    const label = node.addComponent(Label);
    label.string = text;
    label.fontSize = fontSize;
    label.lineHeight = Math.round(fontSize * 1.35);
    label.color = color;
    label.horizontalAlign = Label.HorizontalAlign.CENTER;
    label.verticalAlign = Label.VerticalAlign.CENTER;
    return label;
  }

  private updateWordPanel(): void {
    const letters = this.wordPuzzle.getLetters();
    const selected = this.wordPuzzle.getSelectedIndices();

    for (let i = 0; i < this.tileNodes.length; i += 1) {
      const isSelected = selected.indexOf(i) >= 0;
      const graphics = this.tileGraphics[i];
      graphics.clear();
      graphics.fillColor = isSelected
        ? new Color(255, 220, 143, 255)
        : new Color(255, 255, 255, 255);
      graphics.roundRect(
        -WORD_UI_CONFIG.tileWidth / 2,
        -WORD_UI_CONFIG.tileHeight / 2,
        WORD_UI_CONFIG.tileWidth,
        WORD_UI_CONFIG.tileHeight, 12,
      );
      graphics.fill();
      graphics.lineWidth = isSelected ? 4 : 2;
      graphics.strokeColor = isSelected
        ? new Color(239, 155, 62, 255)
        : new Color(173, 204, 227, 255);
      graphics.roundRect(
        -WORD_UI_CONFIG.tileWidth / 2,
        -WORD_UI_CONFIG.tileHeight / 2,
        WORD_UI_CONFIG.tileWidth,
        WORD_UI_CONFIG.tileHeight, 12,
      );
      graphics.stroke();
      this.tileLabels[i].string = letters[i] || '';
    }

    if (this.wordPreviewLabel) {
      this.wordPreviewLabel.string = this.wordPuzzle.getPreviewText();
    }

    const canConfirm = this.wordPuzzle.canConfirm();
    if (this.confirmGraphics) {
      this.confirmGraphics.clear();
      this.confirmGraphics.fillColor = canConfirm
        ? new Color(65, 164, 119, 255)
        : new Color(166, 190, 207, 255);
      this.confirmGraphics.roundRect(-110, -24, 220, 48, 15);
      this.confirmGraphics.fill();
    }
    this.updateWordBookButton();
  }

  private updateWordBookButton(): void {
    if (!this.wordBookButtonLabel) return;
    const discoveredCount = SaveManager.getDiscoveredWords().length;
    this.wordBookButtonLabel.string = '图鉴 ' + discoveredCount + '/' + WORD_DEFINITIONS.length;
  }

  private buildWordBookText(): string {
    const discovered = new Set(SaveManager.getDiscoveredWords());
    const ammoNames = ['弹跳弹', '磁吸弹', '冰冻弹', '冲击弹'];
    const lines = ammoNames.map((ammoName) => {
      const words = WORD_DEFINITIONS
        .filter((definition) => definition.ammoName === ammoName)
        .map((definition) => (discovered.has(definition.word) ? '✓' : '○') + definition.word)
        .join('  ');
      return ammoName + '  ' + words;
    });
    return [
      '已收录 ' + discovered.size + ' / ' + WORD_DEFINITIONS.length,
      '',
      ...lines,
      '',
      '✓ 已发现    ○ 待发现',
    ].join('\n');
  }

  private createWordBookOverlay(): void {
    const overlay = this.makeRenderNode('WordBookOverlay');
    this.node.addChild(overlay);
    overlay.setPosition(0, 0, 0);
    const overlayTransform = overlay.addComponent(UITransform);
    overlayTransform.setContentSize(this.screenWidth, this.screenHeight);
    const overlayGraphics = overlay.addComponent(Graphics);
    overlayGraphics.fillColor = new Color(18, 42, 62, 175);
    overlayGraphics.rect(-this.screenWidth / 2, -this.screenHeight / 2, this.screenWidth, this.screenHeight);
    overlayGraphics.fill();

    const panelWidth = Math.min(620, this.screenWidth - 40);
    const panelHeight = 480;
    const panel = this.makeRenderNode('WordBookPanel');
    overlay.addChild(panel);
    const panelTransform = panel.addComponent(UITransform);
    panelTransform.setContentSize(panelWidth, panelHeight);
    const panelGraphics = panel.addComponent(Graphics);
    panelGraphics.fillColor = new Color(250, 253, 255, 255);
    panelGraphics.roundRect(-panelWidth / 2, -panelHeight / 2, panelWidth, panelHeight, 22);
    panelGraphics.fill();
    panelGraphics.lineWidth = 5;
    panelGraphics.strokeColor = new Color(110, 166, 202, 255);
    panelGraphics.roundRect(-panelWidth / 2, -panelHeight / 2, panelWidth, panelHeight, 22);
    panelGraphics.stroke();

    const title = this.addChildLabel(panel, '词语图鉴', panelWidth - 48, 44, 27, new Color(48, 91, 126, 255));
    title.node.setPosition(0, 185, 0);
    this.wordBookContentLabel = this.addChildLabel(
      panel,
      this.buildWordBookText(),
      panelWidth - 52,
      280,
      18,
      new Color(66, 103, 132, 255),
    );
    this.wordBookContentLabel.lineHeight = 32;
    this.wordBookContentLabel.horizontalAlign = Label.HorizontalAlign.LEFT;
    this.wordBookContentLabel.node.setPosition(0, 0, 0);
    const close = this.addChildLabel(panel, '点击任意位置关闭', panelWidth - 48, 38, 16, new Color(113, 145, 168, 255));
    close.node.setPosition(0, -196, 0);
    overlay.active = false;
    this.wordBookOverlay = overlay;
  }

  private openWordBook(): void {
    if (!this.wordBookOverlay) return;
    if (this.wordBookContentLabel) this.wordBookContentLabel.string = this.buildWordBookText();
    this.wordBookOverlay.active = true;
    this.wordBookOverlay.setSiblingIndex(this.node.children.length - 1);
  }


  private createFullScreenOverlay(name: string, opaque = false): Node {
    const overlay = this.makeRenderNode(name);
    this.node.addChild(overlay);
    overlay.addComponent(UITransform).setContentSize(this.screenWidth, this.screenHeight);
    const g = overlay.addComponent(Graphics);
    g.fillColor = opaque
      ? new Color(232, 245, 255, 255)
      : new Color(23, 55, 88, 172);
    g.rect(-this.screenWidth / 2, -this.screenHeight / 2,
      this.screenWidth, this.screenHeight);
    g.fill();
    overlay.active = false;
    return overlay;
  }

  private createMenuOverlay(): void {
    const overlay = this.createFullScreenOverlay('MainMenuOverlay', true);
    const width = Math.min(this.screenWidth * 0.87, 630);
    this.createPanel(overlay, 'MainMenuCard', 0, 0, width, 970, 34,
      new Color(255, 255, 255, 252));
    const title = this.addChildLabel(overlay, '词弹碰碰局', width - 40,
      78, 47, new Color(47, 104, 146, 255));
    title.node.setPosition(0, 316, 0);
    const subtitle = this.addChildLabel(overlay, '组好词  ·  弹出惊喜',
      width - 44, 40, 23, new Color(109, 146, 170, 255));
    subtitle.node.setPosition(0, 246, 0);

    const hero = this.makeRenderNode('MainMenuHero');
    overlay.addChild(hero);
    hero.setPosition(0, 100, 0);
    hero.addComponent(UITransform).setContentSize(width - 80, 205);
    const g = hero.addComponent(Graphics);
    g.fillColor = new Color(239, 248, 255, 255);
    g.roundRect(-(width - 95) / 2, -92, width - 95, 188, 24);
    g.fill();
    g.fillColor = new Color(255, 208, 102, 255);
    g.circle(0, 9, 72); g.fill();
    g.fillColor = new Color(114, 193, 235, 255);
    g.circle(0, 9, 49); g.fill();
    g.fillColor = new Color(255, 125, 141, 255);
    g.circle(0, 9, 26); g.fill();
    g.fillColor = new Color(255, 182, 91, 255);
    g.circle(-151, -18, 25); g.fill();
    g.fillColor = new Color(96, 178, 231, 255);
    g.circle(152, 54, 23); g.fill();

    const caption = this.addChildLabel(overlay, '选字组词  →  拖拽发射  →  命中得分',
      width - 50, 40, 19, new Color(75, 119, 150, 255));
    caption.node.setPosition(0, -27, 0);

    this.createActionButton(overlay, 'MenuStartButton', '开始游戏',
      0, -124, 322, 70, true);
    this.createActionButton(overlay, 'MenuPracticeButton', '碰撞练习',
      0, -207, 322, 64);
    this.createActionButton(overlay, 'MenuHowToButton', '玩法说明',
      0, -291, 322, 61);
    this.createActionButton(overlay, 'MenuBookButton', '词语图鉴',
      0, -365, 322, 61);
    this.menuBestLabel = this.addChildLabel(
      overlay, '历史最高 0', width - 40, 34, 20, new Color(104, 144, 172, 255));
    this.menuBestLabel.node.setPosition(0, -438, 0);
    this.menuOverlay = overlay;
  }

  private createHelpOverlay(): void {
    const overlay = this.createFullScreenOverlay('HowToOverlay');
    const width = Math.min(this.screenWidth * 0.88, 640);
    this.createPanel(overlay, 'HowToCard', 0, 0, width, 570, 28);
    const title = this.addChildLabel(overlay, '怎么玩？',
      width - 36, 60, 32, new Color(45, 95, 138, 255));
    title.node.setPosition(0, 205, 0);
    const steps = [
      '① 在六张汉字卡中选两个字',
      '② 组成词语，确认获得不同弹药',
      '③ 需要帮助可点击组词区的「提示」',
      '④ 按住圆盘向后拖动，看清轨迹和力度',
      '⑤ 松开发射，越靠近靶心得分越高',
      '⑥ 连击加分，失误累计五次结束',
      '⑦ 主页「碰撞练习」可直接选择四种弹药',
    ].join('\n');
    const text = this.addChildLabel(overlay, steps, width - 70, 325,
      21, new Color(76, 113, 145, 255));
    text.horizontalAlign = Label.HorizontalAlign.LEFT;
    text.lineHeight = 40;
    text.node.setPosition(0, 4, 0);
    this.createActionButton(overlay, 'HelpBackButton', '明白了',
      0, -225, 240, 64, true);
    this.helpOverlay = overlay;
  }

  private createPauseOverlay(): void {
    const overlay = this.createFullScreenOverlay('PauseOverlay');
    const width = Math.min(this.screenWidth * 0.82, 580);
    this.createPanel(overlay, 'PauseCard', 0, 0, width, 525, 28);
    const title = this.addChildLabel(overlay, '游戏暂停',
      width - 50, 75, 36, new Color(48, 100, 145, 255));
    title.node.setPosition(0, 173, 0);
    const subtitle = this.addChildLabel(overlay, '停下来调整好方向，再继续挑战',
      width - 60, 35, 18, new Color(110, 148, 169, 255));
    subtitle.node.setPosition(0, 121, 0);
    this.createActionButton(overlay, 'PauseResume', '继续游戏',
      0, 22, 300, 70, true);
    this.createActionButton(overlay, 'PauseRestart', '重新开始',
      0, -78, 300, 64);
    this.createActionButton(overlay, 'PauseHome', '返回主页',
      0, -171, 300, 64);
    this.pauseOverlay = overlay;
  }

  private createResultOverlay(): void {
    const overlay = this.createFullScreenOverlay('ResultOverlay');
    const width = Math.min(this.screenWidth * 0.89, 640);
    this.createPanel(overlay, 'ResultCard', 0, 0, width, 540, 30);
    const title = this.addChildLabel(overlay, '本局结算',
      width - 40, 66, 36, new Color(48, 100, 145, 255));
    title.node.setPosition(0, 194, 0);
    this.resultLabel = this.addChildLabel(overlay, '', width - 52,
      285, 26, new Color(59, 100, 135, 255));
    this.resultLabel.lineHeight = 40;
    this.resultLabel.node.setPosition(0, 28, 0);
    this.createActionButton(overlay, 'ResultRestart', '再来一局',
      -this.screenWidth * 0.18, -183, 224, 70, true);
    this.createActionButton(overlay, 'ResultHome', '返回主页',
      this.screenWidth * 0.18, -183, 224, 70);
    this.resultOverlay = overlay;
  }

  private withinBox(
    point: Vec2, x: number, y: number, width: number, height: number,
  ): boolean {
    return Math.abs(point.x - x) <= width / 2 &&
      Math.abs(point.y - y) <= height / 2;
  }

  private showHome(): void {
    PhysicsSystem2D.instance.enable = true;
    this.isDragging = false;
    this.activeTouchId = null;
    this.clearAim();
    this.state = GameState.MENU;
    this.setWordPanelVisible(false);
    if (this.ammoLabel) this.ammoLabel.node.active = false;
    if (this.hintLabel) this.hintLabel.node.active = false;
    if (this.pauseButtonNode) this.pauseButtonNode.active = false;
    if (this.pauseOverlay) this.pauseOverlay.active = false;
    if (this.helpOverlay) this.helpOverlay.active = false;
    if (this.resultOverlay) this.resultOverlay.active = false;
    if (this.wordBookOverlay) this.wordBookOverlay.active = false;
    if (this.menuBestLabel) {
      this.menuBestLabel.string = '历史最高分  ' + SaveManager.getBestScore();
    }
    if (this.menuOverlay) {
      this.menuOverlay.active = true;
      this.menuOverlay.setSiblingIndex(this.node.children.length - 1);
    }
  }

  private pauseRun(): void {
    if (this.state === GameState.MENU ||
        this.state === GameState.RESULT || this.state === GameState.PAUSED) return;
    this.pausedFrom = this.state === GameState.AIMING ? GameState.READY : this.state;
    this.isDragging = false;
    this.activeTouchId = null;
    this.clearAim();
    this.state = GameState.PAUSED;
    PhysicsSystem2D.instance.enable = false;
    if (this.pauseOverlay) {
      this.pauseOverlay.active = true;
      this.pauseOverlay.setSiblingIndex(this.node.children.length - 1);
    }
  }

  private resumeRun(): void {
    if (this.state !== GameState.PAUSED) return;
    PhysicsSystem2D.instance.enable = true;
    this.state = this.pausedFrom;
    if (this.pauseOverlay) this.pauseOverlay.active = false;
  }

  private returnToHome(): void {
    PhysicsSystem2D.instance.enable = true;
    this.practiceMode = false;
    this.restartRun();
    this.showHome();
  }

  private setWordPanelVisible(visible: boolean): void {
    const wordVisible = visible && !this.practiceMode;
    const practiceVisible = visible && this.practiceMode;
    if (this.wordTrayNode) this.wordTrayNode.active = visible;
    if (this.wordHintNode) this.wordHintNode.active = wordVisible;
    if (this.wordTitleLabel) {
      this.wordTitleLabel.node.active = visible;
      if (visible) this.wordTitleLabel.string = this.practiceMode
        ? '碰撞练习 · 选择弹药' : '组词装弹';
    }
    if (this.wordPreviewLabel) this.wordPreviewLabel.node.active = visible;
    if (this.confirmNode) this.confirmNode.active = wordVisible;
    if (this.wordBookButtonNode) this.wordBookButtonNode.active = wordVisible;
    for (const node of this.tileNodes) node.active = wordVisible;
    for (const node of this.practiceAmmoNodes) node.active = practiceVisible;
  }

  private showWordState(): void {
    this.state = GameState.WORD_SELECT;
    this.currentAmmo = null;
    this.currentPuck = null;
    this.setWordPanelVisible(true);
    if (this.ammoLabel) this.ammoLabel.node.active = false;
    if (this.hintLabel) {
      this.hintLabel.string = this.practiceMode
        ? '选一种弹药，对准场上的旧弹药发射'
        : '选择两个汉字，组合下一发弹药';
    }
    if (this.practiceMode) {
      if (this.wordPreviewLabel) {
        this.wordPreviewLabel.string = '练习不计最高分 · 观察弹药碰撞和特殊效果';
      }
    } else {
      this.updateWordPanel();
    }
  }

  private showAmmoState(): void {
    this.setWordPanelVisible(false);
    if (this.ammoLabel && this.currentAmmo) {
      this.ammoLabel.node.active = true;
      this.ammoLabel.string =
        this.currentAmmo.word + '  →  ' + this.currentAmmo.name +
        '：' + this.currentAmmo.description;
    }
    if (this.hintLabel) {
      this.hintLabel.string = '按住圆盘向后拖动，松手发射';
    }
  }

  private handleWordInput(point: Vec2): void {
    if (this.practiceMode) {
      this.handlePracticeAmmoInput(point);
      return;
    }
    if (this.wordHintNode && this.withinBox(
      point,
      this.screenWidth * WORD_UI_CONFIG.hintButtonXRatio,
      -this.screenHeight * WORD_UI_CONFIG.hintButtonYRatio,
      WORD_UI_CONFIG.hintButtonWidth, WORD_UI_CONFIG.hintButtonHeight,
    )) {
      const suggested = this.wordPuzzle.suggestWord();
      this.updateWordPanel();
      if (this.wordPreviewLabel && suggested) {
        this.wordPreviewLabel.string = '提示：' +
          suggested.word + '  →  ' + suggested.ammoName;
      }
      return;
    }
    const bookX = this.screenWidth * WORD_UI_CONFIG.wordBookButtonXRatio;
    const bookY = -this.screenHeight * WORD_UI_CONFIG.confirmYRatio;
    if (this.wordBookButtonNode && Math.abs(point.x - bookX) <= 56 && Math.abs(point.y - bookY) <= 28) {
      this.openWordBook();
      return;
    }

    if (this.confirmNode) {
      const confirmY = -this.screenHeight * WORD_UI_CONFIG.confirmYRatio;
      if (
        Math.abs(point.x) <= 110 &&
        Math.abs(point.y - confirmY) <= 28
      ) {
        this.confirmWord();
        return;
      }
    }

    for (let i = 0; i < this.tileCenters.length; i += 1) {
      const center = this.tileCenters[i];
      if (
        Math.abs(point.x - center.x) <= WORD_UI_CONFIG.tileWidth / 2 &&
        Math.abs(point.y - center.y) <= WORD_UI_CONFIG.tileHeight / 2
      ) {
        this.wordPuzzle.toggleSelection(i);
        this.updateWordPanel();
        return;
      }
    }
  }

  private handlePracticeAmmoInput(point: Vec2): void {
    if (!this.physicsReady) return;
    for (let i = 0; i < this.practiceAmmoCenters.length; i += 1) {
      const center = this.practiceAmmoCenters[i];
      if (!this.withinBox(point, center.x, center.y, 125, 70)) continue;
      const word = WORD_DEFINITIONS.find(
        (entry) => entry.ammoType === PRACTICE_AMMO_TYPES[i],
      );
      if (!word) return;
      this.spawnPuck(AmmoFactory.create(word));
      this.state = GameState.READY;
      this.showAmmoState();
      this.updateHud();
      return;
    }
  }

  private spawnPracticeTargets(): void {
    // Spawn bodies at their FINAL positions (do not teleport active Box2D bodies).
    const types: AmmoType[] = ['bounce', 'ice'];
    const y = this.targetCenter.y - this.scoreRadii.outer * 1.27;
    for (let i = 0; i < types.length; i += 1) {
      const word = WORD_DEFINITIONS.find((entry) => entry.ammoType === types[i]);
      if (!word) continue;
      const x = this.arenaWidth * (i === 0 ? -0.14 : 0.14);
      this.spawnPuck(AmmoFactory.create(word), new Vec2(x, y));
      this.currentPuck?.body.sleep();
    }
    this.currentPuck = null;
    this.currentAmmo = null;
  }

  private confirmWord(): void {
    if (!this.physicsReady) {
      if (this.warningLabel) {
        this.warningLabel.node.active = true;
        this.warningLabel.string = '请先启用 2D Physics / Box2D';
      }
      return;
    }

    const definition = this.wordPuzzle.confirmSelection();
    if (!definition) {
      if (this.wordPreviewLabel) {
        this.wordPreviewLabel.string = '暂未收录这个词语，请重新选择';
      }
      return;
    }

    const ammo = AmmoFactory.create(definition);
    this.currentAmmo = ammo;
    this.runDiscoveredWords.add(definition.word);
    SaveManager.recordDiscoveredWord(definition.word);
    this.discoveredWordCount = this.runDiscoveredWords.size;
    this.updateWordBookButton();
    this.spawnPuck(ammo);
    this.state = GameState.READY;
    this.showAmmoState();
    this.updateHud();
  }

  private spawnPuck(ammo: AmmoDefinition, presetPosition?: Vec2): void {
    if (this.pucks.length >= PUCK_CONFIG.maxActivePucks) {
      const oldest = this.pucks.shift();
      if (oldest) {
        this.bankedScore += oldest.score;
        this.interactions.unregister(oldest);
        oldest.node.destroy();
      }
    }

    const offsets = [
      0,
      -this.arenaWidth * 0.16,
      this.arenaWidth * 0.16,
      -this.arenaWidth * 0.31,
      this.arenaWidth * 0.31,
    ];

    let selectedX = offsets[0];
    let bestClearance = -1;

    for (const offset of offsets) {
      let clearance = Number.POSITIVE_INFINITY;
      for (const puck of this.pucks) {
        const distance = distanceBetween(
          offset,
          this.launchY,
          puck.node.position.x,
          puck.node.position.y,
        );
        clearance = Math.min(clearance, distance);
      }

      if (this.pucks.length === 0) {
        selectedX = offset;
        break;
      }

      if (clearance > bestClearance) {
        bestClearance = clearance;
        selectedX = offset;
      }

      if (clearance > this.puckRadius * 2.5) {
        selectedX = offset;
        break;
      }
    }

    // Training targets do not count as fired shots, so IDs must be unique
    // independently from shotsFired for collision pair deduplication.
    const index = this.nextPuckIndex++;
    const node = this.makeRenderNode('Ammo_' + index);
    this.node.addChild(node);
    node.setPosition(
      presetPosition ? presetPosition.x : selectedX,
      presetPosition ? presetPosition.y : this.launchY, 0,
    );

    const transform = node.addComponent(UITransform);
    transform.setContentSize(this.puckRadius * 2, this.puckRadius * 2);

    const graphics = node.addComponent(Graphics);
    graphics.fillColor = new Color(28, 65, 99, 32);
    graphics.circle(2, -4, this.puckRadius + 3);
    graphics.fill();
    graphics.fillColor = new Color(
      ammo.color[0],
      ammo.color[1],
      ammo.color[2],
      255,
    );
    graphics.circle(0, 0, this.puckRadius);
    graphics.fill();
    graphics.lineWidth = 3;
    graphics.strokeColor = Color.WHITE;
    graphics.circle(0, 0, this.puckRadius);
    graphics.stroke();

    const wordLabelNode = this.makeRenderNode('AmmoWord');
    node.addChild(wordLabelNode);
    const wordTransform = wordLabelNode.addComponent(UITransform);
    wordTransform.setContentSize(this.puckRadius * 2, this.puckRadius * 2);
    const wordLabel = wordLabelNode.addComponent(Label);
    wordLabel.string = ammo.word;
    wordLabel.fontSize = 11;
    wordLabel.color = Color.WHITE;
    wordLabel.horizontalAlign = Label.HorizontalAlign.CENTER;
    wordLabel.verticalAlign = Label.VerticalAlign.CENTER;

    const body = node.addComponent(RigidBody2D);
    body.type = ERigidBody2DType.Dynamic;
    body.gravityScale = 0;
    body.linearVelocity = new Vec2(0, 0);

    const collider = node.addComponent(CircleCollider2D);
    collider.radius = this.puckRadius;
    AmmoEffectController.applyToPuck(body, collider, ammo);

    const entry: PuckEntry = {
      node,
      body,
      collider,
      ammo,
      index,
      score: 0,
      scoreMultiplier: 1,
      freezeRemaining: 0,
    };

    this.interactions.register(entry);
    this.pucks.push(entry);
    this.currentPuck = entry;
    this.currentAmmo = ammo;
  }

  private onTouchStart(event: EventTouch): void {
    const point = this.getCanvasPoint(event);

    if (this.wordBookOverlay?.active) {
      this.wordBookOverlay.active = false;
      return;
    }

    if (this.helpOverlay?.active) {
      this.helpOverlay.active = false;
      return;
    }

    if (this.menuOverlay?.active) {
      if (this.withinBox(point, 0, -124, 322, 76)) {
        this.practiceMode = false;
        this.startRun();
      } else if (this.withinBox(point, 0, -207, 322, 70)) {
        this.practiceMode = true;
        this.startRun();
      } else if (this.withinBox(point, 0, -291, 322, 65)) {
        if (this.helpOverlay) {
          this.helpOverlay.active = true;
          this.helpOverlay.setSiblingIndex(this.node.children.length - 1);
        }
      } else if (this.withinBox(point, 0, -365, 322, 65)) {
        this.openWordBook();
      }
      return;
    }

    if (this.pauseOverlay?.active) {
      if (this.withinBox(point, 0, 22, 300, 76)) {
        this.resumeRun();
      } else if (this.withinBox(point, 0, -78, 300, 70)) {
        this.resumeRun();
        this.restartRun();
      } else if (this.withinBox(point, 0, -171, 300, 70)) {
        this.returnToHome();
      }
      return;
    }

    if (this.resultOverlay?.active) {
      if (this.withinBox(point, -this.screenWidth * 0.18, -183, 224, 74)) {
        this.startRun();
      } else if (this.withinBox(point, this.screenWidth * 0.18, -183, 224, 74)) {
        this.returnToHome();
      }
      return;
    }

    if (this.state === GameState.RESULT || this.state === GameState.PAUSED) return;

    if (this.pauseButtonNode?.active && this.withinBox(
      point, this.screenWidth * 0.36, this.screenHeight * 0.38, 108, 56,
    )) {
      this.pauseRun();
      return;
    }

    if (this.state === GameState.WORD_SELECT) {
      this.handleWordInput(point);
      return;
    }

    if (!this.physicsReady || this.state !== GameState.READY || !this.currentPuck) {
      return;
    }

    const puck = this.currentPuck;
    const puckPosition = puck.node.position;
    const distance = distanceBetween(
      point.x,
      point.y,
      puckPosition.x,
      puckPosition.y,
    );

    if (distance > this.puckRadius * AIM_CONFIG.touchRadiusMultiplier) return;

    this.isDragging = true;
    this.activeTouchId = event.getID();
    this.state = GameState.AIMING;
    this.dragStart = new Vec2(puckPosition.x, puckPosition.y);
    this.dragTouchStart = point;
    this.dragCurrent = point;
    this.drawAim();
  }

  private onTouchMove(event: EventTouch): void {
    if (!this.isDragging || this.state !== GameState.AIMING ||
        event.getID() !== this.activeTouchId) return;
    const next = this.getCanvasPoint(event);
    if (distanceBetween(next.x, next.y, this.dragCurrent.x, this.dragCurrent.y) <
        AIM_CONFIG.moveRedrawThreshold) return;
    this.dragCurrent = next;
    this.drawAim();
  }

  private onTouchEnd(event: EventTouch): void {
    if (!this.isDragging || this.state !== GameState.AIMING ||
        event.getID() !== this.activeTouchId) return;

    this.dragCurrent = this.getCanvasPoint(event);
    this.isDragging = false;
    this.activeTouchId = null;
    this.clearAim();

    const puck = this.currentPuck;
    const ammo = this.currentAmmo;
    const aim = calculateAim(
      this.dragTouchStart.x, this.dragTouchStart.y,
      this.dragCurrent.x, this.dragCurrent.y,
      ammo?.launchSpeedMultiplier ?? 1,
    );
    if (!aim.ready || !puck || !ammo) {
      this.state = GameState.READY;
      return;
    }

    const velocity = new Vec2(
      aim.directionX * aim.speed,
      aim.directionY * aim.speed,
    );

    this.scoreBeforeShot = this.totalScore;
    puck.body.linearVelocity = velocity;
    puck.body.wakeUp();
    this.interactions.beginShot(puck);

    this.state = GameState.FLYING;
    this.settleElapsed = 0;
    this.shotElapsed = 0;

    if (this.hintLabel) {
      this.hintLabel.string = '弹药飞行中……';
    }
    this.updateHud();
  }

  private onTouchCancel(event: EventTouch): void {
    if (!this.isDragging || event.getID() !== this.activeTouchId) return;
    this.isDragging = false;
    this.activeTouchId = null;
    this.clearAim();
    if (this.state === GameState.AIMING) {
      this.state = GameState.READY;
    }
  }

  private getCanvasPoint(event: EventTouch): Vec2 {
    const ui = event.getUILocation();
    return new Vec2(
      ui.x - this.screenWidth / 2,
      ui.y - this.screenHeight / 2,
    );
  }

  private drawAim(): void {
    if (!this.aimGraphics || !this.currentPuck) return;
    const graphics = this.aimGraphics;
    graphics.clear();
    graphics.node.setSiblingIndex(this.node.children.length - 1);
    const aim = calculateAim(
      this.dragTouchStart.x, this.dragTouchStart.y,
      this.dragCurrent.x, this.dragCurrent.y,
      this.currentAmmo?.launchSpeedMultiplier ?? 1,
    );
    const powerRatio = aim.ready
      ? AIM_CONFIG.minimumSpeedRatio + aim.strength * (1 - AIM_CONFIG.minimumSpeedRatio)
      : 0;
    if (this.aimPowerLabel) {
      this.aimPowerLabel.node.active = true;
      this.aimPowerLabel.string = aim.ready
        ? '力度 ' + Math.round(powerRatio * 100) + '% · 松开发射'
        : '向后拖动瞄准 · 松手取消';
    }
    if (!aim.ready) return;

    // Wall-only preview: bumpers, other pucks and ammo effects can alter the real shot.
    const inset = this.puckRadius + PUCK_CONFIG.wallThickness / 2;
    const path = predictWallBouncePath(
      this.dragStart.x, this.dragStart.y, aim.directionX, aim.directionY,
      110 + aim.strength * 385,
      {
        left: -this.arenaWidth / 2 + inset,
        right: this.arenaWidth / 2 - inset,
        bottom: this.arenaCenterY - this.arenaHeight / 2 + inset,
        top: this.arenaCenterY + this.arenaHeight / 2 - inset,
      }, 2,
    );
    const guideColor = powerRatio >= 0.8 ? new Color(227, 99, 83, 255)
      : powerRatio >= 0.5 ? new Color(220, 147, 68, 255)
      : new Color(42, 130, 195, 255);
    for (let i = 1; i < path.length; i++) {
      const from = path[i - 1], to = path[i];
      const dist = distanceBetween(from.x, from.y, to.x, to.y);
      graphics.fillColor = guideColor;
      const count = Math.max(1, Math.ceil(dist / 28));
      for (let dot = 1; dot <= count; dot++) {
        const t = dot / count;
        graphics.circle(from.x + (to.x - from.x) * t,
          from.y + (to.y - from.y) * t, i === 1 ? 4 : 3);
      }
      graphics.fill();
    }
    // Red markers flag approximate intersections with existing pucks.
    // Actual contacts are confirmed by the Box2D BEGIN_CONTACT callback.
    let candidateContact = false;
    for (const oldPuck of this.pucks) {
      if (oldPuck === this.currentPuck) continue;
      if (!pathIntersectsCircle(path, oldPuck.node.position.x,
        oldPuck.node.position.y, this.puckRadius * 2 + 4)) continue;
      candidateContact = true;
      graphics.lineWidth = 4;
      graphics.strokeColor = new Color(249, 116, 92, 245);
      graphics.circle(oldPuck.node.position.x, oldPuck.node.position.y,
        this.puckRadius + 12);
      graphics.stroke();
    }
    if (candidateContact && this.aimPowerLabel) {
      this.aimPowerLabel.string = '瞄准旧弹药 · 松开发射';
    }
    const arrowLength = 44 + aim.strength * 31;
    const endX = this.dragStart.x + aim.directionX * arrowLength;
    const endY = this.dragStart.y + aim.directionY * arrowLength;
    graphics.lineWidth = 5;
    graphics.strokeColor = guideColor;
    graphics.moveTo(this.dragStart.x, this.dragStart.y);
    graphics.lineTo(endX, endY);
    graphics.stroke();
    const angle = Math.atan2(aim.directionY, aim.directionX);
    graphics.fillColor = guideColor;
    graphics.moveTo(endX, endY);
    graphics.lineTo(endX - Math.cos(angle - 0.42) * 15,
      endY - Math.sin(angle - 0.42) * 15);
    graphics.lineTo(endX - Math.cos(angle + 0.42) * 15,
      endY - Math.sin(angle + 0.42) * 15);
    graphics.close();
    graphics.fill();
    const barWidth = 170, barX = -barWidth / 2, barY = this.launchY - 94;
    graphics.fillColor = new Color(194, 216, 230, 245);
    graphics.roundRect(barX, barY, barWidth, 12, 6);
    graphics.fill();
    graphics.fillColor = guideColor;
    graphics.roundRect(barX, barY, barWidth * powerRatio, 12, 6);
    graphics.fill();
  }

  private clearAim(): void {
    this.aimGraphics?.clear();
    if (this.aimPowerLabel) this.aimPowerLabel.node.active = false;
  }

  private stopAllPucks(): void {
    for (const puck of this.pucks) {
      puck.body.linearVelocity = new Vec2(0, 0);
      puck.body.angularVelocity = 0;
      puck.body.sleep();
    }
  }

  private finishCurrentShot(): void {
    this.settleElapsed = 0;
    this.shotElapsed = 0;
    this.interactions.endShot();

    const currentPuck = this.currentPuck;
    if (!currentPuck) return;

    const position = currentPuck.node.position;
    const distance = distanceBetween(
      position.x,
      position.y,
      this.targetCenter.x,
      this.targetCenter.y,
    );
    const baseScore = scoreByDistance(distance, this.scoreRadii);

    // First recalculate all active pucks with their current multipliers.
    // A shot also counts as a success when it pushes an older puck into a scoring ring.
    this.recalculateActiveScores();
    const scoreDelta = this.totalScore - this.scoreBeforeShot;
    const didScore = baseScore > 0 || scoreDelta > 0;

    if (didScore) {
      this.comboStreak += 1;
      this.missCount = Math.max(0, this.missCount - 1);
      const comboMultiplier = Math.min(
        1 + (this.comboStreak - 1) * PUCK_CONFIG.comboStep,
        PUCK_CONFIG.maxComboMultiplier,
      );
      currentPuck.scoreMultiplier =
        comboMultiplier * currentPuck.ammo.scoreMultiplier;
    } else {
      this.comboStreak = 0;
      this.missCount += 1;
      currentPuck.scoreMultiplier = 1;
    }

    this.shotsFired += 1;
    this.recalculateActiveScores();
    this.currentPuck = null;
    this.currentAmmo = null;
    this.updateHud();

    if (!this.practiceMode && this.missCount >= PUCK_CONFIG.maxMisses) {
      this.finishRun();
      return;
    }

    this.showWordState();
  }

  private recalculateActiveScores(): void {
    let activeScore = 0;

    for (const puck of this.pucks) {
      const position = puck.node.position;
      const distance = distanceBetween(
        position.x,
        position.y,
        this.targetCenter.x,
        this.targetCenter.y,
      );
      const base = scoreByDistance(distance, this.scoreRadii);
      puck.score = Math.round(base * puck.scoreMultiplier);
      activeScore += puck.score;
    }

    this.totalScore = this.bankedScore + activeScore;
  }

  private finishRun(): void {
    this.state = GameState.RESULT;
    this.setWordPanelVisible(false);
    if (this.ammoLabel) this.ammoLabel.node.active = false;

    const newBest = !this.practiceMode && this.totalScore > this.bestScore;
    if (!this.practiceMode) {
      this.bestScore = SaveManager.saveBestScore(this.totalScore);
    }

    if (this.resultLabel) {
      this.resultLabel.string =
        '得分  ' + this.totalScore +
        (newBest ? '\n恭喜打破最高纪录！' : '') +
        '\n发射次数  ' + this.shotsFired +
        '\n弹药相撞  ' + this.interactions.collisionCount + ' 次' +
        '\n本局收录词语  ' + this.discoveredWordCount +
        '\n历史最高  ' + this.bestScore;
    }
    if (this.pauseButtonNode) this.pauseButtonNode.active = false;
    if (this.resultOverlay) {
      this.resultOverlay.active = true;
      this.resultOverlay.setSiblingIndex(this.node.children.length - 1);
    }
    if (this.hintLabel) this.hintLabel.string = '本局结束';
    this.updateHud();
  }

  private restartRun(): void {
    this.interactions.reset();
    this.effectGraphics?.clear();
    this.contactNoticeTimer = 0;
    if (this.contactNotice) this.contactNotice.node.active = false;
    for (const puck of this.pucks) {
      puck.node.destroy();
    }

    this.pucks = [];
    this.currentPuck = null;
    this.currentAmmo = null;
    this.shotsFired = 0;
    this.nextPuckIndex = 0;
    this.totalScore = 0;
    this.scoreBeforeShot = 0;
    this.bankedScore = 0;
    this.comboStreak = 0;
    this.missCount = 0;
    this.discoveredWordCount = 0;
    this.runDiscoveredWords.clear();
    this.settleElapsed = 0;
    this.shotElapsed = 0;
    this.isDragging = false;
    this.activeTouchId = null;
    this.wordPuzzle.reset();
    this.state = GameState.WORD_SELECT;

    if (this.resultOverlay) this.resultOverlay.active = false;
    if (this.resultLabel) this.resultLabel.node.active = true;
    this.clearAim();
    if (this.practiceMode && this.physicsReady) this.spawnPracticeTargets();
    this.showWordState();
    this.updateHud();
  }

  private updateHud(): void {
    if (this.gameTitleLabel) {
      this.gameTitleLabel.string = this.practiceMode ? '碰撞练习' : '词弹碰碰局';
    }
    if (this.scoreLabel) {
      this.scoreLabel.string =
        (this.practiceMode ? '练习分 ' : '总分 ') + this.totalScore;
    }
    if (this.shotsLabel) {
      this.shotsLabel.string =
        '发射 ' + this.shotsFired + ' · 撞击 ' +
        this.interactions.collisionCount;
    }
    if (this.bestLabel) {
      this.bestLabel.string = this.practiceMode
        ? '练习不计入纪录' : '最高纪录 ' + this.bestScore;
    }
    if (this.comboLabel) {
      const multiplier = Math.min(
        1 + Math.max(0, this.comboStreak - 1) * PUCK_CONFIG.comboStep,
        PUCK_CONFIG.maxComboMultiplier,
      );
      this.comboLabel.string = this.comboStreak > 0
        ? '连击 ' + this.comboStreak + '  ×' + multiplier.toFixed(2)
        : '连击待触发';
    }
    if (this.missLabel) {
      this.missLabel.string = this.practiceMode
        ? '自由试射' : '失误 ' + this.missCount + '/' + PUCK_CONFIG.maxMisses;
    }
  }

  private startRun(): void {
    PhysicsSystem2D.instance.enable = true;
    if (this.menuOverlay) this.menuOverlay.active = false;
    if (this.helpOverlay) this.helpOverlay.active = false;
    if (this.pauseOverlay) this.pauseOverlay.active = false;
    if (this.resultOverlay) this.resultOverlay.active = false;
    if (this.pauseButtonNode) this.pauseButtonNode.active = true;
    if (this.hintLabel) this.hintLabel.node.active = true;
    this.restartRun();
  }
}

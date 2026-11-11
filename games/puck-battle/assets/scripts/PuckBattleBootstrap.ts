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
} from 'cc';

import { PUCK_CONFIG, WORD_UI_CONFIG } from './GameConfig';
import { AmmoDefinition, AmmoFactory } from './AmmoFactory';
import { AmmoEffectController } from './AmmoEffectController';
import { distanceBetween, scoreByDistance } from './ScoreRules';
import { SaveManager } from './SaveManager';
import { WordPuzzleController } from './WordPuzzleController';

const { ccclass } = _decorator;

enum GameState {
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

  private state = GameState.WORD_SELECT;
  private pucks: PuckEntry[] = [];
  private currentPuck: PuckEntry | null = null;
  private currentAmmo: AmmoDefinition | null = null;
  private wordPuzzle = new WordPuzzleController();

  private shotsFired = 0;
  private totalScore = 0;
  private bankedScore = 0;
  private bestScore = 0;
  private comboStreak = 0;
  private missCount = 0;
  private discoveredWordCount = 0;

  private isDragging = false;
  private dragStart = new Vec2();
  private dragCurrent = new Vec2();
  private settleElapsed = 0;
  private shotElapsed = 0;

  private aimGraphics: Graphics | null = null;
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
  private tileNodes: Node[] = [];
  private tileGraphics: Graphics[] = [];
  private tileLabels: Label[] = [];
  private tileCenters: Vec2[] = [];

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

    this.arenaWidth = Math.min(
      this.screenWidth * PUCK_CONFIG.arenaWidthRatio,
      640,
    );
    this.arenaHeight = Math.min(
      this.screenHeight * PUCK_CONFIG.arenaHeightRatio,
      820,
    );
    this.arenaCenterY = -this.screenHeight * 0.025;
    this.targetCenter = new Vec2(
      0,
      this.arenaCenterY + this.arenaHeight * 0.285,
    );
    this.launchY = this.arenaCenterY - this.arenaHeight * 0.365;

    const outer = Math.min(this.arenaWidth * 0.22, 132);
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

    this.createBackground();
    this.createArenaVisuals();
    this.createWalls();
    this.createBumpers();
    this.createAimLayer();
    this.createHud();
    this.createWordPanel();

    this.bestScore = SaveManager.getBestScore();
    this.discoveredWordCount = SaveManager.getDiscoveredWords().length;
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

    this.startRun();
  }

  onDestroy(): void {
    this.node.off(Node.EventType.TOUCH_START, this.onTouchStart, this);
    this.node.off(Node.EventType.TOUCH_MOVE, this.onTouchMove, this);
    this.node.off(Node.EventType.TOUCH_END, this.onTouchEnd, this);
    this.node.off(Node.EventType.TOUCH_CANCEL, this.onTouchCancel, this);
  }

  update(deltaTime: number): void {
    if (!this.physicsReady) return;

    for (const puck of this.pucks) {
      AmmoEffectController.updateFlight(
        puck.body,
        puck.node,
        puck.ammo,
        this.targetCenter,
        this.scoreRadii.outer,
        deltaTime,
      );
    }

    if (
      this.state !== GameState.FLYING &&
      this.state !== GameState.SETTLING
    ) {
      return;
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

    if (moving) {
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

  private createBackground(): void {
    const node = new Node('Background');
    this.node.addChild(node);
    const transform = node.addComponent(UITransform);
    transform.setContentSize(this.screenWidth, this.screenHeight);

    const graphics = node.addComponent(Graphics);
    graphics.fillColor = new Color(226, 242, 255, 255);
    graphics.rect(
      -this.screenWidth / 2,
      -this.screenHeight / 2,
      this.screenWidth,
      this.screenHeight,
    );
    graphics.fill();

    graphics.fillColor = new Color(255, 255, 255, 90);
    graphics.circle(-this.screenWidth * 0.34, this.screenHeight * 0.36, 54);
    graphics.fill();
    graphics.circle(this.screenWidth * 0.36, -this.screenHeight * 0.35, 72);
    graphics.fill();
  }

  private createArenaVisuals(): void {
    const arenaNode = new Node('ArenaVisual');
    this.node.addChild(arenaNode);
    arenaNode.setPosition(0, this.arenaCenterY, 0);

    const transform = arenaNode.addComponent(UITransform);
    transform.setContentSize(this.arenaWidth, this.arenaHeight);

    const graphics = arenaNode.addComponent(Graphics);
    graphics.fillColor = new Color(250, 253, 255, 255);
    graphics.rect(
      -this.arenaWidth / 2,
      -this.arenaHeight / 2,
      this.arenaWidth,
      this.arenaHeight,
    );
    graphics.fill();

    graphics.lineWidth = 6;
    graphics.strokeColor = new Color(126, 174, 210, 255);
    graphics.rect(
      -this.arenaWidth / 2,
      -this.arenaHeight / 2,
      this.arenaWidth,
      this.arenaHeight,
    );
    graphics.stroke();

    graphics.lineWidth = 2;
    graphics.strokeColor = new Color(190, 216, 237, 255);
    graphics.moveTo(0, -this.arenaHeight * 0.30);
    graphics.lineTo(0, this.arenaHeight * 0.22);
    graphics.stroke();

    graphics.fillColor = new Color(215, 235, 249, 255);
    graphics.circle(0, -this.arenaHeight * 0.365, 32);
    graphics.fill();

    const targetNode = new Node('ScoringTarget');
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
      this.targetCenter.y + this.scoreRadii.outer + 24,
      16,
      new Color(72, 112, 143, 255),
      this.screenWidth * 0.9,
      30,
    );

    this.addLabel(
      'LaunchHint',
      '从下方向目标发射',
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
    const node = new Node(name);
    this.node.addChild(node);
    node.setPosition(x, y, 0);

    const transform = node.addComponent(UITransform);
    transform.setContentSize(width, height);

    const body = node.addComponent(RigidBody2D);
    body.type = ERigidBody2DType.Static;
    body.gravityScale = 0;

    const collider = node.addComponent(BoxCollider2D);
    collider.size = new Size(width, height);
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
    const node = new Node(name);
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
    collider.friction = 0.12;
    collider.restitution = 0.78;
    collider.apply();
  }

  private createAimLayer(): void {
    const node = new Node('AimLayer');
    this.node.addChild(node);
    const transform = node.addComponent(UITransform);
    transform.setContentSize(this.screenWidth, this.screenHeight);
    this.aimGraphics = node.addComponent(Graphics);
  }

  private createHud(): void {
    const topY = this.screenHeight * 0.445;

    this.scoreLabel = this.addLabel(
      'ScoreLabel',
      '总分 0',
      -this.screenWidth * 0.25,
      topY,
      27,
      new Color(48, 86, 119, 255),
      this.screenWidth * 0.44,
      48,
    );

    this.shotsLabel = this.addLabel(
      'ShotsLabel',
      '发射 0',
      this.screenWidth * 0.25,
      topY,
      27,
      new Color(48, 86, 119, 255),
      this.screenWidth * 0.44,
      48,
    );

    this.bestLabel = this.addLabel(
      'BestLabel',
      '最高纪录 0',
      0,
      topY - 44,
      17,
      new Color(92, 132, 164, 255),
      this.screenWidth * 0.8,
      28,
    );

    this.comboLabel = this.addLabel(
      'ComboLabel',
      '连击 ×0',
      -this.screenWidth * 0.20,
      topY - 76,
      18,
      new Color(231, 143, 63, 255),
      this.screenWidth * 0.38,
      28,
    );

    this.missLabel = this.addLabel(
      'MissLabel',
      '失误 0/5',
      this.screenWidth * 0.20,
      topY - 76,
      18,
      new Color(210, 105, 105, 255),
      this.screenWidth * 0.38,
      28,
    );

    this.hintLabel = this.addLabel(
      'HintLabel',
      '选择两个汉字，组合你的弹药',
      0,
      -this.screenHeight * 0.315,
      18,
      new Color(58, 105, 145, 255),
      this.screenWidth * 0.92,
      34,
    );

    this.ammoLabel = this.addLabel(
      'AmmoLabel',
      '',
      0,
      -this.screenHeight * 0.425,
      20,
      new Color(57, 103, 145, 255),
      this.screenWidth * 0.92,
      34,
    );
    this.ammoLabel.node.active = false;

    this.resultLabel = this.addLabel(
      'ResultLabel',
      '',
      0,
      0,
      29,
      new Color(41, 75, 105, 255),
      this.screenWidth * 0.88,
      230,
    );
    this.resultLabel.node.active = false;

    this.warningLabel = this.addLabel(
      'PhysicsWarning',
      '',
      0,
      this.screenHeight * 0.20,
      19,
      new Color(190, 72, 72, 255),
      this.screenWidth * 0.92,
      100,
    );
    this.warningLabel.node.active = false;
  }

  private createWordPanel(): void {
    this.wordTitleLabel = this.addLabel(
      'WordTitle',
      '组词装弹',
      0,
      -this.screenHeight * 0.285,
      24,
      new Color(49, 91, 127, 255),
      this.screenWidth * 0.9,
      38,
    );

    const tileWidth = WORD_UI_CONFIG.tileWidth;
    const tileHeight = WORD_UI_CONFIG.tileHeight;
    const gap = WORD_UI_CONFIG.tileGap;
    const totalWidth = tileWidth * 6 + gap * 5;
    const startX = -totalWidth / 2 + tileWidth / 2;
    const tileY = -this.screenHeight * WORD_UI_CONFIG.tileYRatio;

    for (let i = 0; i < 6; i += 1) {
      const x = startX + i * (tileWidth + gap);
      const node = new Node('WordTile_' + i);
      this.node.addChild(node);
      node.setPosition(x, tileY, 0);

      const transform = node.addComponent(UITransform);
      transform.setContentSize(tileWidth, tileHeight);

      const graphics = node.addComponent(Graphics);
      const labelNode = new Node('Letter');
      node.addChild(labelNode);
      const labelTransform = labelNode.addComponent(UITransform);
      labelTransform.setContentSize(tileWidth, tileHeight);
      const label = labelNode.addComponent(Label);
      label.fontSize = 32;
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
    this.confirmNode = new Node('ConfirmWordButton');
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
    const node = new Node('ButtonLabel');
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
    const node = new Node(name);
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
      graphics.rect(
        -WORD_UI_CONFIG.tileWidth / 2,
        -WORD_UI_CONFIG.tileHeight / 2,
        WORD_UI_CONFIG.tileWidth,
        WORD_UI_CONFIG.tileHeight,
      );
      graphics.fill();
      graphics.lineWidth = isSelected ? 4 : 2;
      graphics.strokeColor = isSelected
        ? new Color(239, 155, 62, 255)
        : new Color(173, 204, 227, 255);
      graphics.rect(
        -WORD_UI_CONFIG.tileWidth / 2,
        -WORD_UI_CONFIG.tileHeight / 2,
        WORD_UI_CONFIG.tileWidth,
        WORD_UI_CONFIG.tileHeight,
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
      this.confirmGraphics.rect(-110, -24, 220, 48);
      this.confirmGraphics.fill();
    }
  }

  private setWordPanelVisible(visible: boolean): void {
    if (this.wordTitleLabel) this.wordTitleLabel.node.active = visible;
    if (this.wordPreviewLabel) this.wordPreviewLabel.node.active = visible;
    if (this.confirmNode) this.confirmNode.active = visible;
    for (const node of this.tileNodes) node.active = visible;
  }

  private showWordState(): void {
    this.state = GameState.WORD_SELECT;
    this.currentAmmo = null;
    this.currentPuck = null;
    this.setWordPanelVisible(true);
    if (this.ammoLabel) this.ammoLabel.node.active = false;
    if (this.hintLabel) {
      this.hintLabel.string = '选择两个汉字，组合下一发弹药';
    }
    this.updateWordPanel();
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

    this.currentAmmo = AmmoFactory.create(definition);
    this.discoveredWordCount = SaveManager.recordDiscoveredWord(definition.word).length;
    this.spawnPuck(this.currentAmmo);
    this.state = GameState.READY;
    this.showAmmoState();
    this.updateHud();
  }

  private spawnPuck(ammo: AmmoDefinition): void {
    if (this.pucks.length >= PUCK_CONFIG.maxActivePucks) {
      const oldest = this.pucks.shift();
      if (oldest) {
        this.bankedScore += oldest.score;
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

    const index = this.shotsFired;
    const node = new Node('Ammo_' + index);
    this.node.addChild(node);
    node.setPosition(selectedX, this.launchY, 0);

    const transform = node.addComponent(UITransform);
    transform.setContentSize(this.puckRadius * 2, this.puckRadius * 2);

    const graphics = node.addComponent(Graphics);
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

    const wordLabelNode = new Node('AmmoWord');
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
    };

    this.pucks.push(entry);
    this.currentPuck = entry;
    this.currentAmmo = ammo;
  }

  private onTouchStart(event: EventTouch): void {
    const point = this.getCanvasPoint(event);

    if (this.state === GameState.RESULT) {
      this.restartRun();
      return;
    }

    if (this.state === GameState.WORD_SELECT) {
      this.handleWordInput(point);
      return;
    }

    if (!this.physicsReady || this.state !== GameState.READY || !this.currentPuck) {
      return;
    }

    const puckPosition = this.currentPuck.node.position;
    const distance = distanceBetween(
      point.x,
      point.y,
      puckPosition.x,
      puckPosition.y,
    );

    if (distance > this.puckRadius * 2.5) return;

    this.isDragging = true;
    this.state = GameState.AIMING;
    this.dragStart = new Vec2(puckPosition.x, puckPosition.y);
    this.dragCurrent = point;
    this.drawAim();
  }

  private onTouchMove(event: EventTouch): void {
    if (!this.isDragging || this.state !== GameState.AIMING) return;
    this.dragCurrent = this.getCanvasPoint(event);
    this.drawAim();
  }

  private onTouchEnd(event: EventTouch): void {
    if (!this.isDragging || this.state !== GameState.AIMING) return;

    this.dragCurrent = this.getCanvasPoint(event);
    this.isDragging = false;
    this.clearAim();

    const dx = this.dragStart.x - this.dragCurrent.x;
    const dy = this.dragStart.y - this.dragCurrent.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance < PUCK_CONFIG.minPullDistance || !this.currentPuck || !this.currentAmmo) {
      this.state = GameState.READY;
      return;
    }

    const power = Math.min(distance / PUCK_CONFIG.maxPullDistance, 1);
    const speed = PUCK_CONFIG.maxLaunchSpeed *
      power *
      this.currentAmmo.launchSpeedMultiplier;

    const velocity = new Vec2(
      (dx / distance) * speed,
      (dy / distance) * speed,
    );

    this.currentPuck.body.linearVelocity = velocity;
    this.currentPuck.body.wakeUp();

    this.state = GameState.FLYING;
    this.settleElapsed = 0;
    this.shotElapsed = 0;

    if (this.hintLabel) {
      this.hintLabel.string = '弹药飞行中……';
    }
    this.updateHud();
  }

  private onTouchCancel(): void {
    if (!this.isDragging) return;
    this.isDragging = false;
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

    const dx = this.dragStart.x - this.dragCurrent.x;
    const dy = this.dragStart.y - this.dragCurrent.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    if (distance < 1) return;

    const power = Math.min(distance / PUCK_CONFIG.maxPullDistance, 1);
    const length = 65 + power * 115;
    const endX = this.dragStart.x + (dx / distance) * length;
    const endY = this.dragStart.y + (dy / distance) * length;

    graphics.lineWidth = 5;
    graphics.strokeColor = new Color(255, 255, 255, 245);
    graphics.moveTo(this.dragStart.x, this.dragStart.y);
    graphics.lineTo(endX, endY);
    graphics.stroke();

    const angle = Math.atan2(dy, dx);
    const headLength = 17;
    graphics.fillColor = new Color(255, 255, 255, 245);
    graphics.moveTo(endX, endY);
    graphics.lineTo(
      endX - Math.cos(angle - 0.45) * headLength,
      endY - Math.sin(angle - 0.45) * headLength,
    );
    graphics.lineTo(
      endX - Math.cos(angle + 0.45) * headLength,
      endY - Math.sin(angle + 0.45) * headLength,
    );
    graphics.close();
    graphics.fill();

    const barWidth = 170;
    const barHeight = 10;
    const barX = -barWidth / 2;
    const barY = this.launchY - 76;

    graphics.fillColor = new Color(190, 215, 235, 220);
    graphics.rect(barX, barY, barWidth, barHeight);
    graphics.fill();

    graphics.fillColor = new Color(74, 169, 225, 255);
    graphics.rect(barX, barY, barWidth * power, barHeight);
    graphics.fill();
  }

  private clearAim(): void {
    this.aimGraphics?.clear();
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

    if (!this.currentPuck) return;

    const position = this.currentPuck.node.position;
    const distance = distanceBetween(
      position.x,
      position.y,
      this.targetCenter.x,
      this.targetCenter.y,
    );
    const baseScore = scoreByDistance(distance, this.scoreRadii);

    if (baseScore > 0) {
      this.comboStreak += 1;
      this.missCount = Math.max(0, this.missCount - 1);
      const comboMultiplier = Math.min(
        1 + (this.comboStreak - 1) * PUCK_CONFIG.comboStep,
        PUCK_CONFIG.maxComboMultiplier,
      );
      this.currentPuck.scoreMultiplier =
        comboMultiplier * this.currentPuck.ammo.scoreMultiplier;
    } else {
      this.comboStreak = 0;
      this.missCount += 1;
      this.currentPuck.scoreMultiplier = 1;
    }

    this.shotsFired += 1;
    this.recalculateActiveScores();
    this.currentPuck = null;
    this.currentAmmo = null;
    this.updateHud();

    if (this.missCount >= PUCK_CONFIG.maxMisses) {
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

    const newBest = this.totalScore > this.bestScore;
    this.bestScore = SaveManager.saveBestScore(this.totalScore);

    if (this.resultLabel) {
      this.resultLabel.string =
        '本局得分  ' + this.totalScore +
        (newBest ? '\n新纪录！' : '') +
        '\n发射次数：' + this.shotsFired +
        '\n发现词语：' + this.discoveredWordCount +
        '\n\n点击屏幕重新开始';
      this.resultLabel.node.active = true;
    }

    if (this.hintLabel) {
      this.hintLabel.string = '连续失误达到上限，本局结束';
    }
    this.updateHud();
  }

  private restartRun(): void {
    for (const puck of this.pucks) {
      puck.node.destroy();
    }

    this.pucks = [];
    this.currentPuck = null;
    this.currentAmmo = null;
    this.shotsFired = 0;
    this.totalScore = 0;
    this.bankedScore = 0;
    this.comboStreak = 0;
    this.missCount = 0;
    this.settleElapsed = 0;
    this.shotElapsed = 0;
    this.isDragging = false;
    this.wordPuzzle.reset();
    this.state = GameState.WORD_SELECT;

    if (this.resultLabel) this.resultLabel.node.active = false;
    this.clearAim();
    this.showWordState();
    this.updateHud();
  }

  private updateHud(): void {
    if (this.scoreLabel) {
      this.scoreLabel.string = '总分 ' + this.totalScore;
    }
    if (this.shotsLabel) {
      this.shotsLabel.string = '发射 ' + this.shotsFired;
    }
    if (this.bestLabel) {
      this.bestLabel.string = '最高纪录 ' + this.bestScore;
    }
    if (this.comboLabel) {
      this.comboLabel.string = '连击 ×' + this.comboStreak;
    }
    if (this.missLabel) {
      this.missLabel.string = '失误 ' + this.missCount + '/' + PUCK_CONFIG.maxMisses;
    }
  }

  private startRun(): void {
    this.wordPuzzle.reset();
    this.shotsFired = 0;
    this.totalScore = 0;
    this.bankedScore = 0;
    this.comboStreak = 0;
    this.missCount = 0;
    this.state = GameState.WORD_SELECT;
    this.showWordState();
    this.updateHud();
  }
}

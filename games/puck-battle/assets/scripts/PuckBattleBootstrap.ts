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

import { PUCK_COLORS, PUCK_CONFIG } from './GameConfig';
import { distanceBetween, scoreByDistance } from './ScoreRules';
import { SaveManager } from './SaveManager';

const { ccclass } = _decorator;

enum GameState {
  READY,
  AIMING,
  FLYING,
  SETTLING,
  NEXT_SHOT,
  RESULT,
}

interface PuckEntry {
  node: Node;
  body: RigidBody2D;
  index: number;
  score: number;
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

  private state = GameState.READY;
  private pucks: PuckEntry[] = [];
  private currentPuck: PuckEntry | null = null;
  private throwsUsed = 0;
  private currentScore = 0;
  private bestScore = 0;

  private isDragging = false;
  private dragStart = new Vec2();
  private dragCurrent = new Vec2();
  private settleElapsed = 0;
  private shotElapsed = 0;

  private aimGraphics: Graphics | null = null;
  private scoreLabel: Label | null = null;
  private throwsLabel: Label | null = null;
  private bestLabel: Label | null = null;
  private hintLabel: Label | null = null;
  private resultLabel: Label | null = null;
  private warningLabel: Label | null = null;

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
    this.createAimLayer();
    this.createHud();

    this.bestScore = SaveManager.getBestScore();
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
        this.hintLabel.string = '启用 Box2D 后即可开始投掷';
      }
      return;
    }

    this.spawnPuck(0);
    if (this.hintLabel) {
      this.hintLabel.string = '按住圆盘，向后拖动，松手发射';
    }
  }

  onDestroy(): void {
    this.node.off(Node.EventType.TOUCH_START, this.onTouchStart, this);
    this.node.off(Node.EventType.TOUCH_MOVE, this.onTouchMove, this);
    this.node.off(Node.EventType.TOUCH_END, this.onTouchEnd, this);
    this.node.off(Node.EventType.TOUCH_CANCEL, this.onTouchCancel, this);
  }

  update(deltaTime: number): void {
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
    node.setSiblingIndex(0);

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

    graphics.fillColor = new Color(255, 255, 255, 80);
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
      '10分        30分        50分',
      0,
      this.targetCenter.y + this.scoreRadii.outer + 24,
      18,
      new Color(72, 112, 143, 255),
      this.screenWidth * 0.8,
      32,
    );

    this.addLabel(
      'LaunchHint',
      '发射区',
      0,
      this.launchY - 44,
      17,
      new Color(91, 133, 164, 255),
      150,
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
      '得分 0',
      -this.screenWidth * 0.25,
      topY,
      28,
      new Color(48, 86, 119, 255),
      this.screenWidth * 0.42,
      54,
    );

    this.throwsLabel = this.addLabel(
      'ThrowsLabel',
      '投掷 0/3',
      this.screenWidth * 0.25,
      topY,
      28,
      new Color(48, 86, 119, 255),
      this.screenWidth * 0.42,
      54,
    );

    this.bestLabel = this.addLabel(
      'BestLabel',
      '最高纪录 0',
      0,
      topY - 48,
      18,
      new Color(92, 132, 164, 255),
      this.screenWidth * 0.8,
      32,
    );

    this.hintLabel = this.addLabel(
      'HintLabel',
      '按住圆盘，向后拖动，松手发射',
      0,
      -this.screenHeight * 0.455,
      19,
      new Color(58, 105, 145, 255),
      this.screenWidth * 0.92,
      44,
    );

    this.resultLabel = this.addLabel(
      'ResultLabel',
      '',
      0,
      0,
      30,
      new Color(41, 75, 105, 255),
      this.screenWidth * 0.84,
      180,
    );
    this.resultLabel.node.active = false;

    this.warningLabel = this.addLabel(
      'PhysicsWarning',
      '',
      0,
      0,
      21,
      new Color(190, 72, 72, 255),
      this.screenWidth * 0.9,
      100,
    );
    this.warningLabel.node.active = false;
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
    return label;
  }

  private spawnPuck(index: number): void {
    const offsets = [
      0,
      -this.arenaWidth * 0.17,
      this.arenaWidth * 0.17,
      -this.arenaWidth * 0.30,
      this.arenaWidth * 0.30,
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

    const node = new Node('Puck_' + (index + 1));
    this.node.addChild(node);
    node.setPosition(selectedX, this.launchY, 0);

    const transform = node.addComponent(UITransform);
    transform.setContentSize(this.puckRadius * 2, this.puckRadius * 2);

    const colorData = PUCK_COLORS[index % PUCK_COLORS.length];
    const puckColor = new Color(
      colorData.r,
      colorData.g,
      colorData.b,
      colorData.a,
    );

    const graphics = node.addComponent(Graphics);
    graphics.fillColor = puckColor;
    graphics.circle(0, 0, this.puckRadius);
    graphics.fill();
    graphics.lineWidth = 3;
    graphics.strokeColor = Color.WHITE;
    graphics.circle(0, 0, this.puckRadius);
    graphics.stroke();
    graphics.fillColor = new Color(255, 255, 255, 210);
    graphics.circle(0, 0, 4);
    graphics.fill();

    const body = node.addComponent(RigidBody2D);
    body.type = ERigidBody2DType.Dynamic;
    body.gravityScale = 0;
    body.linearDamping = 1.25;
    body.angularDamping = 2;
    body.fixedRotation = true;
    body.allowSleep = true;
    body.bullet = true;
    body.linearVelocity = new Vec2(0, 0);

    const collider = node.addComponent(CircleCollider2D);
    collider.radius = this.puckRadius;
    collider.density = 1;
    collider.friction = 0.18;
    collider.restitution = 0.18;
    collider.apply();

    const entry: PuckEntry = {
      node,
      body,
      index,
      score: 0,
    };

    this.pucks.push(entry);
    this.currentPuck = entry;
  }

  private onTouchStart(event: EventTouch): void {
    if (!this.physicsReady) return;

    if (this.state === GameState.RESULT) {
      this.restartRound();
      return;
    }

    if (this.state !== GameState.READY || !this.currentPuck) return;

    const point = this.getCanvasPoint(event);
    const puckPosition = this.currentPuck.node.position;
    const distance = distanceBetween(
      point.x,
      point.y,
      puckPosition.x,
      puckPosition.y,
    );

    if (distance > this.puckRadius * 2.4) return;

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

  private onTouchEnd(): void {
    if (!this.isDragging || this.state !== GameState.AIMING) return;

    this.isDragging = false;
    this.clearAim();

    const dx = this.dragStart.x - this.dragCurrent.x;
    const dy = this.dragStart.y - this.dragCurrent.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance < PUCK_CONFIG.minPullDistance) {
      this.state = GameState.READY;
      return;
    }

    if (!this.currentPuck) {
      this.state = GameState.READY;
      return;
    }

    const power = Math.min(
      distance / PUCK_CONFIG.maxPullDistance,
      1,
    );
    const speed = PUCK_CONFIG.maxLaunchSpeed * power;
    const velocity = new Vec2(
      (dx / distance) * speed,
      (dy / distance) * speed,
    );

    this.currentPuck.body.linearVelocity = velocity;
    this.currentPuck.body.wakeUp();

    this.throwsUsed += 1;
    this.currentPuck = null;
    this.state = GameState.FLYING;
    this.settleElapsed = 0;
    this.shotElapsed = 0;

    if (this.hintLabel) {
      this.hintLabel.string = '圆盘滑行中……';
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
    this.recalculateScore();

    if (this.throwsUsed >= 3) {
      this.finishRound();
      return;
    }

    this.state = GameState.NEXT_SHOT;
    this.spawnPuck(this.throwsUsed);
    this.state = GameState.READY;

    if (this.hintLabel) {
      this.hintLabel.string = '第 ' + (this.throwsUsed + 1) + ' 次投掷：瞄准并发射';
    }
    this.updateHud();
  }

  private recalculateScore(): void {
    let total = 0;

    for (const puck of this.pucks) {
      const position = puck.node.position;
      const distance = distanceBetween(
        position.x,
        position.y,
        this.targetCenter.x,
        this.targetCenter.y,
      );

      puck.score = scoreByDistance(distance, this.scoreRadii);
      total += puck.score;
    }

    this.currentScore = total;
    this.updateHud();
  }

  private finishRound(): void {
    this.state = GameState.RESULT;
    this.recalculateScore();

    const previousBest = this.bestScore;
    this.bestScore = SaveManager.saveBestScore(this.currentScore);
    const isNewBest = this.currentScore > previousBest;

    if (this.resultLabel) {
      this.resultLabel.string =
        '本局得分  ' + this.currentScore +
        (isNewBest ? '\n新纪录！' : '') +
        '\n\n点击任意位置再玩一次';
      this.resultLabel.node.active = true;
    }

    if (this.hintLabel) {
      this.hintLabel.string = '三次投掷完成';
    }
    this.updateHud();
  }

  private restartRound(): void {
    for (const puck of this.pucks) {
      puck.node.destroy();
    }

    this.pucks = [];
    this.currentPuck = null;
    this.throwsUsed = 0;
    this.currentScore = 0;
    this.settleElapsed = 0;
    this.shotElapsed = 0;
    this.isDragging = false;
    this.state = GameState.READY;

    if (this.resultLabel) {
      this.resultLabel.node.active = false;
    }
    this.clearAim();
    this.spawnPuck(0);

    if (this.hintLabel) {
      this.hintLabel.string = '按住圆盘，向后拖动，松手发射';
    }
    this.updateHud();
  }

  private updateHud(): void {
    if (this.scoreLabel) {
      this.scoreLabel.string = '得分 ' + this.currentScore;
    }
    if (this.throwsLabel) {
      this.throwsLabel.string = '投掷 ' + this.throwsUsed + '/3';
    }
    if (this.bestLabel) {
      this.bestLabel.string = '最高纪录 ' + this.bestScore;
    }
  }
}

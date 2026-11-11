# 微信小游戏开发仓库

当前优先项目已从《冰壶碰碰局》基础原型升级为 **《词弹碰碰局》**：汉字组词决定弹药，弹药效果影响物理弹射，无尽模式持续挑战最高分。

## 项目

- [《词弹碰碰局》](games/puck-battle/)：第一开发项目，组词 + 弹药 + 物理弹射无尽模式。
- [《传送带调度员》](games/conveyor-dispatcher/)：候选第二项目，暂缓开发。

## 技术选型

- Cocos Creator 3.8.x
- TypeScript
- Cocos Creator 2D Physics / Box2D
- 微信小游戏
- 本地存档，不依赖服务器

## 设计文档

- [《词弹碰碰局》GDD](docs/GDD_PUCK_BATTLE.md)
- [技术设计](docs/TECHNICAL_DESIGN_PUCK_BATTLE.md)
- [MVP 开发计划](docs/MVP_PLAN.md)
- [《传送带调度员》设计概要](docs/GDD_CONVEYOR_DISPATCHER.md)

## 当前开发分支

`feature/puck-battle-prototype`

## 开发原则

1. 先验证组词、弹药差异和弹射手感，再增加内容。
2. 首版只做单机无尽模式。
3. 词语采用本地词典，不依赖运行时 AI。
4. 物理效果和词语映射配置化。
5. 代码先提交功能分支，验证后再合并稳定版本。
6. 未经过 Cocos Creator 编译和微信运行验证的代码，不标记为已验证版本。

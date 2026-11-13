# 微信小游戏开发仓库

当前优先项目为 **《词弹碰碰局》V0.8**：汉字组词造弹、击碎字块掉字、六种弹药融合连锁，以及四关 Roguelike 冒险；保留经典无尽、碰撞练习及每日固定关卡挑战。

## 项目

- [《词弹碰碰局》](games/puck-battle/)：第一开发项目，组词 + 字块消除 + 特殊弹药融合 + 物理弹射 Roguelike。
- [《传送带调度员》](games/conveyor-dispatcher/)：候选第二项目，暂缓开发。

## 技术选型

- Cocos Creator 3.8.8
- TypeScript
- Cocos Creator 2D Physics / Box2D
- 微信小游戏
- 本地存档，不依赖服务器

## 设计文档

- [《词弹碰碰局》GDD](docs/GDD_PUCK_BATTLE.md)
- [技术设计](docs/TECHNICAL_DESIGN_PUCK_BATTLE.md)
- [MVP 开发计划](docs/MVP_PLAN.md)
- [《传送带调度员》设计概要](docs/GDD_CONVEYOR_DISPATCHER.md)
- [GitHub 自动构建配置](docs/GITHUB_AUTOMATION.md)

## 自动化

- GitHub Actions 自动运行项目结构检查和 TypeScript 逻辑测试。
- 配置 Windows self-hosted runner 后，Actions 可自动调用本机 Cocos Creator 3.8.8 构建微信小游戏。
- 未配置 runner 时，逻辑测试仍会在 GitHub 云端运行。

## 当前开发分支

`feature/puck-battle-prototype`

## 开发原则

1. 优先保证字块、组词、融合、碰撞与升级形成完整可玩循环。
2. 保留经典无尽及练习模式，同时提供四关冒险与离线每日挑战。
3. 词语采用本地词典，不依赖运行时 AI。
4. 物理效果和词语映射配置化。
5. 代码先提交功能分支，验证后再合并稳定版本。
6. 未经过 Cocos Creator 编译和微信运行验证的代码，不标记为已验证版本。

# Puck Battle

《冰壶碰碰局》Cocos Creator 3.8.x 项目。

## 快速开始

1. 使用 Cocos Creator 3.8.x 导入本目录。
2. 按照 COCOS_SETUP.md 创建场景并挂载 PuckBattleBootstrap。
3. 在项目设置的功能裁剪中启用 2D Physics / Box2D。
4. 点击 Preview 运行。

## 当前实现

- 脚本动态创建场地、目标区、HUD 和圆盘。
- Box2D 刚体与圆形碰撞体。
- 单指拖动瞄准与发射。
- 三次投掷、稳定检测和最终计分。
- 本地最高分存档。

## 文档

- 游戏设计：../../docs/GDD_PUCK_BATTLE.md
- 技术设计：../../docs/TECHNICAL_DESIGN_PUCK_BATTLE.md
- MVP计划：../../docs/MVP_PLAN.md
- 启动说明：./COCOS_SETUP.md

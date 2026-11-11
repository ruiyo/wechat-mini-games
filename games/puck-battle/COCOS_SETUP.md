# Cocos Creator 工程启动说明

## 环境

- Cocos Creator 3.8.x
- 微信开发者工具（用于微信小游戏构建和预览）

## 打开工程

1. 克隆仓库。
2. 在 Cocos Creator Dashboard 中选择「导入项目」。
3. 选择本目录：games/puck-battle。
4. 等待编辑器导入 TypeScript 脚本并生成 meta 文件。

## 创建首个场景

1. 在 Cocos Creator 中新建一个 2D Scene，保存为 assets/scenes/Game.scene。
2. 确认场景中有 Canvas 和 UI Camera。
3. 选中 Canvas 节点，在 Inspector 中添加脚本组件 PuckBattleBootstrap。
4. 保存场景，将 Game.scene 作为预览启动场景。

PuckBattleBootstrap 会在运行时自动创建背景、场地、目标圈、边界、弹性机关、汉字卡片、弹药和 HUD。

## 启用 Box2D

1. 打开「项目 -> 项目设置 -> 功能裁剪」。
2. 找到 2D Physics，启用 Box2D 后端。
3. 应用设置并等待编辑器重新编译。
4. 重新预览场景。

如果未启用 Box2D，运行时会显示提示，不会开始发射。

## 操作

1. 在底部 6 个汉字卡片中依次选择两个字。
2. 确认有效词语，生成对应弹药。
3. 按住弹药向后拖动，调整方向和力度。
4. 松手发射，等待场上弹药稳定。
5. 结算后继续组词和发射。
6. 连续失误达到 5 次后本局结束，点击屏幕重新开始。

## 当前原型范围

- 无尽模式。
- 24 个双字词的本地词典。
- 4 种弹药效果。
- 最近 3 颗弹药保留和碰撞。
- 三层目标区计分。
- 连击、失误值和本地最高分/词语记录。

## 注意

- Cocos Creator 会在首次导入时生成 meta 文件，应该将生成的 meta 文件提交到 Git。
- temp、library、local 和 build 是编辑器或构建产物，不应提交。
- 当前代码尚未经过本地 Cocos Creator 编译和微信真机验证；请在对应编辑器版本中运行后，根据日志继续修复和调整物理手感。

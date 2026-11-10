# Cocos Creator 工程启动说明

## 环境

- Cocos Creator 3.8.x
- 微信开发者工具（用于后续微信小游戏构建和预览）

## 打开工程

1. 克隆仓库。
2. 在 Cocos Creator Dashboard 中选择「导入项目」。
3. 选择本目录：games/puck-battle。
4. 等待编辑器导入 TypeScript 脚本并生成 meta 文件。

## 创建首个场景

当前仓库先提交脚本驱动的原型。场景由编辑器创建，避免手工维护容易损坏的序列化场景文件。

1. 在 Cocos Creator 中新建一个 2D Scene，保存为 assets/scenes/Game.scene。
2. 确认场景中有 Canvas 和 UI Camera（使用 2D 项目默认场景即可）。
3. 选中 Canvas 节点，在 Inspector 中添加脚本组件 PuckBattleBootstrap。
4. 保存场景，将 Game.scene 作为预览启动场景。

PuckBattleBootstrap 会在运行时自动创建背景、场地、目标圈、物理边界、圆盘、瞄准线和 HUD，不需要手工摆放这些节点。

## 启用 Box2D

本原型使用 Cocos Creator 2D Physics 的 Box2D 后端：

1. 打开「项目 -> 项目设置 -> 功能裁剪」。
2. 找到 2D Physics，启用 Box2D 后端。
3. 应用设置并等待编辑器重新编译。
4. 重新预览场景。

如果未启用 Box2D，运行时会显示提示，不会开始投掷。

## 运行

1. 点击编辑器顶部 Preview。
2. 按住底部圆盘，向后拖动。
3. 松开手指发射。
4. 等待圆盘全部停止后进行下一次投掷。
5. 三次投掷结束后，点击屏幕任意位置重新开始。

## 当前原型范围

- 一张场地。
- 一种圆盘外观（按投掷次序改变颜色）。
- 三次投掷。
- 圆盘与边界、圆盘与圆盘碰撞。
- 三层目标区计分。
- 本地最高分存档。

## 注意

- Cocos Creator 会在首次导入时生成 meta 文件，应该将生成的 meta 文件提交到 Git。
- temp、library、local 和 build 是编辑器或构建产物，不应提交。
- 当前代码尚未经过本地 Cocos Creator 编译和微信真机验证；需要在对应编辑器版本中运行后，根据日志继续修复和调整物理手感。

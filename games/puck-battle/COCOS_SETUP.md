# Cocos Creator 3.8.8 工程启动与自动构建

## 环境

- Cocos Creator 3.8.8
- 微信开发者工具（用于最终预览和真机验证）

## 首次导入和场景初始化

1. 在 Cocos Creator Dashboard 中导入本目录：`games/puck-battle`。
2. 等待编辑器导入 TypeScript 脚本并生成 meta 文件。
3. 在 `assets/scenes` 新建 `Game.scene`。
4. 确认场景中有 Canvas 和 UI Camera。
5. 选中 Canvas，在 Inspector 中添加 `PuckBattleBootstrap` 组件。
6. 保存场景，并将场景文件及其 .meta 文件提交到 Git。

`PuckBattleBootstrap` 会在运行时自动创建背景、场地、目标圈、边界、弹性机关、汉字卡片、弹药和 HUD。

## 启用 Box2D

1. 打开「项目 -> 项目设置 -> 功能裁剪」。
2. 找到 2D Physics，启用 Box2D 后端。
3. 应用设置并等待编辑器重新编译。

## 操作

1. 在底部 6 个汉字卡片中依次选择两个字。
2. 确认有效词语，生成对应弹药。
3. 按住弹药向后拖动，调整方向和力度。
4. 松手发射，等待场上弹药稳定。
5. 结算后继续组词和发射。
6. 连续失误达到 5 次后本局结束，点击屏幕重新开始。

## 自动构建

完成一次场景初始化后，不需要每次打开 Cocos Creator：

- GitHub Actions 在推送代码后运行逻辑测试。
- 配置 Windows self-hosted runner 后，自动调用本机 Cocos Creator 3.8.8 构建微信小游戏。
- 详细配置见 `docs/GITHUB_AUTOMATION.md`。

## 注意

- Cocos Creator 首次导入会生成 .meta 文件，应该将这些文件提交到 Git。
- temp、library、local 和 build 是编辑器或构建产物，不应提交。
- 自动构建成功不代表已经完成微信真机体验测试；触摸、物理手感和微信兼容性仍需在模拟器或设备上验证。

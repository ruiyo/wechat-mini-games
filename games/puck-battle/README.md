# 词弹碰碰局

**V0.3 · Cocos Creator 3.8.8 · 微信小游戏**

《词弹碰碰局》是一款融合汉字组词、弹药构筑和物理弹射的轻策略休闲小游戏。

## 核心玩法

组词 -> 制弹 -> 发射 -> 碰撞 -> 得分 -> 再组词。

玩家从 6 个汉字中选择两个组成双字词。有效词语映射为弹跳、磁吸、冰冻或冲击弹。无尽模式不限制发射次数，连续失误达到 5 次后结束本局。场上最多保留 3 颗弹药，后续弹药可以推动旧弹药并改变其得分。

## 当前版本

- 24 个双字词，映射 4 种弹药。
- 720×1280 竖屏布局，按高度适配。
- 物理碰撞、拖动瞄准和力度控制。
- 连击倍率、失误限制、最高分和词语图鉴。
- 本局发现词语独立计数，跨局图鉴本地保存。
- GitHub Actions 自动运行逻辑测试并调用 Windows Runner 构建微信小游戏。

## 代码模块

- PuckBattleBootstrap：场景、UI、状态机和无尽循环。
- WordDictionary：本地双字词映射。
- WordPuzzleController：字池、选择、消耗和补字。
- AmmoFactory：词语到弹药配置的映射。
- AmmoEffectController：弹药物理属性和飞行期效果。
- ScoreRules：目标圈计分。
- SaveManager：最高分和词语图鉴本地存档。

## 快速开始

1. 使用 Cocos Creator 3.8.8 导入本目录。
2. 打开 assets/scenes/Game.scene。
3. 点击 Preview 运行。

入口场景和 Box2D 模块配置已经提交，不需要手动创建场景或挂载组件。

## 微信小游戏构建

GitHub Actions 会在可信分支 Push 后自动执行：

1. 项目结构和逻辑单元测试。
2. Windows Runner 调用 Cocos Creator 3.8.8。
3. 构建微信小游戏并验证竖屏配置、入口脚本和场景 UUID。
4. 上传 word-puck-wechat-build 构建产物。

当前生成包使用 Cocos 默认测试 AppID。正式发布前必须替换为对应小程序的正式 AppID，并在微信开发者工具中完成预览和真机验收。

## 文档

- 游戏设计：../../docs/GDD_PUCK_BATTLE.md
- 技术设计：../../docs/TECHNICAL_DESIGN_PUCK_BATTLE.md
- MVP计划：../../docs/MVP_PLAN.md
- 自动构建：../../docs/GITHUB_AUTOMATION.md
- 本地启动说明：./COCOS_SETUP.md

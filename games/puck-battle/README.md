# 词弹碰碰局

Cocos Creator 3.8.8 原型项目。

## 核心玩法
组词 -> 制弹 -> 发射 -> 碰撞 -> 得分 -> 再组词。

玩家从 6 个汉字中选择两个组成双字词。有效词语映射为弹跳、磁吸、冰冻或冲击弹。无尽模式不限制发射次数，连续失误达到 5 次后结束本局。

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

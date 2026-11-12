# 《词弹碰碰局》技术设计

- 版本：0.4
- 引擎：Cocos Creator 3.8.x
- 语言：TypeScript
- 物理：Cocos Creator 2D Physics / Box2D
- 模式：无尽模式优先

## 1. 模块架构

| 模块 | 职责 |
|---|---|
| PuckBattleBootstrap | 场景入口、UI 创建、状态协调 |
| WordPuzzleController | 字池、选择、词语确认和补字 |
| WordDictionary | 本地双字词映射 |
| AmmoFactory | 将词语映射为弹药配置 |
| AmmoEffectController | 配置刚体/碰撞体并执行飞行期效果 |
| Shot/Input logic | 拖动瞄准、力度映射和发射 |
| PhysicsSystem2D | Box2D 碰撞和物理模拟 |
| ScoreRules | 目标区域得分计算 |
| SaveManager | 最高分和已发现词语本地存储 |

## 2. 状态机

```typescript
enum GameState {
  MENU,
  PAUSED,
  WORD_SELECT,
  READY,
  AIMING,
  FLYING,
  SETTLING,
  RESULT,
}
```

- MENU：显示主菜单，玩家主动开始游戏后进入 WORD_SELECT。
- PAUSED：冻结 Box2D 物理推进，保留恢复时的状态。
- WORD_SELECT：选择两个汉字。
- READY：弹药生成，等待拖动。
- AIMING：拖动瞄准。
- FLYING：场上至少一个弹药正在运动。
- SETTLING：等待所有活动弹药稳定。
- RESULT：失误达到上限，展示本局结果。

## 3. 词语数据

`WordDictionary.ts` 提供 24 个有效词语。每条记录包含：
- word
- ammoType
- ammoName
- description

`WordPuzzleController` 维护 6 个字：
- reset：从保证包含有效词语的字包初始化。
- toggleSelection：最多选择两个不同位置。
- getSelectedWord：查词典，正序和逆序均可匹配。
- confirmSelection：移除两个字，并补充一个词典中的随机双字词。

## 4. 弹药数据

`AmmoFactory` 负责生成统一的 `AmmoDefinition`：
- type
- word
- name
- description
- color
- launchSpeedMultiplier
- restitution
- friction
- linearDamping
- density
- scoreMultiplier
- magnetSteer
- targetDamping

主游戏脚本不直接判断每种弹药的数值细节。

## 5. 弹药效果

- 弹跳弹：提高碰撞恢复系数，降低阻尼。
- 磁吸弹：飞行时以小幅方向插值向目标中心偏转，保留当前速度大小。
- 冰冻弹：进入目标外圈范围后提高线性阻尼。
- 冲击弹：提高初始速度倍率、碰撞恢复系数和碰撞体密度。

磁吸和冰冻属于受控的街机效果，不追求真实电磁或热力学模拟。效果强度集中在 AmmoFactory 配置中，便于调整。

## 6. 物理世界

- 重力：0, 0。
- 固定模拟步长：1/60 秒。
- 弹药：Dynamic RigidBody2D + CircleCollider2D。
- 场地边界：Static RigidBody2D + BoxCollider2D。
- 固定弹性机关：Static RigidBody2D + CircleCollider2D。
- 弹药之间启用碰撞。
- 每帧对磁吸弹执行轻微方向修正；冰冻弹在目标圈附近改变阻尼。

## 7. 无尽模式分数管理

- `bankedScore`：已经从场上移除的旧弹药归档分数。
- `pucks`：当前保留的最多 3 颗弹药。
- 每颗弹药存储自己的 scoreMultiplier。
- 每次所有弹药稳定后，重新计算活动弹药的区域分数。
- 总分 = bankedScore + 活动弹药得分之和。
- 新弹药生成前，如果活动弹药达到 3 颗，移除最旧弹药并将其当前得分计入 bankedScore。

## 8. 连击和失误

- 当前弹药命中目标，或本次碰撞使活动弹药总分相较发射前增加：comboStreak +1，missCount -1（最低为0）。
- 当前弹药未命中且活动弹药总分没有增加：comboStreak 清零，missCount +1。
- 发射前记录 scoreBeforeShot；所有活动弹药稳定后重新计分，以 scoreDelta 判断碰撞推动旧弹药产生的有效收益。
- comboMultiplier = min(1 + (comboStreak - 1) × comboStep, maxComboMultiplier)。
- 失误达到配置上限后结束本局。

## 9. 存档

使用 Cocos `sys.localStorage` 封装：
- 最高分。
- 已发现词语列表。
- 音效设置。

保留旧版最高分键读取逻辑，避免覆盖已有《冰壶碰碰局》原型记录。

## 10. UI 布局约束

- 六张汉字卡片的总宽度按 `tileWidth × 6 + tileGap × 5` 计算并居中排列。
- 图鉴按钮位于组词确认行右侧，按钮命中区域不得与最右侧汉字卡片重叠。
- 图鉴内容区按 8 行文本布局，行高应小于弹层可用高度，避免收集状态被裁切。
- `tests/logic/ui-layout.test.ts` 对 720×1280 设计画布上的卡片边界和图鉴按钮边界进行回归检查。

## 11. 测试重点

- 字池始终至少包含一个有效词语。
- 选择两个字后正序/逆序匹配结果正确。
- 组词失败不消耗字。
- 组词成功后字池仍为 6 个字。
- 四种弹药参数正确加载。
- 磁吸弹不会在低速时产生方向抖动。
- 冰冻弹进入目标区附近后能够减速。
- 活动弹药不超过 3 颗。
- 旧弹药归档分数不会重复累计。
- 碰撞后活动弹药得分能够重新计算。
- 失误达到 5 时正确结束。
- 重新开始后状态和场上对象完全重置。
- 微信小游戏触摸和本地存储正常。

## 12. V0.4 瞄准规则

纯函数 `AimRules.calculateAim` 接收按下与当前触点坐标、弹药速度倍率，输出发射方向、有效拖拽距离、力度比例和线速度。

设拖拽距离为 \(d\)，死区为 \(d_{min}=20\)，上限为 \(d_{max}=205\)，指数 \(\gamma=1.35\)：

\[
u=\operatorname{clip}\left(\frac{d-d_{min}}{d_{max}-d_{min}},0,1\right), \quad
p=u^{\gamma}.
\]

若 \(d<d_{min}\)，则不发射；否则速度为 \(v=720\left(0.23+0.77p\right) m_a\)，其中 \(m_a\) 为弹药速度倍率。方向为从当前触点指向按下触点的单位向量。

## 13. V0.4 界面与状态保障

所有 UI 节点继续通过 `makeRenderNode` 设置 Canvas 渲染层，避免再次黑屏。主菜单、玩法说明、暂停、结算是同一 Cocos 场景的独立全屏弹层。触摸事件优先处理弹层，避免操作穿透。暂停通过禁用 `PhysicsSystem2D.instance.enable` 冻结物理推进，恢复时重新启用。

所有操作参数集中在 `GameConfig` 的 `PUCK_CONFIG` 和 `AIM_CONFIG` 中；测试覆盖力度边界、倍率、UI 相机层、页面流程与输入行为。

# Cocos Creator 3.8.8 工程启动与自动构建

## 项目根目录

本 Cocos Creator 项目根目录是 games/puck-battle。该目录包含 package.json、assets、settings 和 tsconfig.json。项目采用 720x1280 竖屏设计分辨率，并按高度适配不同手机屏幕。

项目设置位于：
- settings/v2/packages/engine.json
- settings/v2/packages/project.json

其中 engine.json 已包含 physics-2d-box2d 模块。

## 导入工程

1. 在 Cocos Creator Dashboard 中导入本目录：games/puck-battle。
2. 等待编辑器扫描并导入资源。
3. 打开 assets/scenes/Game.scene。

入口场景已经提交到 GitHub，不需要手动新建场景或重新挂载脚本。Canvas 节点已经挂载 PuckBattleBootstrap。

## 操作

1. 在底部 6 个汉字卡片中依次选择两个字。
2. 确认有效词语，生成对应弹药。
3. 按住弹药向后拖动，调整方向和力度。
4. 松手发射，等待场上弹药稳定。
5. 结算后继续组词和发射。
6. 需要帮助时点击「提示」快速选中有效词语；瞄准时靠近旧弹药的轨迹会触发红色候选标记。
7. 使用不同弹种命中旧弹药，观察碰撞计数、冲击波、磁场与冰冻的差异；红色标记仅供近似瞄准参考。
8. 失误达到 5 次后进入结算，可选择「再来一局」或「返回主页」。

## 物理碰撞练习

1. 在主菜单点击「碰撞练习」。
2. 游戏会在场内放置两颗可被撞击的演示弹药，底部显示四种直接选择按钮。
3. 点击「弹跳」「磁吸」「冰冻」或「冲击」，拖动发射弹药撞击演示球。
4. 观察旧弹药是否移动、顶部撞击计数和特殊效果。无需反复组词，也不会影响历史最高分。
5. 右上角「暂停」可重新开始练习，或者返回主菜单进入正常组词模式。

## 自动构建

GitHub Actions 在可信分支 push 后运行项目结构、场景、Box2D 设置和逻辑测试，随后调用 Windows Runner 使用 Cocos Creator 3.8.8 构建微信小游戏，并上传构建包和完整日志。

详细配置见 docs/GITHUB_AUTOMATION.md。

## 注意

- Cocos Creator 首次导入会生成资源缓存；提交 .meta 文件以保持 UUID 稳定。
- temp、library、local 和 build 是编辑器或构建产物，不应提交。
- 自动构建成功不代表完成微信真机体验测试；触摸、物理手感和微信兼容性仍需在模拟器或设备上验证。

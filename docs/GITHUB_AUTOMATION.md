# GitHub 自动构建配置（Cocos Creator 3.8.8）

仓库通过 GitHub Actions 自动执行逻辑测试，并由 Windows self-hosted runner 调用 Cocos Creator 3.8.8 构建微信小游戏。

## 自动化流程

1. Push 到 feature/puck-battle-prototype 后，Ubuntu runner 自动执行项目结构、场景引用和逻辑单元测试。
2. 测试通过后，可信 push 自动分配给带有 cocos-creator 标签的 Windows runner。
3. Windows runner 使用 COCOS_CREATOR_PATH 调用 Cocos Creator CLI，构建 wechatgame。
4. 构建目录和日志上传为 Actions artifact。
5. Pull Request（包括来自 fork 的 PR）只运行 Ubuntu 逻辑测试，不会在个人电脑上执行不可信代码。

## Windows Runner

Runner 名称：word-puck-win。标签：Windows、X64、cocos-creator。

- 在 Windows 登录会话中运行 run.cmd。
- 不要将 Runner 安装为 Windows 服务，因为 Cocos Creator 命令行构建需要 GUI 环境。
- 保持电脑开机且 Runner 窗口运行。

## 仓库变量

Settings -> Secrets and variables -> Actions -> Variables：

| 变量 | 值 |
|---|---|
| COCOS_CREATOR_PATH | C:\ProgramData\cocos\editors\Creator\3.8.8\CocosCreator.exe |

工作流不再读取 ENABLE_COCOS_BUILD。只要 Runner 在线，可信分支每次 push 都会自动构建；之前创建的 ENABLE_COCOS_BUILD 变量可以保留，不会被读取。

## 入口场景

入口场景已经提交：
- games/puck-battle/assets/scenes/Game.scene
- games/puck-battle/assets/scenes/Game.scene.meta

场景包含 Canvas、UI Camera、UITransform、Canvas、Widget 和 PuckBattleBootstrap 组件。settings/v2/packages/engine.json 已包含 physics-2d-box2d 模块。不要手动重新创建或覆盖 Game.scene。

## 构建产物

构建目录：games/puck-battle/build/ci-wechatgame
构建日志：Runner 临时目录中的 cocos-build.log
Actions artifact：word-puck-wechat-build，保留 14 天。

Cocos Creator 官方命令行文档说明：退出码 36 表示构建成功，32/34 表示构建失败。

## 安全边界

- GitHub-hosted runner 运行所有 PR 的静态检查和逻辑测试。
- 本地 Windows runner 只处理可信分支 push 和手动 workflow_dispatch。
- 不对 fork PR 执行 self-hosted job。
- Runner 保持交互式用户会话运行。

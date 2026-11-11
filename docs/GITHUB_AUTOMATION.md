# GitHub 自动构建配置（Cocos Creator 3.8.8）

本仓库通过 GitHub Actions 自动执行逻辑测试，并由 Windows self-hosted runner 调用 Cocos Creator 3.8.8 构建微信小游戏。

## 自动化流程

1. Push 到 feature/puck-battle-prototype 后，Ubuntu runner 自动执行项目结构、场景引用、项目设置和逻辑单元测试。
2. 测试通过后，可信 push 自动分配给带有 cocos-creator 标签的 Windows runner。
3. Windows runner 使用 COCOS_CREATOR_PATH 调用 Cocos Creator CLI，构建 wechatgame。
4. 构建目录和完整诊断日志上传为 Actions artifact。
5. Pull Request（包括来自 fork 的 PR）只运行 Ubuntu 逻辑测试，不会在个人电脑上执行不可信代码。

## Windows Runner

Runner 名称：word-puck-win。标签：Windows、X64、cocos-creator。

- 在正常 Windows 登录用户会话中运行 run.cmd。
- 不要将 Runner 安装为 Windows 服务；Cocos Creator CLI 需要 GUI 环境。
- 保持电脑开机且 Runner 窗口运行。
- 构建时建议关闭正在编辑同一项目的 Cocos Creator GUI 窗口，避免编辑器与 CLI 同时操作项目缓存。

## 仓库变量

Settings -> Secrets and variables -> Actions -> Variables：

| 变量 | 值 |
|---|---|
| COCOS_CREATOR_PATH | C:\ProgramData\cocos\editors\Creator\3.8.8\CocosCreator.exe |

ENABLE_COCOS_BUILD 不再使用；可信分支 push 会自动构建。

## Cocos 项目目录

Cocos 项目根目录是 games/puck-battle。所有 Cocos 项目设置必须位于这个目录内部：

- games/puck-battle/settings/v2/packages/engine.json
- games/puck-battle/settings/v2/packages/project.json (720x1280 portrait, fitHeight=true)

入口场景：
- games/puck-battle/assets/scenes/Game.scene
- games/puck-battle/assets/scenes/Game.scene.meta

场景包含 Canvas、UI Camera、UITransform、Canvas、Widget 和 PuckBattleBootstrap 组件。engine.json 包含 physics-2d-box2d 模块。

## 自动构建参数

构建配置文件：

- scripts/windows/wechat-build-config.json

使用 JSON 类型保存 debug 布尔值，避免 CLI 将 debug=true 解析成字符串。输出路径使用 Cocos Creator 支持的 project://build，输出文件夹名由 outputName=ci-wechatgame 指定。

实际构建命令由 scripts/windows/build-wechat.ps1 执行：

    CocosCreator.exe --project PROJECT_PATH --build "configPath=CONFIG_JSON;logDest=CLI_LOG"

预期构建目录：

    games/puck-battle/build/ci-wechatgame

Cocos Creator 官方命令行构建退出码：
- 32：构建参数无效
- 34：构建过程失败
- 36：构建成功

构建脚本会记录 Windows 身份、USERPROFILE、Cocos Creator 路径、项目路径、标准输出、标准错误、引擎内部日志和输出文件数量。GitHub Actions job 最长运行 30 分钟。

构建后还会验证 `game.json` 的 portrait 方向，以及 `src/settings.json` 中的 720x1280 竖屏设计分辨率，避免竖屏小游戏误生成横屏布局。

## 构建产物

构建目录：games/puck-battle/build/ci-wechatgame

Actions artifact：word-puck-wechat-build，保留 14 天。失败时也会尝试上传诊断日志。

## 安全边界

- GitHub-hosted runner 运行所有 PR 的静态检查和逻辑测试。
- 本地 Windows runner 只处理可信分支 push 和指定分支的手动 workflow_dispatch。
- 不对 fork PR 执行 self-hosted job。
- Runner 保持交互式用户会话运行。

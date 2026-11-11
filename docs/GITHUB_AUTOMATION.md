# GitHub 自动构建配置（Cocos Creator 3.8.8）

本仓库使用 GitHub Actions 运行逻辑测试，并使用 Windows self-hosted runner 调用本机安装的 Cocos Creator 3.8.8 构建微信小游戏。

## 自动化流程

1. 代码推送到 `feature/puck-battle-prototype` 后，GitHub-hosted Ubuntu runner 自动执行项目结构检查和逻辑单元测试。
2. 逻辑测试通过后，如果仓库变量 `ENABLE_COCOS_BUILD=true`，GitHub Actions 会把可信分支推送任务交给 Windows self-hosted runner。
3. Windows runner 使用仓库变量 `COCOS_CREATOR_PATH` 调用 Cocos Creator CLI，构建 `wechatgame`。
4. 构建目录和日志上传为 Actions artifact。
5. Pull Request（包括来自 fork 的 PR）只运行 Ubuntu 逻辑测试，不会执行本地 Windows runner，避免不可信代码在个人电脑上运行。

## 一次性配置 Windows Runner

> 需要 Windows 电脑保持开机，并在桌面用户会话中运行 runner。Cocos Creator 命令行构建需要 GUI 环境，因此不要把这个 runner 安装成 Windows 服务运行；使用交互式 `run.cmd`。

1. 打开仓库 GitHub 页面：Settings -> Actions -> Runners。
2. 选择 New self-hosted runner -> Windows -> x64。
3. 按 GitHub 页面显示的步骤下载 runner 并解压到一个固定目录，例如 `C:\actions-runner`。
4. 在该目录打开 PowerShell，执行 GitHub 页面生成的 `config.cmd` 注册命令。注册时增加自定义标签 `cocos-creator`，例如：

```powershell
.\config.cmd --url https://github.com/ruiyo/wechat-mini-games --token <GitHub页面生成的一次性令牌> --labels cocos-creator
```

不要把一次性令牌写进仓库、脚本或聊天记录。

5. 注册完成后，在同一目录运行：

```powershell
.\run.cmd
```

保持这个终端和 Windows 登录会话运行。GitHub Actions 才能把构建任务分配给这台电脑。

## 设置仓库变量

打开 Settings -> Secrets and variables -> Actions -> Variables，新增：

| 变量 | 值 |
|---|---|
| `COCOS_CREATOR_PATH` | Cocos Creator 3.8.8 的完整可执行文件路径，例如 `D:\Apps\Cocos\Creator\3.8.8\CocosCreator.exe` |
| `ENABLE_COCOS_BUILD` | `true` |

`COCOS_CREATOR_PATH` 是路径，不是密钥；不要填写 Dashboard 快捷方式路径，必须指向实际的 `CocosCreator.exe`。

## 一次性场景准备

当前代码仓库的原型脚本会在运行时创建 UI 和场地，但 Cocos 项目仍需要一个编辑器序列化的入口场景。

首次构建前，在 Cocos Creator 3.8.8 中：

1. 导入 `games/puck-battle`。
2. 在 `assets/scenes` 创建 `Game.scene`。
3. 确认场景有 Canvas 和 UI Camera。
4. 将 `PuckBattleBootstrap` 组件挂到 Canvas。
5. 在项目设置的功能裁剪中启用 2D Physics / Box2D。
6. 保存场景，并将 `Game.scene` 和它生成的 `.meta` 文件提交到 `feature/puck-battle-prototype`。

这是一次性工程初始化。之后修改 TypeScript 代码、运行逻辑测试和构建微信小游戏都由 GitHub Actions 自动完成，不需要每次打开 Cocos Creator。

## 触发方式

- Push 到 `feature/puck-battle-prototype`：自动逻辑测试；启用变量后自动构建微信小游戏。
- Pull Request 到 `main`：只运行安全的逻辑测试。
- Actions -> Word Puck CI and WeChat Build -> Run workflow：手动触发一次完整检查/构建。

## 构建产物与日志

- 微信小游戏构建目录：`games/puck-battle/build/ci-wechatgame`
- Actions artifact：`word-puck-wechat-build`
- Cocos CLI 日志：runner 临时目录中的 `cocos-build.log`

Cocos Creator 3.8 命令行构建文档列出的退出码中，36 表示构建成功，32/34 表示构建失败。工作流脚本已按此处理。

## 本地只检查逻辑（可选）

在仓库根目录执行：

```powershell
node scripts/validate-project.mjs
npx --yes tsx@4.20.6 --test tests/logic/*.test.ts
```

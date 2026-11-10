# 微信小游戏开发仓库

用于开发和验证轻量级微信小游戏原型。当前优先项目为 **《冰壶碰碰局》**，第二个候选项目为 **《传送带调度员》**。

## 项目状态

- [x] 建立项目仓库与开发分支
- [x] 确定《冰壶碰碰局》核心玩法与 MVP 范围
- [x] 确定《传送带调度员》第二阶段方向
- [ ] 创建 Cocos Creator 工程
- [ ] 完成冰壶物理与投掷原型
- [ ] 完成三次投掷、计分和结算
- [ ] 微信开发者工具真机/模拟器验证

> 当前分支首先提交设计文档和工程规范。可运行的 Cocos Creator 工程将在后续开发提交中加入；本仓库目前还不是可直接打开运行的完整游戏工程。

## 技术选型

- 游戏引擎：Cocos Creator 3.8 LTS
- 语言：TypeScript
- 目标平台：微信小游戏
- 《冰壶碰碰局》：Cocos Creator 2D Physics / Box2D
- 《传送带调度员》：基于路径节点和离散状态更新，不依赖物理引擎
- 首版存档：本地存储，不依赖服务器

## 项目目录

```text
wechat-mini-games/
├── games/
│   ├── puck-battle/             # 第一阶段：冰壶碰碰局
│   └── conveyor-dispatcher/     # 第二阶段：传送带调度员
├── docs/
│   ├── GDD_PUCK_BATTLE.md
│   ├── TECHNICAL_DESIGN_PUCK_BATTLE.md
│   ├── MVP_PLAN.md
│   └── GDD_CONVEYOR_DISPATCHER.md
├── .github/
└── README.md
```

## 设计文档

- [冰壶碰碰局游戏设计](docs/GDD_PUCK_BATTLE.md)
- [冰壶碰碰局技术设计](docs/TECHNICAL_DESIGN_PUCK_BATTLE.md)
- [MVP 开发计划与验收标准](docs/MVP_PLAN.md)
- [传送带调度员游戏设计](docs/GDD_CONVEYOR_DISPATCHER.md)

## Git 工作流

- `main`：稳定版本。
- `develop`：日常集成分支（工程进入持续开发后启用）。
- `feature/*`：独立功能开发分支。

当前开发分支：`feature/puck-battle-prototype`。

建议按功能提交，例如：

- `feat(puck): add arena and puck physics`
- `feat(puck): implement drag aiming and launch`
- `feat(puck): add three-shot round flow`
- `fix(puck): stabilize rest detection`
- `docs: update MVP acceptance criteria`

## 开发原则

1. 先验证核心操作，再扩展关卡和内容。
2. 第一版只做单人玩法，不接入实时联机、商城和广告。
3. 物理参数集中配置，避免散落在脚本中。
4. 每个功能完成后进行模拟器测试，再合并到稳定分支。
5. 不把未验证的原型标记为可发布版本。

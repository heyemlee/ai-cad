# KABI Kitchen Plan CAD MVP

一个 Next.js + TypeScript 项目,把销售端的厨房意向表单转换成 AutoLISP / AutoCAD 图纸。用户在 Web 向导中填写房间尺寸、门窗位置、水电位置和需要的电器,后端生成 `.lsp` 脚本并通过 AutoCAD 2026 (`AcCoreConsole`) 自动绘图,生成 `.dwg` 文件。

## 功能

- 4 步向导(Room / Openings / Needs / Confirm),收集厨房布局意向
- 基于规则的布局引擎(`lib/kitchenPlan.ts`、`lib/kitchenRules.ts`),自动放置基础柜、水槽、灶台、冰箱、洗碗机
- 自动生成 AutoLISP 脚本(`lib/generateKitchenPlanLisp.ts`)
- 调用本机 AutoCAD 2026 启动绘图(`lib/autocad.ts`)
- 中英文混合的修改请求(例:"move sink right 6 inches"、"把冰箱放左墙")

## 环境要求

- Node.js 20+
- macOS(当前 AutoCAD 集成路径写死在 `lib/autocad.ts`,见下方"配置")
- AutoCAD 2026(可选,仅在需要落盘 `.dwg` 时)

## 启动

```bash
npm install
npm run dev
```

打开 [http://localhost:3000](http://localhost:3000)。

## 脚本

| 命令 | 说明 |
| --- | --- |
| `npm run dev` | 启动 Next.js 开发服务器 |
| `npm run build` | 生产构建 |
| `npm run lint` | 运行 ESLint |
| `npm run generate` | 用默认表单跑一次布局,把结果写入 `output/` |
| `npm test` | 跑 `tests/*.test.ts` |

## 目录结构

```
app/                  Next.js App Router 页面 + API 路由
  api/drawings/       生成图纸的 POST 接口,以及 [id]/modify 修改接口
lib/                  布局引擎、规则检查、AutoLISP 生成、AutoCAD 调用
  kitchenPlan.ts      默认意向 + 规则布局核心
  kitchenRules.ts     冲突 / 间距检查
  generateKitchenPlanLisp.ts  导出 AutoLISP
  autocad.ts          调用 AcCoreConsole / 启动 AutoCAD
data/                 静态数据(柜体目录等)
scripts/              一次性 CLI 脚本(generate-output、test_core)
tests/                node:test 测试
output/               生成的 JSON / LSP / DWG(已 gitignore)
```

## 配置

目前 AutoCAD 路径在 [lib/autocad.ts](lib/autocad.ts) 中硬编码:

- `AUTOCAD_APP` — AutoCAD 2026 应用路径
- `ACCORE_CONSOLE` — AcCoreConsole 可执行文件路径
- `AUTOCAD_TEMPLATE` — 默认 `.dwt` 模板

非 macOS 或不同 AutoCAD 版本需手动修改。建议后续改为读取环境变量(见 [.env.example](.env.example))。

## 输出文件

每次绘图会在 `output/kitchen-<timestamp>-<id>/` 下生成:

- `intake.json` — 用户输入
- `layout.json` — 计算后的布局
- `plan.lsp` — AutoLISP 脚本
- `plan.scr` — AutoCAD 批处理脚本
- `plan.dwg` — 最终图纸(AutoCAD 调用成功时)

## License

见 [LICENSE](LICENSE)。

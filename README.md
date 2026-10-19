# dsh-feishu-writer

> **The missing "write" side of Feishu for DeepSeek Harness** — let your agent create Feishu docs, spreadsheets, Bitables and wiki spaces.
> 飞书"读"的插件有了、"聊"的插件也有了，**"写"是空白**——这个插件让 DeepSeek Harness 的 Agent 把产出直接写进飞书。

## What it does

Registers 4 model-facing tools:

| Tool | Capability | Returns |
|------|-----------|---------|
| `feishu_write_doc` | Create a Feishu doc (Markdown body) | `{"document_id":"...","url":"..."}` |
| `feishu_write_sheet` | Create a spreadsheet, optionally pre-filled with a 2D array | sheet info + written range |
| `feishu_write_bitable` | Create a BitTable (BaseApp) in a workspace | `{"app_token":"...","url":"..."}` |
| `feishu_write_wiki` | Create a wiki space | `{"space_id":"...","name":"..."}` |

## Install

```bash
dsh plugin add <owner>/dsh-feishu-writer
```

## Prerequisites (required)

1. Install the official Feishu/Lark CLI: `npx @larksuite/cli@latest install`
2. Log in once: `lark-cli auth login --recommend` (opens a browser authorization page)

**Windows 可执行文件解析**：插件从不经过 shell 执行 lark-cli（注入安全），但 Windows 上 npm 装的
`lark-cli` 只有 `.cmd` 垫片、无法被 `spawn` 直接执行。插件按以下顺序解析真正的 `lark-cli.exe`：

1. `LARK_CLI_BIN` 环境变量（指向 lark-cli.exe 完整路径，最高优先级）；
2. PATH 中的 `lark-cli.exe`；
3. npm 全局安装位置 `%APPDATA%\npm\node_modules\@larksuite\cli\bin\lark-cli.exe`。

解析失败时工具返回明确的修复提示，不会崩溃。

If the plugin detects a missing CLI or an expired login, the tool call fails with a clear
fix-up hint instead of crashing.

## Usage examples

**"帮我写一份本周周报，存到飞书文档"**
```
agent → feishu_write_doc(title="第42周周报", content="# 本周进展\n- 完成 RAG 检索优化\n- 上线评测闭环")
agent → {"document_id":"...","url":"https://xxx.feishu.cn/docx/..."}
```

**"把这些数据整理成飞书表格"**
```
agent → feishu_write_sheet(title="季度数据", values='[["月份","营收"],["Q1",120],["Q2",150]]')
```

**"把研究结果沉淀到知识库"**
```
agent → feishu_write_wiki(name="AI 应用开发笔记", description="RAG/Agent/评测 实战沉淀")
```

**BitTable needs a workspace token**（在飞书多维表格工作区 URL 中获取，形如 `base/workspace/<token>`）:
```
agent → feishu_write_bitable(name="项目看板", workspaceToken="GUs9soB...")
```

## R2 权限披露（DSH-Store R2 级）

本插件属于 **R2 级**（外部进程 + 网络 + 凭据），逐项披露如下：

| 能力 | 说明 |
|------|------|
| 外部进程 | shell out 调用 `lark-cli`（飞书官方 CLI，MIT）。**不使用 shell 解释器**：参数数组直传 `spawn`，模型/用户内容不会被解释为 shell 语法（注入安全） |
| 网络 | 由 lark-cli 发起对飞书 OpenAPI 的 HTTPS 调用 |
| 凭据 | 完全复用 lark-cli 的 OAuth 凭据（存于系统 keychain），**本插件不读取、不存储、不转发任何 token** |
| 外部依赖 | `@larksuite/cli`（npm，飞书官方维护）；建议固定版本 |

## Security & boundaries

- All tool content is passed as `spawn` argv or a temp file — **never through a shell**.
- Tools only **create** objects; they do not delete, share, or modify existing content (write-only scope).
- Errors (not installed / expired login / API failure) surface as actionable messages with fix-up hints.
- Review the objects created before sharing: wiki spaces default to **private**.

## Development

```bash
npm install
npm run typecheck
npm test
npm run build
npm pack
```

Local mount & verify:

```bash
dsh plugin --profile web add ./dsh-feishu-writer-0.1.0.tgz
dsh --profile web --dump-config | grep feishu_write
dsh run "用 feishu_write_doc 创建一篇标题为测试的文档"
```

## License

MIT. Uses the Feishu/Lark Open Platform via lark-cli — using those APIs requires
compliance with Feishu's terms and privacy policy.

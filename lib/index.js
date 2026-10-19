import { defineTool } from '@deepseek-ai/dsh-tools';
import { LARK_CLI_LOGIN_HINT, writeBitable, writeDoc, writeSheet, writeWiki, } from "./impl.js";
export const name = 'dsh-feishu-writer';
export const inject = ['tools'];
const COMMON_DEPENDENCY_NOTE = '前置要求：本机已安装 lark-cli（npx @larksuite/cli install）并已登录（lark-cli auth login）。';
const textOutput = {
    schema: { type: 'string' },
    render: (_args, value) => [{ type: 'text', text: value }],
};
export function apply(ctx) {
    ctx.tools.register(defineTool({
        name: 'feishu_write_doc',
        description: `在飞书（Feishu/Lark）创建一篇新文档。content 为 Markdown 正文，title 为文档标题。` +
            `创建成功返回 JSON：{"document_id":"...","url":"..."}，把 url 给用户。` +
            `${COMMON_DEPENDENCY_NOTE}`,
        parameters: {
            title: { type: 'string', required: true, description: '文档标题' },
            content: { type: 'string', required: true, description: 'Markdown 正文，可多行' },
            folderToken: {
                type: 'string',
                description: '目标文件夹 token（可选，默认放“我的空间”根目录）',
            },
        },
        output: textOutput,
        execute: async (args, exec) => {
            if (args.title.trim() === '')
                throw new Error('feishu-writer: title 不能为空');
            if (args.content.trim() === '')
                throw new Error('feishu-writer: content 不能为空');
            try {
                return await writeDoc(args, { signal: exec.signal });
            }
            catch (err) {
                throw new Error(enrichMessage(err));
            }
        },
        timeoutMs: 60000,
    }));
    ctx.tools.register(defineTool({
        name: 'feishu_write_sheet',
        description: `在飞书创建一张新电子表格，可选同时写入数据。values 为 JSON 二维数组文本，如 '[["name","score"],["Yulia",95]]'。` +
            `创建成功返回 JSON，包含 sheet 信息与写入范围。${COMMON_DEPENDENCY_NOTE}`,
        parameters: {
            title: { type: 'string', required: true, description: '表格标题' },
            values: {
                type: 'string',
                description: 'JSON 二维数组文本（可选），首行通常为表头',
            },
            folderToken: { type: 'string', description: '目标文件夹 token（可选）' },
        },
        output: textOutput,
        execute: async (args, exec) => {
            if (args.title.trim() === '')
                throw new Error('feishu-writer: title 不能为空');
            try {
                return await writeSheet(args, { signal: exec.signal });
            }
            catch (err) {
                throw new Error(enrichMessage(err));
            }
        },
        timeoutMs: 60000,
    }));
    ctx.tools.register(defineTool({
        name: 'feishu_write_bitable',
        description: `在飞书创建一个新的多维表格（BitTable/BaseApp），必须指定工作区 token（workspaceToken）。` +
            `创建成功返回 JSON：{"app_token":"...","url":"..."}，把 url 给用户。${COMMON_DEPENDENCY_NOTE}`,
        parameters: {
            name: { type: 'string', required: true, description: '多维表格名称' },
            workspaceToken: {
                type: 'string',
                required: true,
                description: '工作区 token（在飞书多维表格工作区 URL 中可见，形如 base/workspace/<token>）',
            },
        },
        output: textOutput,
        execute: async (args, exec) => {
            if (args.name.trim() === '')
                throw new Error('feishu-writer: name 不能为空');
            if (args.workspaceToken.trim() === '')
                throw new Error('feishu-writer: workspaceToken 必填，请从飞书多维表格工作区 URL 获取');
            try {
                return await writeBitable(args, { signal: exec.signal });
            }
            catch (err) {
                throw new Error(enrichMessage(err));
            }
        },
        timeoutMs: 60000,
    }));
    ctx.tools.register(defineTool({
        name: 'feishu_write_wiki',
        description: `在飞书创建一个新的知识库（Wiki Space）。创建成功返回 JSON：{"space_id":"...","name":"..."}。` +
            `${COMMON_DEPENDENCY_NOTE}`,
        parameters: {
            name: { type: 'string', required: true, description: '知识库名称' },
            description: { type: 'string', description: '知识库简介（可选）' },
        },
        output: textOutput,
        execute: async (args, exec) => {
            if (args.name.trim() === '')
                throw new Error('feishu-writer: name 不能为空');
            try {
                return await writeWiki(args, { signal: exec.signal });
            }
            catch (err) {
                throw new Error(enrichMessage(err));
            }
        },
        timeoutMs: 60000,
    }));
}
function enrichMessage(err) {
    if (err instanceof Error) {
        const msg = err.message;
        if (msg.includes('未安装'))
            return `${msg}`;
        if (/refresh token expired|not logged|auth login/i.test(msg))
            return `${LARK_CLI_LOGIN_HINT}`;
        return msg;
    }
    return 'feishu-writer: 未知错误';
}

import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
export const LARK_CLI_NOT_INSTALLED_HINT = 'lark-cli 未安装：请先运行 npx @larksuite/cli@latest install';
export const LARK_CLI_WINDOWS_RESOLVE_HINT = 'lark-cli 找不到可执行文件：请把 lark-cli.exe 所在目录加入 PATH，' +
    '或设置 LARK_CLI_BIN 环境变量指向 lark-cli.exe 的完整路径';
export const LARK_CLI_LOGIN_HINT = 'lark-cli 未登录或登录过期：请运行 lark-cli auth login --recommend';
function parseEnvelope(text) {
    const trimmed = text.trim();
    if (!trimmed)
        return null;
    try {
        const parsed = JSON.parse(trimmed);
        if (typeof parsed.ok === 'boolean')
            return parsed;
    }
    catch {
        // fall through
    }
    return null;
}
export function formatLarkError(parsed, fallback = '') {
    const e = parsed?.error;
    if (e) {
        const parts = [e.message, e.hint].filter(Boolean).join('。');
        if (parts)
            return `feishu-writer: ${parts}`;
    }
    const raw = fallback.trim();
    if (raw)
        return `feishu-writer: lark-cli 失败：${raw.slice(0, 500)}`;
    return 'feishu-writer: lark-cli 未知错误';
}
function findOnPath(name) {
    const pathEnv = process.env.PATH || process.env.Path || '';
    for (const dir of pathEnv.split(delimiter)) {
        if (!dir)
            continue;
        const candidate = join(dir, name);
        if (existsSync(candidate))
            return candidate;
    }
    return null;
}
function findNpmGlobalExe() {
    const candidates = [];
    const appData = process.env.APPDATA;
    if (appData) {
        candidates.push(join(appData, 'npm', 'node_modules', '@larksuite', 'cli', 'bin', 'lark-cli.exe'));
    }
    const localAppData = process.env.LOCALAPPDATA;
    if (localAppData) {
        candidates.push(join(localAppData, 'npm', 'node_modules', '@larksuite', 'cli', 'bin', 'lark-cli.exe'));
    }
    for (const c of candidates) {
        if (existsSync(c))
            return c;
    }
    return null;
}
/**
 * Resolve a spawn-safe lark-cli executable without ever going through a shell.
 * Windows npm shims are lark-cli.cmd / lark-cli.ps1 (or a bash script), which
 * spawn() cannot execute without a shell — so we locate the real Go binary
 * (lark-cli.exe) instead. Order: LARK_CLI_BIN override → lark-cli.exe on PATH
 * → npm global install location. Returns null when only unusable shims exist.
 */
export function resolveLarkCli() {
    const override = process.env.LARK_CLI_BIN;
    if (override)
        return { command: override };
    if (process.platform === 'win32') {
        const exeOnPath = findOnPath('lark-cli.exe');
        if (exeOnPath)
            return { command: exeOnPath };
        const npmExe = findNpmGlobalExe();
        if (npmExe)
            return { command: npmExe };
        return null;
    }
    return { command: 'lark-cli' };
}
/**
 * Run a lark-cli command. Never uses a shell: argv is passed directly to spawn,
 * so user/model content can never be interpreted as shell syntax (injection-safe).
 * lark-cli's JSON contract: success -> stdout {ok:true,data}, failure -> stderr {ok:false,error}.
 */
export function runLarkCli(argv, options = {}) {
    const { signal, timeoutMs = 60000, binary } = options;
    const resolved = binary ? { command: binary } : resolveLarkCli();
    if (!resolved) {
        return Promise.reject(new Error(LARK_CLI_WINDOWS_RESOLVE_HINT));
    }
    return new Promise((resolve, reject) => {
        const child = spawn(resolved.command, argv, {
            windowsHide: true,
            stdio: ['ignore', 'pipe', 'pipe'],
        });
        let stdout = '';
        let stderr = '';
        let settled = false;
        const finish = (fn, value) => {
            if (settled)
                return;
            settled = true;
            clearTimeout(timer);
            if (signal)
                signal.removeEventListener('abort', onAbort);
            fn(value);
        };
        const timer = setTimeout(() => {
            child.kill();
            finish(reject, new Error('feishu-writer: lark-cli 执行超时'));
        }, timeoutMs);
        const onAbort = () => {
            child.kill();
            finish(reject, new Error('feishu-writer: 任务已取消'));
        };
        if (signal) {
            if (signal.aborted)
                onAbort();
            else
                signal.addEventListener('abort', onAbort, { once: true });
        }
        child.stdout?.on('data', (d) => {
            stdout += d.toString('utf8');
        });
        child.stderr?.on('data', (d) => {
            stderr += d.toString('utf8');
        });
        child.on('error', (err) => {
            if (err.code === 'ENOENT') {
                finish(reject, new Error(LARK_CLI_NOT_INSTALLED_HINT));
            }
            else {
                finish(reject, err);
            }
        });
        child.on('close', (code) => {
            const outEnv = parseEnvelope(stdout);
            const errEnv = parseEnvelope(stderr);
            const envelope = outEnv ?? errEnv;
            if (envelope) {
                if (envelope.ok === true) {
                    finish(resolve, envelope);
                }
                else {
                    finish(reject, new Error(formatLarkError(envelope, stderr || stdout)));
                }
            }
            else if (code === 0) {
                finish(resolve, { ok: true, data: stdout.trim() });
            }
            else {
                finish(reject, new Error(formatLarkError(null, stderr || stdout)));
            }
        });
    });
}
export async function checkLarkCli() {
    try {
        await runLarkCli(['--version'], { timeoutMs: 5000 });
        return true;
    }
    catch {
        return false;
    }
}
/** Compose the Markdown payload for docs +create (title lives inside the content). */
export function composeDocContent(title, content) {
    return `<title>${title}</title>\n${content}`;
}
export async function writeDoc(args, options = {}) {
    // Long/multiline content goes through a temp file (@file) to avoid argv
    // length limits and any escaping trouble.
    const dir = await mkdtemp(join(tmpdir(), 'dsh-feishu-writer-'));
    const file = join(dir, 'content.md');
    try {
        await writeFile(file, composeDocContent(args.title, args.content), 'utf8');
        const argv = ['docs', '+create', '--doc-format', 'markdown', '--content', `@${file}`];
        if (args.folderToken)
            argv.push('--parent-token', args.folderToken);
        const result = await runLarkCli(argv, options);
        return JSON.stringify(result.data);
    }
    finally {
        await rm(dir, { recursive: true, force: true }).catch(() => undefined);
    }
}
export async function writeSheet(args, options = {}) {
    const argv = ['sheets', '+workbook-create', '--title', args.title];
    if (args.values !== undefined && args.values !== '') {
        JSON.parse(args.values); // fail fast with a clear message before hitting the network
        argv.push('--values', args.values);
    }
    if (args.folderToken)
        argv.push('--folder-token', args.folderToken);
    const result = await runLarkCli(argv, options);
    return JSON.stringify(result.data);
}
export async function writeBitable(args, options = {}) {
    const argv = ['base', '+app-create', '--name', args.name, '--workspace-token', args.workspaceToken];
    const result = await runLarkCli(argv, options);
    return JSON.stringify(result.data);
}
export async function writeWiki(args, options = {}) {
    const argv = ['wiki', '+space-create', '--name', args.name];
    if (args.description)
        argv.push('--description', args.description);
    const result = await runLarkCli(argv, options);
    return JSON.stringify(result.data);
}

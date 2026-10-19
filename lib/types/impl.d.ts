export declare const LARK_CLI_NOT_INSTALLED_HINT = "lark-cli \u672A\u5B89\u88C5\uFF1A\u8BF7\u5148\u8FD0\u884C npx @larksuite/cli@latest install";
export declare const LARK_CLI_WINDOWS_RESOLVE_HINT: string;
export declare const LARK_CLI_LOGIN_HINT = "lark-cli \u672A\u767B\u5F55\u6216\u767B\u5F55\u8FC7\u671F\uFF1A\u8BF7\u8FD0\u884C lark-cli auth login --recommend";
export interface LarkEnvelope {
    ok: boolean;
    identity?: string;
    data?: unknown;
    error?: {
        type?: string;
        subtype?: string;
        code?: number;
        message?: string;
        hint?: string;
    };
}
export interface RunOptions {
    signal?: AbortSignal;
    timeoutMs?: number;
    binary?: string;
}
export declare function formatLarkError(parsed: LarkEnvelope | null, fallback?: string): string;
/**
 * Resolve a spawn-safe lark-cli executable without ever going through a shell.
 * Windows npm shims are lark-cli.cmd / lark-cli.ps1 (or a bash script), which
 * spawn() cannot execute without a shell — so we locate the real Go binary
 * (lark-cli.exe) instead. Order: LARK_CLI_BIN override → lark-cli.exe on PATH
 * → npm global install location. Returns null when only unusable shims exist.
 */
export declare function resolveLarkCli(): {
    command: string;
} | null;
/**
 * Run a lark-cli command. Never uses a shell: argv is passed directly to spawn,
 * so user/model content can never be interpreted as shell syntax (injection-safe).
 * lark-cli's JSON contract: success -> stdout {ok:true,data}, failure -> stderr {ok:false,error}.
 */
export declare function runLarkCli(argv: string[], options?: RunOptions): Promise<LarkEnvelope>;
export declare function checkLarkCli(): Promise<boolean>;
/** Compose the Markdown payload for docs +create (title lives inside the content). */
export declare function composeDocContent(title: string, content: string): string;
export declare function writeDoc(args: {
    title: string;
    content: string;
    folderToken?: string;
}, options?: RunOptions): Promise<string>;
export declare function writeSheet(args: {
    title: string;
    values?: string;
    folderToken?: string;
}, options?: RunOptions): Promise<string>;
export declare function writeBitable(args: {
    name: string;
    workspaceToken: string;
}, options?: RunOptions): Promise<string>;
export declare function writeWiki(args: {
    name: string;
    description?: string;
}, options?: RunOptions): Promise<string>;

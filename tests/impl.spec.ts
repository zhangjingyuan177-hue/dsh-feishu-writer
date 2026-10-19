import { describe, expect, it } from 'vitest'
import {
  composeDocContent,
  formatLarkError,
  LARK_CLI_NOT_INSTALLED_HINT,
  resolveLarkCli,
  runLarkCli,
  writeSheet,
} from '../src/impl.ts'

describe('composeDocContent', () => {
  it('prefixes title and joins content', () => {
    expect(composeDocContent('周报', '# 进展\n- x')).toBe('<title>周报</title>\n# 进展\n- x')
  })
})

describe('formatLarkError', () => {
  it('joins message and hint', () => {
    expect(formatLarkError({ ok: false, error: { message: 'm', hint: 'h' } })).toBe(
      'feishu-writer: m。h',
    )
  })
  it('falls back to raw text when no envelope', () => {
    expect(formatLarkError(null, 'boom')).toBe('feishu-writer: lark-cli 失败：boom')
  })
})

describe('runLarkCli', () => {
  it('resolves ok:true envelope from stdout', async () => {
    const r = await runLarkCli(['-e', 'console.log(JSON.stringify({ok:true,data:{x:1}}))'], {
      binary: process.execPath,
      timeoutMs: 5000,
    })
    expect(r.ok).toBe(true)
    expect(r.data).toEqual({ x: 1 })
  })

  it('rejects ok:false envelope from stderr', async () => {
    await expect(
      runLarkCli(
        [
          '-e',
          'console.error(JSON.stringify({ok:false,error:{message:"boom",hint:"try x"}}));process.exit(1)',
        ],
        { binary: process.execPath, timeoutMs: 5000 },
      ),
    ).rejects.toThrow('feishu-writer: boom。try x')
  })

  it('rejects with install hint when binary is missing', async () => {
    await expect(
      runLarkCli(['--version'], { binary: 'definitely-not-exists-xyz', timeoutMs: 5000 }),
    ).rejects.toThrow(LARK_CLI_NOT_INSTALLED_HINT)
  })

  it('rejects on timeout', async () => {
    await expect(
      runLarkCli(['-e', 'setTimeout(()=>{},5000)'], {
        binary: process.execPath,
        timeoutMs: 300,
      }),
    ).rejects.toThrow('执行超时')
  })
})

describe('writeSheet validation', () => {
  it('rejects invalid values JSON before running lark-cli', async () => {
    await expect(writeSheet({ title: 't', values: 'not-json' })).rejects.toThrow()
  })
})

describe('resolveLarkCli', () => {
  it('honors the LARK_CLI_BIN override', () => {
    const old = process.env.LARK_CLI_BIN
    process.env.LARK_CLI_BIN = 'C:/some/custom/lark-cli.exe'
    try {
      expect(resolveLarkCli()?.command).toBe('C:/some/custom/lark-cli.exe')
    } finally {
      if (old === undefined) delete process.env.LARK_CLI_BIN
      else process.env.LARK_CLI_BIN = old
    }
  })
})

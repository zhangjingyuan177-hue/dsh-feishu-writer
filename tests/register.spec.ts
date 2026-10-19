import { describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import SystemPrompt from '@deepseek-ai/dsh-system-prompt'
import ToolRegistry from '@deepseek-ai/dsh-tools'
import * as plugin from '../src/index.ts'

describe('dsh-feishu-writer registration', () => {
  it('applies cleanly alongside system prompt and tool registry', async () => {
    const ctx = new Context()
    await ctx.plugin(SystemPrompt)
    await ctx.plugin(ToolRegistry)
    await ctx.plugin(plugin)
    expect(plugin.name).toBe('dsh-feishu-writer')
    expect(plugin.inject).toEqual(['tools'])
  })
})

import { describe, expect, it } from 'vitest'

import type { DelegationRouting } from '@/api/delegation'

import { isAdaptiveRouting } from './adaptive-routing'

const map = (model: string, provider: string, effort: string, configured = 'model_map') => ({
  configured,
  model_map: {
    default: 'executor',
    options: [{ name: 'executor', model, provider, reasoning_effort: effort, description: 'test' }]
  }
}) as DelegationRouting

describe('Adaptive Routing scopes to each profile and active route map', () => {
  it('recognizes active Qlik route', () => {
    expect(isAdaptiveRouting('qlik-developer', 'gpt-6-luna', 'xhigh', 'codex-cavernaugabuga', map('gpt-6-luna','codex-cavernaugabuga','xhigh'))).toBe(true)
  })
  it('supports all profiles using each native executor', () => {
    expect(isAdaptiveRouting('default','gpt-6-luna','xhigh','codex-cavernaugabuga',map('gpt-6-luna','codex-cavernaugabuga','xhigh'))).toBe(true)
    expect(isAdaptiveRouting('qlik-cloud-monitor','gemini-3.8-flash-medium','medium','guilhermeguto5',map('gemini-3.8-flash-medium','guilhermeguto5','medium'))).toBe(true)
    expect(isAdaptiveRouting('vps-operator','gpt-6-luna','xhigh','codex-cavernaugabuga',map('gpt-6-luna','codex-cavernaugabuga','xhigh'))).toBe(true)
  })
  it('does not claim routing when unconfigured or on a divergent model', () => {
    expect(isAdaptiveRouting('default','gpt-6-luna','xhigh','codex-cavernaugabuga',map('gpt-6-luna','codex-cavernaugabuga','xhigh','default'))).toBe(false)
    expect(isAdaptiveRouting('qlik-developer','gpt-6-luna','xhigh')).toBe(false)
    expect(isAdaptiveRouting('qlik-developer','gpt-6.1-sol','xhigh','codex-cavernaugabuga',map('gpt-6-luna','codex-cavernaugabuga','xhigh'))).toBe(false)
  })
})

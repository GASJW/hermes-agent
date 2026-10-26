import { describe, expect, it } from 'vitest'

import { routeConfigured } from './adaptive-routing-settings'
import { settingsSubpages } from './subpages'

const make = (name: string, provider: string, model: string, reasoning_effort: string) =>
  ({ name, provider, model, reasoning_effort, description: 'test' })

describe('Adaptive Routing settings across profiles', () => {
  it('appears as a dedicated Model settings subpage', () => {
    expect(settingsSubpages('config:model').some(page => page.id === 'adaptive')).toBe(true)
  })

  it('accepts editable executor models without false divergence', () => {
    expect(routeConfigured(make('executor', 'codex-cavernaugabuga', 'gpt-6.1-terra', 'xhigh'))).toBe(true)
    expect(routeConfigured(make('executor', 'codex-cavernaugabuga', 'gpt-6-luna', 'xhigh'))).toBe(true)
    expect(routeConfigured(make('executor', 'guilhermeguto5', 'gemini-3.8-flash-medium', 'medium'))).toBe(true)
  })

  it('flags only incomplete route configuration', () => {
    expect(routeConfigured(make('executor', '', 'gpt-6.1-terra', 'xhigh'))).toBe(false)
    expect(routeConfigured(make('executor', 'codex-cavernaugabuga', '', 'xhigh'))).toBe(false)
  })
})

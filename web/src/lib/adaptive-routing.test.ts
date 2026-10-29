import { describe, expect, it } from 'vitest'
import { isQlikAdaptiveRouting } from './adaptive-routing'
describe('profile-scoped adaptive routing label', () => {
  it('identifies only the Terra parent inside the Qlik developer profile', () => {
    expect(isQlikAdaptiveRouting('qlik-developer', 'gpt-6.1-terra')).toBe(true)
    expect(isQlikAdaptiveRouting('qlik-developer', 'codex/gpt-6.1-terra')).toBe(true)
    expect(isQlikAdaptiveRouting('qlik-developer', 'gpt-6.1-sol')).toBe(false)
    expect(isQlikAdaptiveRouting('default', 'gpt-6.1-terra')).toBe(false)
    expect(isQlikAdaptiveRouting('qlik-cloud-monitor', 'gpt-6.1-terra')).toBe(false)
    expect(isQlikAdaptiveRouting(undefined, 'gpt-6.1-terra')).toBe(false)
    expect(isQlikAdaptiveRouting('qlik-developer', 'gpt-6-luna')).toBe(false)
  })
})

import { describe, expect, it } from 'vitest'

import { isAdaptiveRouting } from './adaptive-routing'
describe('Adaptive Routing display', () => {
  it('shows only for the Qlik Developer Terra XHigh parent', () => {
    expect(isAdaptiveRouting('qlik-developer','gpt-6.1-terra','xhigh')).toBe(true)
    expect(isAdaptiveRouting('qlik-developer','codex/gpt-6.1-terra','xhigh')).toBe(true)
    expect(isAdaptiveRouting('qlik-developer','gpt-6.1-sol','low')).toBe(false)
    expect(isAdaptiveRouting('qlik-developer','gpt-6.1-terra','medium')).toBe(false)
    expect(isAdaptiveRouting('default','gpt-6.1-terra','xhigh')).toBe(false)
    expect(isAdaptiveRouting('qlik-developer','gpt-6-luna','xhigh')).toBe(false)
  })
})

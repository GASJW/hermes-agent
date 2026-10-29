import { describe,expect,it } from 'vitest'

import { adaptiveRoutingLabel } from '../lib/adaptiveRouting.js'
describe('CLI Adaptive Routing display', () => {
 it('labels Terra XHigh only in Qlik Developer',()=>{
   expect(adaptiveRoutingLabel('qlik-developer','gpt-6.1-terra','xhigh')).toBe('Adaptive Routing')
   expect(adaptiveRoutingLabel('default','gpt-6.1-terra','xhigh')).toBeNull()
   expect(adaptiveRoutingLabel('qlik-developer','gpt-6.1-sol','low')).toBeNull()
   expect(adaptiveRoutingLabel('qlik-developer','gpt-6.1-terra','medium')).toBeNull()
   expect(adaptiveRoutingLabel('qlik-developer','gpt-6-luna','xhigh')).toBeNull()
 })
})

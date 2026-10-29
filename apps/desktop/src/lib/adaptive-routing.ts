export const ADAPTIVE_PROFILE = 'qlik-developer'
export const ADAPTIVE_MODEL = 'gpt-6.1-terra'
export const ADAPTIVE_PROVIDER = 'codex-cavernaugabuga'

/** Qlik Developer UI mode: real parent Terra XHigh, governed delegation via Jev. */
export function isAdaptiveRouting(profile: string, model: string, effort: string): boolean {
  return profile === ADAPTIVE_PROFILE &&
    model.split('/').at(-1)?.toLowerCase() === ADAPTIVE_MODEL &&
    effort.toLowerCase() === 'xhigh'
}

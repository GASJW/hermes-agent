/** UI label for an existing Qlik Developer routing workflow, NOT a virtual LLM.
 * A real model remains responsible for the parent turn. Do not show on Sol,
 * fallback models, other profiles, or an unknown runtime identity.
 */
export const QLIK_ADAPTIVE_PROFILE = 'qlik-developer'
export const QLIK_ADAPTIVE_MODEL = 'gpt-6.1-terra'
export const QLIK_ADAPTIVE_PROVIDER = 'codex-cavernaugabuga'

export function isQlikAdaptiveRouting(profile: string | undefined, actualModel: string): boolean {
  return profile === QLIK_ADAPTIVE_PROFILE &&
    actualModel.split('/').at(-1)?.toLowerCase() === QLIK_ADAPTIVE_MODEL
}

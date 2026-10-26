import type { DelegationRouting } from '@/api/delegation'

/** Show Adaptive Routing only when THIS profile has an active route map.
 * The chosen model/effort/provider must correspond to its default executor. */
export function isAdaptiveRouting(
  profile: string,
  model: string,
  effort: string,
  provider?: string,
  routing?: DelegationRouting | null
): boolean {
  if (!profile || routing?.configured !== 'model_map') {return false}
  const route = routing.model_map.options.find(option => option.name === routing.model_map.default)

  if (!route) {return false}
  const selected = model.split('/').at(-1)?.toLowerCase() ?? ''

  return selected === route.model.toLowerCase() &&
    effort.toLowerCase() === (route.reasoning_effort ?? '').toLowerCase() &&
    (!provider || provider === route.provider)
}

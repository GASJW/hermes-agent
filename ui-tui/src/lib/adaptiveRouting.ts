/** UI label only. Actual parent model stays Terra XHigh and routing uses Jev/Handoff. */
export function adaptiveRoutingLabel(profile: string | null | undefined, model: string, effort?: string): string | null {
  return profile === 'qlik-developer' &&
    model.split('/').at(-1)?.toLowerCase() === 'gpt-6.1-terra' &&
    (effort ?? '').toLowerCase() === 'xhigh'
      ? 'Adaptive Routing'
      : null
}

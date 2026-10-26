import type { ModelOptionsResult } from '@hermes/shared'
import { useStore } from '@nanostores/react'
import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'

import { useSessionView } from '@/app/chat/session-view'
import { useDelegationRouting } from '@/app/settings/delegation/routing-data'
import { Codicon } from '@/components/ui/codicon'
import { DropdownMenuItem, dropdownMenuRow } from '@/components/ui/dropdown-menu'
import { useI18n } from '@/i18n'
import { modelOptionsQueryKey, requestModelOptions } from '@/lib/model-options'
import { cn } from '@/lib/utils'
import { notifyError } from '@/store/notifications'
import { $currentModelSource } from '@/store/session'

import { LocalSetupMenuRow } from './local-setup-menu-row'
import { ModelCatalogMenu } from './model-catalog-menu'
import { type ModelMenuHostProps, useModelMenuController } from './use-model-menu-controller'

export { ModelMenuCloseContext } from './model-catalog-menu'
export type { ModelSelection } from './use-model-menu-controller'

interface ModelMenuPanelProps extends ModelMenuHostProps {
  /** Drop the sticky composer pick so new chats follow Settings → Model. */
  onFollowDefaultModel?: () => void
}

/**
 * The composer's model menu: `ModelCatalogMenu` (the shared renderer) plus the
 * controller that gives a selection its meaning HERE (`useModelMenuController`).
 */
export function ModelMenuPanel({ onFollowDefaultModel, ...props }: ModelMenuPanelProps) {
  const { gateway, ownerConnectionId, profile = 'default', requestGateway } = props
  const { t } = useI18n()
  const copy = t.shell.modelMenu
  const [refreshing, setRefreshing] = useState(false)
  const queryClient = useQueryClient()
  const view = useSessionView()
  const modelSource = useStore($currentModelSource)
  const { activeSessionId, controller } = useModelMenuController(props)
  // Same condition as the pill's pin dot: a draft whose next session.create
  // ships the manual pick instead of the Settings default (#107410).
  const pinnedDraft = view.kind === 'primary' && !activeSessionId && modelSource === 'manual'
  const routing = useDelegationRouting(profile)

  const configuredExecutor = routing.data?.model_map.options.find(
    route => route.name === routing.data?.model_map.default
  )

  const adaptiveAvailable = routing.data?.configured === 'model_map' && Boolean(configuredExecutor)

  // Explicit "Refresh Models": re-fetch the catalog with refresh:true so the
  // backend busts its 1h provider-model disk cache and re-pulls each provider's
  // live list. Fixes live-only models (e.g. OpenCode Zen free tier) vanishing
  // when the cache expires and falls back to the curated static list.
  const refreshModels = async () => {
    if (refreshing) {
      return
    }

    setRefreshing(true)

    try {
      const queryKey = modelOptionsQueryKey(profile, activeSessionId, ownerConnectionId)

      const next = await requestModelOptions({
        gateway,
        profile,
        refresh: true,
        request: requestGateway,
        sessionId: activeSessionId
      })

      // The refreshed catalog is a hint list, never a reason to move the pick:
      // a custom slug the row lacks is still what the user selected.
      queryClient.setQueryData<ModelOptionsResult>(queryKey, next)
    } catch {
      // Network/backend hiccup — fall back to a plain invalidate so the next
      // open re-fetches (still cached, but no worse than before).
      void queryClient.invalidateQueries({ queryKey: ['model-options'] })
    } finally {
      setRefreshing(false)
    }
  }

  return (
    <ModelCatalogMenu
      controller={controller}
      footer={
        <>
          {adaptiveAvailable && configuredExecutor && (
            <DropdownMenuItem
              className={cn(dropdownMenuRow, 'text-(--ui-text-primary)')}
              onSelect={() => {
                void (async () => {
                  try {
                    const switched = await controller.select(configuredExecutor.model, configuredExecutor.provider ?? '')

                    if (switched === false) {
                      return
                    }

                    controller.applyPreset(
                      { effort: configuredExecutor.reasoning_effort ?? 'medium' },
                      { model: configuredExecutor.model, provider: configuredExecutor.provider ?? '' }
                    )
                  } catch (error) {
                    notifyError(error, 'Não foi possível selecionar o executor configurado do Adaptive Routing.')
                  }
                })()
              }}
              title={`Usar executor configurado neste perfil: ${configuredExecutor.model} · ${configuredExecutor.reasoning_effort ?? 'herdado'}. Delegações respeitam a política do perfil.`}
            >
              <Codicon name="git-compare" size="0.75rem" />
              Adaptive Routing · {configuredExecutor.model} · {configuredExecutor.reasoning_effort ?? 'herdado'}
            </DropdownMenuItem>
          )}
          {pinnedDraft && onFollowDefaultModel && (
            <DropdownMenuItem
              className={cn(dropdownMenuRow, 'text-(--ui-text-tertiary)')}
              onSelect={onFollowDefaultModel}
            >
              <Codicon name="discard" size="0.75rem" />
              {copy.followDefault}
            </DropdownMenuItem>
          )}
          <DropdownMenuItem
            className={cn(dropdownMenuRow, 'text-(--ui-text-tertiary)')}
            disabled={refreshing}
            onSelect={event => {
              event.preventDefault()
              void refreshModels()
            }}
          >
            <Codicon name="sync" size="0.75rem" spinning={refreshing} />
            {copy.refreshModels}
          </DropdownMenuItem>
        </>
      }
      gateway={gateway}
      header={<LocalSetupMenuRow />}
      includeMoa
      ownerConnectionId={ownerConnectionId}
      profile={profile}
      request={requestGateway}
      sessionId={activeSessionId}
    />
  )
}

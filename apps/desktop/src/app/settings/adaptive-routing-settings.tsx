import { useState } from 'react'
import { useNavigate } from 'react-router'

import { getApiRequestProfile } from '@/api/client'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { DelegationModelRoute } from '@/hermes'
import { GitFork, ShieldLock } from '@/lib/icons'

import { useOwnerCatalog } from './delegation-model-provider-field'
import { chooseDelegationMode, saveModelRoutes, useDelegationRouting } from './delegation/routing-data'
import { SettingsSection } from './primitives'

const LABELS: Record<string, string> = {
  executor: 'Executor principal',
  'executor-flash': 'Executor alternativo · Flash',
  'architect-medium': 'Arquiteto · Sol Medium',
  'architect-high': 'Escalada excepcional · Sol High',
  'architect-argon-low': 'Arquiteto pago · Argon Low',
  'architect-argon-medium': 'Arquiteto pago · Argon Medium',
  'reviewer-argon-low': 'Revisor pago · Argon Low',
  'reviewer-argon-medium': 'Revisor pago · Argon Medium'
}

const APPROVED_FLASH_IDENTITIES = ['guilhermeguto5', 'nathguijustino'] as const

/** Configuration is user-editable; changing an executor is not a contract violation.
 * Safeguards for optional paid or cross-account routes are shown separately. */
export function routeConfigured(route: DelegationModelRoute): boolean {
  return Boolean(route.name?.trim() && route.model?.trim() && route.provider?.trim() &&
    route.reasoning_effort?.trim())
}

export function AdaptiveRoutingSettings({ scopeProfile }: { scopeProfile?: string }) {
  const scope = scopeProfile ?? getApiRequestProfile()
  const isQlikDeveloper = scope === 'qlik-developer'
  const query = useDelegationRouting(scope)
  const { providers } = useOwnerCatalog(scope)
  const navigate = useNavigate()
  const [saving, setSaving] = useState<string | null>(null)
  const routing = query.data
  const routes = routing?.model_map.options ?? []
  const mode = routing?.configured ?? ''
  const providerNames = new Map(providers.map(provider => [provider.slug, provider.name]))

  async function updateFlashAccount(provider: string) {
    if (!routing || mode !== 'model_map' || saving) {return}
    const current = routes.find((route: DelegationModelRoute) => route.name === 'executor-flash')

    if (!current || !routeConfigured(current) || !APPROVED_FLASH_IDENTITIES.includes(provider as typeof APPROVED_FLASH_IDENTITIES[number])) {return}
    setSaving('executor-flash')

    try {
      await saveModelRoutes(scope, {
        ...routing.model_map,
        options: routes.map((route: DelegationModelRoute) => route.name === current.name ? { ...route, provider } : route)
      }, 'Não foi possível atualizar a conta OAuth do Flash.')
    } finally {
      setSaving(null)
    }
  }

  return (
    <div className="grid gap-5" data-slot="adaptive-routing-settings">
      <SettingsSection icon={GitFork} title={`Adaptive Routing · ${scope}`}>
        <p className="mb-3 text-sm text-(--ui-text-secondary)">
          {isQlikDeveloper
            ? 'Executor e modelos selecionáveis por perfil. O Qlik Developer mantém a triagem Jev e registra as decisões no ledger.'
            : 'Rotas de delegação opcionais deste perfil. Ativar o mapa não implementa automaticamente a triagem Jev do Qlik Developer, nem troca o modelo principal por mensagem.'}
        </p>
        {query.isError ? (
          <div className="grid gap-2 text-sm" role="alert">
            Não foi possível ler as rotas reais do Hermes.
            <Button onClick={() => void query.refetch()} size="sm" variant="secondary">Tentar novamente</Button>
          </div>
        ) : !routing ? (
          <p className="text-sm text-(--ui-text-tertiary)" role="status">Carregando rotas do gateway…</p>
        ) : (
          <>
            <div className="mb-3 flex items-center justify-between rounded-lg border border-(--ui-stroke-tertiary) p-3">
              <div>
                <div className="text-sm font-medium">Backend de delegação</div>
                <div className="text-xs text-(--ui-text-secondary)">{mode === 'model_map' ? 'Mapa de modelos ativo' : `Modo atual: ${mode}`}</div>
              </div>
              {mode !== 'model_map' && (
                <Button disabled={saving !== null} onClick={() => void chooseDelegationMode(scope, 'model_map', 'Não foi possível ativar o mapa de modelos.')} size="sm"
                  variant="secondary">
                  Ativar mapa
                </Button>
              )}
            </div>
            <div className="grid gap-2">
              {routes.map((route: DelegationModelRoute) => {
                const configured = routeConfigured(route)
                const isFlash = isQlikDeveloper && route.name === 'executor-flash'

                return (
                  <div className="grid gap-2 rounded-lg border border-(--ui-stroke-tertiary) p-3" data-testid={`adaptive-route-${route.name}`}
                    key={route.name}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="text-sm font-medium">{LABELS[route.name] ?? route.name}</div>
                      <span className={`text-xs ${configured ? 'text-(--ui-text-tertiary)' : 'text-amber-500'}`}>
                        {configured ? 'Configurado' : 'Incompleto: revise os campos'}
                      </span>
                    </div>
                    <div className="font-mono text-xs text-(--ui-text-secondary)">
                      {route.model} · {route.reasoning_effort ?? 'herdado'} · {providerNames.get(route.provider ?? '') ?? route.provider ?? 'sem provedor'}
                    </div>
                    <p className="text-xs text-(--ui-text-tertiary)">{route.description}</p>
                    {isFlash && configured ? (
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs text-(--ui-text-secondary)">Conta OAuth Flash:</span>
                        <Select disabled={saving !== null || mode !== 'model_map'} onValueChange={value => void updateFlashAccount(value)} value={route.provider}>
                          <SelectTrigger aria-label="Conta Antigravity do Flash" className="w-48"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="guilhermeguto5">guilhermeguto5</SelectItem>
                            <SelectItem value="nathguijustino">nathguijustino</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    ) : null}
                    {route.name.includes('argon') && (
                      <p className="text-xs text-amber-500">API paga. Apenas arquitetura/revisão Low ou Medium, com triagem e aprovação humana por decisão.</p>
                    )}
                  </div>
                )
              })}
            </div>
          </>
        )}
      </SettingsSection>
      <SettingsSection icon={ShieldLock} title="Controles e alterações avançadas">
        <p className="mb-3 text-sm text-(--ui-text-secondary)">
          {isQlikDeveloper
            ? 'O modelo do executor pode ser alterado livremente. Rotas pagas e mudanças de provedor exigem revisão de permissões antes do uso real.'
            : 'As rotas deste perfil são independentes do Qlik. Antes de ativá-las, valide provedores, acesso e políticas de delegação. Nenhum modelo pago deve ser selecionado automaticamente.'}
          Use o editor avançado para alterações de modelo ou papel.
        </p>
        <Button onClick={() => navigate('/settings?tab=config:model&page=delegation')} variant="secondary">
          Abrir editor avançado de subagentes
        </Button>
        <a className="mt-3 block text-xs text-(--ui-text-secondary) underline" href="https://hermes.meucofre.app/model-routing" rel="noopener noreferrer" target="_blank">
          Abrir Dashboard · Model Routing (histórico, decisões, verificações e custos)
        </a>
      </SettingsSection>
    </div>
  )
}

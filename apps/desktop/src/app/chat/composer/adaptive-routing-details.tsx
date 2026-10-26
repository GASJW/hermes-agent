import { useNavigate } from 'react-router'

import { useDelegationRouting } from '@/app/settings/delegation/routing-data'
import { Button } from '@/components/ui/button'
import type { DelegationModelRoute } from '@/hermes'

const DISPLAY_ROUTES = [
  { name: 'executor', title: 'Executor principal' },
  { name: 'architect-medium', title: 'Arquiteto · Sol Medium' },
  { name: 'architect-high', title: 'Exceção · Sol High' },
  { name: 'executor-flash', title: 'Alternativo · Flash' },
  { name: 'architect-argon-medium', title: 'Pago · Argon' }
] as const

/** Shows observed configuration, never presents the configured model as an
 * observed per-turn decision. The latter lives in the routing ledger/dashboard. */
export function AdaptiveRoutingDetails({ onClose, profile }: { onClose: () => void; profile: string }) {
  const navigate = useNavigate()
  const query = useDelegationRouting(profile)
  const routing = query.data

  return (
    <section aria-label="Detalhes do Adaptive Routing" className="border-b border-(--ui-stroke-tertiary) px-3 py-3"
      data-slot="adaptive-routing-details">
      <div className="text-xs font-semibold text-foreground">Adaptive Routing · escolhas configuradas</div>
      <p className="my-2 text-[0.7rem] text-(--ui-text-secondary)">
        Rotas configuradas para o perfil selecionado; delegações não são trocas automáticas por mensagem.
      </p>
      {routing ? (
        <div className="grid gap-1.5">
          {routing.model_map.options.map((route: DelegationModelRoute) => {
            const item = DISPLAY_ROUTES.find(candidate => candidate.name === route.name)

            return (
              <div className="flex items-start justify-between gap-2 text-[0.7rem]" key={route.name}>
                <span className="text-(--ui-text-secondary)">{item?.title ?? route.name}</span>
                <span className="max-w-36 truncate text-right font-mono" title={`${route.model} · ${route.provider}`}>
                  {`${route.model} · ${route.reasoning_effort ?? '—'}`}
                </span>
              </div>
            )
          })}
        </div>
      ) : (
        <p className="text-xs text-(--ui-text-tertiary)" role="status">
          {query.isError ? 'Configuração indisponível no gateway.' : 'Consultando rotas…'}
        </p>
      )}
      <p className="my-2 text-[0.68rem] text-(--ui-text-tertiary)">
        Decisão da mensagem atual: não exposta nesta interface. Consulte o ledger no Dashboard.
      </p>
      <Button className="w-full" onClick={() => {
        onClose()
        navigate('/settings?tab=config:model&page=adaptive')
      }} size="sm" variant="secondary">
        Configurações · Adaptive Routing
      </Button>
    </section>
  )
}

import { createFileRoute } from "@tanstack/react-router";
import { partyQuery } from '@/lib/party.queries';
import { PartyList } from '@/components/party-list';
import { EventManagerPreview } from '@/components/event-manager-preview';

const isPreview = import.meta.env.VITE_FESTOU_PREVIEW === "true";

export const Route = createFileRoute("/")({
  loader: ({ context }) => isPreview ? undefined : context.queryClient.ensureQueryData(partyQuery),
  head: () => ({ meta: [
    { title: isPreview ? 'Festou! · Prévia da gestão de eventos' : 'Festa na Chácara · Lista da festa' },
    { name: 'description', content: isPreview ? 'Prévia isolada da gestão de eventos com dados fictícios.' : 'Escolha o que vai levar e participe da organização da Festa na Chácara. Uma lista compartilhada para família e amigos.' },
    { name: 'robots', content: isPreview ? 'noindex,nofollow' : 'index,follow' },
    { property: 'og:title', content: isPreview ? 'Festou! · Prévia' : 'Festa na Chácara · Uma festa feita por todos' },
    { property: 'og:description', content: isPreview ? 'Ambiente local de teste da gestão de eventos.' : 'Mantimentos, lanches, churrasco e bebidas: combine sua contribuição na lista compartilhada da festa.' },
    { property: 'og:type', content: 'website' },
    { name: 'twitter:card', content: 'summary_large_image' },
    { name: 'theme-color', content: '#21613f' },
  ] }),
  component: () => isPreview ? <PreviewPage /> : <PartyList />,
});

function PreviewPage() {
  return <main className="min-h-screen bg-background p-4 md:p-8">
    <div className="mx-auto max-w-5xl space-y-4">
      <header>
        <p className="text-2xl font-bold">Festou!</p>
        <p className="text-sm text-muted-foreground">Prévia funcional · dados fictícios armazenados somente neste navegador</p>
      </header>
      <div className="rounded-xl border bg-card p-4">
        <EventManagerPreview password="demo-local-only" />
      </div>
      <p className="text-xs text-muted-foreground">Modo isolado: não conecta ao Supabase. Comprovantes não são enviados; somente metadados são simulados.</p>
      <button className="text-sm underline" onClick={() => { localStorage.removeItem("festou-event-manager-demo-v1"); location.reload(); }}>Restaurar dados iniciais</button>
    </div>
  </main>;
}

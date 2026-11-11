import { createFileRoute } from "@tanstack/react-router";
import { partyQuery } from '@/lib/party.queries';
import { PartyList } from '@/components/party-list';

// The home route ships no og:image, so serve-time hosting can inject the
// project's social preview (explicit og:image or latest screenshot).
export const Route = createFileRoute("/")({
  loader: ({ context }) => context.queryClient.ensureQueryData(partyQuery),
  head: () => ({ meta: [
    { title: 'Festa na Chácara · Lista da festa' },
    { name: 'description', content: 'Escolha o que vai levar e participe da organização da Festa na Chácara. Uma lista compartilhada para família e amigos.' },
    { property: 'og:title', content: 'Festa na Chácara · Uma festa feita por todos' },
    { property: 'og:description', content: 'Mantimentos, lanches, churrasco e bebidas: combine sua contribuição na lista compartilhada da festa.' },
    { property: 'og:type', content: 'website' },
    { name: 'twitter:card', content: 'summary_large_image' },
    { name: 'theme-color', content: '#21613f' },
  ] }),
  component: PartyList,
});

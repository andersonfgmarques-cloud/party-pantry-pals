import { createFileRoute } from "@tanstack/react-router";
import { EventManagerPreview } from "@/components/event-manager-preview";
export const Route = createFileRoute("/preview")({
 head:()=>({meta:[{title:"Festou! · Prévia da gestão de eventos"},{name:"robots",content:"noindex"}]}),
 component:PreviewPage,
});
function PreviewPage(){return <main className="min-h-screen bg-background p-4 md:p-8"><div className="mx-auto max-w-5xl space-y-4"><header><p className="text-2xl font-bold">Festou!</p><p className="text-sm text-muted-foreground">Prévia funcional · dados fictícios armazenados somente neste navegador</p></header><div className="rounded-xl border bg-card p-4"><EventManagerPreview password="demo-local-only" /></div><p className="text-xs text-muted-foreground">Modo isolado: não conecta ao Supabase. Comprovantes não são enviados; apenas os metadados do arquivo são simulados.</p><button className="text-sm underline" onClick={()=>{localStorage.removeItem("festou-event-manager-demo-v1");location.reload()}}>Restaurar dados iniciais</button></div></main>}

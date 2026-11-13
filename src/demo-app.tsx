import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, Check, ChevronDown, CirclePlus, ClipboardList, RotateCcw, ShieldCheck, Users } from 'lucide-react';

type Item = { id: string; name: string; category: string; quantity: number; unit: string; reservedBy: string[]; received: boolean };
type DemoState = { items: Item[]; people: { name: string; collaborator: boolean }[] };
const STORAGE_KEY = 'festou-demo-state-v1';
const initialState: DemoState = {
  people: [{ name: 'Ana', collaborator: false }, { name: 'Carlos', collaborator: true }, { name: 'Mariana', collaborator: false }],
  items: [
    { id: 'i1', name: 'Refrigerante', category: 'Bebidas', quantity: 6, unit: 'garrafas', reservedBy: ['Ana'], received: false },
    { id: 'i2', name: 'Pão de alho', category: 'Churrasco', quantity: 4, unit: 'pacotes', reservedBy: ['Carlos'], received: false },
    { id: 'i3', name: 'Arroz', category: 'Mantimentos', quantity: 2, unit: 'pacotes', reservedBy: [], received: false },
    { id: 'i4', name: 'Bolo de aniversário', category: 'Doces', quantity: 1, unit: 'unidade', reservedBy: [], received: false },
    { id: 'i5', name: 'Carvão', category: 'Churrasco', quantity: 3, unit: 'sacos', reservedBy: ['Mariana'], received: true },
  ],
};
function loadState(): DemoState {
  try { const raw = localStorage.getItem(STORAGE_KEY); if (raw) return JSON.parse(raw) as DemoState; } catch { /* demo storage unavailable */ }
  return initialState;
}
export function DemoApp() {
  const [state, setState] = useState<DemoState>(loadState);
  const [activeName, setActiveName] = useState('Ana');
  const [organizer, setOrganizer] = useState(false);
  const [newName, setNewName] = useState('');
  const [newItem, setNewItem] = useState('');
  const [newQuantity, setNewQuantity] = useState('1');
  const [newUnit, setNewUnit] = useState('unidade');
  const [category, setCategory] = useState('Mantimentos');
  const [showAdd, setShowAdd] = useState(false);
  const [notice, setNotice] = useState('Este ambiente usa somente dados fictícios.');
  useEffect(() => { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { setNotice('Armazenamento local indisponível; as alterações valem apenas nesta sessão.'); } }, [state]);
  const person = state.people.find(p => p.name === activeName);
  const canManage = organizer || !!person?.collaborator;
  const reservedCount = useMemo(() => state.items.filter(i => i.reservedBy.length > 0).length, [state.items]);
  function updateItem(id: string, updater: (item: Item) => Item) { setState(s => ({ ...s, items: s.items.map(i => i.id === id ? updater(i) : i) })); }
  function toggleReservation(item: Item) {
    updateItem(item.id, current => ({ ...current, reservedBy: current.reservedBy.includes(activeName) ? current.reservedBy.filter(n => n !== activeName) : [...current.reservedBy, activeName] }));
    setNotice(item.reservedBy.includes(activeName) ? 'Sua reserva de demonstração foi retirada.' : 'Item reservado neste ambiente de demonstração.');
  }
  function addParticipant() {
    const name = newName.trim();
    if (name.length < 2 || state.people.some(p => p.name.toLowerCase() === name.toLowerCase())) { setNotice('Informe um nome novo com pelo menos 2 caracteres.'); return; }
    setState(s => ({ ...s, people: [...s.people, { name, collaborator: false }] })); setActiveName(name); setNewName(''); setNotice('Participante fictício adicionado.');
  }
  function addItem() {
    if (!newItem.trim()) return;
    setState(s => ({ ...s, items: [...s.items, { id: crypto.randomUUID(), name: newItem.trim(), category, quantity: Math.max(1, Number(newQuantity) || 1), unit: newUnit.trim() || 'unidade', reservedBy: [], received: false }] }));
    setNewItem(''); setShowAdd(false); setNotice('Item adicionado apenas à demonstração.');
  }
  function reset() { setState(initialState); setActiveName('Ana'); setOrganizer(false); setNotice('Demonstração restaurada para os dados fictícios iniciais.'); }
  return <main className="min-h-screen bg-[#f5f7f3] text-slate-800">
    <div className="border-b border-amber-300 bg-amber-100 px-4 py-3 text-center text-sm font-semibold text-amber-950">
      MODO DEMONSTRAÇÃO · DADOS FICTÍCIOS · NÃO CONECTADO AO SISTEMA OFICIAL
    </div>
    <div className="mx-auto max-w-5xl px-4 py-7 sm:px-6">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div><p className="text-xs font-bold uppercase tracking-[.2em] text-emerald-700">Juntou. Organizou. Festou!</p><h1 className="mt-1 text-3xl font-bold tracking-tight">Festa na Chácara</h1><p className="mt-1 text-sm text-slate-500">Ambiente de testes com uma festa de exemplo</p></div>
        <button onClick={reset} className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold hover:bg-slate-50"><RotateCcw size={16}/> Restaurar demonstração</button>
      </header>
      <section className="mb-5 grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl bg-white p-4 shadow-sm"><div className="flex items-center gap-2 text-sm text-slate-500"><CalendarDays size={17}/> Data do evento</div><p className="mt-2 text-lg font-bold">15 de dezembro de 2026</p></div>
        <div className="rounded-2xl bg-white p-4 shadow-sm"><div className="flex items-center gap-2 text-sm text-slate-500"><ClipboardList size={17}/> Itens na lista</div><p className="mt-2 text-lg font-bold">{state.items.length} itens</p></div>
        <div className="rounded-2xl bg-white p-4 shadow-sm"><div className="flex items-center gap-2 text-sm text-slate-500"><Users size={17}/> Participantes</div><p className="mt-2 text-lg font-bold">{state.people.length} pessoas</p></div>
      </section>
      <section className="mb-5 rounded-2xl border border-emerald-100 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-end gap-3">
          <label className="min-w-[190px] flex-1 text-sm font-semibold">Testar como participante<select value={activeName} onChange={e=>setActiveName(e.target.value)} className="mt-1 block w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 font-normal">{state.people.map(p=><option key={p.name}>{p.name}</option>)}</select></label>
          <label className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-3 text-sm"><input type="checkbox" checked={organizer} onChange={e=>setOrganizer(e.target.checked)}/> Simular organizador</label>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500"><ShieldCheck size={15}/>{organizer ? 'Permissões de organizador simuladas.' : person?.collaborator ? 'Este participante está testando permissões de colaborador.' : 'Participante comum: pode reservar e retirar suas próprias reservas.'}</div>
        <div className="mt-3 flex gap-2"><input value={newName} onChange={e=>setNewName(e.target.value)} placeholder="Adicionar participante fictício" className="min-w-0 flex-1 rounded-xl border border-slate-300 px-3 py-2 text-sm"/><button onClick={addParticipant} className="rounded-xl bg-slate-800 px-4 py-2 text-sm font-semibold text-white">Adicionar</button></div>
      </section>
      <section className="rounded-2xl bg-white p-4 shadow-sm sm:p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-bold">Lista de contribuições</h2><p className="text-sm text-slate-500">{reservedCount} de {state.items.length} itens com reserva</p></div>{canManage && <button onClick={()=>setShowAdd(v=>!v)} className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-3 py-2 text-sm font-semibold text-white"><CirclePlus size={16}/> Adicionar item</button>}</div>
        {showAdd && <div className="mb-4 grid gap-2 rounded-xl bg-emerald-50 p-3 sm:grid-cols-5"><input value={newItem} onChange={e=>setNewItem(e.target.value)} placeholder="Nome do item" className="rounded-lg border px-3 py-2 sm:col-span-2"/><select value={category} onChange={e=>setCategory(e.target.value)} className="rounded-lg border px-3 py-2">{['Mantimentos','Bebidas','Churrasco','Doces','Outros'].map(c=><option key={c}>{c}</option>)}</select><input type="number" min="1" value={newQuantity} onChange={e=>setNewQuantity(e.target.value)} className="rounded-lg border px-3 py-2"/><div className="flex gap-2"><input value={newUnit} onChange={e=>setNewUnit(e.target.value)} className="min-w-0 w-full rounded-lg border px-2 py-2"/><button onClick={addItem} className="rounded-lg bg-emerald-700 px-3 text-white">OK</button></div></div>}
        <div className="space-y-3">{state.items.map(item=><article key={item.id} className="rounded-xl border border-slate-200 p-3"><div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold">{item.name}</h3><span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">{item.category}</span>{item.received&&<span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-800">Recebido</span>}</div><p className="mt-1 text-sm text-slate-500">Quantidade: {item.quantity} {item.unit}</p><p className="mt-1 text-sm text-slate-600">{item.reservedBy.length ? 'Responsável: '+item.reservedBy.join(', ') : 'Ainda disponível'}</p></div><div className="flex flex-wrap gap-2">{!item.received&&<button onClick={()=>toggleReservation(item)} className={'rounded-lg px-3 py-2 text-sm font-semibold '+(item.reservedBy.includes(activeName)?'border border-slate-300 bg-white':'bg-emerald-700 text-white')}>{item.reservedBy.includes(activeName)?'Retirar minha reserva':'Vou levar'}</button>}{canManage&&<><button onClick={()=>updateItem(item.id,i=>({...i,received:!i.received}))} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">{item.received?'Desmarcar recebido':'Marcar recebido'}</button><button onClick={()=>setState(s=>({...s,items:s.items.filter(i=>i.id!==item.id)}))} className="rounded-lg border border-red-200 px-3 py-2 text-sm text-red-700">Excluir</button></>}</div></div></article>)}</div>
      </section>
      <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><h2 className="font-bold">Permissões de colaborador (simulação)</h2><p className="mt-1 text-sm text-slate-500">O organizador pode conceder ou retirar a função. O colaborador pode administrar itens nesta demonstração.</p>{organizer ? <div className="mt-3 space-y-2">{state.people.map(p=><label key={p.name} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm"><span>{p.name}</span><span className="flex items-center gap-2"><input type="checkbox" checked={p.collaborator} onChange={e=>setState(s=>({...s,people:s.people.map(x=>x.name===p.name?{...x,collaborator:e.target.checked}:x)}))}/> Colaborador</span></label>)}</div> : <p className="mt-3 text-sm font-medium text-slate-700">Ative “Simular organizador” para testar a gestão de colaboradores.</p>}</section>
      <p role="status" className="mt-4 rounded-xl bg-slate-100 px-3 py-2 text-sm text-slate-600">{notice}</p>
      <p className="mt-5 text-center text-xs text-slate-400">As alterações ficam somente neste navegador, na chave local festou-demo-state-v1. Nenhum dado é enviado ao Supabase.</p>
    </div>
  </main>;
}

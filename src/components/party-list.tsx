import { useEffect, useState, type FormEvent } from 'react';
import { useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { TreePine, CalendarDays, Users, Plus, Search, Coffee, Sandwich, Beef, Flame, CakeSlice, GlassWater, ListChecks, Check, Package, ArrowUpRight, Share2, LockKeyhole, Heart, X, Pencil, Trash2, Download, Settings2, CheckCheck, ShoppingBag, Leaf, ClipboardList, Bell, BellRing, Cake, ImagePlus, Dices } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { partyQuery } from '@/lib/party.queries';
import { identifyParticipant, changeParty, getPartyNotifications, markPartyNotificationRead, savePushSubscription, getPushPublicKey, type PartyNotification } from '@/lib/party.functions';
import { reservedFor, itemStatus, remainingFor, number, statusLabels, type Product } from '@/lib/party';
import garden from '@/assets/chacara-garden.jpg';

const icons = [Coffee, Sandwich, Beef, Flame, CakeSlice, GlassWater];
type Modal = 'identity' | 'add' | 'reserve' | 'login' | 'settings' | 'edit' | 'participants' | 'stats' | 'finance' | 'adjust' | 'notifications' | 'birthday' | 'roulette' | null;
type StatsKind = 'items' | 'assumed' | 'available' | 'people';
type Identity = { id: string; name: string; token: string };
export function PartyList() {
  const { data } = useSuspenseQuery(partyQuery);
  const qc = useQueryClient();
  const identify = identifyParticipant;
  const mutate = changeParty;
  const [person, setPerson] = useState<Identity | null>(null);
  const [modal, setModal] = useState<Modal>(null);
  const [selected, setSelected] = useState<Product | null>(null);
  const [pendingModal, setPendingModal] = useState<Modal>(null);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [category, setCategory] = useState(0);
  const [search, setSearch] = useState('');
  const [view, setView] = useState('all');
  const [status, setStatus] = useState('all');
  const [online, setOnline] = useState(true);
  const [participants, setParticipants] = useState<{ id: string; name: string; created_at: string | null }[]>([]);
  const [statsKind, setStatsKind] = useState<StatsKind>('items');
  const [notifications, setNotifications] = useState<PartyNotification[]>([]);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [partyDates, setPartyDates] = useState<string[]>([]);
  const [newPartyDate, setNewPartyDate] = useState('');
  const [selectedBirthday, setSelectedBirthday] = useState<{ id: string; name: string; photo_path: string } | null>(null);
  const [rouletteCategory, setRouletteCategory] = useState(0);
  const [rouletteResult, setRouletteResult] = useState<Product | null>(null);
  const [rouletteRotation, setRouletteRotation] = useState(0);
  const [rouletteSpinning, setRouletteSpinning] = useState(false);
  const [adjustingReservation, setAdjustingReservation] = useState<{ id: string; quantity: number; productName: string; unit: string } | null>(null);
  useEffect(() => {
    try { const stored = localStorage.getItem('party-identity'); if (stored) { const p = JSON.parse(stored); if (p.token && p.name && p.id) setPerson(p); } } catch { /* unavailable storage */ }
    const updateOnline = () => setOnline(navigator.onLine);
    updateOnline(); window.addEventListener('online', updateOnline); window.addEventListener('offline', updateOnline);
    const refresh = () => qc.invalidateQueries({ queryKey: ['party'] });
    const channel = supabase.channel(`party-${crypto.randomUUID()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'party_products' }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'party_reservations' }, payload => {
        refresh();
        if (payload.eventType === 'INSERT') {
          const row = payload.new as { participant_name?: string; product_id?: string; quantity?: number };
          const current = qc.getQueryData<{ products: Product[] }>(['party']);
          const product = current?.products.find(p => p.id === row.product_id);
          toast.info(`${row.participant_name ?? 'Alguém'} assumiu ${product?.name ?? 'um item'}${row.quantity ? ` · ${number(Number(row.quantity))} ${product?.unit ?? ''}` : ''}`);
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'party_event' }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'party_expenses' }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'party_birthday_people' }, refresh)
      .subscribe();
    const focus = () => qc.invalidateQueries({ queryKey: ['party'] }); window.addEventListener('focus', focus);
    return () => { supabase.removeChannel(channel); window.removeEventListener('focus', focus); window.removeEventListener('online', updateOnline); window.removeEventListener('offline', updateOnline); };
  }, [qc]);
  const total = data.products.length;
  const assumed = data.products.filter(p => reservedFor(p.id, data.reservations) > 0 || p.received).length;
  const completed = data.products.filter(p => ['complete','received'].includes(itemStatus(p, reservedFor(p.id, data.reservations)))).length;
  const progress = total ? Math.round(completed / total * 100) : 0;
  const people = new Set(data.reservations.map(r => r.participant_name.trim().normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').toLocaleLowerCase('pt-BR'))).size;
  const configuredDates = data.event.party_dates?.length ? [...data.event.party_dates].sort() : data.event.party_date ? [data.event.party_date] : [];
  const startDate = configuredDates[0] ? new Date(`${configuredDates[0]}T12:00:00`) : null;
  const endDate = configuredDates.at(-1) ? new Date(`${configuredDates.at(-1)}T12:00:00`) : startDate;
  const dateFmt = (date: Date, options: Intl.DateTimeFormatOptions = {}) => date.toLocaleDateString('pt-BR', options);
  const dateLabel = (() => {
    if (!configuredDates.length) return 'Data a definir';
    const dates = configuredDates.map(value => new Date(value + 'T12:00:00'));
    const sameMonth = dates.every(date => date.getMonth() === dates[0]!.getMonth() && date.getFullYear() === dates[0]!.getFullYear());
    if (sameMonth) {
      const days = dates.map(date => dateFmt(date, { day: 'numeric' }));
      const dayList = days.length === 1 ? days[0]! : days.length === 2 ? days.join(' e ') : days.slice(0, -1).join(', ') + ' e ' + days[days.length - 1]!;
      return dayList + ' de ' + dateFmt(dates[0]!, { month: 'long', year: 'numeric' });
    }
    const sameYear = dates.every(date => date.getFullYear() === dates[0]!.getFullYear());
    return dates.map((date, index) => dateFmt(date, { day: 'numeric', month: 'long', ...(!sameYear || index === dates.length - 1 ? { year: 'numeric' as const } : {}) })).join(', ');
  })();
  const daysUntilParty = configuredDates[0] ? Math.ceil((new Date(`${configuredDates[0]}T00:00:00`).getTime() - new Date(new Date().toDateString()).getTime()) / 86400000) : null;
  const countdownLabel = daysUntilParty === null ? 'Data a definir' : daysUntilParty < 0 ? 'Evento já realizado' : daysUntilParty === 0 ? 'É hoje!' : `Faltam ${daysUntilParty} dias`;
  const visible = data.products.filter(p => (!category || p.category_id === category) && p.name.toLocaleLowerCase('pt-BR').includes(search.toLocaleLowerCase('pt-BR')) && (view !== 'mine' || data.reservations.some(r => r.product_id === p.id && r.participant_id === person?.id)) && (status === 'all' || status === itemStatus(p, reservedFor(p.id, data.reservations))));
  function open(next: Modal, product?: Product) { setSelected(product ?? null); if (['add','reserve'].includes(next ?? '') && !person && !password) { setPendingModal(next); setModal('identity'); } else setModal(next); }
  async function act(input: Parameters<typeof mutate>[0]['data'], message: string) {
    if (!online) { toast.error('Conecte-se à internet para atualizar a lista.'); return false; }
    setBusy(true);
    try { await mutate({ data: { ...input, ...(password ? { password } : { token: person?.token }) } }); await qc.invalidateQueries({ queryKey: ['party'] }); toast.success(message); return true; } catch (e) { toast.error(e instanceof Error ? e.message : 'Não foi possível salvar.'); return false; } finally { setBusy(false); }
  }

  async function openNotifications() {
    if (!person) { setPendingModal('notifications'); setModal('identity'); return; }
    try { setNotifications(await getPartyNotifications(person.token)); setModal('notifications'); }
    catch { toast.error('Não foi possível carregar as notificações.'); }
  }
  async function enablePushNotifications() {
    if (!person) { toast.info('Informe seu nome antes de ativar as notificações.'); setPendingModal('notifications'); setModal('identity'); return; }
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
      toast.error('Este navegador não oferece suporte a notificações push.'); return;
    }
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') { toast.info('Permissão de notificações não concedida.'); return; }
      const registration = await navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`, { scope: import.meta.env.BASE_URL });
      const key = await getPushPublicKey();
      const applicationServerKey = Uint8Array.from(atob(key.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
      const subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey });
      await savePushSubscription(person.token, subscription);
      setPushEnabled(true);
      toast.success('Notificações ativadas neste dispositivo!');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível ativar as notificações.');
    }
  }
  async function readNotification(notification: PartyNotification) {
    if (!person || notification.read_at) return;
    try {
      await markPartyNotificationRead(person.token, notification.id);
      setNotifications(current => current.map(item => item.id === notification.id ? { ...item, read_at: new Date().toISOString() } : item));
    } catch { toast.error('Não foi possível atualizar a notificação.'); }
  }
  async function submitIdentity(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); const form = new FormData(e.currentTarget); setBusy(true);
    try { const token = person?.token ?? crypto.randomUUID(); const row = await identify({ data: { name: String(form.get('name')), token } }); const p = { ...row, token }; setPerson(p); try { localStorage.setItem('party-identity', JSON.stringify(p)); } catch { toast.info('Seu nome não poderá ser lembrado neste dispositivo.'); } setModal(pendingModal); setPendingModal(null); toast.success(`Que bom ter você, ${row.name}!`); } catch(e) { toast.error(e instanceof Error ? e.message : 'Não foi possível salvar seu nome.'); } finally { setBusy(false); }
  }
  async function submitProduct(e: FormEvent<HTMLFormElement>) { e.preventDefault(); const f = new FormData(e.currentTarget); const ok = await act({ action: modal === 'edit' ? 'edit' : 'add', id: modal === 'edit' ? selected?.id : undefined, name: String(f.get('name')), categoryId: Number(f.get('category')), quantity: f.get('quantity') ? Number(f.get('quantity')) : null, unit: String(f.get('unit')), note: String(f.get('note') ?? '') }, modal === 'edit' ? 'Item atualizado!' : 'Item adicionado à lista!'); if (ok) setModal(null); }
  async function submitReserve(e: FormEvent<HTMLFormElement>) { e.preventDefault(); if (!selected) return; const f = new FormData(e.currentTarget); const source = f.get('source') === 'home' ? 'home' : 'buy'; const ok = await act({ action: 'reserve', id: selected.id, quantity: Number(f.get('quantity')), source, participantId: password ? String(f.get('participant')) : undefined }, 'Combinado! Sua contribuição foi reservada.'); if (ok) setModal(null); }
  async function submitAdjustment(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!adjustingReservation) return;
    const f = new FormData(e.currentTarget);
    const quantity = Number(f.get('quantity'));
    if (!Number.isFinite(quantity) || quantity <= 0 || quantity >= adjustingReservation.quantity) {
      toast.error('Informe uma quantidade menor que a atual.');
      return;
    }
    const released = adjustingReservation.quantity - quantity;
    const ok = await act({ action: 'adjust_reservation', id: adjustingReservation.id, quantity }, `Contribuição ajustada. ${number(released)} ${adjustingReservation.unit} liberados para outras pessoas.`);
    if (ok) { setModal(null); setAdjustingReservation(null); }
  }

  const rouletteItems = data.products.filter(product => {
    const reserved = reservedFor(product.id, data.reservations);
    const remaining = remainingFor(product, reserved);
    const state = itemStatus(product, reserved);
    return (!rouletteCategory || product.category_id === rouletteCategory) && !product.received && state !== 'complete' && state !== 'received' && (remaining === null || remaining > 0);
  });
  function spinRoulette() {
    if (rouletteSpinning || rouletteItems.length === 0) return;
    const chosen = rouletteItems[Math.floor(Math.random() * rouletteItems.length)]!;
    setRouletteResult(null); setRouletteSpinning(true);
    setRouletteRotation(current => current + 1440 + Math.floor(Math.random() * 360) + 1);
    window.setTimeout(() => { setRouletteResult(chosen); setRouletteSpinning(false); }, 3800);
  }
  function openEventSettings() { const dates = data.event.party_dates?.length ? [...data.event.party_dates].sort() : data.event.party_date ? [data.event.party_date] : []; setPartyDates(dates); setNewPartyDate(''); setModal('settings'); }
  function addPartyDate() { if (!newPartyDate) return; if (partyDates.includes(newPartyDate)) { toast.info('Esse dia já foi adicionado.'); return; } if (partyDates.length >= 90) { toast.error('O limite é de 90 datas por evento.'); return; } setPartyDates([...partyDates, newPartyDate].sort()); setNewPartyDate(''); }
  async function submitBirthday(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const values = new FormData(form);
    const name = String(values.get('name') ?? '').trim();
    const file = values.get('photo');
    if (!name) { toast.error('Informe o nome.'); return; }
    let photoData: string | undefined;
    if (file instanceof File && file.size > 0) {
      if (!['image/jpeg','image/png','image/webp'].includes(file.type) || file.size > 3 * 1024 * 1024) {
        toast.error('Escolha uma foto JPG, PNG ou WebP de até 3 MB.'); return;
      }
      photoData = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('Não foi possível ler a foto.'));
        reader.onerror = () => reject(new Error('Não foi possível ler a foto.'));
        reader.readAsDataURL(file);
      }).catch(error => { toast.error(error instanceof Error ? error.message : 'Erro ao ler a foto.'); return ''; });
      if (!photoData) return;
    } else if (!selectedBirthday) {
      toast.error('Selecione uma foto.'); return;
    }
    const saved = await act({ action: selectedBirthday ? 'birthday_edit' : 'birthday_add', ...(selectedBirthday ? { id: selectedBirthday.id } : {}), name, ...(photoData ? { photoData } : {}) }, selectedBirthday ? 'Aniversariante atualizado!' : 'Aniversariante adicionado!');
    if (saved) { setModal(null); setSelectedBirthday(null); }
  }
  function openBirthdayEditor(person?: { id: string; name: string; photo_path: string }) {
    setSelectedBirthday(person ?? null);
    setModal('birthday');
  }
  async function addExpense(e: FormEvent<HTMLFormElement>) { e.preventDefault(); const f = new FormData(e.currentTarget); const ok = await act({ action: 'expense_add', description: String(f.get('description')), amount: Number(f.get('amount')), paidBy: String(f.get('paidBy')) }, 'Despesa registrada!'); if (ok) (e.currentTarget as HTMLFormElement).reset(); }
  function summary(pending = false) { return `${data.event.name}\n${dateLabel}\n\n` + data.categories.map(c => { const items = data.products.filter(p => p.category_id === c.id && (!pending || !['complete','received'].includes(itemStatus(p, reservedFor(p.id, data.reservations))))); return items.length ? `${c.name.toUpperCase()}\n` + items.map(p => { const reserved = reservedFor(p.id, data.reservations); const remaining = remainingFor(p, reserved); const peopleNames = data.reservations.filter(r => r.product_id === p.id).map(r => `${r.participant_name}: ${number(Number(r.quantity))} ${p.unit}`).join(', '); return `• ${p.name}: ${p.quantity === null ? 'quantidade a definir' : `${number(Number(p.quantity))} ${p.unit}`} | ${statusLabels[itemStatus(p, reserved)]}${remaining !== null ? ` | faltam ${number(remaining)} ${p.unit}` : ''}${peopleNames ? `\n  ${peopleNames}` : ''}`; }).join('\n') : ''; }).filter(Boolean).join('\n\n'); }
  function share(pending = false) { const text = pending ? `${summary(true)}\n\nParticipe: ${window.location.origin}${import.meta.env.BASE_URL}` : `🌿 Festou!\nUma festa feita por todos! Escolha o que você vai levar:\n${window.location.origin}${import.meta.env.BASE_URL}`; window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer'); }
  async function exportReportPdf(title: string, content: string[], filename: string) {
    try {
      const { jsPDF } = await import('jspdf');
      const doc = new jsPDF({ unit: 'mm', format: 'a4' });
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 16;
      let y = 20;
      const writeLine = (line: string, size = 10, bold = false) => {
        doc.setFont('helvetica', bold ? 'bold' : 'normal');
        doc.setFontSize(size);
        const wrapped = doc.splitTextToSize(line, pageWidth - margin * 2);
        for (const part of wrapped) {
          if (y > pageHeight - 18) { doc.addPage(); y = 18; }
          doc.text(part, margin, y);
          y += size * 0.48 + 2;
        }
      };
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(18);
      doc.text('Festou!', margin, y);
      y += 9;
      writeLine(title, 13, true);
      writeLine(data.event.name, 10);
      writeLine(dateLabel, 10);
      writeLine(`Emitido em ${new Date().toLocaleString('pt-BR')}`, 8);
      y += 4;
      doc.setDrawColor(210, 220, 214);
      doc.line(margin, y, pageWidth - margin, y);
      y += 7;
      for (const line of content) {
        if (line === '') { y += 2; continue; }
        writeLine(line, line.startsWith('  ') ? 9 : 10, !line.startsWith('  ') && (line.startsWith('Categoria:') || line.startsWith('Participante:')));
      }
      const pages = doc.getNumberOfPages();
      for (let page = 1; page <= pages; page++) {
        doc.setPage(page);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(120);
        doc.text(`Festou! · Página ${page} de ${pages}`, pageWidth / 2, pageHeight - 8, { align: 'center' });
      }
      doc.save(filename);
      toast.success('PDF gerado com sucesso!');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível gerar o PDF.');
    }
  }
  function reportLines(kind: StatsKind) {
    if (kind === 'people') return participants.map(p => {
      const entries = data.reservations.filter(r => r.participant_id === p.id);
      return [`Participante: ${p.name}`, ...(entries.length ? entries.map(r => {
        const product = data.products.find(x => x.id === r.product_id);
        return `  • ${product?.name ?? 'Produto'} — ${number(Number(r.quantity))} ${product?.unit ?? ''} (${r.source === 'home' ? 'Já tem em casa' : 'Vai comprar'})`;
      }) : ['  Sem contribuições registradas']), ''];
    }).flat();
    const products = data.products.filter(p => kind === 'items' || (kind === 'assumed'
      ? reservedFor(p.id, data.reservations) > 0 || p.received
      : !p.received && itemStatus(p, reservedFor(p.id, data.reservations)) !== 'complete'));
    return products.flatMap(p => {
      const taken = reservedFor(p.id, data.reservations);
      const categoryName = data.categories.find(c => c.id === p.category_id)?.name ?? 'Sem categoria';
      const reservations = data.reservations.filter(r => r.product_id === p.id);
      const statusText = p.received ? 'Recebido' : itemStatus(p, taken) === 'complete' ? 'Completo' : taken > 0 ? 'Parcialmente reservado' : 'Disponível';
      return [
        `Categoria: ${categoryName}`,
        `${p.name} — Necessário: ${p.quantity === null ? 'A definir' : `${number(Number(p.quantity))} ${p.unit}`}`,
        `  Situação: ${statusText}${remainingFor(p, taken) === null ? '' : ` · Faltam ${number(remainingFor(p, taken)!)} ${p.unit}`}`,
        ...(reservations.length ? reservations.map(r => `  • ${r.participant_name}: ${number(Number(r.quantity))} ${p.unit}`) : ['  Ninguém assumiu este item']),
        ''
      ];
    });
  }
  async function exportStatsPdf(kind: StatsKind = statsKind) {
    const titles = { items: 'Lista completa de itens', assumed: 'Itens assumidos', available: 'Itens ainda disponíveis', people: 'Participantes e contribuições' };
    const content = kind === 'people' ? reportLines(kind) : reportLines(kind);
    await exportReportPdf(titles[kind], content, `festou-${kind}.pdf`);
  }
  async function exportParticipantPdf(p: { id: string; name: string }) {
    const entries = data.reservations.filter(r => r.participant_id === p.id);
    const lines = entries.length ? entries.flatMap(r => {
      const product = data.products.find(x => x.id === r.product_id);
      return [`${product?.name ?? 'Produto'} — ${number(Number(r.quantity))} ${product?.unit ?? ''}`, `  ${r.source === 'home' ? 'Já tem em casa' : 'Vai comprar'}`, ''];
    }) : ['Nenhuma contribuição registrada para este participante.'];
    await exportReportPdf(`Lista individual: ${p.name}`, lines, `contribuicoes-${p.name.trim().toLocaleLowerCase('pt-BR').replace(/[^a-z0-9]+/g, '-')}.pdf`);
  }
  async function exportPdf() { await exportReportPdf('Lista completa da festa', summary().split('\\n'), 'festou.pdf'); }
  async function showParticipants() { setBusy(true); try { const result = await mutate({ data: { action: 'participants', password } }); setParticipants(result.participants); setModal('participants'); } catch(e) { toast.error(e instanceof Error ? e.message : 'Erro ao carregar participantes.'); } finally { setBusy(false); } }
  async function openStats(kind: StatsKind) {
    setStatsKind(kind);
    if (kind === 'people') {
      setBusy(true);
      try {
        const result = await mutate({ data: { action: 'public_participants' } });
        setParticipants(result.participants);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Não foi possível carregar os participantes.');
        return;
      } finally { setBusy(false); }
    }
    setModal('stats');
  }
  async function deleteParticipant(p: { id: string; name: string }) {
    if (!password) { toast.error('Ação exclusiva do organizador.'); return; }
    const count = data.reservations.filter(r => r.participant_id === p.id).length;
    const detail = count ? `\n\nAs ${count} contribuições dessa pessoa também serão liberadas.` : '';
    if (!window.confirm(`Excluir ${p.name} da lista de participantes?${detail}\n\nEssa ação não pode ser desfeita.`)) return;
    const ok = await act({ action: 'participant_delete', id: p.id }, `${p.name} foi removido(a) da lista.`);
    if (ok) setParticipants(current => current.filter(item => item.id !== p.id));
  }
  async function openAdminReserve(p: Product) { setBusy(true); try { const result = await mutate({ data: { action: 'participants', password } }); setParticipants(result.participants); setSelected(p); setModal('reserve'); } catch(e) { toast.error(e instanceof Error ? e.message : 'Erro ao carregar participantes.'); } finally { setBusy(false); } }
  return <>
    <header className="site-header"><div className="party-container flex h-full items-center justify-between gap-4"><div className="flex items-center gap-10"><div className="flex shrink-0 items-center"><img src={`${import.meta.env.BASE_URL}festou-logo.svg`} alt="Festou! — Uma festa organizada por todos" className="h-14 w-[210px] max-w-full object-contain object-left"/></div><nav className="header-nav" aria-label="Navegação principal"><Button className={`nav-button ${view === 'all' ? 'active' : ''}`} variant="ghost" onClick={() => setView('all')}>Lista da festa</Button><Button className={`nav-button ${view === 'mine' ? 'active' : ''}`} variant="ghost" onClick={() => setView('mine')}>Minhas contribuições</Button></nav></div><div className="flex items-center gap-1"><Button variant="ghost" size="icon" aria-label="Abrir notificações" onClick={openNotifications}><Bell size={18}/></Button><Button variant="ghost" size="sm" aria-label={person ? person.name : 'Participar'} onClick={() => { setPendingModal(null); setModal('identity'); }}><span className="initial">{person ? person.name.slice(0,1).toUpperCase() : <Users size={12}/>}</span><span className="hidden sm:inline">{person ? person.name : 'Participar'}</span><ArrowUpRight size={14}/></Button></div></div></header>
    <section className="party-hero"><img src={garden} alt="Mesa ao ar livre em uma chácara ensolarada" width={1920} height={640}/><div className="party-container hero-content"><span className="hero-eyebrow"><Leaf size={12}/> Todo mundo junto</span><h1>Festou!</h1><p>Boa companhia, comida gostosa e uma festa feita por todos.</p><div className="hero-meta"><span><CalendarDays size={16}/>{dateLabel}{daysUntilParty !== null && daysUntilParty >= 0 ? ` · ${countdownLabel}` : ''}</span><span><Users size={16}/>{data.event.guests ? `${data.event.guests} convidados` : 'Família e amigos'}</span><span><Heart size={15}/> Cada contribuição faz a diferença</span></div></div></section>
    <main className="party-container"><section className="overview"><div className="overview-top"><div className="overview-title">Nossa festa está tomando forma <span className="text-primary">· {progress}%</span></div><span className="live-label"><span className="live-dot"/>{online ? 'Lista compartilhada' : 'Sem conexão'}</span></div><div className="progress-track"><progress value={progress} max={100} aria-label="Progresso da organização"/></div><div className="stat-grid"><button type="button" className="stat stat-button" onClick={() => openStats('items')} aria-label={`Ver os ${total} itens da lista`}><span className="stat-icon"><ClipboardList size={20}/></span><div><strong>{total}</strong><small>Itens na lista</small></div></button><button type="button" className="stat stat-button" onClick={() => openStats('assumed')} aria-label={`Ver os ${assumed} itens assumidos`}><span className="stat-icon assumed"><CheckCheck size={20}/></span><div><strong>{assumed}</strong><small>Itens assumidos</small></div></button><button type="button" className="stat stat-button" onClick={() => openStats('available')} aria-label={`Ver os ${total-assumed} itens ainda disponíveis`}><span className="stat-icon waiting"><ShoppingBag size={20}/></span><div><strong>{total-assumed}</strong><small>Ainda disponíveis</small></div></button><button type="button" className="stat stat-button" onClick={() => openStats('people')} aria-label={`Ver participantes: ${people} contribuindo`}><span className="stat-icon people"><Users size={20}/></span><div><strong>{people}</strong><small>Pessoas contribuindo</small></div></button></div></section>
    <section className="birthday-album mt-8 mb-10" aria-labelledby="birthday-album-title">
      <div className="section-heading">
        <div><h2 id="birthday-album-title"><Cake size={21}/> Aniversariantes</h2><p>Pessoas especiais que fazem parte da nossa história.</p></div>
        {password && <Button size="sm" onClick={() => openBirthdayEditor()}><Plus size={16}/> Adicionar</Button>}
      </div>
      {data.birthdays.length ? <div className="birthday-grid">{data.birthdays.map(person => <article className="birthday-card" key={person.id}>
        <img src={supabase.storage.from('party-birthday-photos').getPublicUrl(person.photo_path).data.publicUrl} alt={person.name} loading="lazy"/>
        <strong>{person.name}</strong>
        {password && <div className="birthday-actions"><Button size="sm" variant="outline" onClick={() => openBirthdayEditor(person)}><Pencil size={14}/> Editar</Button><Button size="sm" variant="ghost" onClick={() => { if (window.confirm(`Excluir ${person.name} do álbum de aniversariantes?`)) act({ action: 'birthday_delete', id: person.id }, 'Aniversariante removido.'); }}><Trash2 size={14}/> Excluir</Button></div>}
      </article>)}</div> : <div className="birthday-empty"><Cake size={28}/><p>Ainda não há aniversariantes cadastrados.</p>{password && <Button size="sm" variant="outline" onClick={() => openBirthdayEditor()}><ImagePlus size={16}/> Adicionar primeira foto</Button>}</div>}
    </section>
    <section className="participants-overview mt-8 mb-10">
      <div className="section-heading">
        <div>
          <h2>Quem vai levar o quê?</h2>
          <p>As contribuições aparecem aqui automaticamente conforme cada pessoa escolhe um item.</p>
        </div>
        <span className="live-label"><span className="live-dot"/>{people} {people === 1 ? 'pessoa contribuindo' : 'pessoas contribuindo'}</span>
      </div>
      {data.reservations.length ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from(new Set(data.reservations.map(r => r.participant_name.trim().normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').toLocaleLowerCase('pt-BR')))).map(participantKey => {
            const entries = data.reservations.filter(r => r.participant_name.trim().normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').toLocaleLowerCase('pt-BR') === participantKey);
            const participantName = entries[0]?.participant_name.trim() ?? 'Participante';
            return <article className="rounded-xl border border-border bg-card p-4 shadow-sm" key={participantKey}>
              <div className="mb-3 flex items-center gap-2">
                <span className="initial">{participantName.slice(0,1).toUpperCase()}</span>
                <strong>{participantName}</strong>
              </div>
              <div className="space-y-2">
                {entries.map(r => {
                  const product = data.products.find(p => p.id === r.product_id);
                  return <div className="flex items-start justify-between gap-3 border-t border-border pt-2 text-sm" key={r.id}>
                    <span className="font-medium">{product?.name ?? 'Item da lista'}</span>
                    <span className="shrink-0 text-muted-foreground">{number(Number(r.quantity))} {product?.unit ?? ''}</span>
                  </div>;
                })}
              </div>
            </article>;
          })}
        </div>
      ) : (
        <div className="empty-state rounded-xl border border-dashed border-border py-8">
          <Users size={28} className="mx-auto mb-3"/>
          <p>Ninguém assumiu um item ainda. Quando alguém confirmar uma contribuição, o nome e o item aparecerão aqui.</p>
        </div>
      )}
    </section>
    <section className="list-section"><div className="section-heading"><div><h2>{view === 'mine' ? 'Minhas contribuições' : 'O que vamos levar?'}</h2><p>{view === 'mine' ? person ? `Tudo que você combinou de levar, ${person.name}.` : 'Informe seu nome para ver suas contribuições.' : 'Escolha um item e faça parte dessa festa.'}</p></div><div className="list-actions"><Button variant="outline" onClick={() => { setRouletteResult(null); setRouletteCategory(0); setModal('roulette'); }}><Dices size={16}/>Roleta da festa</Button><Button variant="outline" onClick={() => share()}><Share2 size={15}/>Compartilhar lista</Button><Button onClick={() => open('add')}><Plus size={16}/>Adicionar item</Button></div></div>
    <div className="filter-row"><label className="search-box"><Search size={17}/><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar um item..." aria-label="Buscar um item"/></label><div className="category-filters"><Button variant="ghost" className={`filter-button ${category === 0 ? 'active' : ''}`} onClick={() => setCategory(0)}>Todos os itens</Button>{data.categories.map(c => <Button key={c.id} variant="ghost" className={`filter-button ${category === c.id ? 'active' : ''}`} onClick={() => setCategory(c.id)}>{c.name === 'Bebidas e descartáveis' ? 'Bebidas e outros' : c.name === 'Carnes e complementos' ? 'Carnes' : c.name}</Button>)}</div><select aria-label="Filtrar por status" className="bg-transparent text-xs text-muted-foreground max-w-36" value={status} onChange={e => setStatus(e.target.value)}><option value="all">Todos os status</option><option value="available">Disponíveis</option><option value="partial">Parciais</option><option value="complete">Completos</option><option value="received">Recebidos</option></select></div>
    <div className="sm:hidden flex gap-2 mb-5"><Button variant={view === 'all' ? 'secondary' : 'ghost'} size="sm" onClick={() => setView('all')}>Lista da festa</Button><Button variant={view === 'mine' ? 'secondary' : 'ghost'} size="sm" onClick={() => setView('mine')}>Minhas contribuições</Button></div>
    {password && <div className="flex flex-wrap gap-2 mb-5"><Button variant="secondary" size="sm" onClick={openEventSettings}><CalendarDays size={16}/>Configurar evento</Button><Button variant="outline" size="sm" onClick={showParticipants}><Users/>Participantes</Button><Button variant="outline" size="sm" onClick={() => setModal('finance')}>Financeiro</Button><Button variant="outline" size="sm" onClick={exportPdf}><Download/>Exportar PDF</Button><Button variant="outline" size="sm" onClick={() => share(true)}><Share2/>Compartilhar pendências</Button><Button variant="ghost" size="sm" onClick={() => setPassword('')}><LockKeyhole/>Sair da administração</Button></div>}
    {!visible.length && <div className="empty-state"><Package size={32} className="mx-auto mb-3"/><p>{view === 'mine' ? 'Nenhuma contribuição por aqui ainda.' : 'Nenhum item encontrado.'}</p>{view === 'mine' && !person && <Button className="mt-4" onClick={() => open('identity')}>Informar meu nome</Button>}</div>}
    {data.categories.map(c => { const products = visible.filter(p => p.category_id === c.id); if (!products.length) return null; const Icon = icons[c.id - 1] ?? Package; return <section key={c.id}><h3 className="category-heading"><Icon size={18}/>{c.name}<span className="category-count">{products.length} itens</span></h3><div className="product-grid">{products.map(p => { const taken = reservedFor(p.id, data.reservations); const state = itemStatus(p,taken); const remaining = remainingFor(p,taken); const contributions = data.reservations.filter(r => r.product_id === p.id); return <article className="product-card" key={p.id}><div className="product-top"><span className="product-symbol"><Icon size={20}/></span><span className={`status-pill status-${state}`}>{statusLabels[state]}</span></div><h3>{p.name}</h3><p className="product-needed">Precisamos de <strong>{p.quantity === null ? 'quantidade a definir' : `${number(Number(p.quantity))} ${p.unit}`}</strong></p>{p.note && <p className="help-text mt-2">{p.note}</p>}<div className="progress-track product-meter"><progress value={p.received ? 100 : p.quantity ? Math.min(100, taken/Number(p.quantity)*100) : 0} max={100} aria-label={`Progresso de ${p.name}`}/></div><div className="quantity-line"><strong>{number(taken)} {p.unit} reservados</strong><span>{remaining === null ? 'Total a definir' : `Faltam ${number(remaining)} ${p.unit}`}</span></div><div className="contributors">{contributions.length ? contributions.map(r => <div className="reservation-contribution" key={r.id}><div className="reservation-person"><span className="initial">{r.participant_name.slice(0,1).toUpperCase()}</span><span className="reservation-person-name">{r.participant_name}</span><span className="reservation-quantity">{number(Number(r.quantity))} {p.unit}</span></div><div className="reservation-actions">{(password || r.participant_id === person?.id) ? <><select aria-label={`Situação da contribuição de ${r.participant_name}`} className="reservation-status" value={r.status ?? (r.source === 'home' ? 'at_home' : 'planned')} onChange={e => act({ action: 'reservation_status', id: r.id, status: e.target.value as 'planned'|'purchased'|'at_home'|'delivered' }, 'Situação atualizada.')}><option value="planned">Vai comprar</option><option value="purchased">Comprado</option><option value="at_home">Já tem em casa</option><option value="delivered">Entregue</option></select><Button size="sm" variant="outline" className="adjust-button" aria-label={`Ajustar quantidade da contribuição de ${r.participant_name} para ${p.name}`} disabled={busy} onClick={() => { setAdjustingReservation({ id: r.id, quantity: Number(r.quantity), productName: p.name, unit: p.unit }); setModal('adjust'); }}>Ajustar</Button><Button size="sm" variant="outline" className="withdraw-button" aria-label={`Desistir da contribuição de ${r.participant_name} para ${p.name}`} title="Desistir deste item" disabled={busy} onClick={() => { if (window.confirm(`Deseja desistir de levar ${p.name}? A quantidade será liberada para os outros participantes.`)) act({ action: 'cancel', id: r.id }, 'Compromisso cancelado. A quantidade voltou a ficar disponível.'); }}><X size={15}/>Desistir</Button></> : <span className="reservation-state-label">{{ planned: 'Vai comprar', purchased: 'Comprado', at_home: 'Já tem em casa', delivered: 'Entregue' }[r.status ?? (r.source === 'home' ? 'at_home' : 'planned')]}</span>}</div></div>) : <><Users size={12}/>Seja o primeiro a contribuir</>}</div><Button variant="secondary" className="carry-button" disabled={busy || !online || state === 'complete' || state === 'received'} onClick={() => password ? openAdminReserve(p) : open('reserve',p)}>{state === 'complete' || state === 'received' ? <Check size={13}/> : <Plus size={13}/>} {state === 'received' ? 'Já recebido' : state === 'complete' ? 'Tudo garantido!' : 'Eu vou levar'}</Button>{password && <div className="admin-controls"><Button variant="ghost" size="icon" title="Editar item" aria-label={`Editar ${p.name}`} onClick={() => open('edit',p)}><Pencil/></Button><Button variant="ghost" size="icon" title="Marcar recebimento" aria-label={`Marcar recebimento de ${p.name}`} onClick={() => act({ action: 'received', id: p.id, received: !p.received }, p.received ? 'Recebimento desmarcado.' : 'Item recebido!')}><Package/></Button><Button variant="ghost" size="icon" title="Excluir item" aria-label={`Excluir ${p.name}`} onClick={() => { if (confirm(`Excluir ${p.name} e todas as reservas deste item?`)) act({ action: 'delete', id: p.id }, 'Item excluído.'); }}><Trash2/></Button></div>}</article>; })}</div></section>; })}
    </section></main><footer className="site-footer"><div className="party-container flex justify-between items-center"><span className="flex items-center gap-2"><TreePine size={14}/>Festou! · Feita por todos, para todos.</span><div className="flex items-center gap-3"><Button variant="ghost" size="sm" onClick={() => share(true)}><Share2/>O que ainda falta</Button><Button variant="ghost" size="sm" onClick={() => setModal(password ? 'settings' : 'login')}>{password ? <CalendarDays size={12}/> : <LockKeyhole size={12}/>}{password ? 'Configurar evento' : 'Área do organizador'}</Button></div></div></footer>
    <Dialog open={modal !== null} onOpenChange={v => { if (!v) { setModal(null); setPendingModal(null); } }}><DialogContent className="max-w-md"><DialogHeader><DialogTitle>{modal === 'identity' ? 'Como você se chama?' : modal === 'add' ? 'Adicionar novo item' : modal === 'edit' ? 'Editar item' : modal === 'reserve' ? `Eu vou levar ${selected?.name ?? ''}` : modal === 'login' ? 'Área do organizador' : modal === 'participants' ? 'Participantes da festa' : modal === 'finance' ? 'Controle financeiro' : modal === 'adjust' ? 'Ajustar contribuição' : modal === 'notifications' ? 'Notificações' : modal === 'birthday' ? (selectedBirthday ? 'Editar aniversariante' : 'Adicionar aniversariante') : modal === 'roulette' ? 'Roleta da festa' : modal === 'stats' ? ({ items: 'Todos os itens da lista', assumed: 'Itens assumidos', available: 'O que ainda falta', people: 'Todos os participantes' } as const)[statsKind] : 'Detalhes da festa'}</DialogTitle><DialogDescription>{modal === 'identity' ? 'Que bom ter você com a gente!' : modal === 'reserve' ? `${selected?.quantity === null ? 'Quantidade total a definir' : `Ainda faltam ${number(selected ? remainingFor(selected,reservedFor(selected.id,data.reservations)) ?? 0 : 0)} ${selected?.unit}`}` : modal === 'login' ? 'Entre com a senha exclusiva do organizador.' : modal === 'participants' ? `${participants.length} pessoas na lista` : modal === 'finance' ? 'Registre e acompanhe os gastos da festa.' : modal === 'adjust' ? `Você reservou ${adjustingReservation ? number(adjustingReservation.quantity) : ''} ${adjustingReservation?.unit ?? ''} de ${adjustingReservation?.productName ?? 'um item'}.` : modal === 'notifications' ? 'Atualizações sobre as contribuições e a organização da festa.' : modal === 'birthday' ? 'Cadastre somente o nome e uma foto.' : modal === 'roulette' ? 'Gire e descubra qual item da festa pode ficar por sua conta!' : modal === 'stats' ? ({ items: `${data.products.length} produtos cadastrados`, assumed: `${assumed} itens com contribuição ou recebidos`, available: 'Produtos e quantidades que ainda precisam ser providenciados', people: `${participants.length} pessoas cadastradas, inclusive quem ainda não reservou itens` } as const)[statsKind] : 'Festou!'}</DialogDescription></DialogHeader>
    {modal === 'roulette' && <div className="modal-form">
      <label>Sortear entre<select value={rouletteCategory} onChange={e => { setRouletteCategory(Number(e.target.value)); setRouletteResult(null); }} disabled={rouletteSpinning}><option value={0}>Todas as categorias</option>{data.categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
      <div className="flex flex-col items-center gap-4 py-2">
        <div className="relative flex h-64 w-64 items-center justify-center">
          <div className="absolute -top-2 z-20 text-3xl leading-none text-foreground drop-shadow-md">▼</div>
          <div className="h-60 w-60 rounded-full border-[7px] border-amber-400 shadow-xl" style={{ background: 'conic-gradient(#2f855a 0deg 45deg, #f6bd45 45deg 90deg, #e87945 90deg 135deg, #3b82a0 135deg 180deg, #8b6bb1 180deg 225deg, #e7a3a5 225deg 270deg, #a3b85a 270deg 315deg, #d58a3c 315deg 360deg)', transform: 'rotate(' + rouletteRotation + 'deg)', transition: rouletteSpinning ? 'transform 3.8s cubic-bezier(.12,.75,.12,1)' : 'none' }} />
          <div className="absolute z-10 flex h-20 w-20 items-center justify-center rounded-full border-4 border-amber-300 bg-white text-center text-xs font-extrabold text-green-800 shadow-lg">FESTA<br/>JUNTA</div>
        </div>
        <p className="text-center text-sm text-muted-foreground">{rouletteSpinning ? 'A sorte está sendo lançada...' : rouletteItems.length ? rouletteItems.length + ' itens disponíveis para sorteio' : 'Não há itens disponíveis nesta seleção.'}</p>
        {rouletteResult && <div className="w-full rounded-xl border border-primary/20 bg-primary/5 p-4 text-center"><p className="text-xs font-semibold uppercase tracking-wider text-primary">A sorte escolheu!</p><p className="mt-1 text-xl font-bold">{rouletteResult.name}</p><p className="text-sm text-muted-foreground">{rouletteResult.quantity === null ? 'Quantidade a combinar' : number(Number(remainingFor(rouletteResult, reservedFor(rouletteResult.id, data.reservations)) ?? rouletteResult.quantity)) + ' ' + rouletteResult.unit + ' disponíveis'}</p><p className="mt-2 text-sm">A escolha é sua: você pode assumir esse item ou tentar novamente.</p></div>}
        <div className="flex w-full flex-wrap justify-center gap-2"><Button type="button" onClick={spinRoulette} disabled={rouletteSpinning || rouletteItems.length === 0}><Dices size={16}/>{rouletteSpinning ? 'Girando...' : rouletteResult ? 'Girar novamente' : 'Girar roleta'}</Button>{rouletteResult && <Button type="button" variant="outline" onClick={() => { const product = rouletteResult; setModal(null); open('reserve', product); }}>Vou ficar com esse item</Button>}</div>
      </div>
    </div>}
    {modal === 'birthday' && <form className="modal-form" onSubmit={submitBirthday}><label>Nome<input name="name" required minLength={1} maxLength={60} defaultValue={selectedBirthday?.name ?? ''} placeholder="Ex.: Maria"/></label><label>Foto<input name="photo" type="file" accept="image/jpeg,image/png,image/webp" required={!selectedBirthday}/></label><p className="help-text">Foto JPG, PNG ou WebP. Tamanho máximo: 3 MB. {selectedBirthday ? 'Se não selecionar outra foto, a atual será mantida.' : ''}</p><Button type="submit" disabled={busy}>{busy ? 'Salvando...' : selectedBirthday ? 'Salvar alterações' : 'Adicionar ao álbum'}</Button></form>}
    {modal === 'notifications' && <div className="modal-form notification-panel"><Button type="button" onClick={enablePushNotifications} disabled={pushEnabled}>{pushEnabled ? <><BellRing size={16}/> Notificações ativadas</> : <><Bell size={16}/> Ativar notificações neste celular</>}</Button>{notifications.length === 0 ? <p className="help-text">Nenhuma novidade por enquanto. Quando alguém reservar, ajustar ou liberar um item, as atualizações aparecerão aqui.</p> : <div className="notification-list">{notifications.map(item => <button type="button" key={item.id} className={`notification-item ${item.read_at ? 'read' : 'unread'}`} onClick={() => readNotification(item)}><span className="notification-title">{item.title}</span><span>{item.body}</span><small>{new Date(item.created_at).toLocaleString('pt-BR')}</small></button>)}</div>}</div>}
    {modal === 'identity' && <form className="modal-form" onSubmit={submitIdentity}><label>Seu nome<input name="name" required minLength={2} maxLength={60} defaultValue={person?.name} placeholder="Nome e sobrenome" autoComplete="name"/></label><Button type="submit" disabled={busy}>{busy ? 'Salvando...' : 'Vamos participar'}</Button></form>}
    {(modal === 'add' || modal === 'edit') && <form className="modal-form" onSubmit={submitProduct}><label>Nome do produto<input name="name" required maxLength={100} defaultValue={modal === 'edit' ? selected?.name : ''} placeholder="Ex.: Gelo"/></label><label>Categoria<select name="category" defaultValue={modal === 'edit' ? selected?.category_id : category || 1}>{data.categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label><div className="form-row"><label>Quantidade necessária<input name="quantity" type="number" min="0.01" step="0.01" max="100000" defaultValue={modal === 'edit' ? selected?.quantity ?? '' : ''} placeholder="A definir"/></label><label>Unidade<select name="unit" defaultValue={modal === 'edit' ? selected?.unit : 'un.'}>{['un.','kg','g','mg','L','ml','litro','litros','pacote','pacotes','caixa','caixas','fardo','fardos','dúzia','garrafa','garrafas','lata','latas','bandeja','rolo','rolos','saco','sacos','kit'].map(u => <option key={u}>{u}</option>)}</select></label></div><label>Observação (opcional)<textarea name="note" maxLength={500} defaultValue={modal === 'edit' ? selected?.note ?? '' : ''} placeholder="Algum detalhe importante?"/></label><Button type="submit" disabled={busy}>{busy ? 'Salvando...' : modal === 'edit' ? 'Salvar alterações' : 'Adicionar à lista'}</Button></form>}
    {modal === 'reserve' && <form className="modal-form" onSubmit={submitReserve}>{password ? <label>Quem vai levar<select name="participant" required><option value="">Selecione um participante</option>{participants.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label> : <label>Quem vai levar<input readOnly value={person?.name ?? ''}/></label>}<label>Quantidade ({selected?.unit})<input name="quantity" type="number" required min="0.01" step="0.01" max={selected ? remainingFor(selected,reservedFor(selected.id,data.reservations)) ?? 100000 : 100000} placeholder="Quanto você vai levar?"/></label><div className="radio-row"><label><input type="radio" name="source" value="home"/>Já tenho em casa</label><label><input type="radio" name="source" value="buy" defaultChecked/>Vou comprar</label></div><Button type="submit" disabled={busy}>{busy ? 'Reservando...' : 'Confirmar contribuição'}</Button></form>}
    {modal === 'adjust' && adjustingReservation && <form className="modal-form" onSubmit={submitAdjustment}><p className="help-text">Informe quanto você realmente conseguirá levar. A diferença será liberada automaticamente para os demais participantes.</p><label>Nova quantidade ({adjustingReservation.unit})<input name="quantity" type="number" required min="0.01" max={adjustingReservation.quantity - 0.01} step="0.01" defaultValue={adjustingReservation.quantity} autoFocus/></label><p className="help-text">Quantidade atual: {number(adjustingReservation.quantity)} {adjustingReservation.unit}</p><Button type="submit" disabled={busy}>{busy ? 'Atualizando...' : 'Salvar nova quantidade'}</Button></form>}
    {modal === 'login' && <form className="modal-form" onSubmit={async e => { e.preventDefault(); const value = String(new FormData(e.currentTarget).get('password')); setBusy(true); try { await mutate({ data: { action: 'verify', password: value } }); setPassword(value); setModal(null); toast.success('Bem-vindo à administração.'); } catch(e) { toast.error(e instanceof Error ? e.message : 'Acesso indisponível.'); } finally { setBusy(false); } }}><label>Senha<input name="password" type="password" required autoComplete="current-password"/></label><Button type="submit" disabled={busy}>{busy ? 'Verificando...' : 'Entrar'}</Button></form>}
    {modal === 'settings' && <form className="modal-form" onSubmit={async e => { e.preventDefault(); const f = new FormData(e.currentTarget); const dates = [...partyDates].sort(); const date = dates[0] ?? null; const endDate = dates.at(-1) ?? null; if (await act({ action: 'event', date, endDate, dates, guests: f.get('guests') ? Number(f.get('guests')) : null }, 'Dias da festa atualizados!')) setModal(null); }}>
      <label>Adicionar dia à festa<input type="date" value={newPartyDate} onChange={e => setNewPartyDate(e.target.value)}/></label>
      <Button type="button" variant="outline" onClick={addPartyDate} disabled={!newPartyDate}><Plus size={16}/> Adicionar dia</Button>
      <div className="party-date-list"><strong>{partyDates.length} {partyDates.length === 1 ? 'dia selecionado' : 'dias selecionados'}</strong>{partyDates.length ? <div className="party-date-chips">{partyDates.map(day => <span className="party-date-chip" key={day}>{new Date(day+'T12:00:00').toLocaleDateString('pt-BR')}<button type="button" aria-label={`Remover dia ${day}`} onClick={() => setPartyDates(partyDates.filter(value => value !== day))}>×</button></span>)}</div> : <p className="help-text">Adicione os dias em que a festa acontecerá. Você pode escolher datas separadas ou consecutivas.</p>}</div>
      <label>Quantidade de convidados (opcional)<input type="number" name="guests" min="1" max="100000" defaultValue={data.event.guests ?? ''}/></label>
      <Button type="submit" disabled={busy}>{busy ? 'Salvando...' : 'Salvar detalhes'}</Button></form>}
    {modal === 'finance' && <div className="space-y-4"><div className="rounded-lg bg-secondary p-4"><p className="text-xs text-muted-foreground">Total registrado</p><strong className="text-2xl">R$ {number(data.expenses.reduce((sum, expense) => sum + Number(expense.amount), 0))}</strong></div><form className="modal-form" onSubmit={addExpense}><label>Descrição<input name="description" required maxLength={120} placeholder="Ex.: compra de bebidas"/></label><label>Valor (R$)<input name="amount" type="number" min="0.01" step="0.01" required/></label><label>Quem pagou<input name="paidBy" required maxLength={60} placeholder="Nome do responsável"/></label><Button type="submit" disabled={busy}>Registrar despesa</Button></form><div className="max-h-56 overflow-y-auto">{data.expenses.map(expense => <div className="reservation-row" key={expense.id}><div><strong>{expense.description}</strong><p className="help-text">Pago por {expense.paid_by}</p></div><div className="text-right"><strong>R$ {number(Number(expense.amount))}</strong><Button size="sm" variant="ghost" onClick={() => act({ action: 'expense_delete', id: expense.id }, 'Despesa removida.')}>Excluir</Button></div></div>)}{!data.expenses.length && <p className="help-text py-4">Nenhuma despesa registrada.</p>}</div></div>}
    {modal === 'participants' && <div className="max-h-96 overflow-y-auto">{participants.map(p => <div className="reservation-row" key={p.id}><span>{p.name}</span><div className="flex items-center gap-2"><span className="text-muted-foreground text-xs">{data.reservations.filter(r => r.participant_id === p.id).length} contribuições</span><Button size="icon" variant="ghost" title={`Excluir ${p.name}`} aria-label={`Excluir participante ${p.name}`} disabled={busy} onClick={() => deleteParticipant(p)}><Trash2 size={16}/></Button></div></div>)}{!participants.length && <p className="help-text py-6">Ainda não há participantes.</p>}</div>}
    {modal === 'stats' && <div className="space-y-3"><div className="flex justify-end"><Button size="sm" onClick={() => exportStatsPdf()}><Download size={15}/> Exportar PDF</Button></div><div className="max-h-[58vh] overflow-y-auto space-y-2 pr-1">
      {statsKind === 'people' && (participants.length ? participants.map(p => {
        const entries = data.reservations.filter(r => r.participant_id === p.id);
        return <div className="stats-list-row" key={p.id}><div className="min-w-0"><strong>{p.name}</strong><p>{entries.length ? entries.map(r => { const product = data.products.find(x => x.id === r.product_id); return `${product?.name ?? 'Produto'} · ${number(Number(r.quantity))} ${product?.unit ?? ''}`; }).join(' | ') : 'Ainda não assumiu nenhum produto'}</p></div><div className="flex items-center gap-1"><span className="stats-list-count">{entries.length} {entries.length === 1 ? 'item' : 'itens'}</span>{password && <Button size="icon" variant="ghost" title={`Excluir ${p.name}`} aria-label={`Excluir ${p.name}`} disabled={busy} onClick={() => deleteParticipant(p)}><Trash2 size={16}/></Button>}</div></div>;
      }) : <p className="help-text py-6 text-center">Ainda não há participantes cadastrados.</p>)}
      {statsKind !== 'people' && (data.products.filter(p => statsKind === 'items' || (statsKind === 'assumed' ? reservedFor(p.id, data.reservations) > 0 || p.received : !p.received && itemStatus(p, reservedFor(p.id, data.reservations)) !== 'complete')).length ? data.products.filter(p => statsKind === 'items' || (statsKind === 'assumed' ? reservedFor(p.id, data.reservations) > 0 || p.received : !p.received && itemStatus(p, reservedFor(p.id, data.reservations)) !== 'complete')).map(p => {
        const taken = reservedFor(p.id, data.reservations);
        const remaining = remainingFor(p, taken);
        const entries = data.reservations.filter(r => r.product_id === p.id);
        return <div className="stats-list-row" key={p.id}><div className="min-w-0"><strong>{p.name}</strong><p>{entries.length ? entries.map(r => `${r.participant_name} (${number(Number(r.quantity))} ${p.unit})`).join(', ') : 'Ninguém assumiu este item ainda'}</p></div><span className="stats-list-count">{statsKind === 'available' ? remaining === null ? 'A definir' : `Faltam ${number(remaining)} ${p.unit}` : p.quantity === null ? `${number(taken)} ${p.unit}` : `${number(taken)} / ${number(Number(p.quantity))} ${p.unit}`}</span></div>;
      }) : <p className="help-text py-6 text-center">Não há itens nesta situação. Tudo certo!</p>)}
    </div></div>}
    </DialogContent></Dialog>
  </>;
}
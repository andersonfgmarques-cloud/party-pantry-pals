import { useEffect, useState, type FormEvent } from 'react';
import { useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { TreePine, CalendarDays, MapPin, ExternalLink, LogOut, ChevronDown, Users, Plus, Search, Coffee, Sandwich, Beef, Flame, CakeSlice, GlassWater, ListChecks, Check, Package, ArrowUpRight, Share2, LockKeyhole, Heart, X, Pencil, Trash2, Download, Copy, MessageCircle, Settings2, CheckCheck, ShoppingBag, Leaf, ClipboardList, Bell, BellRing, Cake, ImagePlus, Dices, MoreVertical, Clock3 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { partyQuery } from '@/lib/party.queries';
import { identifyParticipant, changeParty, loginParticipant, logoutParticipant, setParticipantPin, getPartyNotifications, markPartyNotificationRead, markAllPartyNotificationsRead, savePushSubscription, getPushPublicKey, getPartyExpenses, getPartyBirthdayPhotos, renameParticipant, getPushStatus, getPartyLocation, type PartyNotification } from '@/lib/party.functions';
import { reservedFor, itemStatus, remainingFor, number, statusLabels, type Product, type Expense } from '@/lib/party';
import garden from '@/assets/chacara-garden.jpg';

const icons = [Coffee, Sandwich, Beef, Flame, CakeSlice, GlassWater];
type Modal = 'dashboard' | 'history' | 'identity' | 'add' | 'reserve' | 'login' | 'settings' | 'edit' | 'participants' | 'stats' | 'finance' | 'adjust' | 'notifications' | 'birthday' | 'roulette' | 'qrcode' | 'account' | null;
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
  const [identityMode, setIdentityMode] = useState<'register' | 'login' | 'setPin'>('register');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [openProductMenuId, setOpenProductMenuId] = useState<string | null>(null);
  const [category, setCategory] = useState(0);
  const [search, setSearch] = useState('');
  const [view, setView] = useState('all');
  const [status, setStatus] = useState('all');
  const [online, setOnline] = useState(true);
  const [history, setHistory] = useState<{ id: string; action: string; entity_name: string | null; actor_name: string; created_at: string; details: Record<string, unknown> }[]>([]);
  const [participants, setParticipants] = useState<{ id: string; name: string; created_at: string | null }[]>([]);
  const [statsKind, setStatsKind] = useState<StatsKind>('items');
  const [dashboardFilter, setDashboardFilter] = useState<'all' | 'unassigned' | 'partial' | 'guaranteed' | 'received' | 'undefined'>('all');
  const [notifications, setNotifications] = useState<PartyNotification[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [birthdayPhotos, setBirthdayPhotos] = useState<Record<string, string>>({});
  const [birthdayPreview, setBirthdayPreview] = useState<{ src: string; name: string } | null>(null);
  const [pushEnabled, setPushEnabled] = useState(false);
  const unreadNotifications = notifications.filter(item => !item.read_at).length;
  useEffect(() => {
    let active = true;
    setAuthorizedLocationUrl(null);
    if (!person?.token && !password) return () => { active = false; };
    getPartyLocation(person?.token, password || undefined)
      .then(url => { if (active) setAuthorizedLocationUrl(url); })
      .catch(() => { if (active) setAuthorizedLocationUrl(null); });
    return () => { active = false; };
  }, [person?.token, password]);
  const [partyDates, setPartyDates] = useState<string[]>([]);
  const [guests, setGuests] = useState('');
  const [locationUrl, setLocationUrl] = useState('');
  const [authorizedLocationUrl, setAuthorizedLocationUrl] = useState<string | null>(null);
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
      .on('postgres_changes', { event: '*', schema: 'public', table: 'party_products' }, () => { refresh(); if (person?.token) window.setTimeout(() => getPartyNotifications(person.token).then(rows => setNotifications(rows)).catch(() => {}), 700); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'party_reservations' }, payload => {
        refresh();
        if (person?.token) window.setTimeout(() => getPartyNotifications(person.token).then(setNotifications).catch(() => {}), 700);
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
  }, [qc, person?.token]);
  useEffect(() => {
    if (!password) { setExpenses([]); return; }
    if (modal !== 'finance') return;
    let active = true;
    getPartyExpenses(password).then(rows => { if (active) setExpenses(rows); }).catch(error => { if (active) toast.error(error instanceof Error ? error.message : 'Não foi possível carregar as despesas.'); });
    return () => { active = false; };
  }, [modal, password]);
  useEffect(() => {
    if (!person?.token) {
      setNotifications([]);
      setPushEnabled(false);
      return;
    }

    let active = true;
    getPartyNotifications(person.token)
      .then(rows => { if (active) setNotifications(rows.filter(item => !item.read_at)); })
      .catch(() => {});

    const syncPushStatus = async () => {
      try {
        if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
          if (active) setPushEnabled(false);
          return;
        }
        const registration = await navigator.serviceWorker.getRegistration(import.meta.env.BASE_URL);
        const subscription = await registration?.pushManager.getSubscription();
        const status = await getPushStatus(person.token, subscription?.endpoint);
        if (active) setPushEnabled(status.enabled);
      } catch {
        if (active) setPushEnabled(false);
      }
    };

    void syncPushStatus();
    return () => { active = false; };
  }, [person?.token]);

  useEffect(() => {
    if (!person?.token && !password) {
      setBirthdayPhotos({});
      return;
    }

    let active = true;
    getPartyBirthdayPhotos(person?.token, password || undefined)
      .then(photos => { if (active) setBirthdayPhotos(photos); })
      .catch(error => {
        if (active) {
          setBirthdayPhotos({});
          toast.error(error instanceof Error ? error.message : 'Não foi possível carregar as fotos.');
        }
      });
    return () => { active = false; };
  }, [person?.token, password, data.birthdays]);
  useEffect(() => {
    if (modal !== 'settings') return;
    const event = data.event;
    let dates: string[] = Array.isArray(event.party_dates) ? [...event.party_dates] : [];
    if (!dates.length && event.party_date) {
      dates = [event.party_date];
      if (event.party_end_date && event.party_end_date > event.party_date) {
        const cursor = new Date(`${event.party_date}T12:00:00`);
        const end = new Date(`${event.party_end_date}T12:00:00`);
        while (cursor < end && dates.length < 90) { cursor.setDate(cursor.getDate() + 1); dates.push(cursor.toISOString().slice(0, 10)); }
      }
    }
    setPartyDates(dates.sort());
    setGuests(event.guests == null ? '' : String(event.guests));
    setLocationUrl(authorizedLocationUrl ?? '');
  }, [modal, data.event]);
  const total = data.products.length;
  const assumed = data.products.filter(p => reservedFor(p.id, data.reservations) > 0 || p.received).length;
  const completed = data.products.filter(p => ['complete','received'].includes(itemStatus(p, reservedFor(p.id, data.reservations)))).length;
  const progress = total ? Math.round(completed / total * 100) : 0;
  const people = data.participantCount;
  const dashboardItems = data.products.map(product => ({ product, reserved: reservedFor(product.id, data.reservations), remaining: remainingFor(product, reservedFor(product.id, data.reservations)), reservations: data.reservations.filter(r => r.product_id === product.id), state: itemStatus(product, reservedFor(product.id, data.reservations)) }));
  const unassignedItems = dashboardItems.filter(item => !item.product.received && item.reserved === 0);
  const partialItems = dashboardItems.filter(item => item.state === 'partial');
  const guaranteedItems = dashboardItems.filter(item => item.state === 'complete');
  const receivedItems = dashboardItems.filter(item => item.product.received);
  const undefinedQuantityItems = dashboardItems.filter(item => item.product.quantity === null && !item.product.received);
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
  const normalizeSearch = (value: string) => value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
  const searchTerms = normalizeSearch(search).split(/\s+/).filter(Boolean);
  const visible = data.products.filter(p => {
    const productCategory = data.categories.find(c => c.id === p.category_id)?.name ?? '';
    const searchableText = normalizeSearch([p.name, p.note ?? '', p.unit, productCategory].join(' '));
    const matchesSearch = searchTerms.every(term => searchableText.includes(term));
    const reserved = reservedFor(p.id, data.reservations);
    return (!category || p.category_id === category)
      && matchesSearch
      && (view !== 'mine' || data.reservations.some(r => r.product_id === p.id && r.participant_id === person?.id))
      && (status === 'all' || status === itemStatus(p, reserved));
  });
  function open(next: Modal, product?: Product) { setSelected(product ?? null); if (['add','reserve'].includes(next ?? '') && !person && !password) { setPendingModal(next); setModal('identity'); } else setModal(next); }
  async function act(input: Parameters<typeof mutate>[0]['data'], message: string) {
    if (!online) { toast.error('Conecte-se à internet para atualizar a lista.'); return false; }
    setBusy(true);
    try { await mutate({ data: { ...input, ...(password ? { password } : { token: person?.token }) } }); await qc.invalidateQueries({ queryKey: ['party'] }); toast.success(message); return true; } catch (e) { toast.error(e instanceof Error ? e.message : 'Não foi possível salvar.'); return false; } finally { setBusy(false); }
  }

  async function openNotifications() {
    if (!person) { setPendingModal('notifications'); setModal('identity'); return; }
    setModal('notifications');
    try {
      // Load the full history first, then mark unread entries as read without removing them.
      const history = await getPartyNotifications(person.token);
      setNotifications(history);
      await markAllPartyNotificationsRead(person.token);
      const readAt = new Date().toISOString();
      setNotifications(current => current.map(item => item.read_at ? item : { ...item, read_at: readAt }));
    } catch {
      toast.error('Não foi possível atualizar as notificações. Tente novamente.');
    }
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
      const existingSubscription = await registration.pushManager.getSubscription();
      const subscription = existingSubscription ?? await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey });
      await savePushSubscription(person.token, subscription);
      const status = await getPushStatus(person.token, subscription.endpoint);
      setPushEnabled(status.enabled);
      toast.success('Notificações ativadas neste dispositivo!');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível ativar as notificações.');
    }
  }
  async function readNotification(notification: PartyNotification) {
    if (!person || notification.read_at) return;
    const readAt = new Date().toISOString();
    setNotifications(current => current.map(item => item.id === notification.id ? { ...item, read_at: readAt } : item));
    try {
      await markPartyNotificationRead(person.token, notification.id);
    } catch {
      setNotifications(current => current.map(item => item.id === notification.id ? { ...item, read_at: null } : item));
      toast.error('Não foi possível atualizar a notificação. Tente novamente.');
    }
  }
  async function submitParticipantName(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!person) return;
    const name = String(new FormData(e.currentTarget).get('name') ?? '').trim().replace(/\\s+/g, ' ');
    if (name.length < 2 || name.length > 60) { toast.error('Informe um nome entre 2 e 60 caracteres.'); return; }
    if (name === person.name) { toast.info('O nome informado já está atualizado.'); return; }
    setBusy(true);
    try {
      const updated = await renameParticipant(person.token, name);
      const nextPerson = { ...person, name: updated.name };
      setPerson(nextPerson);
      try { localStorage.setItem('party-identity', JSON.stringify(nextPerson)); } catch { /* storage may be unavailable */ }
      await qc.invalidateQueries({ queryKey: ['party'] });
      toast.success('Nome atualizado com sucesso!');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível atualizar seu nome.');
    } finally { setBusy(false); }
  }
  async function submitIdentity(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); const form = new FormData(e.currentTarget); setBusy(true);
    try { const token = person?.token ?? crypto.randomUUID(); const row = await identify({ data: { name: String(form.get('name')), token } }); const p = { ...row, token }; setPerson(p); try { localStorage.setItem('party-identity', JSON.stringify(p)); } catch { toast.info('Seu nome não poderá ser lembrado neste dispositivo.'); } setIdentityMode('setPin'); toast.success(`Cadastro iniciado, ${row.name}! Agora crie seu PIN de acesso.`); } catch(e) { toast.error(e instanceof Error ? e.message : 'Não foi possível salvar seu nome.'); } finally { setBusy(false); }
  }
  async function submitPinLogin(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); const form = new FormData(e.currentTarget); setBusy(true);
    try {
      const p = await loginParticipant(String(form.get('name') ?? ''), String(form.get('pin') ?? ''));
      setPerson(p); localStorage.setItem('party-identity', JSON.stringify(p));
      await qc.invalidateQueries({ queryKey: ['party'] }); setView('mine'); setModal(null);
      toast.success('Bem-vindo de volta, ' + p.name + '!');
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Não foi possível entrar.'); }
    finally { setBusy(false); }
  }
  async function submitPinSet(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); if (!person) return; const form = new FormData(e.currentTarget);
    const pin = String(form.get('pin') ?? ''); const confirmation = String(form.get('confirmation') ?? '');
    if (pin !== confirmation) { toast.error('Os PINs não conferem.'); return; }
    setBusy(true); try { await setParticipantPin(person.token, pin); toast.success('PIN criado! Você permanecerá conectado neste aparelho e poderá entrar em outros aparelhos com ele.'); setView('mine'); setModal(pendingModal); setPendingModal(null); }
    catch (error) { toast.error(error instanceof Error ? error.message : 'Não foi possível criar o PIN.'); } finally { setBusy(false); }
  }
  function logoutCurrentParticipant() {
    if (!person) return;
    const token = person.token;
    // O logout local não depende da resposta do servidor: limpa o armazenamento
    // e recarrega a aplicação para reconstruir a interface sem participante ativo.
    try {
      localStorage.removeItem('party-identity');
      sessionStorage.removeItem('party-identity');
    } catch { /* storage may be unavailable */ }
    setPerson(null);
    setView('all');
    setModal(null);
    setPendingModal(null);
    setIdentityMode('login');
    setBusy(false);
    void logoutParticipant(token).catch(() => {
      toast.warning('A sessão foi encerrada neste aparelho. A confirmação do servidor não foi recebida.');
    });
    window.location.reload();
  }
  async function submitProduct(e: FormEvent<HTMLFormElement>) { e.preventDefault(); const f = new FormData(e.currentTarget); const name = String(f.get('name')).trim(); const normalize = (value: string) => value.normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').toLocaleLowerCase('pt-BR').replace(/[^a-z0-9]+/g, ' ').trim(); if (modal === 'add') { const duplicate = data.products.find(product => normalize(product.name) === normalize(name)); if (duplicate) { const categoryName = data.categories.find(item => item.id === duplicate.category_id)?.name ?? 'outra categoria'; const detail = `Já existe um item chamado \"${duplicate.name}\" na categoria \"${categoryName}\" (${duplicate.unit}).`; if (!window.confirm(`${detail} Deseja adicionar mesmo assim?`)) return; } } const ok = await act({ action: modal === 'edit' ? 'edit' : 'add', id: modal === 'edit' ? selected?.id : undefined, name, categoryId: Number(f.get('category')), quantity: f.get('quantity') ? Number(f.get('quantity')) : null, unit: String(f.get('unit')), note: String(f.get('note') ?? '') }, modal === 'edit' ? 'Item atualizado!' : 'Item adicionado à lista!'); if (ok) setModal(null); }
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
  async function openEventSettings() { const event = data.event; const privateLocation = await getPartyLocation(undefined, password); setAuthorizedLocationUrl(privateLocation); let dates: string[] = Array.isArray(event.party_dates) ? [...event.party_dates] : []; if (!dates.length && event.party_date) { dates = [event.party_date]; if (event.party_end_date && event.party_end_date > event.party_date) { const cursor = new Date(`${event.party_date}T12:00:00`); const end = new Date(`${event.party_end_date}T12:00:00`); while (cursor < end && dates.length < 90) { cursor.setDate(cursor.getDate() + 1); dates.push(cursor.toISOString().slice(0, 10)); } } } setPartyDates(dates.sort()); setNewPartyDate(''); setGuests(event.guests == null ? '' : String(event.guests)); setLocationUrl(privateLocation ?? ''); setModal('settings'); }
  function isGoogleMapsUrl(value: string) { try { const url = new URL(value); return url.protocol === 'https:' && ['maps.app.goo.gl', 'maps.google.com', 'google.com', 'www.google.com'].includes(url.hostname) && (url.hostname !== 'google.com' && url.hostname !== 'www.google.com' || url.pathname.startsWith('/maps')); } catch { return false; } }
  const mapsLocationUrl = authorizedLocationUrl && isGoogleMapsUrl(authorizedLocationUrl) ? authorizedLocationUrl : null;
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
  async function addExpense(e: FormEvent<HTMLFormElement>) { e.preventDefault(); const form = e.currentTarget; const f = new FormData(form); const ok = await act({ action: 'expense_add', description: String(f.get('description')), amount: Number(f.get('amount')), paidBy: String(f.get('paidBy')) }, 'Despesa registrada!'); if (ok) { form.reset(); try { setExpenses(await getPartyExpenses(password)); } catch { toast.error('Despesa salva, mas não foi possível atualizar a lista.'); } } }
  function summary(pending = false) { return `${data.event.name}\n${dateLabel}\n\n` + data.categories.map(c => { const items = data.products.filter(p => p.category_id === c.id && (!pending || !['complete','received'].includes(itemStatus(p, reservedFor(p.id, data.reservations))))); return items.length ? `${c.name.toUpperCase()}\n` + items.map(p => { const reserved = reservedFor(p.id, data.reservations); const remaining = remainingFor(p, reserved); const peopleNames = data.reservations.filter(r => r.product_id === p.id).map(r => `${r.participant_name}: ${number(Number(r.quantity))} ${p.unit}`).join(', '); return `• ${p.name}: ${p.quantity === null ? 'quantidade a definir' : `${number(Number(p.quantity))} ${p.unit}`} | ${statusLabels[itemStatus(p, reserved)]}${remaining !== null ? ` | faltam ${number(remaining)} ${p.unit}` : ''}${peopleNames ? `\n  ${peopleNames}` : ''}`; }).join('\n') : ''; }).filter(Boolean).join('\n\n'); }
  function share(pending = false) { const text = pending ? `${summary(true)}\n\nParticipe: ${window.location.origin}${import.meta.env.BASE_URL}` : `🌿 Festou!\nUma festa feita por todos! Escolha o que você vai levar:\n${window.location.origin}${import.meta.env.BASE_URL}`; window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer'); }
  function shareAvailableList() {
    const pending = data.products.filter(product => {
      const reserved = reservedFor(product.id, data.reservations);
      return !product.received && itemStatus(product, reserved) !== 'complete';
    });
    if (!pending.length) { toast.info('Não há itens pendentes para compartilhar.'); return; }
    const grouped = data.categories.map(category => {
      const items = pending.filter(product => product.category_id === category.id);
      if (!items.length) return '';
      return `* ${category.name.toUpperCase()}\n` + items.map(product => {
        const reserved = reservedFor(product.id, data.reservations);
        const remaining = remainingFor(product, reserved);
        const quantity = remaining === null ? 'Quantidade a definir' : `Faltam ${number(remaining)} ${product.unit}`;
        return `• ${product.name} — ${quantity}`;
      }).join('\n');
    }).filter(Boolean).join('\n\n');
    const message = `🌿 *Festou! — O que ainda falta*\n${data.event.name}\n${dateLabel}\n\n${grouped}\n\nQuer ajudar? Acesse a lista e escolha o que pode levar:\n${appUrl()}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank', 'noopener,noreferrer');
  }
  const appUrl = () => `${window.location.origin}${import.meta.env.BASE_URL}`;
  const qrImageUrl = () => `${window.location.origin}${import.meta.env.BASE_URL}festou-app-qrcode.png`;
  async function shareQrImage() {
    const url = qrImageUrl();
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error('Não foi possível carregar o QR Code.');
      const blob = await response.blob();
      const file = new File([blob], 'festou-qr-code.png', { type: 'image/png' });
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ title: 'Festou! — QR Code do aplicativo', text: 'Acesse o Festou! pelo QR Code ou pelo link.', files: [file] });
        return;
      }
      window.open(`https://wa.me/?text=${encodeURIComponent(`🌿 Conheça o Festou! Organize e participe da festa: ${appUrl()}`)}`, '_blank', 'noopener,noreferrer');
      toast.info('Seu navegador não permite compartilhar a imagem diretamente. O WhatsApp foi aberto com o link do app.');
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') return;
      toast.error(error instanceof Error ? error.message : 'Não foi possível compartilhar o QR Code.');
    }
  }
  async function copyAppLink() {
    try { await navigator.clipboard.writeText(appUrl()); toast.success('Link do Festou! copiado.'); }
    catch { toast.error('Não foi possível copiar automaticamente. Use o link: ' + appUrl()); }
  }
  function downloadQrImage() {
    const anchor = document.createElement('a');
    anchor.href = qrImageUrl();
    anchor.download = 'festou-qr-code.png';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  }
  function shareQrWhatsApp() {
    const message = `🌿 Conheça o Festou!\nOrganize e participe da festa. Acesse pelo link ou escaneie o QR Code:\n${appUrl()}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank', 'noopener,noreferrer');
  }
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
      const itemCount = data.reservations.filter(r => r.participant_id === p.id).length;
      return [`Participante: ${p.name}`, `Quantidade de itens: ${itemCount}`, ''];
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
    if (kind === 'items' || kind === 'assumed' || kind === 'available') {
      const products = data.products.filter(p => kind === 'items' || (kind === 'assumed'
        ? reservedFor(p.id, data.reservations) > 0 || p.received
        : !p.received && itemStatus(p, reservedFor(p.id, data.reservations)) !== 'complete'));
      const rows = products.map(p => {
        const taken = reservedFor(p.id, data.reservations);
        const remaining = remainingFor(p, taken);
        return {
          name: p.name,
          quantity: p.quantity === null ? `${number(taken)} ${p.unit} reservados` : `${number(taken)} / ${number(Number(p.quantity))} ${p.unit}`,
          status: p.received ? 'Recebido' : remaining === 0 ? 'Quantidade completa' : remaining === null ? 'Quantidade a definir' : `Faltam ${number(remaining)} ${p.unit}`,
        };
      });
      await exportChecklistPdf(titles[kind], rows, `festou-${kind}.pdf`);
      return;
    }
    await exportReportPdf(titles[kind], reportLines(kind), `festou-${kind}.pdf`);
  }
  async function exportChecklistPdf(
    title: string,
    rows: { name: string; quantity: string; status?: string }[],
    filename: string,
  ) {
    try {
      const { jsPDF } = await import('jspdf');
      const doc = new jsPDF({ unit: 'mm', format: 'a4' });
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 14;
      const gap = 7;
      const colWidth = (pageWidth - margin * 2 - gap) / 2;
      const cardPadding = 4;
      const cardGap = 3;
      let page = 1;
      let column = 0;
      let y = 62;
      const bottom = pageHeight - 17;

      const header = () => {
        doc.setTextColor(25, 55, 40);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(19);
        doc.text('Festou!', margin, 18);
        doc.setFontSize(14);
        doc.text(title, margin, 28, { maxWidth: pageWidth - margin * 2 });
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(90, 105, 96);
        doc.text(data.event.name, margin, 36);
        doc.text(dateLabel, margin, 42);
        doc.text(`Emitido em ${new Date().toLocaleString('pt-BR')}`, margin, 48);
        doc.setDrawColor(210, 220, 214);
        doc.line(margin, 53, pageWidth - margin, 53);
      };
      const newPage = () => {
        doc.addPage();
        page += 1;
        column = 0;
        y = 62;
        header();
      };
      header();

      for (const row of rows) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        const nameLines = doc.splitTextToSize(row.name, colWidth - 19);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        const quantityLines = doc.splitTextToSize(row.quantity, colWidth - 19);
        const statusLines = row.status ? doc.splitTextToSize(row.status, colWidth - 19) : [];
        const cardHeight = Math.max(18, 8 + nameLines.length * 4.5 + quantityLines.length * 4 + statusLines.length * 3.7);
        if (y + cardHeight > bottom) {
          if (column === 0) { column = 1; y = 62; }
          else newPage();
        }
        const x = margin + column * (colWidth + gap);
        doc.setDrawColor(215, 224, 218);
        doc.setFillColor(250, 252, 250);
        doc.roundedRect(x, y, colWidth, cardHeight, 2, 2, 'FD');
        doc.setDrawColor(75, 105, 87);
        doc.setLineWidth(0.45);
        doc.rect(x + cardPadding, y + 5, 4, 4);
        let textY = y + 8;
        doc.setTextColor(35, 50, 40);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.text(nameLines, x + 11, textY);
        textY += nameLines.length * 4.5 + 1;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.text(quantityLines, x + 11, textY);
        textY += quantityLines.length * 4;
        if (statusLines.length) {
          doc.setTextColor(95, 110, 100);
          doc.setFontSize(8);
          doc.text(statusLines, x + 11, textY);
        }
        y += cardHeight + cardGap;
        if (column === 0) column = 1;
        else { column = 0; y += 0; }
      }

      const pages = doc.getNumberOfPages();
      for (let current = 1; current <= pages; current++) {
        doc.setPage(current);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(120);
        doc.text(`Festou! · Página ${current} de ${pages}`, pageWidth / 2, pageHeight - 8, { align: 'center' });
      }
      doc.save(filename);
      toast.success('PDF de conferência gerado com sucesso!');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível gerar o PDF.');
    }
  }
  async function exportParticipantPdf(p: { id: string; name: string }) {
    const entries = data.reservations.filter(r => r.participant_id === p.id);
    const rows = entries.map(r => {
      const product = data.products.find(x => x.id === r.product_id);
      return {
        name: product?.name ?? 'Produto',
        quantity: `${number(Number(r.quantity))} ${product?.unit ?? ''}`,
        status: r.source === 'home' ? 'Já tem em casa' : 'Vai comprar',
      };
    });
    await exportChecklistPdf(`Lista individual: ${p.name}`, rows, `contribuicoes-${p.name.trim().toLocaleLowerCase('pt-BR').replace(/[^a-z0-9]+/g, '-')}.pdf`);
  }
  async function exportPdf() { await exportReportPdf('Lista completa da festa', summary().split('\\n'), 'festou.pdf'); }
  async function showHistory() { setBusy(true); try { const result = await mutate({ data: { action: 'audit_history', password } }); setHistory((result as unknown as { history: typeof history }).history ?? []); setModal('history'); } catch(e) { toast.error(e instanceof Error ? e.message : 'Erro ao carregar histórico.'); } finally { setBusy(false); } }
  async function showParticipants() { setBusy(true); try { const result = await mutate({ data: { action: 'participants', password } }); setParticipants(result.participants); setModal('participants'); } catch(e) { toast.error(e instanceof Error ? e.message : 'Erro ao carregar participantes.'); } finally { setBusy(false); } }
  async function openStats(kind: StatsKind) {
    setStatsKind(kind);
    if (kind === 'people') {
      // Visitors see only the aggregate. Registered participants and the
      // organizer can view the nominal directory; the server validates either credential.
      if (!password && !person?.token) {
        setParticipants([]);
        setModal('stats');
        return;
      }
      setBusy(true);
      try {
        const result = await mutate({ data: { action: 'participant_directory', ...(password ? { password } : { token: person?.token }) } });
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
    <header className="site-header"><div className="party-container flex h-full items-center justify-between gap-4"><div className="flex items-center gap-10"><div className="flex shrink-0 items-center"><img src={`${import.meta.env.BASE_URL}festou-logo.svg?v=3`} alt="Festou! — Juntou. Organizou. Festou!" className="h-[62px] w-[250px] object-contain object-left"/></div><nav className="header-nav" aria-label="Navegação principal"><Button type="button" className={`nav-button ${view === 'all' ? 'active' : ''}`} variant="ghost" onClick={() => { setView('all'); document.getElementById('party-list-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}>Lista da festa</Button><Button type="button" className={`nav-button ${view === 'mine' ? 'active' : ''}`} variant="ghost" onClick={() => { setView('mine'); if (!person) { setIdentityMode('login'); setPendingModal(null); setModal('identity'); } document.getElementById('party-list-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}>Minhas contribuições</Button></nav></div><div className="flex items-center gap-1"><Button variant="ghost" size="icon" aria-label={unreadNotifications ? `Abrir notificações, ${unreadNotifications} não lidas` : "Abrir notificações"} onClick={openNotifications} className="relative"><Bell size={18}/>{unreadNotifications > 0 && <span className="absolute -right-0.5 -top-0.5 flex h-[17px] min-w-[17px] items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold leading-none text-destructive-foreground">{unreadNotifications > 9 ? "9+" : unreadNotifications}</span>}</Button><details className="relative"><summary className="flex cursor-pointer list-none items-center gap-2 rounded-lg px-2 py-2 text-sm text-foreground transition-colors hover:bg-muted [&::-webkit-details-marker]:hidden"><span className="initial">{person ? person.name.slice(0,1).toUpperCase() : <Users size={12}/>}</span><span className="hidden sm:inline">{person ? person.name : 'Participar'}</span><ChevronDown size={14}/></summary><div className="absolute right-0 top-full z-50 mt-2 min-w-52 overflow-hidden rounded-xl border border-border bg-popover p-1 shadow-lg"><button type="button" className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm hover:bg-muted" onClick={e => { e.currentTarget.closest('details')?.removeAttribute('open'); if (person) { setModal('account'); } else { setPendingModal(null); setIdentityMode('login'); setModal('identity'); } }}><Users size={16}/>Minha conta</button>{person && <button type="button" disabled={busy} className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm text-destructive hover:bg-muted" onClick={e => { e.currentTarget.closest('details')?.removeAttribute('open'); void logoutCurrentParticipant(); }}><LogOut size={16}/>Sair da minha conta</button>}{password && <><div className="my-1 border-t border-border"/><button type="button" className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm text-destructive hover:bg-muted" onClick={e => { e.currentTarget.closest('details')?.removeAttribute('open'); setPassword(''); toast.success('Você saiu da administração.'); }}><LogOut size={16}/>Sair da administração</button></>}</div></details></div></div></header>
    <section className="party-hero"><img src={garden} alt="Mesa ao ar livre em uma chácara ensolarada" width={1920} height={640}/><div className="party-container hero-content"><span className="hero-eyebrow"><Users size={15}/><span className="hero-verse">Fazei tudo para a glória de Deus.<small>1 Coríntios 10:31</small></span></span><h1>Festou!</h1><p className="hero-tagline">Uma festa especial, construída com a participação de todos!</p><div className="hero-event-date"><CalendarDays size={22}/><strong>{dateLabel}</strong></div><div className="hero-stat-row"><div className="hero-stat-card"><Clock3 size={25}/><div><span>Contagem regressiva</span><strong>{countdownLabel}</strong></div></div><div className="hero-stat-card"><Users size={26}/><div><span>Participantes</span><strong>{data.event.guests ? `${data.event.guests} convidados` : 'Família e amigos'}</strong></div></div></div><div className="hero-closing"><Heart size={23} fill="currentColor"/> <strong>Cada contribuição faz a diferença!</strong></div></div></section>
    {mapsLocationUrl && <section className="party-container mt-6"><div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between"><div className="flex items-center gap-3"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"><MapPin size={22}/></span><div><h2 className="font-semibold">Local da festa</h2><p className="text-sm text-muted-foreground">Veja o endereço e trace sua rota.</p></div></div><a href={mapsLocationUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90">Como chegar <ExternalLink size={16}/></a></div></section>}
    <main className="party-container"><section className="overview"><div className="overview-top"><div className="overview-title">Nossa festa está tomando forma <span className="text-primary">· {progress}%</span></div><span className="live-label"><span className="live-dot"/>{online ? 'Lista compartilhada' : 'Sem conexão'}</span></div><div className="progress-track"><progress value={progress} max={100} aria-label="Progresso da organização"/></div><div className="stat-grid"><button type="button" className="stat stat-button" onClick={() => openStats('items')} aria-label={`Ver os ${total} itens da lista`}><span className="stat-icon"><ClipboardList size={20}/></span><div><strong>{total}</strong><small>Itens na lista</small></div></button><button type="button" className="stat stat-button" onClick={() => openStats('assumed')} aria-label={`Ver os ${assumed} itens assumidos`}><span className="stat-icon assumed"><CheckCheck size={20}/></span><div><strong>{assumed}</strong><small>Itens assumidos</small></div></button><button type="button" className="stat stat-button" onClick={() => openStats('available')} aria-label={`Ver os ${total-assumed} itens ainda disponíveis`}><span className="stat-icon waiting"><ShoppingBag size={20}/></span><div><strong>{total-assumed}</strong><small>Ainda disponíveis</small></div></button><button type="button" className="stat stat-button" onClick={() => openStats('people')} aria-label={`Ver todos os participantes: ${people} cadastrados`}><span className="stat-icon people"><Users size={20}/></span><div><strong>{people}</strong><small>Participantes</small></div></button></div></section>
    <section className="birthday-album mt-8 mb-10" aria-labelledby="birthday-album-title">
      <div className="section-heading">
        <div><h2 id="birthday-album-title"><Cake size={21}/> Aniversariantes</h2><p>Pessoas especiais que fazem parte da nossa história.</p></div>
        {password && <Button size="sm" onClick={() => openBirthdayEditor()}><Plus size={16}/> Adicionar</Button>}
      </div>
      {data.birthdays.length && !person && !password && <p className="help-text">As fotos são protegidas. Informe seu nome para visualizar o álbum. <Button size="sm" variant="outline" onClick={() => open('identity')}>Identificar-me</Button></p>}
      {data.birthdays.length ? <div className="birthday-grid">{data.birthdays.map(person => <article className="birthday-card" key={person.id}>
        {birthdayPhotos[person.photo_path] ? <button type="button" className="birthday-photo-trigger" onClick={() => setBirthdayPreview({ src: birthdayPhotos[person.photo_path]!, name: person.name })} aria-label={`Ampliar foto de ${person.name}`}><img src={birthdayPhotos[person.photo_path]} alt={person.name} loading="lazy"/></button> : <div className="birthday-photo-placeholder" aria-label="Foto protegida"><LockKeyhole size={24}/></div>}
        <strong>{person.name}</strong>
        {password && <div className="birthday-actions"><Button size="sm" variant="outline" onClick={() => openBirthdayEditor(person)}><Pencil size={14}/> Editar</Button><Button size="sm" variant="ghost" onClick={() => { if (window.confirm(`Excluir ${person.name} do álbum de aniversariantes?`)) act({ action: 'birthday_delete', id: person.id }, 'Aniversariante removido.'); }}><Trash2 size={14}/> Excluir</Button></div>}
      </article>)}</div> : <div className="birthday-empty"><Cake size={28}/><p>Ainda não há aniversariantes cadastrados.</p>{password && <Button size="sm" variant="outline" onClick={() => openBirthdayEditor()}><ImagePlus size={16}/> Adicionar primeira foto</Button>}</div>}
    </section>
    {(person || password) && <section className="participants-overview mt-8 mb-10">
      <div className="section-heading">
        <div>
          <h2>Quem vai levar o quê?</h2>
          <p>As contribuições aparecem aqui automaticamente conforme cada pessoa escolhe um item.</p>
        </div>
        <span className="live-label"><span className="live-dot"/>{people} {people === 1 ? 'pessoa contribuindo' : 'pessoas contribuindo'}</span>
      </div>
      {data.reservations.length ? (
        <div className="mx-auto max-w-3xl space-y-2">
          {Array.from(new Set(data.reservations.map(r => r.participant_name.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR'))))
            .map(participantKey => {
              const entries = data.reservations.filter(r => r.participant_name.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR') === participantKey);
              return { participantKey, entries, participantName: entries[0]?.participant_name.trim() ?? 'Participante' };
            })
            .sort((a, b) => a.participantName.localeCompare(b.participantName, 'pt-BR', { sensitivity: 'base' }))
            .map(({ participantKey, entries, participantName }) => (
              <details className="group rounded-xl border border-border bg-card shadow-sm" key={participantKey}>
                <summary className="flex cursor-pointer list-none items-center gap-3 rounded-xl px-3 py-3 transition-colors hover:bg-muted/50 [&::-webkit-details-marker]:hidden">
                  <span className="initial shrink-0">{participantName.slice(0,1).toUpperCase()}</span>
                  <strong className="min-w-0 flex-1 truncate">{participantName}</strong>
                  <span className="shrink-0 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">{entries.length} {entries.length === 1 ? 'item' : 'itens'}</span>
                  <ChevronDown size={18} className="shrink-0 text-muted-foreground transition-transform group-open:rotate-180"/>
                </summary>
                <div className="space-y-2 border-t border-border px-3 py-3">
                  {entries.map(r => {
                    const product = data.products.find(p => p.id === r.product_id);
                    return <div className="flex items-start justify-between gap-3 text-sm" key={r.id}>
                      <span className="min-w-0 font-medium">{product?.name ?? 'Item da lista'}</span>
                      <span className="shrink-0 text-muted-foreground">{number(Number(r.quantity))} {product?.unit ?? ''}</span>
                    </div>;
                  })}
                  <div className="flex justify-end border-t border-border pt-3">
                    <Button type="button" size="sm" variant="outline" onClick={() => exportParticipantPdf({ id: entries[0]!.participant_id, name: participantName })}>
                      <Download size={15}/> Gerar PDF desta lista
                    </Button>
                  </div>
                </div>
              </details>
            ))}
        </div>
      ) : (
        <div className="empty-state rounded-xl border border-dashed border-border py-8">
          <Users size={28} className="mx-auto mb-3"/>
          <p>Ninguém assumiu um item ainda. Quando alguém confirmar uma contribuição, o nome e o item aparecerão aqui.</p>
        </div>
      )}
    </section>}
    <section id="party-list-section" className="list-section scroll-mt-4"><div className="section-heading"><div><h2>{view === 'mine' ? 'Minhas contribuições' : 'O que vamos levar?'}</h2><p>{view === 'mine' ? person ? `Tudo que você combinou de levar, ${person.name}.` : 'Informe seu nome para ver suas contribuições.' : 'Escolha um item e faça parte dessa festa.'}</p></div><div className="list-actions">{(person || password) && <><Button variant="outline" onClick={() => { setRouletteResult(null); setRouletteCategory(0); setModal('roulette'); }}><Dices size={16}/>Roleta da festa</Button><Button variant="outline" onClick={() => share()}><Share2 size={15}/>Compartilhar lista</Button></>}{view === 'mine' && person && <Button variant="outline" onClick={() => exportParticipantPdf({ id: person.id, name: person.name })}><Download size={16}/>PDF da minha lista</Button>}{password && <Button onClick={() => open('add')}><Plus size={16}/>Adicionar item</Button>}</div></div>
    <div className="filter-row"><label className="search-box"><Search size={17}/><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar um item..." aria-label="Buscar um item"/></label><div className="category-filters"><Button variant="ghost" className={`filter-button ${category === 0 ? 'active' : ''}`} onClick={() => setCategory(0)}>Todos os itens</Button>{data.categories.map(c => <Button key={c.id} variant="ghost" className={`filter-button ${category === c.id ? 'active' : ''}`} onClick={() => setCategory(c.id)}>{c.name === 'Bebidas e descartáveis' ? 'Bebidas e outros' : c.name === 'Carnes e complementos' ? 'Carnes' : c.name}</Button>)}</div><select aria-label="Filtrar por status" className="bg-transparent text-xs text-muted-foreground max-w-36" value={status} onChange={e => setStatus(e.target.value)}><option value="all">Todos os status</option><option value="available">Disponíveis</option><option value="partial">Parciais</option><option value="complete">Completos</option><option value="received">Recebidos</option></select></div>
    {person && <div className="sm:hidden flex gap-2 mb-5"><Button variant={view === 'all' ? 'secondary' : 'ghost'} size="sm" onClick={() => setView('all')}>Lista da festa</Button><Button variant={view === 'mine' ? 'secondary' : 'ghost'} size="sm" onClick={() => setView('mine')}>Minhas contribuições</Button></div>}
    {password && <div className="flex flex-wrap gap-2 mb-5"><Button variant="secondary" size="sm" onClick={openEventSettings}><CalendarDays size={16}/>Configurar evento</Button><Button variant="outline" size="sm" onClick={showParticipants}><Users/>Participantes</Button><Button variant="outline" size="sm" onClick={() => setModal('dashboard')}><ListChecks/>Painel de pendências</Button><Button variant="outline" size="sm" onClick={showHistory} disabled={busy}><ClipboardList/>Histórico</Button><Button variant="outline" size="sm" onClick={() => setModal('finance')}>Financeiro</Button><Button variant="outline" size="sm" onClick={exportPdf}><Download/>Exportar PDF</Button><Button variant="outline" size="sm" onClick={() => share(true)}><Share2/>Compartilhar pendências</Button><Button variant="ghost" size="sm" onClick={() => setPassword('')}><LockKeyhole/>Sair da administração</Button></div>}
    {!visible.length && <div className="empty-state"><Package size={32} className="mx-auto mb-3"/><p>{view === 'mine' ? 'Nenhuma contribuição por aqui ainda.' : 'Nenhum item encontrado.'}</p>{view === 'mine' && !person && <Button className="mt-4" onClick={() => open('identity')}>Informar meu nome</Button>}</div>}
    {data.categories.map(c => { const products = visible.filter(p => p.category_id === c.id); if (!products.length) return null; const Icon = icons[c.id - 1] ?? Package; return <section key={c.id}><h3 className="category-heading"><Icon size={18}/>{c.name}<span className="category-count">{products.length} itens</span></h3><div className="product-grid">{products.map(p => { const taken = reservedFor(p.id, data.reservations); const state = itemStatus(p,taken); const remaining = remainingFor(p,taken); const contributions = data.reservations.filter(r => r.product_id === p.id); const isMandatoryKit = p.name.normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').toLocaleLowerCase('pt-BR').includes('kit churrasco'); return <article className={`product-card${isMandatoryKit ? ' product-card-mandatory' : ''}`} key={p.id}><div className="product-top"><span className="product-symbol"><Icon size={20}/></span><span className={`status-pill status-${state}`}>{statusLabels[state]}</span></div><h3>{p.name}</h3><p className="product-needed">Precisamos de <strong>{p.quantity === null ? 'quantidade a definir' : `${number(Number(p.quantity))} ${p.unit}`}</strong></p>{p.note && <p className="help-text mt-2">{p.note}</p>}<div className="progress-track product-meter"><progress value={p.received ? 100 : p.quantity ? Math.min(100, taken/Number(p.quantity)*100) : 0} max={100} aria-label={`Progresso de ${p.name}`}/></div><div className="quantity-line"><strong>{number(taken)} {p.unit} reservados</strong><span>{remaining === null ? 'Total a definir' : `Faltam ${number(remaining)} ${p.unit}`}</span></div>{remaining !== null && remaining > 0 && !p.received && <div className="mt-3 flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-800 dark:text-amber-200" role="status"><Bell size={16} className="mt-0.5 shrink-0"/><span><strong>Está faltando {number(remaining)} {p.unit}.</strong> {taken > 0 ? `Já temos ${number(taken)} de ${number(Number(p.quantity))} ${p.unit} reservados.` : `Ainda precisamos de ${number(Number(p.quantity))} ${p.unit}.`}</span></div>}{remaining === 0 && !p.received && <div className="mt-3 flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-300" role="status"><Check size={16}/><strong>Quantidade completa! Tudo garantido.</strong></div>}{(person || password) && <div className="contributors">{contributions.length ? contributions.map(r => <div className="reservation-contribution" key={r.id}><div className="reservation-person"><span className="initial">{r.participant_name.slice(0,1).toUpperCase()}</span><span className="reservation-person-name">{r.participant_name}</span><span className="reservation-quantity">{number(Number(r.quantity))} {p.unit}</span></div><div className="reservation-actions">{(password || r.participant_id === person?.id) ? <>{p.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR').includes('kit churrasco') && <span className="required-item-alert" role="status"><Bell size={14} aria-hidden="true"/> Item obrigatório</span>}<Button size="sm" variant="outline" className="adjust-button" aria-label={`Ajustar quantidade da contribuição de ${r.participant_name} para ${p.name}`} disabled={busy} onClick={() => { setAdjustingReservation({ id: r.id, quantity: Number(r.quantity), productName: p.name, unit: p.unit }); setModal('adjust'); }}>Ajustar</Button><Button size="sm" variant="outline" className="withdraw-button" aria-label={`Desistir da contribuição de ${r.participant_name} para ${p.name}`} title="Desistir deste item" disabled={busy} onClick={() => { if (window.confirm(`Deseja desistir de levar ${p.name}? A quantidade será liberada para os outros participantes.`)) act({ action: 'cancel', id: r.id }, 'Compromisso cancelado. A quantidade voltou a ficar disponível.'); }}><X size={15}/>Desistir</Button></> : <span className="reservation-state-label">{{ planned: 'Vai comprar', purchased: 'Comprado', at_home: 'Já tem em casa', delivered: 'Entregue' }[r.status ?? (r.source === 'home' ? 'at_home' : 'planned')]}</span>}</div></div>) : <><Users size={12}/>Seja o primeiro a contribuir</>}</div>}<Button variant="secondary" className="carry-button" disabled={busy || !online || state === 'complete' || state === 'received'} onClick={() => password ? openAdminReserve(p) : open('reserve',p)}>{state === 'complete' || state === 'received' ? <Check size={13}/> : <Plus size={13}/>} {state === 'received' ? 'Já recebido' : state === 'complete' ? 'Tudo garantido!' : 'Eu vou levar'}</Button>{password && <div className="admin-controls relative"><Button type="button" variant="outline" size="sm" className="manage-product-button" aria-label={`Gerenciar ${p.name}`} aria-expanded={openProductMenuId === p.id} onClick={() => setOpenProductMenuId(current => current === p.id ? null : p.id)}><MoreVertical size={16}/> Gerenciar</Button>{openProductMenuId === p.id && <div className="absolute right-0 top-full z-20 mt-2 flex min-w-44 flex-col gap-1 rounded-xl border border-border bg-card p-2 shadow-lg"><Button type="button" variant="ghost" className="justify-start" onClick={() => { setOpenProductMenuId(null); open('edit',p); }}><Pencil size={16}/> Editar item</Button><Button type="button" variant="ghost" className="justify-start" onClick={() => { setOpenProductMenuId(null); act({ action: 'received', id: p.id, received: !p.received }, p.received ? 'Recebimento desmarcado.' : 'Item recebido!'); }}><Package size={16}/>{p.received ? 'Desmarcar recebido' : 'Marcar recebido'}</Button><Button type="button" variant="ghost" className="justify-start text-destructive hover:text-destructive" onClick={() => { setOpenProductMenuId(null); const count = contributions.length; const detail = count ? ` Também serão excluídas ${count} ${count === 1 ? 'contribuição vinculada' : 'contribuições vinculadas'}.` : ''; if (window.confirm(`Excluir o item “${p.name}”? Essa ação não pode ser desfeita.${detail}`)) act({ action: 'delete', id: p.id }, 'Item excluído.'); }}><Trash2 size={16}/> Excluir item</Button></div>}</div>}</article>; })}</div></section>; })}
    </section></main><footer className="site-footer"><div className="party-container flex justify-between items-center gap-4 flex-wrap"><div className="footer-brand"><span className="flex items-center gap-2"><TreePine size={14}/>Festou! · Feita por todos, para todos.</span><div className="footer-credit"><span>Uma criação de <strong>Anderson Marques</strong></span><small>© 2026 · Todos os direitos reservados</small></div></div><div className="flex items-center gap-3 flex-wrap"><Button variant="ghost" size="sm" onClick={() => setModal("qrcode")}><Share2/>QR Code do app</Button><Button variant="ghost" size="sm" onClick={() => share(true)}><Share2/>O que ainda falta</Button><Button variant="ghost" size="sm" onClick={() => setModal(password ? 'settings' : 'login')}>{password ? <CalendarDays size={12}/> : <LockKeyhole size={12}/>}{password ? 'Configurar evento' : 'Área do organizador'}</Button></div></div></footer>
    <Dialog open={modal !== null} onOpenChange={v => { if (!v) { setModal(null); setPendingModal(null); } }}><DialogContent className="max-w-md"><DialogHeader><DialogTitle>{modal === 'identity' ? (identityMode === 'setPin' ? 'Criar meu PIN de acesso' : identityMode === 'login' ? 'Já participa da festa?' : 'Criar cadastro de participante') : modal === 'add' ? 'Adicionar novo item' : modal === 'edit' ? 'Editar item' : modal === 'reserve' ? `Eu vou levar ${selected?.name ?? ''}` : modal === 'login' ? 'Área do organizador' : modal === 'dashboard' ? 'Painel de pendências e contribuições' : modal === 'history' ? 'Histórico de atividades' : modal === 'participants' ? 'Participantes da festa' : modal === 'finance' ? 'Controle financeiro' : modal === 'adjust' ? 'Ajustar contribuição' : modal === 'notifications' ? 'Notificações' : modal === 'birthday' ? (selectedBirthday ? 'Editar aniversariante' : 'Adicionar aniversariante') : modal === 'roulette' ? 'Roleta da festa' : modal === 'qrcode' ? 'Compartilhar o Festou!' : modal === 'account' ? 'Minha conta' : modal === 'stats' ? ({ items: 'Todos os itens da lista', assumed: 'Itens assumidos', available: 'O que ainda falta', people: 'Todos os participantes' } as const)[statsKind] : 'Detalhes da festa'}</DialogTitle><DialogDescription>{modal === 'identity' ? (identityMode === 'setPin' ? 'Use um PIN de 6 números para acessar suas contribuições em outros aparelhos.' : identityMode === 'login' ? 'Entre com seu nome e PIN para recuperar suas contribuições.' : 'Informe seu nome para começar a participar.') : modal === 'reserve' ? `${selected?.quantity === null ? 'Quantidade total a definir' : `Ainda faltam ${number(selected ? remainingFor(selected,reservedFor(selected.id,data.reservations)) ?? 0 : 0)} ${selected?.unit}`}` : modal === 'login' ? 'Entre com a senha exclusiva do organizador.' : modal === 'dashboard' ? 'Visão geral das quantidades e dos compromissos da festa.' : modal === 'history' ? 'Últimas 200 alterações registradas no sistema.' : modal === 'participants' ? `${participants.length} pessoas na lista` : modal === 'finance' ? 'Registre e acompanhe os gastos da festa.' : modal === 'adjust' ? `Você reservou ${adjustingReservation ? number(adjustingReservation.quantity) : ''} ${adjustingReservation?.unit ?? ''} de ${adjustingReservation?.productName ?? 'um item'}.` : modal === 'notifications' ? 'Atualizações sobre as contribuições e a organização da festa.' : modal === 'birthday' ? 'Cadastre somente o nome e uma foto.' : modal === 'roulette' ? 'Gire e descubra qual item da festa pode ficar por sua conta!' : modal === 'qrcode' ? 'Envie o QR Code ou o link do aplicativo para seus contatos.' : modal === 'account' ? 'Confira seus dados e suas contribuições nesta festa.' : modal === 'stats' ? ({ items: `${data.products.length} produtos cadastrados`, assumed: `${assumed} itens com contribuição ou recebidos`, available: 'Produtos e quantidades que ainda precisam ser providenciados', people: `${participants.length} pessoas cadastradas, inclusive quem ainda não reservou itens` } as const)[statsKind] : 'Festou!'}</DialogDescription></DialogHeader>
    {modal === 'account' && person && <div className="modal-form">
      <div className="rounded-xl border border-border bg-card p-4">
        <p className="text-xs text-muted-foreground">Participante conectado</p>
        <strong className="text-lg">{person.name}</strong>
        <p className="mt-1 text-sm text-muted-foreground">{data.reservations.filter(r => r.participant_id === person.id).length} contribuições registradas</p>
      </div>
      <form className="modal-form" onSubmit={submitParticipantName}>
        <label>Alterar meu nome<input name="name" required minLength={2} maxLength={60} defaultValue={person.name} autoComplete="name" /></label>
        <Button type="submit" variant="outline" disabled={busy}>{busy ? 'Salvando...' : 'Salvar novo nome'}</Button>
      </form>
      <div className="max-h-56 space-y-2 overflow-y-auto">
        {data.reservations.filter(r => r.participant_id === person.id).map(r => {
          const product = data.products.find(p => p.id === r.product_id);
          return <div key={r.id} className="reservation-row"><div><strong>{product?.name ?? 'Item da festa'}</strong><p className="help-text">{number(Number(r.quantity))} {product?.unit ?? ''}</p></div></div>;
        })}
        {!data.reservations.some(r => r.participant_id === person.id) && <p className="help-text">Você ainda não assumiu nenhum item.</p>}
      </div>
      <Button type="button" className="w-full" onClick={() => { setView('mine'); setModal(null); }}>Ver minhas contribuições</Button>
      <button type="button" className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-border bg-background px-4 py-3 font-medium text-foreground shadow-sm hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" onClick={logoutCurrentParticipant}><LogOut size={16}/>Sair da minha conta</button>
    </div>}
    {modal === 'qrcode' && <div className="modal-form">
      <div className="flex justify-center rounded-xl border border-border bg-white p-4">
        <img src={qrImageUrl()} alt="QR Code para acessar o Festou!" className="h-56 w-56 object-contain" />
      </div>
      <p className="text-center text-sm text-muted-foreground">Compartilhe com amigos e familiares para que eles acessem o Festou! e participem da organização da festa.</p>
      <Button type="button" className="w-full" onClick={shareQrImage}><Share2 size={16}/>Compartilhar QR Code</Button>
      <Button type="button" variant="outline" className="w-full" onClick={shareQrWhatsApp}><MessageCircle size={16}/>Enviar convite pelo WhatsApp</Button>
      <div className="grid grid-cols-2 gap-2">
        <Button type="button" variant="outline" onClick={downloadQrImage}><Download size={16}/>Baixar imagem</Button>
        <Button type="button" variant="outline" onClick={copyAppLink}><Copy size={16}/>Copiar link</Button>
      </div>
    </div>}
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
    {modal === 'notifications' && <div className="modal-form notification-panel"><Button type="button" onClick={enablePushNotifications} disabled={pushEnabled}>{pushEnabled ? <><BellRing size={16}/> Notificações ativadas neste dispositivo</> : <><Bell size={16}/> Ativar notificações neste dispositivo</>}</Button><p className="help-text">As notificações push dependem da permissão do navegador e da inscrição deste dispositivo. Para receber avisos em outro celular ou computador, ative também nele.</p>{notifications.length === 0 ? <p className="help-text">Nenhuma novidade por enquanto. Quando alguém reservar, alterar ou liberar uma contribuição, ou atualizar a situação de um item, as novidades aparecerão aqui.</p> : <div className="notification-list">{notifications.map(item => <button type="button" key={item.id} className={`notification-item ${item.read_at ? 'read' : 'unread'}`} onClick={() => readNotification(item)}><span className="notification-title">{item.title}</span><span>{item.body}</span><small>{new Date(item.created_at).toLocaleString('pt-BR')}</small></button>)}</div>}</div>}
    {modal === 'identity' && identityMode === 'register' && <form className="modal-form" onSubmit={submitIdentity}><label>Seu nome<input name="name" required minLength={2} maxLength={60} defaultValue={person?.name} placeholder="Nome e sobrenome" autoComplete="name"/></label><Button type="submit" disabled={busy}>{busy ? 'Salvando...' : 'Vamos participar'}</Button><Button type="button" variant="ghost" onClick={() => setIdentityMode('login')}>Já tenho cadastro · Entrar com PIN</Button></form>}
    {modal === 'identity' && identityMode === 'login' && <form className="modal-form" onSubmit={submitPinLogin}><label>Seu nome<input name="name" required minLength={2} maxLength={60} defaultValue={person?.name ?? ''} placeholder="Nome e sobrenome" autoComplete="name"/></label><label>PIN de 6 números<input name="pin" type="password" inputMode="numeric" pattern="[0-9]{6}" minLength={6} maxLength={6} required autoComplete="one-time-code" placeholder="••••••"/></label><Button type="submit" disabled={busy}>{busy ? 'Entrando...' : 'Entrar e ver minhas contribuições'}</Button><Button type="button" variant="ghost" onClick={() => setIdentityMode('register')}>Primeira vez? Criar cadastro</Button></form>}
    {modal === 'identity' && identityMode === 'setPin' && <form className="modal-form" onSubmit={submitPinSet}><p className="help-text">Seu nome: <strong>{person?.name}</strong>. Guarde o PIN para entrar em outro celular ou navegador.</p><label>Criar PIN de 6 números<input name="pin" type="password" inputMode="numeric" pattern="[0-9]{6}" minLength={6} maxLength={6} required autoComplete="new-password" placeholder="••••••"/></label><label>Confirmar PIN<input name="confirmation" type="password" inputMode="numeric" pattern="[0-9]{6}" minLength={6} maxLength={6} required autoComplete="new-password" placeholder="Repita o PIN"/></label><Button type="submit" disabled={busy}>{busy ? 'Salvando...' : 'Salvar meu PIN'}</Button></form>}
    {(modal === 'add' || modal === 'edit') && <form className="modal-form" onSubmit={submitProduct}><label>Nome do produto<input name="name" required maxLength={100} defaultValue={modal === 'edit' ? selected?.name : ''} placeholder="Ex.: Gelo"/></label><label>Categoria<select name="category" defaultValue={modal === 'edit' ? selected?.category_id : category || 1}>{data.categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label><div className="form-row"><label>Quantidade necessária<input name="quantity" type="number" min="0.01" step="0.01" max="100000" defaultValue={modal === 'edit' ? selected?.quantity ?? '' : ''} placeholder="A definir"/></label><label>Unidade<select name="unit" defaultValue={modal === 'edit' ? selected?.unit : 'un.'}>{['un.','kg','g','mg','L','ml','litro','litros','pacote','pacotes','caixa','caixas','fardo','fardos','dúzia','garrafa','garrafas','lata','latas','bandeja','rolo','rolos','saco','sacos','kit'].map(u => <option key={u}>{u}</option>)}</select></label></div><label>Observação (opcional)<textarea name="note" maxLength={500} defaultValue={modal === 'edit' ? selected?.note ?? '' : ''} placeholder="Algum detalhe importante?"/></label><Button type="submit" disabled={busy}>{busy ? 'Salvando...' : modal === 'edit' ? 'Salvar alterações' : 'Adicionar à lista'}</Button></form>}
    {modal === 'reserve' && <form className="modal-form" onSubmit={submitReserve}>{password ? <label>Quem vai levar<select name="participant" required><option value="">Selecione um participante</option>{participants.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label> : <label>Quem vai levar<input readOnly value={person?.name ?? ''}/></label>}<label>Quantidade ({selected?.unit})<input name="quantity" type="number" required min="0.01" step="0.01" max={selected ? remainingFor(selected,reservedFor(selected.id,data.reservations)) ?? 100000 : 100000} placeholder="Quanto você vai levar?"/></label><div className="radio-row"><label><input type="radio" name="source" value="home"/>Já tenho em casa</label><label><input type="radio" name="source" value="buy" defaultChecked/>Vou comprar</label></div><Button type="submit" disabled={busy}>{busy ? 'Reservando...' : 'Confirmar contribuição'}</Button></form>}
    {modal === 'adjust' && adjustingReservation && <form className="modal-form" onSubmit={submitAdjustment}><p className="help-text">Informe quanto você realmente conseguirá levar. A diferença será liberada automaticamente para os demais participantes.</p><label>Nova quantidade ({adjustingReservation.unit})<input name="quantity" type="number" required min="0.01" max={adjustingReservation.quantity - 0.01} step="0.01" defaultValue={adjustingReservation.quantity} autoFocus/></label><p className="help-text">Quantidade atual: {number(adjustingReservation.quantity)} {adjustingReservation.unit}</p><Button type="submit" disabled={busy}>{busy ? 'Atualizando...' : 'Salvar nova quantidade'}</Button></form>}
    {modal === 'login' && <form className="modal-form" onSubmit={async e => { e.preventDefault(); const value = String(new FormData(e.currentTarget).get('password')); setBusy(true); try { await mutate({ data: { action: 'verify', password: value } }); setPassword(value); setModal(null); toast.success('Bem-vindo à administração.'); } catch(e) { toast.error(e instanceof Error ? e.message : 'Acesso indisponível.'); } finally { setBusy(false); } }}><label>Senha<input name="password" type="password" required autoComplete="current-password"/></label><Button type="submit" disabled={busy}>{busy ? 'Verificando...' : 'Entrar'}</Button></form>}
    {modal === 'settings' && <form className="modal-form" onSubmit={async e => { e.preventDefault(); const f = new FormData(e.currentTarget); const dates = [...partyDates].sort(); const date = dates[0] ?? null; const endDate = dates.at(-1) ?? null; if (locationUrl.trim() && !isGoogleMapsUrl(locationUrl.trim())) { toast.error('Cole um link HTTPS válido do Google Maps.'); return; } if (await act({ action: 'event', date, endDate, dates, guests: f.get('guests') ? Number(f.get('guests')) : null, locationUrl: locationUrl.trim() || null }, 'Detalhes da festa atualizados!')) setModal(null); }}>
      <p className="help-text">Os dados já cadastrados foram carregados. Altere somente o que desejar; o restante será mantido.</p>
      <label>Datas da festa · adicione ou remova apenas se necessário<input type="date" value={newPartyDate} onChange={e => setNewPartyDate(e.target.value)}/></label>
      <Button type="button" variant="outline" onClick={addPartyDate} disabled={!newPartyDate}><Plus size={16}/> Adicionar dia</Button>
      <div className="party-date-list"><strong>{partyDates.length} {partyDates.length === 1 ? 'dia selecionado' : 'dias selecionados'}</strong>{partyDates.length ? <div className="party-date-chips">{partyDates.map(day => <span className="party-date-chip" key={day}>{new Date(day+'T12:00:00').toLocaleDateString('pt-BR')}<button type="button" aria-label={`Remover dia ${day}`} onClick={() => setPartyDates(partyDates.filter(value => value !== day))}>×</button></span>)}</div> : <p className="help-text">Adicione os dias em que a festa acontecerá. Você pode escolher datas separadas ou consecutivas.</p>}</div>
      <label>Quantidade de convidados (opcional)<input type="number" name="guests" min="1" max="100000" value={guests} onChange={e => setGuests(e.target.value)}/></label>
      <label>Link do local no Google Maps (opcional)<input type="url" inputMode="url" value={locationUrl} onChange={e => setLocationUrl(e.target.value)} maxLength={2048} placeholder="https://maps.app.goo.gl/..." autoComplete="url"/></label>
      <p className="help-text">No Google Maps, toque em Compartilhar, copie o link e cole aqui. O botão “Como chegar” aparecerá para todos os convidados.</p>
      <Button type="submit" disabled={busy}>{busy ? 'Salvando...' : 'Salvar alterações'}</Button></form>}
    {modal === 'finance' && <div className="space-y-4"><div className="rounded-lg bg-secondary p-4"><p className="text-xs text-muted-foreground">Total registrado</p><strong className="text-2xl">R$ {number(expenses.reduce((sum, expense) => sum + Number(expense.amount), 0))}</strong></div><form className="modal-form" onSubmit={addExpense}><label>Descrição<input name="description" required maxLength={120} placeholder="Ex.: compra de bebidas"/></label><label>Valor (R$)<input name="amount" type="number" min="0.01" step="0.01" required/></label><label>Quem pagou<input name="paidBy" required maxLength={60} placeholder="Nome do responsável"/></label><Button type="submit" disabled={busy}>Registrar despesa</Button></form><div className="max-h-56 overflow-y-auto">{expenses.map(expense => <div className="reservation-row" key={expense.id}><div><strong>{expense.description}</strong><p className="help-text">Pago por {expense.paid_by}</p></div><div className="text-right"><strong>R$ {number(Number(expense.amount))}</strong><Button size="sm" variant="ghost" onClick={async () => { if (await act({ action: 'expense_delete', id: expense.id }, 'Despesa removida.')) { try { setExpenses(await getPartyExpenses(password)); } catch { toast.error('Não foi possível atualizar a lista de despesas.'); } } }}>Excluir</Button></div></div>)}{!expenses.length && <p className="help-text py-4">Nenhuma despesa registrada.</p>}</div></div>}
    {modal === 'participants' && <div className="participant-list-scroll max-h-[220px] overflow-y-scroll">{participants.map(p => <div className="reservation-row" key={p.id}><span>{p.name}</span><div className="flex items-center gap-2"><span className="text-muted-foreground text-xs">{data.reservations.filter(r => r.participant_id === p.id).length} contribuições</span><Button size="icon" variant="ghost" title={`Excluir ${p.name}`} aria-label={`Excluir participante ${p.name}`} disabled={busy} onClick={() => deleteParticipant(p)}><Trash2 size={16}/></Button></div></div>)}{!participants.length && <p className="help-text py-6">Ainda não há participantes.</p>}</div>}
    {modal === 'dashboard' && <div className="max-h-[65vh] space-y-4 overflow-y-auto pr-1">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {[{id:'unassigned',label:'Sem responsável',count:unassignedItems.length,icon:Users},{id:'partial',label:'Parcialmente reservados',count:partialItems.length,icon:Bell},{id:'guaranteed',label:'Quantidade garantida',count:guaranteedItems.length,icon:CheckCheck},{id:'received',label:'Já recebidos',count:receivedItems.length,icon:Package},{id:'undefined',label:'Quantidade a definir',count:undefinedQuantityItems.length,icon:ListChecks}].map(card => { const Icon = card.icon; const active = dashboardFilter === card.id; return <button type="button" key={card.id} aria-pressed={active} onClick={() => setDashboardFilter(active ? 'all' : card.id as typeof dashboardFilter)} className={`rounded-xl border p-3 text-left transition-colors ${active ? 'border-primary bg-primary/10 ring-1 ring-primary' : 'border-border bg-card hover:bg-accent'}`}><div className="flex items-center justify-between gap-2"><span className="text-xs text-muted-foreground">{card.label}</span><Icon size={16} className="text-muted-foreground"/></div><strong className="mt-1 block text-2xl">{card.count}</strong></button>; })}
      </div>
      <div className="flex items-center justify-between gap-2"><p className="text-xs text-muted-foreground">{dashboardFilter === 'all' ? 'Todas as situações' : 'Filtro aplicado · toque novamente no indicador para limpar'}</p>{dashboardFilter !== 'all' && <Button size="sm" variant="ghost" onClick={() => setDashboardFilter('all')}>Limpar filtro</Button>}</div>
      <div className="space-y-2">
        {[{id:'unassigned',title:'Ainda sem responsável',items:unassignedItems,empty:'Todos os itens já têm alguém responsável.'},{id:'partial',title:'Parcialmente reservados',items:partialItems,empty:'Nenhum item parcialmente reservado.'},{id:'guaranteed',title:'Quantidade garantida',items:guaranteedItems,empty:'Ainda não há itens com a quantidade completa.'},{id:'received',title:'Recebidos',items:receivedItems,empty:'Nenhum item marcado como recebido.'},{id:'undefined',title:'Quantidade a definir',items:undefinedQuantityItems,empty:'Todos os itens têm quantidade definida.'}].filter(group => dashboardFilter === 'all' || group.id === dashboardFilter).map(group => <section key={group.id} className="rounded-xl border border-border p-3"><h3 className="mb-2 font-semibold">{group.title}</h3>{group.items.length ? <div className="space-y-2">{group.items.map(({product,reserved,remaining,reservations}) => <div key={product.id} className="flex items-start justify-between gap-3 border-t border-border pt-2 text-sm"><div className="min-w-0 flex-1"><strong>{product.name}</strong><p className="text-xs text-muted-foreground">{reservations.length ? reservations.map(r => `${r.participant_name}: ${number(Number(r.quantity))} ${product.unit}`).join(' · ') : 'Ninguém assumiu este item'}</p></div><div className="flex shrink-0 items-center gap-2"><span className="text-right text-xs text-muted-foreground">{product.quantity === null ? `${number(reserved)} ${product.unit} reservados · total a definir` : product.received ? 'Recebido' : remaining === 0 ? 'Completo' : `Faltam ${number(remaining ?? 0)} ${product.unit}`}</span><Button type="button" size="icon" variant="ghost" title={product.received ? `Desmarcar recebimento de ${product.name}` : `Marcar ${product.name} como recebido`} aria-label={product.received ? `Desmarcar recebimento de ${product.name}` : `Marcar ${product.name} como recebido`} disabled={busy} onClick={() => act({ action: 'received', id: product.id, received: !product.received }, product.received ? 'Recebimento desmarcado.' : 'Item recebido!')}><Package size={15}/></Button><Button type="button" size="icon" variant="ghost" title={`Editar ${product.name}`} aria-label={`Editar ${product.name}`} onClick={() => { setSelected(product); setModal('edit'); }}><Pencil size={15}/></Button></div></div>)}</div> : <p className="text-sm text-muted-foreground">{group.empty}</p>}</section>)}
      </div>
    </div>}
    {modal === 'history' && <div className="max-h-[60vh] overflow-y-auto space-y-2 pr-1">
      {history.length ? history.map(item => <article key={item.id} className="rounded-xl border border-border bg-card p-3">
        <div className="flex items-start justify-between gap-3"><div className="min-w-0"><strong className="text-sm">{item.action}</strong><p className="text-sm text-muted-foreground">{item.entity_name ?? 'Registro'} · {item.actor_name}</p></div><time className="shrink-0 text-xs text-muted-foreground">{new Date(item.created_at).toLocaleString('pt-BR')}</time></div>
      </article>) : <p className="help-text py-6 text-center">Nenhuma atividade registrada ainda. As próximas alterações aparecerão aqui.</p>}
    </div>}
    {modal === 'stats' && <div className="space-y-3"><div className="flex flex-wrap justify-end gap-2">{statsKind === 'available' && <Button size="sm" onClick={shareAvailableList}><MessageCircle size={15}/> Compartilhar lista</Button>}<Button size="sm" variant="outline" onClick={() => exportStatsPdf()}><Download size={15}/> Exportar PDF</Button></div><div className="participant-report-scroll max-h-[220px] overflow-y-scroll space-y-2 pr-1">
      {statsKind === 'people' && (!password && !person?.token ? <div className="rounded-lg border border-border bg-muted/40 p-4 text-center"><strong>{data.participantCount} participantes cadastrados</strong><p className="help-text mt-1">Entre com seu cadastro para visualizar a relação nominal dos participantes.</p></div> : participants.length ? participants.map(p => {
        const entries = data.reservations.filter(r => r.participant_id === p.id);
        return <div className="stats-list-row" key={p.id}><div className="min-w-0"><strong>{p.name}</strong></div><div className="flex items-center gap-1"><span className="stats-list-count">{entries.length} {entries.length === 1 ? 'item' : 'itens'}</span>{password && <Button size="icon" variant="ghost" title={`Excluir ${p.name}`} aria-label={`Excluir participante ${p.name}`} disabled={busy} onClick={() => deleteParticipant(p)}><Trash2 size={16}/></Button>}</div></div>;
      }) : <p className="help-text py-6 text-center">Ainda não há participantes cadastrados.</p>)}
      {statsKind !== 'people' && (data.products.filter(p => statsKind === 'items' || (statsKind === 'assumed' ? reservedFor(p.id, data.reservations) > 0 || p.received : !p.received && itemStatus(p, reservedFor(p.id, data.reservations)) !== 'complete')).length ? data.products.filter(p => statsKind === 'items' || (statsKind === 'assumed' ? reservedFor(p.id, data.reservations) > 0 || p.received : !p.received && itemStatus(p, reservedFor(p.id, data.reservations)) !== 'complete')).map(p => {
        const taken = reservedFor(p.id, data.reservations);
        const remaining = remainingFor(p, taken);
        const entries = data.reservations.filter(r => r.product_id === p.id);
        return <div className="stats-list-row" key={p.id}><div className="min-w-0"><strong>{p.name}</strong><p>{entries.length ? entries.map(r => `${r.participant_name} (${number(Number(r.quantity))} ${p.unit})`).join(', ') : 'Ninguém assumiu este item ainda'}</p></div><span className="stats-list-count">{statsKind === 'available' ? remaining === null ? 'A definir' : `Faltam ${number(remaining)} ${p.unit}` : p.quantity === null ? `${number(taken)} ${p.unit}` : `${number(taken)} / ${number(Number(p.quantity))} ${p.unit}`}</span></div>;
      }) : <p className="help-text py-6 text-center">Não há itens nesta situação. Tudo certo!</p>)}
    </div></div>}
    </DialogContent></Dialog>
    <Dialog open={birthdayPreview !== null} onOpenChange={open => { if (!open) setBirthdayPreview(null); }}>
      <DialogContent className="birthday-preview-dialog">
        <DialogHeader><DialogTitle>{birthdayPreview?.name ?? "Foto do aniversariante"}</DialogTitle><DialogDescription>Foto ampliada</DialogDescription></DialogHeader>
        {birthdayPreview && <img className="birthday-preview-image" src={birthdayPreview.src} alt={birthdayPreview.name}/>}
      </DialogContent>
    </Dialog>
  </>;
}
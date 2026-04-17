
(function(){
const seedData = window.__TOPBRS_SEED__;
const STORAGE_KEY = 'topbrs-ultra-pwa-v6-1-auth';
const LEGACY_STORAGE_KEYS = ['topbrs-ultra-pwa-v4-2-elite-arena','topbrs-ultra-pwa-v3-9-safe','topbrs-ultra-pwa-v4-0-1-real-fix','topbrs-ultra-pwa-v4-0-real-fix','topbrs-ultra-pwa-v3-7','topbrs-ultra-pwa-v3-6','topbrs-ultra-pwa-v3-5','topbrs-ultra-pwa-v3-4','topbrs-ultra-pwa-v3-3','topbrs-ultra-pwa-v3-2','topbrs-ultra-pwa-v3-1','topbrs-ultra-pwa-v3-0','topbrs-ultra-pwa-v2-9','topbrs-ultra-pwa-v2-8','topbrs-ultra-pwa-v2-7','topbrs-ultra-pwa-v2-4','topbrs-ultra-pwa-v2-3','topbrs-ultra-pwa-v2-2','topbrs-ultra-pwa-v2'];
const appVersion = 'V2.0.7.5 Oficial Auto';
const WAR_AUTO_SANDBOX = true;
const WAR_AUTO_REALTIME_READONLY = true;
const monthLabels = {
  JANEIRO:'Janeiro',FEVEREIRO:'Fevereiro','MARÇO':'Março',ABRIL:'Abril',MAIO:'Maio',JUNHO:'Junho',
  JULHO:'Julho',AGOSTO:'Agosto',SETEMBRO:'Setembro',OUTUBRO:'Outubro',NOVEMBRO:'Novembro',DEZEMBRO:'Dezembro'
};
const dayOrder = ['quinta','sexta','sabado','domingo'];
let deferredPrompt = null;
const WAR_AUTO_AUTO_REFRESH_MS = 30000;
let warAutoRefreshTimer = null;
let warAutoRefreshBusy = false;
let currentDecksRarityFilter = 'all';
let __topbrsToastTimer = null;

function ensureToastHost(){
  let host = document.getElementById('topbrsToastHost');
  if(!host){
    host = document.createElement('div');
    host.id = 'topbrsToastHost';
    host.className = 'topbrs-toast-host';
    document.body.appendChild(host);
  }
  return host;
}

function showToast(message='', tone='success'){
  const host = ensureToastHost();
  host.innerHTML = `<div class="topbrs-toast ${tone==='error' ? 'error' : ''}">${esc(String(message||''))}</div>`;
  host.classList.add('visible');
  clearTimeout(__topbrsToastTimer);
  __topbrsToastTimer = setTimeout(() => host.classList.remove('visible'), 2200);
}

function setButtonWorking(btn, working=false, doneLabel='Salvo'){
  if(!btn) return;
  if(working){
    if(!btn.dataset.defaultLabel) btn.dataset.defaultLabel = btn.textContent;
    btn.disabled = true;
    btn.classList.add('is-working');
    btn.textContent = 'Salvando...';
    return;
  }
  btn.disabled = false;
  btn.classList.remove('is-working');
  btn.classList.add('is-done');
  btn.textContent = doneLabel;
  setTimeout(() => {
    btn.classList.remove('is-done');
    btn.textContent = btn.dataset.defaultLabel || 'Salvar';
  }, 1400);
}

function normalizePlayerTag(value=''){
  let tag = String(value || '').trim().toUpperCase().replace(/\s+/g, '');
  if(!tag) return '';
  if(!tag.startsWith('#')) tag = `#${tag.replace(/^#+/, '')}`;
  return tag;
}

function normalizeMatchText(value=''){
  return String(value||'')
    .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .replace(/[^a-zA-Z0-9]/g,'')
    .trim().toLowerCase();
}

function resolveCurrentLinkedMember(){
  const uid = currentAccessUid ? currentAccessUid() : '';
  const email = currentAccessEmail ? currentAccessEmail() : '';
  const nick = currentAccessNick ? currentAccessNick() : '';
  const linked = currentAccessLinkedMemberName ? currentAccessLinkedMemberName() : '';
  const explicitTag = normalizePlayerTag(window.TOPBRS_ACCESS?.playerTag || '');
  const active = typeof activeMembers === 'function' ? activeMembers() : [];
  return active.find(member => {
    const memberTag = normalizePlayerTag(member.playerTag || member.tag || '');
    const memberNames = [member.name, member.nick, member.fullName, member.linkedMemberName]
      .map(v => String(v || '').trim().toLowerCase())
      .filter(Boolean);
    if(explicitTag && memberTag && explicitTag === memberTag) return true;
    if(uid && String(member.linkedAuthUid || '') === uid) return true;
    if(email && String(member.linkedEmail || '').trim().toLowerCase() === email) return true;
    if(linked && memberNames.includes(linked)) return true;
    if(nick && memberNames.includes(nick)) return true;
    return false;
  }) || null;
}

let __currentPlayerLiveProfile = null;
let __currentPlayerLiveProfileTag = '';
async function ensureCurrentPlayerLiveProfile(force=false){
  const linkedMember = resolveCurrentLinkedMember();
  const tag = normalizePlayerTag(window.TOPBRS_ACCESS?.playerTag || linkedMember?.playerTag || linkedMember?.tag || '');
  if(!tag) return null;
  if(!force && __currentPlayerLiveProfile && __currentPlayerLiveProfileTag === tag){
    return __currentPlayerLiveProfile;
  }
  const profile = await fetchClashPlayerProfile(tag, { force });
  if(profile){
    __currentPlayerLiveProfile = profile;
    __currentPlayerLiveProfileTag = tag;
  }
  return profile || null;
}

async function getRuntimeClashApiBase(force=false){
  try{
    if(window.TOPBRS_API?.loadClashApiBase){
      return await window.TOPBRS_API.loadClashApiBase(force);
    }
  }catch(e){}
  return String(window.TOPBRS_RUNTIME_CONFIG?.clashApiBase || window.TOPBRS_FIREBASE_CONFIG?.clashApiBase || '').replace(/\/$/, '');
}

async function fetchClashPlayerProfile(playerTag, options={}){
  const tag = normalizePlayerTag(playerTag);
  if(!tag) return null;
  const apiBase = await getRuntimeClashApiBase(Boolean(options.force));
  if(!apiBase) throw new Error('API base indisponível');
  const res = await fetch(`${apiBase}/player/${encodeURIComponent(tag)}`, { cache:'no-store' });
  if(!res.ok) throw new Error('Falha ao ler jogador');
  return await res.json();
}

async function fetchClashCurrentRiverRace(clanTag, options={}){
  const tag = normalizePlayerTag(clanTag || window.TOPBRS_FIREBASE_CONFIG?.clashClanTag || '#QRG9QQ');
  const apiBase = await getRuntimeClashApiBase(Boolean(options.force));
  if(!apiBase) throw new Error('API base indisponível');
  const res = await fetch(`${apiBase}/clan/${encodeURIComponent(tag)}/currentriverrace`, { cache:'no-store' });
  if(!res.ok) throw new Error('Falha ao ler guerra atual');
  return await res.json();
}

async function fetchClashClanProfile(clanTag, options={}){
  const tag = normalizePlayerTag(clanTag || window.TOPBRS_FIREBASE_CONFIG?.clashClanTag || '#QRG9QQ');
  const apiBase = await getRuntimeClashApiBase(Boolean(options.force));
  if(!apiBase) throw new Error('API base indisponível');
  const res = await fetch(`${apiBase}/clan/${encodeURIComponent(tag)}`, { cache:'no-store' });
  if(!res.ok) throw new Error('Falha ao ler clã');
  return await res.json();
}

function roleEligibleForSystem(role=''){
  const normalized = normalizeMatchText(role);
  return ['anciao','colider','lider'].includes(normalized);
}

function findActiveMemberLink(record={}){
  const active = activeMembers();
  const byTag = new Map(active.map(m => [normalizePlayerTag(m.playerTag || m.tag || ''), m]));
  const byName = new Map(active.map(m => [normalizeMatchText(m.name || m.nick || ''), m]));
  return byTag.get(normalizePlayerTag(record.playerTag || record.tag || '')) || byName.get(normalizeMatchText(record.name || record.nick || '')) || null;
}

async function loadApiConfigSnapshot(force=false){
  try{
    if(window.TOPBRS_API?.loadClashApiBase){
      await window.TOPBRS_API.loadClashApiBase(force);
    }
  }catch(e){}
  const cfg = window.TOPBRS_RUNTIME_CONFIG?.clashApiBase || window.TOPBRS_FIREBASE_CONFIG?.clashApiBase || '';
  let extra = {};
  try{
    const getDoc = window.TOPBRS_AUTH_UI?.__firestoreGetDoc;
    const docFn = window.TOPBRS_AUTH_UI?.__firestoreDoc;
    const db = window.TOPBRS_AUTH_UI?.__firestoreDb;
    if(getDoc && docFn && db){
      const snap = await getDoc(docFn(db, 'system', 'apiConfig'));
      extra = snap.data?.() || {};
    }
  }catch(e){}
  return {
    clashApiBase: String(extra.clashApiBase || cfg || '').replace(/\/$/, ''),
    source: String(extra.source || ''),
    updatedAt: String(extra.updatedAt || '')
  };
}

function getCurrentWarDayKey(){
  const day = new Date().getDay();
  if(day === 4) return 'thu';
  if(day === 5) return 'fri';
  if(day === 6) return 'sat';
  if(day === 0) return 'sun';
  return null;
}

function getArenaLabelFromTrophies(trophies=0){
  const t = Number(trophies||0);
  if(t >= 9000) return 'Liga';
  if(t >= 8500) return 'Arena 23';
  if(t >= 8000) return 'Arena 22';
  if(t >= 7500) return 'Arena 21';
  if(t >= 7000) return 'Arena 20';
  if(t >= 6500) return 'Arena 19';
  if(t >= 6000) return 'Arena 18';
  if(t >= 5600) return 'Arena 17';
  if(t >= 5300) return 'Arena 16';
  if(t >= 5000) return 'Arena 15';
  return `Arena ${Math.max(1, Math.floor(t/300))}`;
}

const ARENA_NAME_MAP = {
  "Goblin Stadium":"Estádio dos Goblins",
  "Bone Pit":"Fosso de Ossos",
  "Barbarian Bowl":"Arena dos Bárbaros",
  "Spell Valley":"Vale das Magias",
  "Builder's Workshop":"Oficina do Construtor",
  "Pekka's Playhouse":"Casa de Brincadeira da P.E.K.K.A",
  "Royal Arena":"Arena Real",
  "Frozen Peak":"Pico Congelado",
  "Jungle Arena":"Arena Selvagem",
  "Hog Mountain":"Montanha do Porco",
  "Electro Valley":"Vale Elétrico",
  "Spooky Town":"Cidade Assombrada",
  "Rascal's Hideout":"Esconderijo dos Patifes",
  "Serenity Peak":"Pico da Serenidade",
  "Miner's Mine":"Mina do Mineiro",
  "Executioner's Kitchen":"Cozinha do Executor",
  "Royal Crypt":"Cripta Real",
  "Silent Sanctuary":"Santuário Silencioso",
  "Dragon Spa":"Spa do Dragão",
  "Boot Camp":"Campo de Treino",
  "Clash Fest":"Clash Fest",
  "Pan-cake Arena":"Arena de Panquecas",
  "Rumble Road":"Estrada da Rixa",
  "Electro Buffs":"Bufos Elétricos",
  "Spooky Circus":"Circo Assombrado",
  "Secret Valley":"Vale Secreto",
  "Builder's Kitchen":"Cozinha do Construtor",
  "Magic Academy":"Escola Mágica",
  "Spirit Square":"Praça dos Espíritos",
  "Legendary Arena":"Arena Lendária"
};

function translateArenaName(name=''){
  return ARENA_NAME_MAP[name] || name || 'Arena';
}

function getArenaStageLabel(arena={}){
  const raw = String(arena?.rawName || '');
  const m = raw.match(/Arena_L(\d+)/i);
  if(m) return `Arena ${Number(m[1])}`;
  return '';
}

function formatPlayerCompactMeta(profile={}){
  if(!profile || !profile.name){ return 'Sincronize sua tag para ver troféus e arena.'; }
  const trophies = Number(profile?.trophies || 0).toLocaleString('pt-BR');
  const arenaName = translateArenaName(profile?.arena?.name || getArenaLabelFromTrophies(profile?.trophies));
  const arenaStage = getArenaStageLabel(profile?.arena);
  return `${trophies} 🏆 | ${arenaName}${arenaStage ? ' - ' + arenaStage : ''}`;
}

function getDisplayedCardLevel(card={}){
  const rarity = String(card?.rarity || '').toLowerCase();
  const level = Number(card?.level || 0);
  const offset = rarity === 'rare' ? 2 : rarity === 'epic' ? 5 : rarity === 'legendary' ? 8 : rarity === 'champion' ? 10 : 0;
  const shown = level + offset;
  return shown || Number(card?.evolutionLevel || card?.maxLevel || 0) || 0;
}

function cardImage(card={}){
  return card?.iconUrls?.medium || card?.iconUrls?.evolutionMedium || card?.iconUrls?.large || '';
}

const RARITY_LABELS_PT = { common:'Comum', rare:'Rara', epic:'Épica', legendary:'Lendária', champion:'Campeã' };
function translateCardName(name=''){
  const map = {
    'Zap':'Zap','Firecracker':'Atiradora','Minion Horde':'Horda de Servos','Sparky':'Sparky','Elite Barbarians':'Bárbaros de Elite','Arrows':'Flechas','Giant Skeleton':'Esqueleto Gigante','Elixir Collector':'Coletor de Elixir','Baby Dragon':'Bebê Dragão','Balloon':'Balão','Freeze':'Gelo','Princess':'Princesa','Bomber':'Bombardeiro','Dagger Duchess':'Duquesa das Adagas'
  };
  const key = String(name || '').trim();
  return map[key] || key.replace(/^The\s+/i,'').trim();
}
function translateCardRarity(rarity=''){
  const key = String(rarity || '').toLowerCase();
  return RARITY_LABELS_PT[key] || rarity || 'Carta';
}
function filterCardsByRarity(cards=[], rarity='all'){
  if(rarity === 'all') return cards;
  return cards.filter(card => String(card?.rarity || '').toLowerCase() === rarity);
}

async function updateDrawerProfileSummary(force=false){
  const summary = document.getElementById('drawerProfileSummary');
  if(!summary) return;
  const access = window.TOPBRS_ACCESS || {};
  const linkedMember = resolveCurrentLinkedMember();
  let profile = null;
  try{ profile = await ensureCurrentPlayerLiveProfile(true); }catch(e){}
  const name = profile?.name || linkedMember?.name || linkedMember?.nick || (displayLabel ? displayLabel(access) : (access.nick || access.email || 'Usuário'));
  const compact = profile ? formatPlayerCompactMeta(profile || {}) : 'Sincronize sua tag para ver troféus e arena.';
  summary.classList.remove('hidden');
  summary.innerHTML = `<div class="profile-summary-main shimmer-gold"><strong>${esc(name)}</strong><small>${esc(compact)}</small></div>`;
}

function getRarityClass(rarity=''){
  const key = String(rarity || '').toLowerCase();
  return ['common','rare','epic','legendary','champion'].includes(key) ? `rarity-${key}` : 'rarity-common';
}

function renderDeckCard(card={}){
  const level = getDisplayedCardLevel(card);
  const img = cardImage(card);
  const label = translateCardName(card.name || 'Carta');
  const rarityClass = getRarityClass(card.rarity || 'common');
  return `<article class="deck-card ${rarityClass}" title="${esc(label)}"><div class="deck-card-frame ${rarityClass}">${img ? `<img src="${esc(img)}" alt="${esc(label)}" loading="lazy">` : `<div class="deck-card-fallback">${esc(label.slice(0,2).toUpperCase())}</div>`}<span class="deck-level-badge">Nv ${esc(String(level || '—'))}</span></div><div class="deck-card-name">${esc(label)}</div></article>`;
}

function renderCollectionCard(card={}){
  const level = getDisplayedCardLevel(card);
  const img = cardImage(card);
  const label = translateCardName(card.name || 'Carta');
  const rarity = translateCardRarity(card.rarity || '');
  const rarityClass = getRarityClass(card.rarity || 'common');
  return `<article class="deck-collection-card ${rarityClass}" title="${esc(label)} • ${esc(rarity)}"><div class="deck-collection-frame ${rarityClass}">${img ? `<img src="${esc(img)}" alt="${esc(label)}" loading="lazy">` : `<div class="deck-card-fallback">${esc(label.slice(0,2).toUpperCase())}</div>`}<span class="deck-level-badge">Nv ${esc(String(level || '—'))}</span><span class="deck-rarity-badge ${rarityClass}">${esc(rarity)}</span></div><div class="deck-card-name">${esc(label)}</div></article>`;
}

async function renderDecksView(force=false){
  if(!ui.decksMeta || !ui.decksCurrentDeck || !ui.decksCardsGrid) return;
  const tag = currentAccessPlayerTag();
  if(!tag){
    ui.decksMeta.textContent = 'Defina sua tag para visualizar deck e coleção.';
    ui.decksCurrentDeck.innerHTML = '';
    ui.decksCardsGrid.innerHTML = '<div class="empty">Sem tag vinculada ao usuário atual.</div>';
    return;
  }
  ui.decksMeta.textContent = 'Carregando deck e cartas do jogador...';
  try{
    let profile = null;
    try{
      profile = await ensureCurrentPlayerLiveProfile(true);
    }catch(e){
      profile = __currentPlayerLiveProfile || null;
      if(!profile){
        try{ profile = await ensureCurrentPlayerLiveProfile(false); }catch(err2){}
      }
    }
    if(!profile){
      ui.decksMeta.textContent = 'API temporariamente indisponível.';
      ui.decksCurrentDeck.innerHTML = '<div class="empty">Deck atual indisponível.</div>';
      ui.decksCardsGrid.innerHTML = '<div class="empty">Não foi possível carregar os decks agora.</div>';
      return;
    }
    const currentDeck = Array.isArray(profile.currentDeck) ? profile.currentDeck : [];
    const cards = Array.isArray(profile.cards) ? profile.cards : [];
    const compact = `${Number(profile?.trophies || 0).toLocaleString('pt-BR')} 🏆 | ${translateArenaName(profile?.arena?.name || getArenaLabelFromTrophies(profile?.trophies))}${getArenaStageLabel(profile?.arena) ? ' - ' + getArenaStageLabel(profile?.arena) : ''}`;
    ui.decksMeta.innerHTML = `<div class="war-auto-live-pill decks-live-pill"><strong>${esc(profile?.name || 'Jogador')}</strong><span>${esc(compact)}</span></div>`;
    ui.decksCurrentDeck.innerHTML = currentDeck.length ? currentDeck.slice(0,8).map(renderDeckCard).join('') : '<div class="empty">Deck atual não disponível agora.</div>';
    const filteredCards = filterCardsByRarity(cards, currentDecksRarityFilter);
    const sortedCards = [...filteredCards].sort((a,b) => getDisplayedCardLevel(b) - getDisplayedCardLevel(a) || String(translateCardName(a.name)).localeCompare(String(translateCardName(b.name)), 'pt-BR'));
    ui.decksCardsGrid.innerHTML = sortedCards.length ? sortedCards.map(renderCollectionCard).join('') : '<div class="empty">Nenhuma carta encontrada nesse filtro.</div>';
  }catch(err){
    ui.decksMeta.textContent = 'API temporariamente indisponível.';
    ui.decksCurrentDeck.innerHTML = '<div class="empty">Deck atual indisponível.</div>';
    ui.decksCardsGrid.innerHTML = '<div class="empty">Não foi possível carregar os decks agora.</div>';
  }
}



function clearWarAutoRefreshTimer(){
  if(warAutoRefreshTimer){
    clearInterval(warAutoRefreshTimer);
    warAutoRefreshTimer = null;
  }
}

async function runWarAutoRefreshCycle(reason='timer'){
  if(warAutoRefreshBusy) return;
  if(activeViewId !== 'warAutoView') return;
  warAutoRefreshBusy = true;
  try{
    await renderWarAutoView({ force: true, silent: reason !== 'manual' });
  }catch(e){
    console.error('War auto refresh cycle error:', e);
  }finally{
    warAutoRefreshBusy = false;
  }
}

function startWarAutoRefreshTimer(){
  clearWarAutoRefreshTimer();
  if(activeViewId !== 'warAutoView') return;
  warAutoRefreshTimer = setInterval(() => {
    runWarAutoRefreshCycle('timer');
  }, WAR_AUTO_AUTO_REFRESH_MS);
}

function buildWarAutoApiRowsFromRace(raceData, selection){
  const participants = raceData?.clan?.participants || raceData?.participants || raceData?.items || raceData?.clans?.[0]?.participants || [];
  const currentDay = getCurrentWarDayKey();
  const active = activeMembers();
  const byTag = new Map(active.map(m => [normalizePlayerTag(m.playerTag || m.tag || ''), m]));
  const byName = new Map(active.map(m => [normalizeMatchText(m.name || m.nick || ''), m]));
  return participants.map((p, index) => {
    const member = byTag.get(normalizePlayerTag(p.tag)) || byName.get(normalizeMatchText(p.name)) || {};
    const row = {
      playerTag: normalizePlayerTag(p.tag || member.playerTag || ''),
      name: member.name || p.name || member.nick || 'Sem nome',
      role: member.role || 'Membro',
      thu: 0, fri: 0, sat: 0, sun: 0,
      total: Number(p.decksUsed ?? p.battlesPlayed ?? p.decksUsedToday ?? 0),
      points: Number(p.fame || 0) + Number(p.repairPoints || 0),
      decksUsedToday: Number(p.decksUsedToday || 0),
      apiLive: true,
      weekId: `${monthLabel(selection.month)} • Semana ${selection.week}`
    };
    if(currentDay) row[currentDay] = Number(p.decksUsedToday || 0);
    return row;
  });
}

function mergeWarAutoRows(manualRows, apiRows){
  const merged = new Map((manualRows || []).map(r => [normalizePlayerTag(r.playerTag || '' ) || normalizeMatchText(r.name), { ...r, apiLive:false, points: Number(r.points||0) }]));
  for(const apiRow of (apiRows || [])){
    const key = normalizePlayerTag(apiRow.playerTag || '') || normalizeMatchText(apiRow.name);
    const base = merged.get(key) || { thu:0,fri:0,sat:0,sun:0,total:0,name:apiRow.name,role:apiRow.role,playerTag:apiRow.playerTag };
    const next = { ...base, ...apiRow };
    ['thu','fri','sat','sun'].forEach(day => { if(apiRow[day] != null && apiRow[day] !== 0) next[day] = Number(apiRow[day]); });
    const computed = ['thu','fri','sat','sun'].reduce((sum, day)=> sum + Number(next[day]||0), 0);
    next.total = Math.max(Number(apiRow.total || 0), computed);
    merged.set(key, next);
  }
  return Array.from(merged.values());
}

const state = loadState();
state.ui ||= {};
state.ui.lastSyncAt ||= new Date().toISOString();
state.ui.warAutoExpanded ||= {};
const ui = {
  monthSelect: $('#monthSelect'),
  weekSelect: $('#weekSelect'),
  usersBoard: $('#usersBoard'),
  monthChipBar: $('#monthChipBar'),
  weekChipBar: $('#weekChipBar'),
  kpiGrid: $('#kpiGrid'),
  podium: $('#podium'),
  goalPanel: $('#goalPanel'),
  rankingList: $('#rankingList'),
  leaderActions: $('#leaderActions'),
  annualPulse: $('#annualPulse'),
  warBoard: $('#warBoard'),
  warAutoStats: $('#warAutoStats'),
  warAutoMeta: $('#warAutoMeta'),
  warAutoBoard: $('#warAutoBoard'),
  warAutoRefreshBtn: $('#warAutoRefreshBtn'),
  warRankingMeta: $('#warRankingMeta'),
  warRankingBoard: $('#warRankingBoard'),
  warRankingMonthChipBar: $('#warRankingMonthChipBar'),
  warRankingWeekChipBar: $('#warRankingWeekChipBar'),
  warRankingRefreshBtn: $('#warRankingRefreshBtn'),
  membersSyncMeta: $('#membersSyncMeta'),
  membersSyncBoard: $('#membersSyncBoard'),
  membersSyncRefreshBtn: $('#membersSyncRefreshBtn'),
  apiLogsMeta: $('#apiLogsMeta'),
  apiLogsBoard: $('#apiLogsBoard'),
  apiLogsRefreshBtn: $('#apiLogsRefreshBtn'),
  warAutoPrepareBtn: $('#warAutoPrepareBtn'),
  warAutoMonthChipBar: $('#warAutoMonthChipBar'),
  warAutoWeekChipBar: $('#warAutoWeekChipBar'),
  tournamentEditor: $('#tournamentEditor'),
  tournamentBoard: $('#tournamentBoard'),
  classificationMonthSelect: $('#classificationMonthSelect'),
  classificationBoard: $('#classificationBoard'),
  eliteBoard: $('#eliteBoard'),
  historyBoard: $('#historyBoard'),
  membersGrid: $('#membersGrid'),
  memberModal: $('#memberModal'),
  memberModalBody: $('#memberModalBody'),
  userEditModal: $('#userEditModal'),
  userEditBody: $('#userEditBody'),
  createMemberModal: $('#createMemberModal'),
  createMemberForm: $('#createMemberForm'),
  createMemberName: $('#createMemberName'),
  createMemberNick: $('#createMemberNick'),
  createMemberTag: $('#createMemberTag'),
  createMemberRole: $('#createMemberRole'),
  goalModal: $('#goalModal'),
  vaultInsights: $('#vaultInsights'),
  heroMonth: $('#heroMonth'),
  heroClanName: $('#heroClanName'),
  heroSync: $('#heroSync'),
  installBtn: $('#installBtn'),
  sideDrawer: $('#sideDrawer'),
  drawerBackdrop: $('#drawerBackdrop'),
  menuToggleBtn: $('#menuToggleBtn'),
  menuHint: $('#menuHint'),
  backToTopBtn: $('#backToTopBtn'),
  currentViewBadge: $('#currentViewBadge'),
  viewMenuDropdown: $('#viewMenuDropdown'),
  heroSection: $('.hero'),
  weekHeroPicker: $('#weekHeroPicker'),
  archivedBoard: $('#archivedBoard'),
  decksMeta: $('#decksMeta'),
  decksCurrentDeck: $('#decksCurrentDeck'),
  decksCardsGrid: $('#decksCardsGrid'),
  decksFilterBar: $('#decksFilterBar'),
  memberActionModal: $('#memberActionModal'),
  memberActionBody: $('#memberActionBody'),
  vaultAccessModal: $('#vaultAccessModal'),
  vaultAccessForm: $('#vaultAccessForm'),
  vaultPasswordInput: $('#vaultPasswordInput'),
  vaultAccessError: $('#vaultAccessError'),
  vaultAccessCancelBtn: $('#vaultAccessCancelBtn')
};

let rankMode = 'elite';
let warFilter = 'all';
let touchMenuState = null;
const VAULT_PASSWORD = 'liderestopbrs';
setupDeckFilters();
const VAULT_SESSION_KEY = 'topbrs-vault-unlocked';
let lastNonVaultView = 'arenaView';

const viewLabels = {
  arenaView:'Arena 🏟️',
  warView:'Guerra ⚔️',
  warAutoView:'Guerra Auto 🤖',
  warRankingView:'Ranking Guerra ⚔️',
  membersSyncView:'Membros Sync 🔄',
  apiLogsView:'Logs API 🛰️',
  tournamentView:'Torneio 🏆',
  classificationView:'Classificação 📊',
  eliteView:'Elite 👑',
  membersView:'Membros 👥',
  vaultView:'Cofre 🔐',
  usersView:'Usuários 🪪',
  archivedView:'Arquivados 📦',
  decksView:'Decks 🃏'
};

function currentAccessRole(){
  return window.TOPBRS_ACCESS?.accessRole || 'viewer';
}
function canEditApp(){
  return ['admin','editor'].includes(currentAccessRole());
}
function isAdminApp(){
  return currentAccessRole() === 'admin';
}
function currentAccessUid(){
  return String(window.TOPBRS_ACCESS?.uid || '');
}
function currentAccessEmail(){
  return String(window.TOPBRS_ACCESS?.email || '').trim().toLowerCase();
}
function currentAccessNick(){
  return String(window.TOPBRS_ACCESS?.nick || '').trim().toLowerCase();
}
function currentAccessPlayerTag(){
  const linkedMember = resolveCurrentLinkedMember();
  return normalizePlayerTag(window.TOPBRS_ACCESS?.playerTag || linkedMember?.playerTag || linkedMember?.tag || '');
}
function currentAccessLinkedMemberName(){
  return String(window.TOPBRS_ACCESS?.linkedMemberName || '').trim().toLowerCase();
}
function memberMatchesCurrentUser(member){
  if(!member) return false;
  if(member.ghostAdmin) return false;
  const uid = currentAccessUid();
  const email = currentAccessEmail();
  const nick = currentAccessNick();
  const linkedMemberName = currentAccessLinkedMemberName();
  const accessTag = currentAccessPlayerTag();
  const authUsers = Array.isArray(state?.authUsers) ? state.authUsers : [];
  const profile = authUsers.find(user => String(user.uid || '') === uid) || null;
  const memberNames = [member.name, member.nick, member.fullName, member.linkedMemberName].map(v => String(v || '').trim().toLowerCase()).filter(Boolean);
  const memberTag = normalizePlayerTag(member.playerTag || member.tag || '');
  if(uid && String(member.linkedAuthUid || '') === uid) return true;
  if(email && String(member.linkedEmail || '').trim().toLowerCase() === email) return true;
  if(accessTag && memberTag && accessTag === memberTag) return true;
  if(linkedMemberName && memberNames.includes(linkedMemberName)) return true;
  if(profile){
    const profileNames = [profile.nick, profile.name, profile.email, profile.linkedMemberName].map(v => String(v || '').trim().toLowerCase()).filter(Boolean);
    if(profileNames.some(value => memberNames.includes(value))) return true;
    const profileTag = normalizePlayerTag(profile.playerTag || '');
    if(profileTag && memberTag && profileTag === memberTag) return true;
  }
  if(nick && memberNames.includes(nick)) return true;
  if(email && memberNames.includes(email)) return true;
  return false;
}
function canEditMemberProfile(member){
  return isAdminApp() || memberMatchesCurrentUser(member);
}
function nextPromotedRole(role='Membro'){
  if(role === 'Membro') return 'Ancião';
  if(role === 'Ancião') return 'Co-líder';
  if(role === 'Co-líder') return 'Líder';
  return 'Líder';
}
function nextDemotedRole(role='Membro'){
  if(role === 'Líder') return 'Co-líder';
  if(role === 'Co-líder') return 'Ancião';
  if(role === 'Ancião') return 'Membro';
  return 'Membro';
}

function updateTopbarTitle(viewId){
  if(!ui.currentViewBadge) return;
  ui.currentViewBadge.textContent = viewLabels[viewId] || 'Arena 🏟️';
}

function setupDeckFilters(){
  if(!ui.decksFilterBar) return;
  ui.decksFilterBar.addEventListener('click', (event) => {
    const btn = event.target.closest('[data-rarity]');
    if(!btn) return;
    currentDecksRarityFilter = String(btn.dataset.rarity || 'all');
    ui.decksFilterBar.querySelectorAll('[data-rarity]').forEach(node => node.classList.toggle('active', node === btn));
    renderDecksView();
  });
}

function showMenuHint(){
  const hint = ui.menuHint;
  if(!hint) return;
  hint.classList.remove('hidden');
  requestAnimationFrame(()=> hint.classList.add('show'));
  clearTimeout(showMenuHint._timer);
  showMenuHint._timer = setTimeout(()=> { hint.classList.remove('show'); }, 3000);
}
function encodedParts(payload, count){
  const raw = String(payload || '').split('|');
  const first = decodeURIComponent(raw.shift() || '');
  return [first, ...raw].slice(0, count);
}
function toggleViewMenu(force){
  openDrawer(force);
}
function deepClone(obj){ return JSON.parse(JSON.stringify(obj)); }
function readStoredState(key){
  try{
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  }catch(e){
    return null;
  }
}
function blankWeekRecord(name, role='Membro'){
  return {
    name,
    role,
    days:{
      quinta:{attacks:[false,false,false,false],total:0,fourFour:false},
      sexta:{attacks:[false,false,false,false],total:0,fourFour:false},
      sabado:{attacks:[false,false,false,false],total:0,fourFour:false},
      domingo:{attacks:[false,false,false,false],total:0,fourFour:false}
    },
    attacksTotal:0,
    days44:0,
    clinchit:false
  };
}
function blankTournamentRecord(name){
  return {
    name,
    weeks:[1,2,3,4].map(() => ({participated:false,position:null,points:0})),
    pointsMonth:0,top3Month:0,observation:'EM CURSO'
  };
}
function mergeMonthData(baseMonth, savedMonth){
  const merged = deepClone(baseMonth || {weeks:{},tournament:{},summaryOriginal:{}});
  if(!savedMonth || typeof savedMonth !== 'object') return merged;
  merged.summaryOriginal = {...(merged.summaryOriginal||{}), ...(savedMonth.summaryOriginal||{})};
  merged.weeks ||= {};
  for(let week=1; week<=4; week++){
    const key = String(week);
    merged.weeks[key] = {...(merged.weeks[key]||{}), ...deepClone(savedMonth.weeks?.[key] || {})};
  }
  merged.tournament = {...(merged.tournament||{}), ...deepClone(savedMonth.tournament || {})};
  return merged;
}
function mergeWithSeed(saved){
  const base = deepClone(seedData);
  const imported = saved && typeof saved === 'object' ? saved : {};

  const validMonths = new Set(seedData.meta.months || []);
  base.meta = {...base.meta, ...(imported.meta || {})};
  base.meta.version = appVersion;
  base.meta.currentMonth = validMonths.has(imported.meta?.currentMonth) ? imported.meta.currentMonth : seedData.meta.currentMonth;
  base.meta.currentWeek = [1,2,3,4].includes(Number(imported.meta?.currentWeek)) ? Number(imported.meta.currentWeek) : 1;

  base.goals = {...(base.goals || {}), ...(imported.goals || {})};

  const seedMembers = Array.isArray(base.members) ? base.members : [];
  const savedMembers = Array.isArray(imported.members) ? imported.members : [];
  const savedByName = new Map(savedMembers.map(member => [member.name, member]));
  const mergedMembers = seedMembers.map(member => {
    const savedMember = savedByName.get(member.name) || {};
    return {
      ...member,
      ...savedMember,
      notes: {...(member.notes || {}), ...(savedMember.notes || {})}
    };
  });
  for(const savedMember of savedMembers){
    if(!mergedMembers.some(member => member.name === savedMember.name)){
      mergedMembers.push(savedMember);
    }
  }
  base.members = mergedMembers;

  base.months ||= {};
  const savedMonths = imported.months || {};
  for(const month of seedData.meta.months){
    base.months[month] = mergeMonthData(base.months[month], savedMonths[month]);
  }

  for(const [month, monthData] of Object.entries(savedMonths)){
    if(!base.months[month]) base.months[month] = mergeMonthData({weeks:{}, tournament:{}, summaryOriginal:{}}, monthData);
  }

  base.history = Array.isArray(imported.history) ? imported.history : [];
  base.authUsers = Array.isArray(imported.authUsers) ? imported.authUsers : (Array.isArray(state?.authUsers) ? deepClone(state.authUsers) : []);
  base.ui = {...(imported.ui || {}), lastSync: imported.ui?.lastSync || new Date().toISOString(), migratedFrom: imported.meta?.version || imported.meta?.appVersion || 'seed'};
  base.ui.classificationMonth = validMonths.has(imported.ui?.classificationMonth) ? imported.ui.classificationMonth : base.meta.currentMonth;
  base.ui.classificationRole = imported.ui?.classificationRole || 'ALL';
  base.ui.classificationQuery = imported.ui?.classificationQuery || '';
  base.ui.warQuery = imported.ui?.warQuery || '';
  base.ui.warRole = imported.ui?.warRole || 'ALL';
  base.ui.tournamentQuery = imported.ui?.tournamentQuery || '';
  base.ui.tournamentRole = imported.ui?.tournamentRole || 'ALL';
  base.ui.warCollapsed = imported.ui?.warCollapsed && typeof imported.ui.warCollapsed === 'object' ? imported.ui.warCollapsed : {};
  base.ui.tournamentCollapsed = imported.ui?.tournamentCollapsed && typeof imported.ui.tournamentCollapsed === 'object' ? imported.ui.tournamentCollapsed : {};
  return base;
}
function ensureDataCompleteness(data){
  data.meta ||= {};
  data.meta.version = appVersion;
  data.meta.currentMonth ||= seedData.meta.currentMonth;
  data.meta.currentWeek = [1,2,3,4].includes(Number(data.meta.currentWeek)) ? Number(data.meta.currentWeek) : 1;
  data.goals ||= {};
  data.members ||= [];
  data.months ||= {};
  data.history ||= [];
  data.ui ||= {lastSync:new Date().toISOString()};
  data.ui.classificationMonth ||= data.meta.currentMonth;
  data.ui.classificationRole ||= 'ALL';
  data.ui.classificationQuery ||= '';
  data.ui.warQuery ||= '';
  data.ui.warRole ||= 'ALL';
  data.ui.tournamentQuery ||= '';
  data.ui.tournamentRole ||= 'ALL';
  data.authUsers ||= [];
  data.ui.warCollapsed ||= {};
  data.ui.tournamentCollapsed ||= {};
  data.ui.warAutoMonth ||= data.meta.currentMonth;
  data.ui.warAutoWeek = [1,2,3,4].includes(Number(data.ui.warAutoWeek)) ? Number(data.ui.warAutoWeek) : data.meta.currentWeek;
  data.ui.localRevision = Number(data.ui.localRevision || 0);

  for(const month of seedData.meta.months){
    data.goals[month] ||= deepClone(seedData.goals?.[month] || {attacks:1200,tournament:80});
    data.months[month] ||= {weeks:{}, tournament:{}, summaryOriginal:{}};
    data.months[month].weeks ||= {};
    data.months[month].tournament ||= {};
    for(let week=1; week<=4; week++){
      const key = String(week);
      data.months[month].weeks[key] ||= {};
      for(const member of data.members){
        data.months[month].weeks[key][member.name] ||= blankWeekRecord(member.name, member.role);
      }
    }
    for(const member of data.members){
      data.months[month].tournament[member.name] ||= blankTournamentRecord(member.name);
    }
  }
  return data;
}
function loadState(){
  const current = readStoredState(STORAGE_KEY);
  if(current){
    return ensureDataCompleteness(mergeWithSeed(current));
  }
  for(const legacyKey of LEGACY_STORAGE_KEYS){
    const legacy = readStoredState(legacyKey);
    if(legacy){
      const migrated = ensureDataCompleteness(mergeWithSeed(legacy));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
      return migrated;
    }
  }
  const fresh = ensureDataCompleteness(deepClone(seedData));
  localStorage.setItem(STORAGE_KEY, JSON.stringify(fresh));
  return fresh;
}
function hydrateSeed(data){
  return ensureDataCompleteness(mergeWithSeed(data));
}
function saveState(){
  state.ui.localRevision = Number(state.ui.localRevision || 0) + 1;
  state.ui.lastSync = new Date().toISOString();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  if(ui.heroSync) ui.heroSync.textContent = 'salvo ' + new Date(state.ui.lastSync).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});
  window.TOPBRS_REMOTE?.onLocalSave?.(deepClone(state));
}

function $(sel){ return document.querySelector(sel); }
function $all(sel){ return Array.from(document.querySelectorAll(sel)); }
function esc(text){
  return String(text ?? '').replace(/[&<>"]/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m]));
}
function monthLabel(m){ return monthLabels[m] || m; }
function slugify(text){
  return String(text ?? '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g,'-')
    .replace(/^-+|-+$/g,'');
}
function roleOptionsHtml(selected='ALL'){
  const roles = ['ALL', ...new Set(activeMembers().map(member => member.role || 'Membro'))];
  return roles.map(role => `<option value="${esc(role)}" ${role===selected?'selected':''}>${role==='ALL'?'Todos os cargos':esc(role)}</option>`).join('');
}
function filteredSummariesForTools(ctx, mode){
  const query = ((mode === 'war' ? state.ui.warQuery : state.ui.tournamentQuery) || '').trim().toLowerCase();
  const role = mode === 'war' ? (state.ui.warRole || 'ALL') : (state.ui.tournamentRole || 'ALL');
  return ctx.summaries.filter(item => {
    const matchQuery = !query || item.member.name.toLowerCase().includes(query);
    const matchRole = role === 'ALL' || item.member.role === role;
    return matchQuery && matchRole;
  });
}
function renderToolQuickbar(mode, count){
  const query = mode === 'war' ? (state.ui.warQuery || '') : (state.ui.tournamentQuery || '');
  const role = mode === 'war' ? (state.ui.warRole || 'ALL') : (state.ui.tournamentRole || 'ALL');
  const title = mode === 'war' ? 'Filtro rápido da guerra' : 'Filtro rápido do torneio';
  const subtitle = mode === 'war' ? 'Ache um membro e marque os ataques sem rolar tudo.' : 'Ache um membro e marque a pontuação do torneio mais rápido.';
  return `
    <div class="tool-quickbar sticky-toolbar ${mode==='war' ? 'war-quickbar' : 'tournament-quickbar'}">
      <div class="tool-quickbar-copy">
        <strong>${title}</strong>
        <small>${subtitle} ${count} visível(is).</small>
      </div>
      <label class="field compact">
        <span>Buscar</span>
        <input type="search" placeholder="Digite o nome..." value="${esc(query)}" data-tool-query="${mode}">
      </label>
      <label class="field compact">
        <span>Cargo</span>
        
      </label>
      <div class="tool-quickbar-actions">
        <button class="ghost small" data-tool-clear="${mode}">Limpar</button>
      </div>
    </div>
  `;
}

function applyToolFilters(mode){
  const query = ((mode === 'war' ? state.ui.warQuery : state.ui.tournamentQuery) || '').trim().toLowerCase();
  const role = mode === 'war' ? (state.ui.warRole || 'ALL') : (state.ui.tournamentRole || 'ALL');
  const container = mode === 'war' ? ui.warBoard : ui.tournamentEditor;
  if(!container) return;
  const rows = [...container.querySelectorAll(mode === 'war' ? '.war-row' : '.tour-row')];
  let visible = 0;
  rows.forEach(row => {
    const name = (row.dataset.memberName || '').toLowerCase();
    const rowRole = row.dataset.memberRole || '';
    const matchQuery = !query || name.includes(query);
    const matchRole = role === 'ALL' || rowRole === role;
    const show = matchQuery && matchRole;
    row.style.display = show ? '' : 'none';
    if(show) visible += 1;
  });
  const small = container.querySelector('.tool-quickbar-copy small');
  if(small){
    small.textContent = (mode === 'war'
      ? 'Ache um membro e marque os ataques sem rolar tudo.'
      : 'Ache um membro e marque a pontuação do torneio mais rápido.') + ` ${visible} visível(is).`;
  }
  const empty = container.querySelector(mode === 'war' ? '.war-inline-empty' : '.tour-inline-empty');
  if(empty) empty.remove();
  if(!visible){
    const div = document.createElement('div');
    div.className = mode === 'war' ? 'empty war-inline-empty' : 'empty tour-inline-empty';
    div.textContent = 'Nenhum membro encontrado nesse filtro.';
    container.appendChild(div);
  }
}

function collapseStore(mode){
  if(mode === 'war'){
    state.ui.warCollapsed ||= {};
    return state.ui.warCollapsed;
  }
  state.ui.tournamentCollapsed ||= {};
  return state.ui.tournamentCollapsed;
}
function isCollapsed(mode, memberName){
  const store = collapseStore(mode);
  return store[memberName] !== false;
}
function toggleMemberCollapse(mode, memberName){
  const store = collapseStore(mode);
  const currentlyCollapsed = isCollapsed(mode, memberName);
  store[memberName] = !currentlyCollapsed ? true : false;
  saveState();
  render();
}

function roleWeight(role){
  if(/líder/i.test(role)) return 4;
  if(/co-líder/i.test(role)) return 3;
  if(/ancião/i.test(role)) return 2;
  return 1;
}
function activeMembers(includeArchived=false){
  return state.members.filter(m => {
    if(m.ghostAdmin) return false;
    return includeArchived ? true : m.status !== 'ARQUIVADO';
  });
}
function ensureMonth(month){
  state.months[month] ||= {weeks:{},tournament:{},summaryOriginal:{}};
  state.goals[month] ||= {attacks:1200,tournament:80};
  for(let week=1;week<=4;week++){
    state.months[month].weeks[String(week)] ||= {};
  }
  return state.months[month];
}
function ensureWeekMember(month, week, name){
  const monthObj = ensureMonth(month);
  monthObj.weeks[String(week)][name] ||= {
    name,
    days:{
      quinta:{attacks:[false,false,false,false],total:0,fourFour:false},
      sexta:{attacks:[false,false,false,false],total:0,fourFour:false},
      sabado:{attacks:[false,false,false,false],total:0,fourFour:false},
      domingo:{attacks:[false,false,false,false],total:0,fourFour:false}
    },
    attacksTotal:0,
    days44:0,
    clinchit:false
  };
  return monthObj.weeks[String(week)][name];
}
function ensureTournamentMember(month, name){
  const monthObj = ensureMonth(month);
  monthObj.tournament[name] ||= {
    name,
    weeks:[1,2,3,4].map(() => ({participated:false,position:null,points:0})),
    pointsMonth:0,top3Month:0,observation:'EM CURSO'
  };
  return monthObj.tournament[name];
}
function recomputeWeekRecord(record){
  let attacksTotal = 0;
  let days44 = 0;
  for(const day of dayOrder){
    const dayRecord = record.days[day];
    dayRecord.total = dayRecord.attacks.filter(Boolean).length;
    dayRecord.fourFour = dayRecord.total === 4;
    attacksTotal += dayRecord.total;
    if(dayRecord.fourFour) days44 += 1;
  }
  record.attacksTotal = attacksTotal;
  record.days44 = days44;
  record.clinchit = attacksTotal === 16;
  return record;
}
function computeTournamentPoints(position, participated){
  const hasParticipation = !!participated || !!position;
  if(!hasParticipation) return 0;
  let points = Number(state.meta.tournamentRules.participation || 0);
  if(position === 1) points += Number(state.meta.tournamentRules.first || 0);
  else if(position === 2) points += Number(state.meta.tournamentRules.second || 0);
  else if(position === 3) points += Number(state.meta.tournamentRules.third || 0);
  return points;
}
function monthContext(month){
  const monthObj = ensureMonth(month);
  const members = activeMembers();
  const summaries = [];
  let maxWeeksStarted = 0;

  for(const member of members){
    const weekly = [1,2,3,4].map(week => recomputeWeekRecord(ensureWeekMember(month, week, member.name)));
    const tournament = ensureTournamentMember(month, member.name);
    tournament.weeks = tournament.weeks.map((item, idx) => {
      let position = item.position === '' ? null : item.position;
      if(position != null) position = Number(position);
      const participated = !!item.participated || !!position;
      return {participated, position, points: computeTournamentPoints(position, participated)};
    });
    tournament.pointsMonth = round1(tournament.weeks.reduce((acc, item) => acc + item.points, 0));
    tournament.top3Month = tournament.weeks.filter(item => item.position && item.position <= 3).length;

    const attacksByWeek = weekly.map(w => w.attacksTotal);
    const attacksMonth = attacksByWeek.reduce((a,b)=>a+b,0);
    const days44Month = weekly.reduce((acc,w)=>acc + w.days44,0);
    const perfectWeeks = weekly.filter(w => w.clinchit).length;
    const tournamentParticipationPoints = round1(tournament.weeks.reduce((acc, item) => acc + (item.participated ? Number(state.meta.tournamentRules.participation || 0) : 0), 0));
    const tournamentPlacementPoints = round1(tournament.weeks.reduce((acc, item) => {
      if(item.position === 1) return acc + Number(state.meta.tournamentRules.first || 0);
      if(item.position === 2) return acc + Number(state.meta.tournamentRules.second || 0);
      if(item.position === 3) return acc + Number(state.meta.tournamentRules.third || 0);
      return acc;
    }, 0));
    const tournamentPoints = round1(tournamentParticipationPoints + tournamentPlacementPoints);
    const clinchitPoints = perfectWeeks * 3;
    const classificationPoints = attacksMonth + tournamentPoints + clinchitPoints;
    const scoreIntegrated = attacksMonth + tournamentPoints;
    const weeksStarted = [1,2,3,4].filter((week, idx) => {
      return attacksByWeek[idx] > 0 || tournament.weeks[idx].participated || tournament.weeks[idx].position;
    }).length;
    maxWeeksStarted = Math.max(maxWeeksStarted, weeksStarted);
    const expectedAttacks = weeksStarted * 16;
    const baseWarBonus = perfectWeeks * 3 + (days44Month >= 12 ? 5 : days44Month >= 8 ? 3 : days44Month >= 4 ? 1 : 0);
    const penalty = weeksStarted >= 2 && attacksMonth === 0 && tournamentPoints === 0 ? 6 : (weeksStarted >= 1 && attacksMonth < Math.max(1, weeksStarted*8) ? 2 : 0);
    const scorePro = round1(attacksMonth * 0.6 + tournamentPoints * 0.4 + baseWarBonus - penalty);
    const scoreElite = round2(scorePro + (member.eligibleTournament ? 0.2 : 0) + tournament.top3Month*0.2 + days44Month*0.05);
    let confidence = 'BAIXA';
    if(weeksStarted === 0) confidence = 'NÃO INICIADO';
    else if(perfectWeeks === weeksStarted && tournamentPoints > 0) confidence = 'ALTA';
    else if(attacksMonth >= expectedAttacks || tournamentPoints > 0 || perfectWeeks > 0) confidence = 'MÉDIA';
    let activityStatus = (attacksMonth === 0 && tournamentPoints === 0) ? 'INATIVO' : 'ATIVO';
    let warPriority = 'BAIXA';
    if(weeksStarted === 0) warPriority = 'NÃO INICIADO';
    else if(attacksMonth < Math.max(1, weeksStarted*8)) warPriority = 'CRÍTICA';
    else if(attacksMonth < expectedAttacks) warPriority = 'ALTA';
    else if(tournamentPoints === 0) warPriority = 'MÉDIA';
    let alert = 'ESTÁVEL';
    if(weeksStarted === 0) alert = 'NÃO INICIADO';
    else if(activityStatus === 'INATIVO' && weeksStarted >= 2) alert = 'EXPULSÃO';
    else if(attacksMonth < Math.max(1, weeksStarted*8) && tournamentPoints === 0) alert = 'RISCO';
    else if(attacksMonth < expectedAttacks || tournamentPoints === 0) alert = 'OBSERVAÇÃO';
    let suggestion = suggestionFor(member, {scoreElite, scorePro, confidence, attacksMonth, weeksStarted, tournamentPoints, activityStatus});
    let progressStatus = weeksStarted === 0 ? 'AGUARDANDO INÍCIO' : attacksMonth >= expectedAttacks ? 'NO RITMO' : 'ABAIXO DO RITMO';

    summaries.push({
      member, weekly, tournament, attacksByWeek, attacksMonth, days44Month, perfectWeeks,
      tournamentPoints, tournamentParticipationPoints, tournamentPlacementPoints, clinchitPoints, classificationPoints,
      scoreIntegrated, scorePro, scoreElite, confidence, warPriority,
      alert, suggestion, activityStatus, expectedAttacks, weeksStarted, progressStatus,
      baseWarBonus, penalty
    });
  }

  summaries.sort((a,b) => (b.scoreElite - a.scoreElite) || (b.scoreIntegrated - a.scoreIntegrated) || (b.attacksMonth - a.attacksMonth) || roleWeight(b.member.role)-roleWeight(a.member.role) || a.member.name.localeCompare(b.member.name));
  summaries.forEach((item, index) => item.rankElite = index + 1);

  const attackTotalClan = summaries.reduce((acc,s) => acc + s.attacksMonth, 0);
  const tournamentTotalClan = round1(summaries.reduce((acc,s)=>acc + s.tournamentPoints, 0));
  const avgElite = summaries.length ? round1(summaries.reduce((acc,s)=>acc + s.scoreElite, 0) / summaries.length) : 0;
  const riskCount = summaries.filter(s => ['RISCO','EXPULSÃO'].includes(s.alert)).length;
  const reviewCount = summaries.filter(s => s.suggestion === 'REVISAR CARGO').length;
  const promoteCount = summaries.filter(s => s.suggestion === 'PROMOVER').length;
  const expelCount = summaries.filter(s => s.suggestion === 'EXPULSAR').length;

  return {summaries, attackTotalClan, tournamentTotalClan, avgElite, riskCount, reviewCount, promoteCount, expelCount, maxWeeksStarted};
}
function suggestionFor(member, stats){
  const role = member.role || 'Membro';
  if(/líder/i.test(role)) return 'MANTER';
  if(stats.activityStatus === 'INATIVO' && stats.weeksStarted >= 2) return 'EXPULSAR';
  if(/co-líder/i.test(role)){
    return stats.scoreElite < 11 || stats.confidence === 'BAIXA' ? 'REVISAR CARGO' : 'MANTER';
  }
  if(/ancião/i.test(role)){
    if(stats.scoreElite >= 11.5 && stats.confidence !== 'BAIXA') return 'PROMOVER';
    if(stats.scoreElite < 5 && stats.weeksStarted >= 2) return 'OBSERVAR';
    return 'MANTER';
  }
  if(stats.scoreElite >= 10 && stats.confidence !== 'BAIXA') return 'PROMOVER';
  if(stats.scoreElite < 4 && stats.weeksStarted >= 2) return 'EXPULSAR';
  return 'OBSERVAR';
}
function round1(n){ return Math.round((Number(n)||0) * 10) / 10; }
function round2(n){ return Math.round((Number(n)||0) * 100) / 100; }
function pct(current,total){
  if(!total) return 0;
  return Math.max(0, Math.min(100, Math.round((current/total)*100)));
}

function formatSyncDate(dateValue){
  const d = dateValue instanceof Date ? dateValue : new Date(dateValue || Date.now());
  if(Number.isNaN(d.getTime())) return '--';
  return d.toLocaleString('pt-BR', {
    day:'2-digit', month:'2-digit', year:'2-digit',
    hour:'2-digit', minute:'2-digit'
  });
}
function updateSyncStatusDisplay(status='online', timestamp=null){
  const indicator = document.getElementById('syncIndicator');
  const text = document.getElementById('syncText');
  const time = document.getElementById('syncTime');
  if(indicator){
    indicator.classList.remove('online','syncing','manual');
    indicator.classList.add(status === 'syncing' ? 'syncing' : status === 'manual' ? 'manual' : 'online');
  }
  if(text){
    text.textContent = status === 'syncing'
      ? 'Sincronizando...'
      : status === 'manual'
        ? 'Atualizado agora'
        : 'Tempo real ativo';
  }
  if(time){
    const stamp = timestamp || state?.ui?.lastSyncAt || Date.now();
    time.textContent = `Última atualização: ${formatSyncDate(stamp)}`;
  }
}
function markSyncTimestamp(ts = Date.now(), mode='online'){
  state.ui ||= {};
  state.ui.lastSyncAt = new Date(ts).toISOString();
  try{ saveState(); }catch(e){}
  updateSyncStatusDisplay(mode, state.ui.lastSyncAt);
}
async function manualRefreshSync(){
  const btn = document.getElementById('syncRefreshBtn');
  if(btn) btn.classList.add('spinning');
  updateSyncStatusDisplay('syncing');
  try{
    if(window.TOPBRS_AUTH_UI?.refreshUsersNow){
      await window.TOPBRS_AUTH_UI.refreshUsersNow();
    }
    if(window.TOPBRS_FIREBASE_SYNC?.refreshNow){
      await window.TOPBRS_FIREBASE_SYNC.refreshNow();
    }
    markSyncTimestamp(Date.now(), 'manual');
    render();
    setTimeout(()=>updateSyncStatusDisplay('online'), 1800);
  }catch(e){
    updateSyncStatusDisplay('online');
  }finally{
    if(btn) btn.classList.remove('spinning');
  }
}


function applyDynamicTopSpacing(){
  const topbar = document.querySelector('.topbar');
  if(!topbar) return;
  const h = Math.max(72, Math.round(topbar.getBoundingClientRect().height || topbar.offsetHeight || 0));
  const heroPad = Math.max(28, Math.min(42, Math.round(h * 0.36)));
  const heroCopy = Math.max(10, Math.min(18, Math.round(h * 0.14)));
  const heroControls = Math.max(4, Math.min(10, Math.round(h * 0.08)));
  const firstGap = Math.max(8, Math.min(14, Math.round(h * 0.12)));
  document.documentElement.style.setProperty('--topbar-height-dyn', `${h}px`);
  document.documentElement.style.setProperty('--hero-top-pad-dyn', `${heroPad}px`);
  document.documentElement.style.setProperty('--hero-copy-offset-dyn', `${heroCopy}px`);
  document.documentElement.style.setProperty('--hero-controls-offset-dyn', `${heroControls}px`);
  document.documentElement.style.setProperty('--first-block-gap-dyn', `${firstGap}px`);
}
window.addEventListener('resize', applyDynamicTopSpacing);
window.addEventListener('orientationchange', () => setTimeout(applyDynamicTopSpacing, 80));


function getWarAutoSelection(){
  const month = state.ui?.warAutoMonth || state.meta.currentMonth;
  const week = Number(state.ui?.warAutoWeek || state.meta.currentWeek || 1);
  return { month, week };
}
function getWarRankingSelection(){
  const month = state.ui?.warRankingMonth || state.ui?.warAutoMonth || state.meta.currentMonth;
  const week = Number(state.ui?.warRankingWeek || state.ui?.warAutoWeek || state.meta.currentWeek || 1);
  return { month, week };
}

function getRealCurrentWarSelection(){
  const now = new Date();
  const monthKeys = ['JANEIRO','FEVEREIRO','MARÇO','ABRIL','MAIO','JUNHO','JULHO','AGOSTO','SETEMBRO','OUTUBRO','NOVEMBRO','DEZEMBRO'];
  const month = monthKeys[now.getMonth()] || state.meta.currentMonth;
  const week = Math.max(1, Math.min(4, Math.ceil(now.getDate() / 7)));
  return { month, week };
}

function isCurrentWarSelection(selection={}){
  const current = getRealCurrentWarSelection();
  return String(selection.month || '').toUpperCase() === String(current.month || '').toUpperCase() && Number(selection.week || 0) === Number(current.week || 0);
}

function applyWarRowsToState(month, week, rows=[]){
  try{
    if(!month || !week || !Array.isArray(rows) || !rows.length) return false;
    const eligibleRoles = new Set(['Líder','Co-líder','Ancião','Membro','Co-lider','Colíder']);
    let changed = false;
    for(const row of rows){
      const linked = row.linkedMember || findActiveMemberLink(row) || {};
      const memberName = linked.name || row.name;
      if(!memberName) continue;
      const record = ensureWeekMember(month, week, memberName);
      const mapped = {
        quinta: Number(row.thu || 0),
        sexta: Number(row.fri || 0),
        sabado: Number(row.sat || 0),
        domingo: Number(row.sun || 0)
      };
      for(const day of dayOrder){
        const total = Math.max(0, Math.min(4, Number(mapped[day] || 0)));
        const nextArr = Array.from({length:4}, (_, idx) => idx < total);
        const dayRecord = record.days[day] || { attacks:[false,false,false,false], total:0, fourFour:false };
        const prev = JSON.stringify(dayRecord.attacks || []);
        const next = JSON.stringify(nextArr);
        if(prev != next){
          dayRecord.attacks = nextArr;
          changed = true;
        }
        dayRecord.total = total;
        dayRecord.fourFour = total === 4;
        record.days[day] = dayRecord;
      }
      const prevTotal = Number(record.attacksTotal || 0);
      const prevClinchit = Boolean(record.clinchit);
      recomputeWeekRecord(record);
      if(Number(record.attacksTotal || 0) !== prevTotal || Boolean(record.clinchit) !== prevClinchit){
        changed = true;
      }
      record.livePoints = Number(row.points || row.livePoints || 0);
      record.liveSource = String(row.source || 'war_auto');
      record.liveUpdatedAt = new Date().toISOString();
      record.playerTag = normalizePlayerTag(row.playerTag || linked.playerTag || linked.tag || '');
    }
    if(changed){
      saveState();
    }
    return changed;
  }catch(err){
    console.warn('applyWarRowsToState', err);
    return false;
  }
}
function monthToNumber(month){
  const key = String(month||'').trim().toUpperCase();
  const map = {
    JANEIRO:'01', JAN:'01',
    FEVEREIRO:'02', FEV:'02',
    'MARÇO':'03', MARCO:'03', MAR:'03',
    ABRIL:'04', ABR:'04',
    MAIO:'05', MAI:'05',
    JUNHO:'06', JUN:'06',
    JULHO:'07', JUL:'07',
    AGOSTO:'08', AGO:'08',
    SETEMBRO:'09', SET:'09',
    OUTUBRO:'10', OUT:'10',
    NOVEMBRO:'11', NOV:'11',
    DEZEMBRO:'12', DEZ:'12'
  };
  return map[key] || '';
}
async function fetchWarHistoryRows(month, week){
  try{
    const firebase = window.TOPBRS_FIREBASE;
    if(!firebase?.app) return [];
    const { getFirestore, doc, getDoc, collection, getDocs } = await import('https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js');
    const db = firebase.db || getFirestore(firebase.app);
    const monthNum = monthToNumber(month);
    if(!monthNum) return [];
    const docId = `${new Date().getFullYear()}-${monthNum}-S${Number(week||1)}`;
    const snap = await getDoc(doc(db, 'war_history', docId));
    if(!snap.exists()) return [];
    const membersSnap = await getDocs(collection(db, 'war_history', docId, 'members'));
    return membersSnap.docs.map(d => {
      const m = d.data() || {};
      const thu = Number(m.thu || m.days?.thu || 0);
      const fri = Number(m.fri || m.days?.fri || 0);
      const sat = Number(m.sat || m.days?.sat || 0);
      const sun = Number(m.sun || m.days?.sun || 0);
      const total = Number(m.attacks || m.totalAttacks || (thu+fri+sat+sun) || 0);
      return {
        name: m.name || d.id,
        playerTag: normalizePlayerTag(m.playerTag || m.tag || ''),
        role: m.role || 'Membro',
        thu, fri, sat, sun, total,
        points: Number(m.points || 0),
        clinchit: Boolean(m.clinchit),
        weekId: docId,
        source: 'war_history'
      };
    });
  }catch(err){
    console.warn('fetchWarHistoryRows', err);
    return [];
  }
}

async function saveCurrentWarToFirestore(rows, selection, extra = {}){
  try{
    if(!Array.isArray(rows) || !rows.length) return false;
    const firebase = window.TOPBRS_FIREBASE;
    if(!firebase?.app) return false;
    const { getFirestore, doc, setDoc, collection, writeBatch, serverTimestamp } = await import('https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js');
    const db = firebase.db || getFirestore(firebase.app);
    const docId = `${new Date().getFullYear()}-${monthToNumber(selection.month)}-S${Number(selection.week || 1)}`;
    const rootRef = doc(db, 'war_history', docId);
    await setDoc(rootRef, {
      week: `S${Number(selection.week || 1)}`,
      month: monthLabel(selection.month),
      year: new Date().getFullYear(),
      clanTag: String(window.TOPBRS_FIREBASE_CONFIG?.clashClanTag || '#QRG9QQ'),
      source: 'api-live',
      updatedAt: serverTimestamp(),
      membersCount: rows.length,
      lastSyncOrigin: extra.source || 'api-live',
      lastSyncReason: extra.reason || 'auto-refresh'
    }, { merge: true });

    const batch = writeBatch(db);
    const membersCol = collection(db, 'war_history', docId, 'members');
    rows.forEach((row, index) => {
      const memberId = String(row.playerTag || row.name || `member_${index}`)
        .normalize('NFD').replace(/[̀-ͯ]/g,'')
        .replace(/[.#$/\[\]]/g,'')
        .replace(/\s+/g,'_')
        .replace(/[^\w-]/g,'_')
        .replace(/_+/g,'_')
        .replace(/^_+|_+$/g,'');
      const ref = doc(membersCol, memberId || `member_${index}`);
      batch.set(ref, {
        name: row.name || memberId,
        tag: normalizePlayerTag(row.playerTag || row.tag || ''),
        playerTag: normalizePlayerTag(row.playerTag || row.tag || ''),
        role: row.role || 'Membro',
        attacks: Number(row.total || 0),
        totalAttacks: Number(row.total || 0),
        thu: Number(row.thu || 0),
        fri: Number(row.fri || 0),
        sat: Number(row.sat || 0),
        sun: Number(row.sun || 0),
        days: {
          thu: Number(row.thu || 0),
          fri: Number(row.fri || 0),
          sat: Number(row.sat || 0),
          sun: Number(row.sun || 0)
        },
        points: Number(row.points || row.livePoints || 0),
        fame: Number(row.points || row.livePoints || 0),
        repairPoints: Number(row.repairPoints || 0),
        decksUsed: Number(row.total || row.decksUsed || 0),
        clinchit: Number(row.total || 0) >= 16,
        source: 'api-live',
        updatedAt: serverTimestamp()
      }, { merge: true });
    });
    await batch.commit();
    return true;
  }catch(err){
    console.warn('saveCurrentWarToFirestore', err);
    return false;
  }
}

function renderWarRankingPeriodControls(){
  const selection = getWarRankingSelection();
  const monthButtons = (seedData.meta.months || []).map((m) => `<button class="hero-chip ${m===selection.month?'active':''}" type="button" data-war-ranking-month="${esc(m)}">${esc(monthLabel(m).slice(0,3))}</button>`).join('');
  const weekButtons = [1,2,3,4].map((week) => `<button class="hero-chip ${week===selection.week?'active':''}" type="button" data-war-ranking-week="${week}">S${week}</button>`).join('');
  if(ui.warRankingMonthChipBar) ui.warRankingMonthChipBar.innerHTML = monthButtons;
  if(ui.warRankingWeekChipBar) ui.warRankingWeekChipBar.innerHTML = weekButtons;
}

async function prepareWarAutoWeekFromRoster(options = {}){
  if(WAR_AUTO_SANDBOX){
    return { prepared: 0, skipped: true, sandbox: true };
  }
  const service = window.WAR_SERVICE;
  if(!service || typeof service.initWeekForMembers !== 'function'){
    if(!options?.silent) alert('O módulo da Guerra Auto ainda não está pronto para preparar os membros reais.');
    return { prepared: 0, skipped: true };
  }
  const btn = ui.warAutoPrepareBtn;
  if(btn) btn.disabled = true;
  try{
    const roster = activeMembers().map(member => ({
      id: member.id,
      name: member.name,
      role: member.role,
      playerTag: member.playerTag || member.tag || ''
    }));
    const selection = getWarAutoSelection();
    const signature = `${selection.month}|${selection.week}|` + roster.map(m => `${m.name}:${m.role}:${m.playerTag || ''}`).join('||');
    if(options?.silent && state.ui?.warAutoPreparedSignature === signature){
      return { prepared: roster.length, cached: true };
    }
    const result = await service.initWeekForMembers(roster, { month: selection.month, week: selection.week, silent: true });
    state.ui ||= {};
    state.ui.warAutoPreparedSignature = signature;
    saveState();
    if(result?.prepared && !options?.silent){
      alert(`Base automática preparada para ${result.prepared} membro(s).`);
    }
    return result || { prepared: roster.length };
  }catch(err){
    console.error('prepareWarAutoWeekFromRoster', err);
    if(!options?.silent) alert('Não foi possível preparar os membros reais agora.');
    return { prepared: 0, error: true };
  }finally{
    if(btn) btn.disabled = false;
  }
}

async function ensureWarAutoWeekPrepared(options = {}){
  return prepareWarAutoWeekFromRoster({ ...options, silent: true });
}

function renderWarAutoPeriodControls(){
  const selection = getWarAutoSelection();
  const monthButtons = (seedData.meta.months || []).map((m) => {
    const shortLabel = monthLabel(m).slice(0,3);
    return `<button class="hero-chip ${m===selection.month?'active':''}" type="button" data-war-auto-month="${esc(m)}">${esc(shortLabel)}</button>`;
  }).join('');
  const weekButtons = [1,2,3,4].map((week) => {
    return `<button class="hero-chip ${week===selection.week?'active':''}" type="button" data-war-auto-week="${week}">S${week}</button>`;
  }).join('');
  if(ui.warAutoMonthChipBar) ui.warAutoMonthChipBar.innerHTML = monthButtons;
  if(ui.warAutoWeekChipBar) ui.warAutoWeekChipBar.innerHTML = weekButtons;
}

const WAR_AUTO_MIRROR_CACHE = new Map();
let WAR_AUTO_MIRROR_LAST_KEY = '';

function renderWarAutoDots(count=0, max=4){
  return Array.from({length:max}, (_, idx) => `<span class="war-auto-dot ${idx < Number(count || 0) ? 'filled' : 'missed'}"></span>`).join('');
}


function getWarAutoRowsFromManual(month, week, options = {}){
  const cacheKey = `${month}-${week}`;
  const force = Boolean(options.force);
  if(!force && WAR_AUTO_MIRROR_CACHE.has(cacheKey)){
    return WAR_AUTO_MIRROR_CACHE.get(cacheKey).map(item => ({ ...item }));
  }
  const ctx = monthContext(month);
  const weekIndex = Math.max(0, Math.min(3, Number(week || 1) - 1));
  const rows = (ctx.summaries || []).map((item) => {
    const weekData = item.weekly?.[weekIndex] || blankWeekRecord(item.member?.name || '');
    return {
      playerTag: item.member?.playerTag || item.member?.tag || item.member?.name || '',
      name: item.member?.name || item.member?.nick || 'Sem nome',
      role: item.member?.role || 'Membro',
      thu: Number(weekData.days?.quinta?.total || 0),
      fri: Number(weekData.days?.sexta?.total || 0),
      sat: Number(weekData.days?.sabado?.total || 0),
      sun: Number(weekData.days?.domingo?.total || 0),
      total: Number(weekData.attacksTotal || 0),
      weekId: `${monthLabel(month)} • Semana ${week}`
    };
  });
  WAR_AUTO_MIRROR_CACHE.set(cacheKey, rows.map(item => ({ ...item })));
  WAR_AUTO_MIRROR_LAST_KEY = cacheKey;
  return rows;
}

function renderWarAutoSummaryCards(rows){
  const totalMembers = rows.length;
  const totalAttacks = rows.reduce((sum, row) => sum + Number(row.total || 0), 0);
  const completeCount = rows.filter(row => Number(row.total || 0) >= 16).length;
  const pendingCount = rows.filter(row => Number(row.total || 0) < 16).length;
  const riskCount = rows.filter(row => Number(row.total || 0) <= 8).length;
  const totalPoints = rows.reduce((sum, row) => sum + Number(row.points || row.livePoints || 0), 0);
  return `
    <div class="war-auto-card tone-blue">
      <small>Membros lidos</small>
      <strong>${totalMembers}</strong>
      <span>${completeCount} completos</span>
    </div>
    <div class="war-auto-card tone-gold">
      <small>Ataques na semana</small>
      <strong>${totalAttacks}</strong>
      <span>${totalPoints ? `${totalPoints.toLocaleString('pt-BR')} pts na guerra` : `Meta total ${totalMembers * 16}`}</span>
    </div>
    <div class="war-auto-card tone-green">
      <small>Fecharam 16/16</small>
      <strong>${completeCount}</strong>
      <span>${pendingCount} pendentes</span>
    </div>
    <div class="war-auto-card tone-red">
      <small>Risco</small>
      <strong>${riskCount}</strong>
      <span>-50% de ataque na semana</span>
    </div>
  `;
}

function getWarAutoCardKey(member = {}, index = 0){
  return String(member.playerTag || member.name || `war-auto-${index}`);
}
function isWarAutoExpanded(member = {}, index = 0){
  const key = getWarAutoCardKey(member, index);
  return Boolean(state.ui.warAutoExpanded?.[key]);
}
function toggleWarAutoMember(key){
  if(!key) return;
  state.ui.warAutoExpanded ||= {};
  const nextExpanded = !state.ui.warAutoExpanded[key];
  state.ui.warAutoExpanded[key] = nextExpanded;
  const safeKey = String(key).replace(/"/g, '&quot;');
  const card = document.querySelector(`[data-war-auto-card-key="${CSS.escape(String(key))}"]`);
  if(card){
    card.classList.toggle('expanded', nextExpanded);
    card.classList.toggle('collapsed', !nextExpanded);
    const body = card.querySelector('.war-auto-days');
    if(body){
      body.classList.toggle('expanded', nextExpanded);
      body.classList.toggle('collapsed', !nextExpanded);
    }
    const btn = card.querySelector('[data-war-auto-toggle]');
    if(btn){
      btn.setAttribute('aria-expanded', nextExpanded ? 'true' : 'false');
      btn.setAttribute('title', nextExpanded ? 'Recolher detalhes' : 'Expandir detalhes');
      const chevron = btn.querySelector('.war-auto-chevron');
      if(chevron) chevron.textContent = nextExpanded ? '▾' : '▸';
    }
    return;
  }
  renderWarAutoView();
  renderWarRankingView();
  renderMembersSyncView();
  renderApiLogsView();
  updateDrawerProfileSummary();
  renderDecksView();
}
window.toggleWarAutoMember = toggleWarAutoMember;


function topbrsIsExactLiveSelection(selectedMonthKey, selectedWeekKey, liveMonthKey, liveWeekKey){
  return String(selectedMonthKey||'') === String(liveMonthKey||'') &&
         String(selectedWeekKey||'') === String(liveWeekKey||'');
}

async function renderWarAutoView(options = {}){
  if(!ui.warAutoBoard) return;
  if(ui.warAutoBoard.dataset.loading === '1') return;
  ui.warAutoBoard.dataset.loading = '1';
  ui.warAutoBoard.innerHTML = '<div class="empty">Carregando painel da guerra...</div>';
  if(ui.warAutoMeta) ui.warAutoMeta.textContent = '';
  try{
    const selection = getWarAutoSelection();
    let rows = await fetchWarHistoryRows(selection.month, selection.week);
    let source = rows.length ? 'war_history' : 'fallback';
    let liveEnabled = false;
    const canUseLiveApi = WAR_AUTO_REALTIME_READONLY && isCurrentWarSelection(selection);
    if(!rows.length && canUseLiveApi){
      try{
        const race = await fetchClashCurrentRiverRace(window.TOPBRS_FIREBASE_CONFIG?.clashClanTag || '#QRG9QQ', { force: Boolean(options.force) });
        rows = buildWarAutoApiRowsFromRace(race, selection);
        liveEnabled = rows.length > 0;
        source = liveEnabled ? 'api-live' : source;
        if(liveEnabled){
          await saveCurrentWarToFirestore(rows, selection, { source: 'api-live', reason: options.force ? 'manual-refresh' : 'auto-refresh' });
        }
      }catch(liveErr){ console.warn('war auto live api fallback', liveErr); }
    }
    if(!rows.length){
      rows = [];
      source = canUseLiveApi ? source : 'empty';
    }
    const sorted = [...rows].sort((a,b)=> (Number(b.total||0) - Number(a.total||0)) || String(a.name||'').localeCompare(String(b.name||''), 'pt-BR'));
    const active = activeMembers() || [];
    const activeMapByName = new Map(active.map(member => [normalizeMatchText(member.name || member.nick || ''), member]));
    const activeMapByTag = new Map(active.map(member => [normalizePlayerTag(member.playerTag || member.tag || ''), member]));
    const filteredRows = sorted.filter(member => {
      const tagKey = normalizePlayerTag(member.playerTag || member.tag || '');
      const nameKey = normalizeMatchText(member.name || '');
      return Boolean((tagKey && activeMapByTag.has(tagKey)) || (nameKey && activeMapByName.has(nameKey)));
    }).map(member => {
      const linked = activeMapByTag.get(normalizePlayerTag(member.playerTag || member.tag || '')) || activeMapByName.get(normalizeMatchText(member.name || '')) || {};
      return { ...member, linkedMember: linked };
    });
    state.ui ||= {};
    state.ui.lastWarAutoLive = {
      updatedAt: new Date().toISOString(),
      liveEnabled,
      participants: Array.isArray(rows) ? rows.length : 0,
      filtered: filteredRows.length,
      month: selection.month,
      week: selection.week,
      apiBase: await getRuntimeClashApiBase(false),
      source
    };
    const classificationChanged = applyWarRowsToState(selection.month, selection.week, filteredRows);
    if(classificationChanged){
      try{ renderClassification(); }catch(e){}
    }
    if(ui.warAutoStats) ui.warAutoStats.innerHTML = renderWarAutoSummaryCards(filteredRows);
    if(!filteredRows.length){
      ui.warAutoBoard.innerHTML = '<div class="empty war-auto-empty"><strong>Nenhum dado encontrado para este período.</strong></div>';
    }else{
      ui.warAutoBoard.innerHTML = filteredRows.map((member, index) => {
        const linkedMember = member.linkedMember || findActiveMemberLink(member) || {};
        const role = linkedMember.role || member.role || 'Membro';
        const total = Number(member.total||0);
        const isComplete = total >= 16;
        const isRisk = total <= 8;
        const points = Number(member.points || member.livePoints || 0);
        const statusClass = isComplete ? 'good' : isRisk ? 'bad' : 'warn';
        const statusLabel = isComplete ? '16/16 fechado' : isRisk ? 'Baixo desempenho' : 'Parcial';
        const statusNote = isRisk ? '<small class="war-auto-status-note">-50% de ataque na semana</small>' : '';
        const cardKey = getWarAutoCardKey(member, index);
        const expanded = isWarAutoExpanded(member, index);
        const bodyId = `war-auto-days-${index}-${cardKey.replace(/[^a-zA-Z0-9_-]/g, '-')}`;
        return `<article class="war-auto-member glass ${expanded ? 'expanded' : 'collapsed'} ${memberMatchesCurrentUser(linkedMember) ? 'is-self' : ''}" data-war-auto-card-key="${esc(cardKey)}">
            <div class="war-auto-member-top">
              <div class="war-auto-member-head">
                <p class="war-auto-rank">#${index + 1} • ${esc(role)}</p>
                <h4>${esc(member.name || member.playerTag || 'Sem nome')} ${memberMatchesCurrentUser(linkedMember) ? '<span class="self-badge">VOCÊ</span>' : ''}</h4>
                <div class="war-auto-summary-left">
                  <strong class="war-auto-total-value">${Number(member.total || 0)}/16</strong>
                  <span class="chip ${statusClass}">${statusLabel}</span>${statusNote}${points ? `<span class="war-auto-live-pill ${isRisk ? 'bad' : ''}">${points.toLocaleString('pt-BR')} pts</span>` : ''}
                </div>
              </div>
              <button class="war-auto-toggle" type="button" data-war-auto-toggle="${esc(cardKey)}" aria-expanded="${expanded ? 'true' : 'false'}" aria-controls="${esc(bodyId)}" title="${expanded ? 'Recolher detalhes' : 'Expandir detalhes'}"><span class="war-auto-chevron">${expanded ? '▾' : '▸'}</span></button>
            </div>
            <div id="${esc(bodyId)}" class="war-auto-days ${expanded ? 'expanded' : 'collapsed'}">
              <div class="war-auto-day"><span>Qui</span><div class="war-auto-dots">${renderWarAutoDots(member.thu)}</div><b>${Number(member.thu||0)}/4</b></div>
              <div class="war-auto-day"><span>Sex</span><div class="war-auto-dots">${renderWarAutoDots(member.fri)}</div><b>${Number(member.fri||0)}/4</b></div>
              <div class="war-auto-day"><span>Sáb</span><div class="war-auto-dots">${renderWarAutoDots(member.sat)}</div><b>${Number(member.sat||0)}/4</b></div>
              <div class="war-auto-day"><span>Dom</span><div class="war-auto-dots">${renderWarAutoDots(member.sun)}</div><b>${Number(member.sun||0)}/4</b></div>
            </div>
          </article>`;
      }).join('');
    }
  }catch(err){
    console.error('renderWarAutoView', err);
    if(ui.warAutoStats) ui.warAutoStats.innerHTML = '';
    ui.warAutoBoard.innerHTML = '<div class="empty">Não foi possível carregar a Guerra Auto agora.</div>';
    if(ui.warAutoMeta) ui.warAutoMeta.textContent = '';
  }finally{
    delete ui.warAutoBoard.dataset.loading;
  }
}


async function getEligibleWarRankingRows(force=false){
  const selection = getWarRankingSelection();
  let rows = await fetchWarHistoryRows(selection.month, selection.week);
  if(!rows.length && isCurrentWarSelection(selection)){
    try{
      const race = await fetchClashCurrentRiverRace(window.TOPBRS_FIREBASE_CONFIG?.clashClanTag || '#QRG9QQ', { force: Boolean(force) });
      rows = buildWarAutoApiRowsFromRace(race, selection);
    }catch(e){
      rows = [];
    }
  }
  return rows
    .map(row => {
      const linked = findActiveMemberLink(row);
      return linked ? { ...row, linkedMember: linked } : null;
    })
    .filter(Boolean)
    .filter(row => roleEligibleForSystem(row.linkedMember?.role || row.role || ''))
    .sort((a,b) => (Number(b.points||0) - Number(a.points||0)) || (Number(b.total||0) - Number(a.total||0)) || String(a.name||'').localeCompare(String(b.name||''), 'pt-BR'));
}

async function renderWarRankingView(force=false){
  if(!ui.warRankingBoard) return;
  renderWarRankingPeriodControls();
  ui.warRankingBoard.innerHTML = '<div class="empty">Carregando ranking da guerra...</div>';
  try{
    const rows = await getEligibleWarRankingRows(force);
    const selection = getWarRankingSelection();
    if(ui.warRankingMeta){
      ui.warRankingMeta.textContent = `${monthLabel(selection.month)} • Semana ${selection.week} • ${rows.length} membros elegíveis • ordenado por pts (fame)`;
    }
    if(!rows.length){
      ui.warRankingBoard.innerHTML = '<div class="empty">Nenhum membro elegível encontrado neste período.</div>';
      return;
    }
    ui.warRankingBoard.innerHTML = `<div class="war-ranking-table"><div class="war-ranking-head"><div>Pos</div><div>Nick</div><div>Pts</div><div>Atk</div></div>${rows.map((row, index) => {
          const self = memberMatchesCurrentUser(row.linkedMember || row);
          return `<div class="war-ranking-row ${index===0?'top-1':index===1?'top-2':index===2?'top-3':''} ${self?'is-self':''}"><div class="pos">#${index + 1}</div><div class="nick">${esc(row.linkedMember?.name || row.name || 'Sem nome')} ${self ? '<span class="self-badge">VOCÊ</span>' : ''}</div><div>${Number(row.points || 0).toLocaleString('pt-BR')}</div><div>${Number(row.total || 0)}</div></div>`;
        }).join('')}</div>`;
  }catch(err){
    console.error('renderWarRankingView', err);
    if(ui.warRankingMeta) ui.warRankingMeta.textContent = 'Não foi possível montar o ranking da guerra agora.';
    ui.warRankingBoard.innerHTML = '<div class="empty">Ranking da guerra indisponível no momento.</div>';
  }
}


async function renderMembersSyncView(force=false){
  if(!ui.membersSyncBoard) return;
  ui.membersSyncBoard.innerHTML = '<div class="empty">Lendo membros atuais do clã...</div>';
  try{
    const clan = await fetchClashClanProfile(window.TOPBRS_FIREBASE_CONFIG?.clashClanTag || '#QRG9QQ', { force });
    const members = Array.isArray(clan?.memberList) ? clan.memberList : [];
    const rows = members.sort((a,b)=> String(a.name||'').localeCompare(String(b.name||''), 'pt-BR'));
    if(ui.membersSyncMeta){
      ui.membersSyncMeta.textContent = `${rows.length} membro(s) encontrados no clã • use Integrar para pré-cadastrar no sistema`;
    }
    if(!rows.length){
      ui.membersSyncBoard.innerHTML = '<div class="empty">Nenhum membro retornado pela API do clã.</div>';
      return;
    }
    ui.membersSyncBoard.innerHTML = rows.map(member => {
      const roleText = member.role === 'leader' ? 'Líder' : member.role === 'coLeader' ? 'Co-líder' : member.role === 'elder' ? 'Ancião' : 'Membro';
      const eligible = roleEligibleForSystem(roleText);
      const existing = findActiveMemberLink({ name: member.name, playerTag: member.tag, tag: member.tag });
      const payload = encodeURIComponent(JSON.stringify({ name: member.name, tag: member.tag, role: roleText }));
      return `<article class="members-sync-item">
        <div><strong>${esc(member.name || 'Sem nome')}</strong><small>${esc(member.tag || '—')}</small></div>
        <div><span class="members-sync-badge ${eligible ? '' : 'low'}">${esc(roleText)}</span></div>
        <div><small>${existing ? 'Já integrado' : eligible ? 'Elegível ao sistema' : 'Cargo abaixo do permitido'}</small></div>
        <div class="members-sync-actions">${existing ? '<button class="ghost small" type="button" disabled>Integrado</button>' : `<button class="${eligible ? 'primary' : 'ghost'} small" type="button" data-sync-integrate="${payload}" ${eligible ? '' : 'disabled'}>Integrar</button>`}</div>
      </article>`;
    }).join('');
  }catch(err){
    console.error('renderMembersSyncView', err);
    if(ui.membersSyncMeta) ui.membersSyncMeta.textContent = 'Falha ao sincronizar membros do clã.';
    ui.membersSyncBoard.innerHTML = '<div class="empty">Não foi possível ler os membros do clã agora.</div>';
  }
}

async function renderApiLogsView(force=false){
  if(!ui.apiLogsBoard) return;
  ui.apiLogsBoard.innerHTML = '<div class="empty">Lendo diagnóstico da API...</div>';
  try{
    const config = await loadApiConfigSnapshot(force);
    let raceState = 'indisponível';
    let participants = 0;
    try{
      const race = await fetchClashCurrentRiverRace(window.TOPBRS_FIREBASE_CONFIG?.clashClanTag || '#QRG9QQ', { force });
      raceState = String(race?.state || 'ok');
      participants = Array.isArray(race?.clan?.participants) ? race.clan.participants.length : 0;
    }catch(e){}
    const live = state.ui?.lastWarAutoLive || {};
    if(ui.apiLogsMeta){
      ui.apiLogsMeta.textContent = 'Painel técnico para admin • sem impacto no sistema geral.';
    }
    ui.apiLogsBoard.innerHTML = `
      <div class="api-logs-grid">
        <article class="api-log-card"><small>API base</small><strong>${config.clashApiBase ? 'OK' : '—'}</strong><div class="api-log-code">${esc(config.clashApiBase || 'Não definida')}</div></article>
        <article class="api-log-card"><small>Race state</small><strong>${esc(raceState)}</strong><div class="api-log-code">Participantes: ${participants}</div></article>
        <article class="api-log-card"><small>Origem</small><strong>${esc(live.source || config.source || 'indefinida')}</strong><div class="api-log-code">${esc(live.updatedAt || config.updatedAt || 'sem horário')}</div></article>
        <article class="api-log-card"><small>Última leitura app</small><strong>${live.liveEnabled ? 'Live' : (live.source === 'empty' ? 'Sem dados' : 'Fallback')}</strong><div class="api-log-code">${esc(live.updatedAt || 'sem leitura')}</div></article>
      </div>
    `;
  }catch(err){
    console.error('renderApiLogsView', err);
    if(ui.apiLogsMeta) ui.apiLogsMeta.textContent = 'Não foi possível montar os logs da API.';
    ui.apiLogsBoard.innerHTML = '<div class="empty">Logs da API indisponíveis no momento.</div>';
  }
}

function integrateSyncedMember(payloadEncoded=''){
  try{
    const payload = JSON.parse(decodeURIComponent(payloadEncoded || '{}'));
    const name = String(payload.name || '').trim();
    const playerTag = normalizePlayerTag(payload.tag || '');
    const role = String(payload.role || 'Membro').trim();
    if(!name || !playerTag) throw new Error('Dados do membro inválidos.');
    const existing = activeMembers(true).find(member => normalizePlayerTag(member.playerTag || member.tag || '') === playerTag || normalizeMatchText(member.name || '') === normalizeMatchText(name));
    if(existing){
      existing.name = existing.name || name;
      existing.role = role || existing.role || 'Membro';
      existing.playerTag = playerTag;
      existing.tag = playerTag;
      existing.eligibleTournament = roleEligibleForSystem(role);
    }else{
      state.members.push({
        id: slugify(name) || `member-${Date.now()}`,
        name,
        role,
        eligibleTournament: roleEligibleForSystem(role),
        observation: null,
        status: 'ATIVO',
        notes: {},
        exitDate: null,
        exitReason: null,
        exitObservation: null,
        playerTag,
        tag: playerTag
      });
    }
    saveState();
    renderMembersSyncView();
    render();
    showToast('Membro integrado ao sistema com sucesso.');
  }catch(err){
    console.error('integrateSyncedMember', err);
    alert('Não foi possível integrar este membro agora.');
  }
}

function render(){
  const month = state.meta.currentMonth;
  const week = Number(state.meta.currentWeek || 1);
  const ctx = monthContext(month);
  const goals = state.goals[month] || {attacks:1200,tournament:80};

  if(ui.heroMonth) ui.heroMonth.textContent = monthLabel(month);
  if(ui.heroClanName) ui.heroClanName.innerHTML = '';
  if(ui.heroSync) ui.heroSync.textContent = '';
  updateSyncStatusDisplay('online');
  requestAnimationFrame(applyDynamicTopSpacing);

  renderKPIs(ctx, goals);
  renderPodium(ctx);
  renderGoals(ctx, goals);
  renderRanking(ctx);
  renderLeaderActions(ctx);
  renderAnnualPulse();
  renderWarBoard(ctx, week);
  renderWarAutoPeriodControls();
  renderWarAutoView();
  renderWarRankingView();
  renderMembersSyncView();
  renderApiLogsView();
  updateDrawerProfileSummary();
  renderDecksView();
  renderTournamentEditor(ctx, week);
  renderTournamentBoard(ctx);
  renderClassification();
  renderEliteBoard(ctx);
  renderHistory(ctx);
  renderMembers(ctx);
  renderArchivedBoard(ctx);
  renderVault(ctx, goals);
  renderUsersView();
  const activeViewId = document.querySelector('.view.active')?.id || 'arenaView';
  document.body.classList.toggle('reader-mode', !canEditApp());
  const canManage = canEditApp();
  document.querySelectorAll('[data-view="archivedView"]').forEach(btn => btn.classList.toggle('hidden', !canManage));
  document.querySelectorAll('#archivedView').forEach(section => section.classList.toggle('hidden', !canManage));
  if(!canManage && activeViewId === 'archivedView') setActiveView('arenaView');
  const showWarAuto = true;
  document.querySelectorAll('[data-view="warAutoView"]').forEach(btn => btn.classList.toggle('hidden', !showWarAuto));
  document.querySelectorAll('#warAutoView').forEach(section => section.classList.toggle('hidden', !showWarAuto));
  document.querySelectorAll('[data-view="warRankingView"]').forEach(btn => btn.classList.toggle('hidden', !showWarAuto));
  document.querySelectorAll('#warRankingView').forEach(section => section.classList.toggle('hidden', !showWarAuto));
  document.querySelectorAll('[data-view="membersSyncView"]').forEach(btn => btn.classList.toggle('hidden', !isAdminApp()));
  document.querySelectorAll('#membersSyncView').forEach(section => section.classList.toggle('hidden', !isAdminApp()));
  document.querySelectorAll('[data-view="apiLogsView"]').forEach(btn => btn.classList.toggle('hidden', !isAdminApp()));
  document.querySelectorAll('#apiLogsView').forEach(section => section.classList.toggle('hidden', !isAdminApp()));
  if((!isAdminApp()) && ['membersSyncView','apiLogsView'].includes(activeViewId)) setActiveView('arenaView');
  if(ui.weekHeroPicker){ ui.weekHeroPicker.classList.toggle('hidden', ['arenaView','eliteView'].includes(activeViewId)); }
  updateSelectors();
  window.TOPBRS_REMOTE?.afterRender?.();
}

function updateSelectors(){
  ui.monthSelect.innerHTML = seedData.meta.months.map(m => `<option value="${m}" ${m===state.meta.currentMonth?'selected':''}>${monthLabel(m)}</option>`).join('');
  ui.weekSelect.value = String(state.meta.currentWeek || 1);
  if(ui.monthChipBar){
    ui.monthChipBar.innerHTML = seedData.meta.months.map(m => {
      const shortLabel = monthLabel(m).slice(0,3);
      return `<button class="hero-chip ${m===state.meta.currentMonth?'active':''}" type="button" data-month-chip="${m}">${shortLabel}</button>`;
    }).join('');
  }
  if(ui.weekChipBar){
    ui.weekChipBar.innerHTML = [1,2,3,4].map(week => `<button class="hero-chip ${week===Number(state.meta.currentWeek||1)?'active':''}" type="button" data-week-chip="${week}">S${week}</button>`).join('');
  }
  if(ui.classificationMonthSelect){
    const selectedMonth = state.ui.classificationMonth || state.meta.currentMonth;
    ui.classificationMonthSelect.innerHTML = seedData.meta.months.map(m => `<option value="${m}" ${m===selectedMonth?'selected':''}>${monthLabel(m)}</option>`).join('');
  }
}
function renderKPIs(ctx, goals){
  const leader = ctx.summaries[0];
  const cards = [
    {label:'Ataques do clã', value:ctx.attackTotalClan, hint:`Meta ${goals.attacks}`, tone: ctx.attackTotalClan >= goals.attacks ? 'success' : ''},
    {label:'Pontos torneio', value:ctx.tournamentTotalClan, hint:`Meta ${goals.tournament}`, tone: ctx.tournamentTotalClan >= goals.tournament ? 'success' : 'gold'},
    {label:'Média elite', value:ctx.avgElite, hint:`MVP ${leader ? esc(leader.member.name) : '-'}`, tone:'gold'},
    {label:'Riscos críticos', value:ctx.riskCount, hint:`${ctx.reviewCount} revisar • ${ctx.expelCount} expulsão`, tone: ctx.riskCount ? 'danger' : 'success'}
  ];
  ui.kpiGrid.innerHTML = cards.map(card => `
    <article class="kpi ${card.tone}">
      <div class="label">${card.label}</div>
      <div class="value">${card.value}</div>
      <div class="hint">${card.hint}</div>
    </article>
  `).join('');
}
function renderPodium(ctx){
  const top3 = ctx.summaries.slice(0,3);
  if(!top3.length){
    ui.podium.innerHTML = '<div class="empty">Sem dados no mês.</div>';
    return;
  }
  const order = [1,0,2].filter(idx => top3[idx]).map(idx => ({item:top3[idx], slot: idx===0?'first':idx===1?'second':'third'}));
  ui.podium.innerHTML = `<div class="podium">` + order.map(({item,slot}) => `
    <article class="podium-card ${slot} ${memberMatchesCurrentUser(item.member) ? 'is-self' : ''}">
      <div class="podium-rank">${slot==='first'?'🥇':slot==='second'?'🥈':'🥉'}</div>
      <div class="podium-name">${esc(item.member.name)} ${memberMatchesCurrentUser(item.member) ? '<span class="self-badge">VOCÊ</span>' : ''}</div>
      <div class="podium-role">${esc(item.member.role)}</div>
      <div class="podium-score">${item.scoreElite}</div>
      <div class="chips">
        <span class="chip blue">${item.attacksMonth} ataques</span>
        <span class="chip ${item.confidence==='ALTA'?'good':item.confidence==='MÉDIA'?'warn':'bad'}">${item.confidence}</span>
      </div>
    </article>
  `).join('') + `</div>`;
}
function renderGoals(ctx, goals){
  const attackPct = pct(ctx.attackTotalClan, goals.attacks || 0);
  const tournamentPct = pct(ctx.tournamentTotalClan, goals.tournament || 0);
  ui.goalPanel.innerHTML = `
    <div class="goal-grid">
      <div class="goal-stat">
        <div class="goal-row"><span>Ataques</span><span>${ctx.attackTotalClan} / ${goals.attacks}</span></div>
        <div class="progress"><span style="width:${attackPct}%"></span></div>
        <strong>${attackPct}%</strong>
      </div>
      <div class="goal-stat">
        <div class="goal-row"><span>Torneio</span><span>${ctx.tournamentTotalClan} / ${goals.tournament}</span></div>
        <div class="progress"><span style="width:${tournamentPct}%"></span></div>
        <strong>${tournamentPct}%</strong>
      </div>
    </div>
  `;
}
function renderRanking(ctx){
  const items = [...ctx.summaries];
  items.sort((a,b) => rankMode === 'elite'
    ? (b.scoreElite - a.scoreElite) || (b.scoreIntegrated - a.scoreIntegrated)
    : (b.scoreIntegrated - a.scoreIntegrated) || (b.scoreElite - a.scoreElite));
  const scoreLabel = rankMode === 'elite' ? 'Score ELITE' : 'Score Integrado';
  const scoreKey = rankMode === 'elite' ? 'scoreElite' : 'scoreIntegrated';
  const leader = items[0];
  ui.rankingList.innerHTML = `
    <div class="classification-wrap football-style tournament-style replicated-ranking-table">
      ${leader ? `
      <div class="classification-leader-card tournament-leader-card">
        <div class="leader-crown">${rankMode === 'elite' ? '👑' : '📊'}</div>
        <div class="leader-copy">
          <span class="leader-label">${scoreLabel}</span>
          <strong>${esc(leader.member.name)} ${memberMatchesCurrentUser(leader.member) ? '<span class="self-badge">VOCÊ</span>' : ''}</strong>
          <small>${esc(leader.member.role)} • ${leader.attacksMonth} ataques • ${leader.tournamentPoints} torneio</small>
        </div>
        <div class="leader-points-box">
          <span>PTS</span>
          <strong>${leader[scoreKey]}</strong>
        </div>
      </div>` : ''}
      <div class="classification-table tournament-table-shell">
        <div class="classification-grid tournament-grid compact-grid ranking-grid-table">
          <div class="classification-head tournament-head compact-head ranking-head-table">
            <div>#</div>
            <div>Membro</div>
            <div>PTS</div>
            <div>ATQ</div>
            <div>TOR</div>
            <div>CL</div>
            <div>STS</div>
          </div>
          ${items.slice(0,8).map((item,idx) => {
            const topClass = idx < 5 ? 'top5' : idx < 8 ? 'top10' : '';
            const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : (idx+1);
            const tone = item.alert === 'EXPULSÃO' ? 'bad' : item.alert === 'RISCO' ? 'warn' : 'good';
            return `
              <div class="classification-row tournament-row compact-row ranking-table-row ${topClass} ${idx===0?'leader-row':''} ${memberMatchesCurrentUser(item.member) ? 'is-self' : ''}">
                <div class="classification-rank"><span class="classification-badge">${medal}</span></div>
                <div class="classification-name tournament-name-cell ranking-name-cell">
                  <strong>${esc(item.member.name)} ${memberMatchesCurrentUser(item.member) ? '<span class="self-badge">VOCÊ</span>' : ''}</strong>
                  <span>${esc(item.member.role)} • ${scoreLabel}</span>
                </div>
                <div class="classification-cell points">${item[scoreKey]}</div>
                <div class="classification-cell standings-cell">${item.attacksMonth}</div>
                <div class="classification-cell standings-cell">${item.tournamentPoints}</div>
                <div class="classification-cell standings-cell">${item.clinchitPoints}</div>
                <div class="classification-cell standings-cell status"><span class="mini-chip ${tone}">${item.alert}</span></div>
              </div>`;
          }).join('')}
        </div>
      </div>
    </div>
  `;
}
function renderLeaderActions(ctx){
  const actions = [
    ['🚀 Promover', ctx.summaries.filter(s => s.suggestion === 'PROMOVER')],
    ['⚔️ Revisar cargo', ctx.summaries.filter(s => s.suggestion === 'REVISAR CARGO')],
    ['❌ Expulsar', ctx.summaries.filter(s => s.suggestion === 'EXPULSAR')],
    ['👑 MVP', ctx.summaries.slice(0,1)]
  ];
  ui.leaderActions.innerHTML = actions.map(([title, list]) => `
    <article class="leader-card">
      <div class="leader-top">
        <strong>${title}</strong>
        <span class="chip ${title.includes('Expuls')?'bad':title.includes('Promover')?'good':'warn'}">${list.length}</span>
      </div>
      <div class="chips">
        ${list.length ? list.slice(0,4).map(item => `<span class="chip blue">${esc(item.member.name)}</span>`).join('') : '<span class="mini">Nenhum nome agora.</span>'}
      </div>
    </article>
  `).join('');
}
function annualSummary(){
  const members = activeMembers();
  const rows = members.map(member => {
    let attacksYear = 0, tournamentYear = 0, days44Year = 0, perfectWeeks = 0, eliteTotal = 0;
    for(const month of seedData.meta.months){
      const summary = monthContext(month).summaries.find(s => s.member.name === member.name);
      if(summary){
        attacksYear += summary.attacksMonth;
        tournamentYear += summary.tournamentPoints;
        days44Year += summary.days44Month;
        perfectWeeks += summary.perfectWeeks;
        eliteTotal += summary.scoreElite;
      }
    }
    return {member, attacksYear, tournamentYear, days44Year, perfectWeeks, eliteTotal: round1(eliteTotal)};
  }).sort((a,b) => (b.eliteTotal - a.eliteTotal) || (b.attacksYear - a.attacksYear));
  rows.forEach((row,idx) => row.rank = idx+1);
  return rows;
}
function renderAnnualPulse(){
  const rows = annualSummary().slice(0,5);
  ui.annualPulse.innerHTML = rows.map(row => `
    <article class="pulse-card">
      <div class="pulse-top">
        <strong>${row.rank}. ${esc(row.member.name)}</strong>
        <span class="chip ${row.rank===1?'good':'blue'}">${row.eliteTotal} elite ano</span>
      </div>
      <div class="chips">
        <span class="chip">${row.attacksYear} ataques</span>
        <span class="chip">${row.tournamentYear} torneio</span>
        <span class="chip">${row.days44Year} dias 4/4</span>
      </div>
    </article>
  `).join('');
}
function renderWarBoard(ctx, week){
  let filtered = filteredSummariesForTools(ctx, 'war').filter(item => {
    if(warFilter === 'risk') return ['RISCO','EXPULSÃO'].includes(item.alert);
    if(warFilter === 'safe') return item.alert === 'OK';
    return true;
  });
  const quickbar = renderToolQuickbar('war', filtered.length);
  if(!filtered.length){
    ui.warBoard.innerHTML = quickbar + '<div class="empty">Nenhum membro encontrado nesse filtro.</div>';
    return;
  }
  ui.warBoard.innerHTML = quickbar + filtered.map(item => {
    const weekData = item.weekly[week-1];
    const collapsed = isCollapsed('war', item.member.name);
    const memberKey = slugify(item.member.name);
    return `
      <article class="war-row ${collapsed?'collapsed':''} ${memberMatchesCurrentUser(item.member) ? 'is-self' : ''}" id="war-${memberKey}" data-member-name="${esc(item.member.name)}" data-member-role="${esc(item.member.role)}">
        <div class="war-top">
          <div>
            <strong>${esc(item.member.name)} ${memberMatchesCurrentUser(item.member) ? '<span class="self-badge">VOCÊ</span>' : ''}</strong>
            <small>${esc(item.member.role)} • ${weekData.attacksTotal} ataques • ${weekData.days44} dias 4/4</small>
          </div>
          <div class="war-stats">
            <span class="chip ${weekData.clinchit?'good':'warn'}">${weekData.clinchit?'CLINCHIT':'SEM FECHAR'}</span>
            <span class="chip ${item.alert==='EXPULSÃO'?'bad':item.alert==='RISCO'?'warn':'blue'}">${item.alert}</span>
            <button class="collapse-toggle" type="button" data-collapse-member="war|${encodeURIComponent(item.member.name)}" aria-expanded="${collapsed?'false':'true'}">${collapsed?'Expandir':'Recolher'}</button>
          </div>
        </div>
        <div class="member-collapsible ${collapsed?'is-collapsed':''}">
          <div class="day-grid">
            ${dayOrder.map(day => `
              <div class="day-card">
                <div class="day-title">${day}</div>
                <div class="attack-grid">
                  ${weekData.days[day].attacks.map((on, idx) => `<button class="attack-btn ${on?'on':'off'}" data-toggle-attack="${encodeURIComponent(item.member.name)}|${week}|${day}|${idx}">${on?'✅':'—'}</button>`).join('')}
                </div>
                <div class="chips"><span class="chip ${weekData.days[day].fourFour?'good':'warn'}">${weekData.days[day].total}/4</span></div>
              </div>
            `).join('')}
          </div>
        </div>
      </article>
    `;
  }).join('');
}
function renderTournamentEditor(ctx, week){
  if(!canEditApp()){
    ui.tournamentEditor.innerHTML = '<div class="empty">Torneio semanal oculto para leitores. Entre como líder para editar.</div>';
    return;
  }
  const filtered = filteredSummariesForTools(ctx, 'tournament');
  const quickbar = renderToolQuickbar('tournament', filtered.length);
  ui.tournamentEditor.innerHTML = quickbar + filtered.map(item => {
    const tw = item.tournament.weeks[week-1];
    const payload = `${encodeURIComponent(item.member.name)}|${week}`;
    const collapsed = isCollapsed('tournament', item.member.name);
    const memberKey = slugify(item.member.name);
    return `
      <article class="tour-row compact ${collapsed?'collapsed':''}" id="tour-${memberKey}" data-member-name="${esc(item.member.name)}" data-member-role="${esc(item.member.role)}">
        <div class="tour-main">
          <div class="tour-identity">
            <strong>${esc(item.member.name)}</strong>
            <span class="chip blue">${esc(item.member.role)}</span>
          </div>
          <div class="tour-main-actions">
            <div class="tour-points-inline"><span class="chip ${tw.points>=6?'good':tw.points>0?'blue':'warn'}">${tw.points} pts</span></div>
            <button class="collapse-toggle" type="button" data-collapse-member="tournament|${encodeURIComponent(item.member.name)}" aria-expanded="${collapsed?'false':'true'}">${collapsed?'Expandir':'Recolher'}</button>
          </div>
        </div>
        <div class="member-collapsible ${collapsed?'is-collapsed':''}">
          <div class="tour-actions-grid">
            <button class="toggle ${tw.participated?'on':''}" data-toggle-participation="${payload}">${tw.participated?'Participou':'Participar'}</button>
            <div class="tour-medals">
              <button class="mini-medal ${tw.position===1?'active gold':''}" data-quick-position="${payload}" data-position-value="1">🥇</button>
              <button class="mini-medal ${tw.position===2?'active silver':''}" data-quick-position="${payload}" data-position-value="2">🥈</button>
              <button class="mini-medal ${tw.position===3?'active bronze':''}" data-quick-position="${payload}" data-position-value="3">🥉</button>
            </div>
            <label class="tour-position-field">
              <span>Posição</span>
              <input type="number" min="1" max="${activeMembers().length}" value="${tw.position ?? ''}" data-position-input="${payload}" placeholder="#">
            </label>
          </div>
        </div>
      </article>
    `;
  }).join('') + (!filtered.length ? '<div class="empty">Nenhum membro encontrado nesse filtro.</div>' : '');
}
function renderTournamentBoard(ctx){
  const rows = [...ctx.summaries].sort((a,b) => (b.tournamentPoints - a.tournamentPoints) || (b.scoreElite - a.scoreElite) || a.member.name.localeCompare(b.member.name));
  const leader = rows[0];
  ui.tournamentBoard.innerHTML = `
    <div class="classification-wrap football-style tournament-style">
      ${leader ? `
      <div class="classification-leader-card tournament-leader-card">
        <div class="leader-crown">🏆</div>
        <div class="leader-copy">
          <span class="leader-label">Líder do torneio</span>
          <strong>${esc(leader.member.name)}</strong>
          <small>${esc(leader.member.role)} • ${leader.tournament.top3Month} top 3 no mês</small>
        </div>
        <div class="leader-points-box">
          <span>PTS</span>
          <strong>${leader.tournamentPoints}</strong>
        </div>
      </div>` : ''}
      <div class="classification-table tournament-table-shell">
        <div class="classification-grid tournament-grid compact-grid">
          <div class="classification-head tournament-head compact-head">
            <div>#</div>
            <div>Membro</div>
            <div>PTS</div>
            <div>S1</div>
            <div>S2</div>
            <div>S3</div>
            <div>S4</div>
          </div>
          ${rows.map((item,idx) => {
            const topClass = idx < 5 ? 'top5' : idx < 10 ? 'top10' : '';
            const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : (idx+1);
            return `
              <div class="classification-row tournament-row compact-row ${topClass}">
                <div class="classification-rank"><span class="classification-badge">${medal}</span></div>
                <div class="classification-name tournament-name-cell">
                  <strong>${esc(item.member.name)}</strong>
                  <span>${esc(item.member.role)} • Top 3: ${item.tournament.top3Month}</span>
                </div>
                <div class="classification-cell points">${item.tournamentPoints}</div>
                ${item.tournament.weeks.map(w=>`<div class="classification-cell standings-cell"><span class="week-mini ${w.participated?'played':''}">${w.points}</span></div>`).join('')}
              </div>`;
          }).join('')}
        </div>
      </div>
    </div>`;
}
function previousMonth(month){
  const idx = seedData.meta.months.indexOf(month);
  return idx > 0 ? seedData.meta.months[idx - 1] : null;
}
function classificationRows(month){
  const ctx = monthContext(month);
  const rows = [...ctx.summaries].sort((a,b) =>
    (b.classificationPoints - a.classificationPoints) ||
    (b.attacksMonth - a.attacksMonth) ||
    (b.tournamentPoints - a.tournamentPoints) ||
    (b.perfectWeeks - a.perfectWeeks) ||
    a.member.name.localeCompare(b.member.name)
  );
  rows.forEach((item, idx) => {
    item.classificationRank = idx + 1;
  });
  return rows;
}
function movementMeta(month, name, currentRank){
  const prevMonth = previousMonth(month);
  if(!prevMonth) return {icon:'—', cls:'flat', label:'Sem mês anterior'};
  const prevRows = classificationRows(prevMonth);
  const prevRank = prevRows.findIndex(item => item.member.name === name);
  if(prevRank === -1) return {icon:'★', cls:'new', label:'Novo na tabela'};
  const delta = (prevRank + 1) - currentRank;
  if(delta > 0) return {icon:'↑', cls:'up', label:`Subiu ${delta}`};
  if(delta < 0) return {icon:'↓', cls:'down', label:`Caiu ${Math.abs(delta)}`};
  return {icon:'→', cls:'flat', label:'Sem mudança'};
}


function renderClassification(){
  const month = state.ui.classificationMonth || state.meta.currentMonth;
  const allRows = classificationRows(month);
  const query = (state.ui.classificationQuery || '').trim().toLowerCase();
  const roleFilter = state.ui.classificationRole || 'ALL';
  const filteredRows = allRows.filter(item => {
    const roleOk = roleFilter === 'ALL' ? true : item.member.role === roleFilter;
    const searchOk = !query ? true : item.member.name.toLowerCase().includes(query);
    return roleOk && searchOk;
  });
  const rows = filteredRows.map(item => ({
    ...item,
    movement: movementMeta(month, item.member.name, item.classificationRank)
  }));
  const top5Points = allRows.slice(0,5).reduce((acc,item) => acc + item.classificationPoints, 0);
  const perfectWeeks = allRows.reduce((acc,item) => acc + item.perfectWeeks, 0);
  const totalPoints = allRows.reduce((acc,item) => acc + item.classificationPoints, 0);
  const totalAttacks = allRows.reduce((acc,item) => acc + item.attacksMonth, 0);
  const leader = allRows[0];
  const leaderGap = allRows.length > 1 ? Math.max(0, leader.classificationPoints - allRows[1].classificationPoints) : (leader?.classificationPoints || 0);
  const roles = ['ALL', ...new Set(state.members.filter(m => m.status !== 'ARQUIVADO').map(m => m.role))];
  const monthButtons = seedData.meta.months.map(m => `<button class="month-chip ${m === month ? 'active' : ''}" data-classification-month="${m}">${monthLabel(m).slice(0,3)}</button>`).join('');
  const medalFor = rank => rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : '';
  const top3 = allRows.slice(0,3);
  const top3Order = [1,0,2].filter(i => top3[i]).map(i => ({row: top3[i], slot: i===0 ? 'first' : i===1 ? 'second' : 'third'}));

  ui.classificationBoard.innerHTML = `
    <div class="classification-wrap football-standings legendary-board">
      <div class="classification-topbar premium">
        <div class="classification-topbar-copy">
          <span class="classification-kicker">Classificação lendária</span>
          <strong>${monthLabel(month)} • ranking por pontuação total</strong>
          <small>${rows.length === allRows.length ? 'Todos os membros exibidos' : `Filtro ativo: ${rows.length} membro(s)`}</small>
        </div>
        <div class="classification-topbar-stats">
          <div><span>Pontos</span><strong>${totalPoints}</strong></div>
          <div><span>Ataques</span><strong>${totalAttacks}</strong></div>
          <div><span>Top 5</span><strong>${top5Points}</strong></div>
        </div>
      </div>

      <div class="classification-month-strip">
        ${monthButtons}
      </div>

      ${top3Order.length ? `
      <div class="legendary-podium">
        ${top3Order.map(({row,slot}) => `
          <article class="legendary-podium-card ${slot}">
            <div class="legendary-podium-rank">${slot==='first'?'👑':slot==='second'?'🥈':'🥉'}</div>
            <div class="legendary-podium-name">${esc(row.member.name)}</div>
            <div class="legendary-podium-role">${esc(row.member.role)}</div>
            <div class="legendary-podium-points">${row.classificationPoints}<span>PTS</span></div>
            <div class="legendary-podium-meta">
              <span>${row.attacksMonth} ataques</span>
              <span>${row.tournamentPlacementPoints} torneio</span>
            </div>
          </article>
        `).join('')}
      </div>` : ''}

      ${leader ? `
      <div class="classification-highlight-row premium">
        <article class="classification-highlight-card leader premium">
          <span class="classification-highlight-label">Líder do mês</span>
          <strong>👑 ${esc(leader.member.name)}</strong>
          <small>${leader.classificationPoints} pts • ${leader.attacksMonth} ataques • ${leaderGap} pts de vantagem</small>
        </article>
        
        <article class="classification-highlight-card month premium">
          <span class="classification-highlight-label">Clinchit</span>
          <strong>${perfectWeeks}</strong>
          <small>Semanas perfeitas fechadas com 16/16 ataques no mês.</small>
        </article>
      </div>` : ''}

      <div class="classification-table football-board football-standings-board upgraded premium">
        <div class="classification-grid standings-grid upgraded premium">
          <div class="classification-head standings-head upgraded premium">
            <div>#</div>
            <div>Membro</div>
            <div>PTS</div>
            <div>ATQ</div>
            <div>PAR</div>
            <div>TOR</div>
            <div>CL</div>
          </div>
          ${rows.length ? rows.map(item => {
            const topTone = item.classificationRank === 1 ? 'gold' : item.classificationRank === 2 ? 'silver' : item.classificationRank === 3 ? 'bronze' : '';
            const maxPoints = leader?.classificationPoints || 1;
            const fillPct = Math.max(10, Math.min(100, Math.round((item.classificationPoints / maxPoints) * 100)));
            return `
            <div class="classification-row standings-row upgraded premium ${item.classificationRank <= 5 ? 'zone-green' : 'zone-blue'} ${item.classificationRank<=3 ? 'podium-row' : ''} ${item.classificationRank===1 ? 'leader-row' : ''} ${topTone} ${memberMatchesCurrentUser(item.member) ? 'is-self' : ''}">
              <div class="classification-rank standings-rank">
                <span class="classification-badge standings-badge ${item.classificationRank <= 5 ? 'green' : 'blue'} ${topTone}">${item.classificationRank<=3 ? medalFor(item.classificationRank) : item.classificationRank}</span>
              </div>
              <div class="classification-name standings-name upgraded premium">
                <strong>${esc(item.member.name)}</strong>
                <span>${esc(item.member.role)} • ${item.movement.icon} ${item.movement.label}</span>
                <div class="classification-inline-tags">
                  <span class="inline-tag points">${item.classificationPoints} pts total</span>
                  <span class="inline-tag attacks">${item.attacksMonth} ataques</span>
                </div>
                <div class="rank-progress premium"><span style="width:${fillPct}%"></span></div>
              </div>
              <div class="classification-cell standings-cell points primary">${item.classificationPoints}</div>
              <div class="classification-cell standings-cell attacks">${item.attacksMonth}</div>
              <div class="classification-cell standings-cell">${item.tournamentParticipationPoints}</div>
              <div class="classification-cell standings-cell">${item.tournamentPlacementPoints}</div>
              <div class="classification-cell standings-cell">${item.clinchitPoints}</div>
            </div>`;
          }).join('') : `<div class="empty classification-empty">Nenhum membro encontrado com esse filtro.</div>`}
        </div>
      </div>

      <div class="classification-footnote-grid">
        <div class="classification-note">Legenda: ATQ=1 por ataque • PAR=participação • TOR=posição • CL=3/semana.
Clinchit = 3 pontos para cada semana fechada com 16/16 ataques.</div>
      </div>
    </div>
  `;
}


function renderEliteBoard(ctx){
  const rows = [...ctx.summaries].sort((a,b)=>(b.scoreElite-a.scoreElite) || (b.classificationPoints-a.classificationPoints) || a.member.name.localeCompare(b.member.name));
  const leader = rows[0];
  ui.eliteBoard.innerHTML = `
    <div class="classification-wrap football-style tournament-style elite-selection-table">
      ${leader ? `
      <div class="classification-leader-card tournament-leader-card">
        <div class="leader-crown">👑</div>
        <div class="leader-copy">
          <span class="leader-label">Seleção elite</span>
          <strong>${esc(leader.member.name)}</strong>
          <small>${esc(leader.member.role)} • confiança ${leader.confidence} • ${leader.warPriority}</small>
        </div>
        <div class="leader-points-box">
          <span>ELT</span>
          <strong>${leader.scoreElite}</strong>
        </div>
      </div>` : ''}
      <div class="classification-table tournament-table-shell">
        <div class="classification-grid tournament-grid compact-grid elite-grid-table">
          <div class="classification-head tournament-head compact-head elite-head-table">
            <div>#</div>
            <div>Membro</div>
            <div>ELT</div>
            <div>ATQ</div>
            <div>TOR</div>
            <div>PRI</div>
            <div>CF</div>
          </div>
          ${rows.slice(0,12).map((item,idx) => {
            const topClass = idx < 5 ? 'top5' : idx < 10 ? 'top10' : '';
            const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : (idx+1);
            return `
              <div class="classification-row tournament-row compact-row elite-table-row ${topClass} ${idx===0?'leader-row':''}">
                <div class="classification-rank"><span class="classification-badge">${medal}</span></div>
                <div class="classification-name tournament-name-cell ranking-name-cell">
                  <strong>${esc(item.member.name)}</strong>
                  <span>${esc(item.member.role)} • ${item.suggestion}</span>
                </div>
                <div class="classification-cell points">${item.scoreElite}</div>
                <div class="classification-cell standings-cell">${item.attacksMonth}</div>
                <div class="classification-cell standings-cell">${item.tournamentPoints}</div>
                <div class="classification-cell standings-cell"><span class="mini-chip ${item.warPriority==='CRÍTICA'?'bad':item.warPriority==='ALTA'?'warn':'good'}">${item.warPriority.slice(0,3)}</span></div>
                <div class="classification-cell standings-cell"><span class="mini-chip ${item.confidence==='ALTA'?'good':item.confidence==='MÉDIA'?'warn':'bad'}">${item.confidence.slice(0,1)}</span></div>
              </div>`;
          }).join('')}
        </div>
      </div>
    </div>`;
}
function renderHistory(ctx){
  const month = state.meta.currentMonth;
  const history = state.history.filter(item => normalizeMonth(item.month) === month).slice(0,12);
  const rows = history.length ? history : ctx.summaries.slice(0,12).map(item => ({
    name:item.member.name, month:monthLabel(month), suggestion:item.suggestion, confidence:item.confidence, priority:item.warPriority, alert:item.alert, observation:item.progressStatus
  }));
  ui.historyBoard.innerHTML = rows.map(item => `
    <article class="history-card">
      <strong>${esc(item.name)}</strong>
      <div class="chips">
        <span class="chip blue">${esc(item.suggestion || '-')}</span>
        <span class="chip ${item.confidence==='ALTA'?'good':item.confidence==='MÉDIA'?'warn':'bad'}">${esc(item.confidence || '—')}</span>
      </div>
      <small>${esc(item.observation || '')}</small>
    </article>
  `).join('');
}
function normalizeMonth(label){
  if(!label) return '';
  const cleaned = label.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase();
  return Object.keys(monthLabels).find(key => key.normalize('NFD').replace(/[\u0300-\u036f]/g,'') === cleaned) || cleaned;
}
function memberActionLabel(member, summary){
  if(member.status === 'ARQUIVADO') return 'Arquivado 📦';
  if(summary?.suggestion === 'PROMOVER') return 'Promover 🎉';
  if(summary?.suggestion === 'REVISAR CARGO') return 'Rebaixar ❌';
  return 'Manter ✋🏼';
}

function renderMembers(ctx){
  const summaries = Object.fromEntries(ctx.summaries.map(s => [s.member.name, s]));
  const visibleMembers = activeMembers();
  ui.membersGrid.innerHTML = visibleMembers.map(member => {
    const summary = summaries[member.name];
    const elite = summary ? summary.scoreElite : 0;
    const tone = member.status === 'ARQUIVADO' ? 'bad' : summary?.alert === 'EXPULSÃO' ? 'bad' : summary?.alert === 'RISCO' ? 'warn' : 'good';
    return `
      <article class="member-card ${memberMatchesCurrentUser(member) ? 'is-self' : ''}">
        <div class="member-top">
          <div>
            <strong>${esc(member.name)} ${memberMatchesCurrentUser(member) ? '<span class="self-badge">VOCÊ</span>' : ''}</strong>
            <div class="mini">${esc(member.role)} • ${member.eligibleTournament ? 'Elegível torneio' : 'Sem torneio'}</div>
          </div>
          <span class="chip ${tone}">${member.status}</span>
        </div>
        <div class="chips">
          <span class="chip blue">ELITE ${elite || 0}</span>
          <span class="chip">${summary ? summary.suggestion : 'Sem mês ativo'}</span>
        </div>
        <div class="actions">
          <button class="ghost small" data-open-member="${esc(member.name)}">Perfil</button>
          ${isAdminApp() ? `<button class="ghost small" data-open-member-action="${esc(member.name)}">${memberActionLabel(member, summary)}</button>
          <button class="ghost small" data-toggle-archive="${esc(member.name)}">${member.status === 'ARQUIVADO' ? 'Reativar' : 'Arquivar'}</button>` : `<button class="ghost small" type="button" disabled>Somente admin</button>`}
        </div>
      </article>
    `;
  }).join('');
}


function renderArchivedBoard(ctx){
  if(!ui.archivedBoard) return;
  if(!canEditApp()){ ui.archivedBoard.innerHTML = '<div class="empty">Arquivados visível apenas para líder ou editor.</div>'; return; }
  const archived = state.members.filter(member => member.status === 'ARQUIVADO');
  if(!archived.length){
    ui.archivedBoard.innerHTML = '<div class="empty">Nenhum membro arquivado no momento.</div>';
    return;
  }
  ui.archivedBoard.innerHTML = `
    <div class="archived-list">
      ${archived.map(member => {
        const history = state.history.filter(item => item.name === member.name).slice(-1)[0];
        return `
          <article class="archived-item-card">
            <button class="archived-item archived-open" type="button" data-open-member="${esc(member.name)}">
              <span class="archived-main">
                <strong>${esc(member.name)} - ${esc(member.role)}</strong>
                <small>${member.exitDate ? 'Arquivado em ' + esc(member.exitDate) : 'Arquivado'}${history?.suggestion ? ' • ' + esc(history.suggestion) : ''}</small>
              </span>
              <span class="chip bad">Arquivado</span>
            </button>
            <div class="inline-actions archived-actions">
              <button class="ghost small" type="button" data-restore-member="${esc(member.name)}">Restaurar</button>
              <button class="ghost small danger" type="button" data-delete-member="${esc(member.name)}">Excluir</button>
            </div>
          </article>
        `;
      }).join('')}
    </div>`;
}

function purgeMemberFromState(name){
  if(!name) return;
  state.members = state.members.filter(member => member.name !== name);
  state.history = (state.history || []).filter(item => item.name !== name);
  if(state.decisions?.currentMonth){
    state.decisions.currentMonth = state.decisions.currentMonth.filter(item => item.name !== name && item.member?.name !== name);
  }
  Object.keys(state.months || {}).forEach(month => {
    const monthObj = state.months[month];
    if(!monthObj) return;
    Object.keys(monthObj.weeks || {}).forEach(week => {
      if(monthObj.weeks[week] && monthObj.weeks[week][name]) delete monthObj.weeks[week][name];
    });
    if(monthObj.tournament && monthObj.tournament[name]) delete monthObj.tournament[name];
  });
}

function deleteArchivedMember(name){
  if(!isAdminApp()) return;
  if(!name) return;
  const member = state.members.find(m => m.name === name);
  if(!member) return;
  if(!confirm(`Excluir ${name} definitivamente do sistema?`)) return;
  purgeMemberFromState(name);
  saveState();
  closeMember();
  render();
}
function openMemberAction(name){
  if(!isAdminApp()) return;
  if(!ui.memberActionModal || !ui.memberActionBody) return;
  const member = state.members.find(m => m.name === name);
  if(!member) return;
  ui.memberActionBody.innerHTML = `
    <div class="profile-popover-header user-edit-header">
      <strong>${esc(member.name)} ${memberMatchesCurrentUser(member) ? '<span class="self-badge">VOCÊ</span>' : ''}</strong>
      <small>${esc(member.role)} • ${esc(member.status)}</small>
    </div>
    <div class="member-action-stack">
      <button class="primary" type="button" data-member-action-choice="keep" data-member-action-name="${esc(member.name)}">Manter ✋🏼</button>
      <button class="ghost" type="button" data-member-action-choice="promote" data-member-action-name="${esc(member.name)}" ${canEditApp() ? '' : 'disabled'}>Promover 🎉</button>
      <button class="ghost" type="button" data-member-action-choice="demote" data-member-action-name="${esc(member.name)}" ${canEditApp() ? '' : 'disabled'}>Rebaixar ❌</button>
    </div>
    <p class="helper">Promoção e rebaixamento seguem automaticamente a hierarquia do clã.</p>
  `;
  ui.memberActionModal.classList.remove('hidden');
}
function closeMemberAction(){ ui.memberActionModal?.classList.add('hidden'); }
function applyMemberAction(action, name){
  if(!isAdminApp() && action !== 'keep') return;
  const member = state.members.find(m => m.name === name);
  if(!member) return;
  if(action === 'promote') member.role = nextPromotedRole(member.role);
  if(action === 'demote') member.role = nextDemotedRole(member.role);
  saveState();
  closeMemberAction();
  render();
}

function renderUsersView(){
  if(!ui.usersBoard) return;
  const users = Array.isArray(state.authUsers) ? state.authUsers : [];
  if(!users.length){
    ui.usersBoard.innerHTML = '<div class="empty">Nenhum usuário cadastrado ainda.</div>';
    return;
  }
  ui.usersBoard.innerHTML = `
    <div class="users-compact-list">
      ${users.map(user => `
        <button class="user-compact-item" type="button" data-open-user-edit="${esc(user.uid)}">
          <span class="user-compact-main">
            <strong>${esc(user.nick || user.name || user.email)}</strong>
            <small>${esc(user.clanRole || 'Membro')} • ${esc(user.accessRole || 'viewer')}</small>
          </span>
          <span class="user-compact-email">${esc(user.email || '')}</span>
        </button>
      `).join('')}
    </div>
  `;
}


function openUserEdit(uid){
  const users = Array.isArray(state.authUsers) ? state.authUsers : [];
  const user = users.find(item => String(item.uid) === String(uid));
  if(!user || !ui.userEditBody || !ui.userEditModal) return;

  const cargoOptions = ['Membro','Ancião','Co-líder','Líder'];
  const accessOptions = [
    { value:'viewer', label:'Leitura' },
    { value:'editor', label:'Editor' },
    { value:'admin', label:'Líder' }
  ];

  ui.userEditBody.innerHTML = `
    <div class="profile-popover-header user-edit-header">
      <strong>${esc(user.nick || user.name || user.email || 'Usuário')}</strong>
      <small>${esc(user.email || '')}</small>
    </div>
    <div class="user-edit-grid compact-popup">
      <label class="field compact">
        <span>Nome</span>
        <input type="text" value="${esc(user.name || '')}" data-user-name="${esc(user.uid)}">
      </label>
      <label class="field compact">
        <span>Nick</span>
        <input type="text" value="${esc(user.nick || '')}" data-user-nick="${esc(user.uid)}">
      </label>
      <label class="field compact">
        <span>Tag do jogador</span>
        <input type="text" value="${esc(user.playerTag || '')}" placeholder="#Q2ABC123" data-user-player-tag="${esc(user.uid)}">
      </label>
      <label class="field compact">
        <span>Cargo</span>
        <select data-user-clan-role="${esc(user.uid)}">
          ${cargoOptions.map(role => `<option value="${role}" ${String(user.clanRole || '').toLowerCase() === role.toLowerCase() ? 'selected' : ''}>${role}</option>`).join('')}
        </select>
      </label>
      <label class="field compact">
        <span>Acesso</span>
        <select data-user-access-role="${esc(user.uid)}">
          ${accessOptions.map(opt => `<option value="${opt.value}" ${String(user.accessRole || 'viewer') === opt.value ? 'selected' : ''}>${opt.label}</option>`).join('')}
        </select>
      </label>
    </div>
    <div class="actions user-edit-actions">
      <button class="primary" data-save-user-profile="${esc(user.uid)}">Salvar</button>
      <button class="ghost danger" data-delete-user-profile="${esc(user.uid)}">Excluir usuário</button>
    </div>
    <p class="helper">A exclusão remove o usuário do sistema e bloqueia novo acesso com essa conta.</p>
  `;
  ui.userEditModal.classList.remove('hidden');
}

function closeUserEdit(){ ui.userEditModal?.classList.add('hidden'); }

function renderVault(ctx, goals){
  const annual = annualSummary();
  const archived = state.members.filter(m => m.status === 'ARQUIVADO').length;
  const currentTop = ctx.summaries[0];
  ui.vaultInsights.innerHTML = `
    <article class="insight-card">
      <div class="insight-top">
        <strong>Resumo rápido</strong>
        <span class="chip blue">${monthLabel(state.meta.currentMonth)}</span>
      </div>
      <div class="chips">
        <span class="chip">${activeMembers().length} ativos</span>
        <span class="chip">${archived} arquivados</span>
        <span class="chip">${ctx.maxWeeksStarted} semanas com atividade</span>
      </div>
    </article>
    <article class="insight-card">
      <div class="insight-top">
        <strong>Melhor do mês</strong>
        <span class="chip good">${currentTop ? currentTop.scoreElite : 0}</span>
      </div>
      <small>${currentTop ? esc(currentTop.member.name) + ' • ' + esc(currentTop.member.role) : 'Sem dados'}</small>
    </article>
    <article class="insight-card">
      <div class="insight-top">
        <strong>Topo anual</strong>
        <span class="chip gold">${annual[0] ? annual[0].eliteTotal : 0}</span>
      </div>
      <small>${annual[0] ? esc(annual[0].member.name) + ' lidera a temporada.' : 'Sem dados'}</small>
    </article>
    <article class="insight-card">
      <div class="insight-top">
        <strong>Metas</strong>
        <span class="chip">${goals.attacks}/${goals.tournament}</span>
      </div>
      <small>Ajuste as metas conforme o ritmo real da temporada.</small>
    </article>
  `;
}

function openMember(name){
  const member = state.members.find(m => m.name === name);
  if(!member) return;
  const annual = annualSummary().find(row => row.member.name === name);
  const bars = seedData.meta.months.map(month => {
    const summary = monthContext(month).summaries.find(s => s.member.name === name);
    const val = summary ? summary.scoreElite : 0;
    return {month, val};
  });
  const current = monthContext(state.meta.currentMonth).summaries.find(s => s.member.name === name);
  const maxElite = Math.max(1, ...bars.map(item => item.val || 0), current?.scoreElite || 0);
  const initials = String(member.name || '?').split(' ').filter(Boolean).slice(0,2).map(part => part[0]).join('').toUpperCase();
  const confidenceTone = current?.confidence === 'ALTA' ? 'good' : current?.confidence === 'MÉDIA' ? 'warn' : 'bad';
  const alertTone = current?.alert === 'EXPULSÃO' ? 'bad' : current?.alert === 'RISCO' ? 'warn' : 'good';
  const recentHistory = (state.history || []).filter(item => item.name === name).slice(-4).reverse();
  const canEditProfile = canEditMemberProfile(member);
  const isOwnProfile = memberMatchesCurrentUser(member);
  const lockHint = isAdminApp() ? '' : (isOwnProfile ? 'Você pode editar apenas o seu cadastro.' : 'Somente o próprio membro ou um admin pode editar este cadastro.');

  ui.memberModalBody.innerHTML = `
    <div class="premium-profile-shell">
      <div class="premium-profile-hero">
        <div class="premium-avatar">${esc(initials)}</div>
        <div class="premium-profile-copy">
          <p class="eyebrow">Perfil premium do jogador<br></p>
          <h3>${esc(member.name)}</h3>
          <div class="mini">${esc(member.role)} • ${member.status}</div>
          <div class="chips">
            <span class="chip ${member.eligibleTournament ? 'good' : 'warn'}">${member.eligibleTournament ? 'Elegível torneio' : 'Não elegível'}</span>
            <span class="chip blue">Mês ${monthLabel(state.meta.currentMonth)}</span>
            <span class="chip ${confidenceTone}">${current?.confidence || 'Sem confiança'}</span>
            <span class="chip ${alertTone}">${current?.alert || 'Sem alerta'}</span>
          </div>
        </div>
      </div>

      <div class="premium-profile-section">
        <div class="premium-section-head">
          <strong>Dados do jogador</strong>
          <small>tag oficial para vínculo do sistema com a Guerra Auto</small>
        </div>
        <div class="stack">
          <label class="field">
            <span>Tag do jogador</span>
            <input type="text" value="${esc(member.playerTag || '')}" placeholder="#Q2ABC123" data-member-tag="${esc(member.name)}" ${isAdminApp() ? '' : 'disabled'}>
          </label>
          ${isAdminApp() ? `<button class="primary" data-save-member-tag="${esc(member.name)}">Salvar tag</button>` : '<p class="helper">Somente administradores podem alterar a tag do jogador.</p>'}
        </div>
      </div>

      <div class="premium-stat-grid">
        <article class="premium-stat-card gold">
          <span>Score ELITE</span>
          <strong>${current ? current.scoreElite : 0}</strong>
          <small>força competitiva atual</small>
        </article>
        <article class="premium-stat-card blue">
          <span>Ataques no mês</span>
          <strong>${current ? current.attacksMonth : 0}</strong>
          <small>participação em guerra</small>
        </article>
        <article class="premium-stat-card green">
          <span>Pontos torneio</span>
          <strong>${current ? current.tournamentPoints : 0}</strong>
          <small>resultado competitivo</small>
        </article>
        <article class="premium-stat-card">
          <span>Temporada</span>
          <strong>${annual ? annual.eliteTotal : 0}</strong>
          <small>elite acumulado no ano</small>
        </article>
      </div>

      <div class="premium-profile-section">
        <div class="premium-section-head">
          <strong>Evolução mensal</strong>
          <small>desempenho do jogador ao longo da temporada</small>
        </div>
        <div class="premium-bars">
          ${bars.map(item => {
            const fill = Math.max(6, Math.round(((item.val || 0) / maxElite) * 100));
            return `
              <div class="premium-bar-item">
                <div class="premium-bar-meta">
                  <span>${monthLabel(item.month).slice(0,3)}</span>
                  <strong>${item.val}</strong>
                </div>
                <div class="premium-bar-track"><span style="width:${fill}%"></span></div>
              </div>
            `;
          }).join('')}
        </div>
      </div>

      <div class="premium-profile-section">
        <div class="premium-section-head">
          <strong>Resumo competitivo</strong>
          <small>leitura rápida do estado atual do jogador</small>
        </div>
        <div class="premium-summary-grid">
          <div class="premium-summary-item">
            <span>Sugestão</span>
            <strong>${current?.suggestion || 'Sem sugestão'}</strong>
          </div>
          
          <div class="premium-summary-item">
            <span>Colocação</span>
            <strong>#${current?.classificationRank || '-'}</strong>
          </div>
          <div class="premium-summary-item">
            <span>Classificação</span>
            <strong>${current?.classificationPoints || 0} pts</strong>
          </div>
        </div>
      </div>

      <div class="premium-profile-section">
        <div class="premium-section-head">
          <strong>Histórico recente</strong>
          <small>últimos registros e observações do sistema</small>
        </div>
        <div class="premium-history-list">
          ${recentHistory.length ? recentHistory.map(item => `
            <article class="premium-history-item">
              <div>
                <strong>${monthLabel(item.month || state.meta.currentMonth)} • Semana ${item.week || '-'}</strong>
                <small>${item.suggestion || 'Sem sugestão'} • ${item.alert || 'Sem alerta'}</small>
              </div>
              <span class="chip ${item.alert === 'EXPULSÃO' ? 'bad' : item.alert === 'RISCO' ? 'warn' : 'good'}">${item.scoreElite || 0} elite</span>
            </article>
          `).join('') : `<div class="empty">Sem histórico recente registrado.</div>`}
        </div>
      </div>

      </div>

      <div class="premium-profile-section">
        <div class="premium-section-head">
          <strong>Nota do líder</strong>
          <small>ajuste manual e acompanhamento individual</small>
        </div>
        <div class="stack">
          <label class="field">
            <span>Nota do líder</span>
            <input type="text" value="${esc(member.notes?.leaderNote || member.notes?.manualNote || '')}" data-member-note="${esc(member.name)}" ${isAdminApp() ? '' : 'disabled'}>
          </label>
          <button class="primary" data-save-member-note="${esc(member.name)}" ${isAdminApp() ? '' : 'disabled'}>Salvar nota</button>
          ${!isAdminApp() ? '<p class="helper">Nota do líder disponível apenas para admin.</p>' : ''}
        </div>
      </div>

      <div class="chips" style="margin-top:18px">
        <span class="chip blue">Ano ${annual ? annual.eliteTotal : 0} elite</span>
        <span class="chip">${annual ? annual.attacksYear : 0} ataques ano</span>
        <span class="chip">${annual ? annual.tournamentYear : 0} torneio ano</span>
      </div>
    </div>
  `;
  ui.memberModal.classList.remove('hidden');
}

function closeMember(){ ui.memberModal.classList.add('hidden'); }
function openGoals(){
  const goals = state.goals[state.meta.currentMonth] || {attacks:1200,tournament:80};
  $('#goalAttacksInput').value = goals.attacks;
  $('#goalTournamentInput').value = goals.tournament;
  ui.goalModal.classList.remove('hidden');
}
function closeGoals(){ ui.goalModal.classList.add('hidden'); }

function openCreateMemberModal(){
  if(!ui.createMemberModal) return;
  ui.createMemberModal.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
  requestAnimationFrame(() => (ui.createMemberName || ui.createMemberNick)?.focus());
}
function closeCreateMemberModal(){
  if(!ui.createMemberModal) return;
  ui.createMemberModal.classList.add('hidden');
  if(ui.createMemberForm) ui.createMemberForm.reset();
  document.body.style.overflow = '';
}
function exportBackup(){
  const blob = new Blob([JSON.stringify(state, null, 2)], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `topbrs-backup-${new Date().toISOString().slice(0,10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
function importBackup(file){
  const reader = new FileReader();
  reader.onload = () => {
    try{
      const imported = hydrateSeed(JSON.parse(reader.result));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(imported));
      location.reload();
    }catch(e){
      alert('Backup inválido ou incompatível com a versão atual.');
    }
  };
  reader.readAsText(file);
}
function toggleArchive(name){
  if(!isAdminApp()) return;
  const member = state.members.find(m => m.name === name);
  if(!member) return;
  if(member.status === 'ARQUIVADO'){
    member.status = 'ATIVO';
    member.exitDate = null;
    member.exitReason = null;
  }else{
    member.status = 'ARQUIVADO';
    member.exitDate = new Date().toISOString().slice(0,10);
    member.exitReason = 'Arquivado pelo app';
  }
  saveState();
  closeMember();
  render();
  if(member.status === 'ARQUIVADO'){
    setActiveView('archivedView');
  }
}
function addMember(){
  openCreateMemberModal();
}
function createMemberFromModal(){
  const name = (ui.createMemberName?.value || '').trim();
  const nick = (ui.createMemberNick?.value || '').trim();
  const playerTag = normalizePlayerTag(ui.createMemberTag?.value || '');
  if(!name || !nick) return;
  const role = (ui.createMemberRole?.value || 'Ancião').trim() || 'Ancião';
  state.members.unshift({
    id: nick.toLowerCase().replace(/[^a-z0-9]+/g,'-'),
    name: nick,
    fullName: name,
    nick,
    playerTag,
    role, eligibleTournament:true, observation:'', status:'ATIVO',
    exitDate:null, exitReason:null, exitObservation:null, notes:{}
  });
  for(const month of seedData.meta.months){
    for(let week=1;week<=4;week++) ensureWeekMember(month, week, nick);
    ensureTournamentMember(month, nick);
  }
  saveState();
  closeCreateMemberModal();
  render();
}
function toggleAttack(payload){
  const [name, week, day, idx] = encodedParts(payload, 4);
  const record = ensureWeekMember(state.meta.currentMonth, Number(week), name);
  record.days[day].attacks[Number(idx)] = !record.days[day].attacks[Number(idx)];
  recomputeWeekRecord(record);
  saveState();
  render();
}
function toggleParticipation(payload){
  const [name, week] = encodedParts(payload, 2);
  const record = ensureTournamentMember(state.meta.currentMonth, name);
  const row = record.weeks[Number(week)-1];
  row.participated = !row.participated;
  row.points = computeTournamentPoints(row.position, row.participated);
  saveState();
  render();
}
function setTournamentPosition(payload, value){
  const [name, week] = encodedParts(payload, 2);
  const record = ensureTournamentMember(state.meta.currentMonth, name);
  const row = record.weeks[Number(week)-1];
  const position = value ? Number(value) : null;
  row.position = position;
  row.participated = !!position || row.participated;
  row.points = computeTournamentPoints(row.position, row.participated);
  saveState();
  render();
}
function updatePosition(payload, value){
  const [name, week] = encodedParts(payload, 2);
  const record = ensureTournamentMember(state.meta.currentMonth, name);
  const row = record.weeks[Number(week)-1];
  row.position = value ? Number(value) : null;
  if(row.position) row.participated = true;
  row.points = computeTournamentPoints(row.position, row.participated);
  saveState();
  render();
}
function saveMemberTag(name){
  const member = state.members.find(item => item.name === name);
  if(!member || !canEditMemberProfile(member)) return;
  const input = document.querySelector(`[data-member-tag="${CSS.escape(String(name))}"]`);
  const btn = document.querySelector(`[data-save-member-tag="${CSS.escape(String(name))}"]`);
  if(!input) return;
  setButtonWorking(btn, true);
  member.playerTag = normalizePlayerTag(input.value || '');
  saveState();
  showToast('Tag do jogador salva com sucesso.');
  renderWarAutoView?.();
  setButtonWorking(btn, false, 'Salvo');
}

function saveMemberNote(name){
  if(!isAdminApp()) return;
  const input = document.querySelector(`[data-member-note="${CSS.escape(name)}"]`);
  const btn = document.querySelector(`[data-save-member-note="${CSS.escape(name)}"]`);
  if(!input) return;
  const member = state.members.find(m => m.name === name);
  member.notes ||= {};
  setButtonWorking(btn, true);
  member.notes.leaderNote = input.value;
  saveState();
  showToast('Nota salva com sucesso.');
  setButtonWorking(btn, false, 'Salvo');
}
function openShareCard(){
  const ctx = monthContext(state.meta.currentMonth);
  const top = ctx.summaries.slice(0,5);
  const canvas = $('#shareCanvas');
  const c = canvas.getContext('2d');
  c.clearRect(0,0,canvas.width,canvas.height);
  const grad = c.createLinearGradient(0,0,canvas.width,canvas.height);
  grad.addColorStop(0,'#0d1532');
  grad.addColorStop(.5,'#131f46');
  grad.addColorStop(1,'#24120c');
  c.fillStyle = grad;
  c.fillRect(0,0,canvas.width,canvas.height);
  c.fillStyle = 'rgba(255,255,255,0.08)';
  c.beginPath(); c.arc(930,120,180,0,Math.PI*2); c.fill();
  c.beginPath(); c.arc(120,1180,220,0,Math.PI*2); c.fill();
  c.fillStyle = '#ffca55';
  c.font = '700 34px -apple-system, sans-serif';
  c.fillText("TOP BRS", 72, 96);
  c.fillStyle = '#ffffff';
  c.font = '900 74px -apple-system, sans-serif';
  c.fillText('Ranking Elite', 72, 176);
  c.font = '500 30px -apple-system, sans-serif';
  c.fillStyle = '#d9e4ff';
  c.fillText(monthLabel(state.meta.currentMonth) + ' • modo mito ativo', 72, 226);

  top.forEach((item, idx) => {
    const y = 292 + idx*184;
    c.fillStyle = 'rgba(10,16,34,0.72)';
    roundRect(c,72,y,936,144,28,true,false);
    c.fillStyle = idx===0 ? '#ffca55' : idx===1 ? '#d7e0ff' : idx===2 ? '#ffb26a' : '#53a2ff';
    roundRect(c,92,y+24,86,96,24,true,false);
    c.fillStyle = '#08101f';
    c.font = '900 44px -apple-system, sans-serif';
    c.fillText(String(idx+1), 124, y+84);
    c.fillStyle = '#ffffff';
    c.font = '800 40px -apple-system, sans-serif';
    c.fillText(item.member.name.slice(0,24), 204, y+68);
    c.fillStyle = '#aebee5';
    c.font = '500 26px -apple-system, sans-serif';
    c.fillText(`${item.member.role} • ${item.attacksMonth} ataques • ${item.tournamentPoints} torneio`, 204, y+106);
    c.fillStyle = '#ffffff';
    c.font = '900 50px -apple-system, sans-serif';
    c.fillText(String(item.scoreElite), 888, y+88);
    c.fillStyle = item.confidence === 'ALTA' ? '#7dffc7' : item.confidence === 'MÉDIA' ? '#ffe08f' : '#ff9ba7';
    c.font = '700 24px -apple-system, sans-serif';
    c.fillText(item.confidence, 834, y+116);
  });
  c.fillStyle = '#aebee5';
  c.font = '500 24px -apple-system, sans-serif';
  c.fillText('Gerado pelo Ultra PWA • offline • pronto para compartilhar', 72, 1290);

  canvas.toBlob(async blob => {
    const file = new File([blob], 'topbrs-ranking.png', {type:'image/png'});
    if(navigator.canShare && navigator.canShare({files:[file]})){
      await navigator.share({files:[file], title:"TOP BRS' Ranking"});
    }else{
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'topbrs-ranking.png';
      a.click();
    }
  });
}
function roundRect(ctx,x,y,w,h,r,fill,stroke){
  ctx.beginPath();
  ctx.moveTo(x+r,y);
  ctx.arcTo(x+w,y,x+w,y+h,r);
  ctx.arcTo(x+w,y+h,x,y+h,r);
  ctx.arcTo(x,y+h,x,y,r);
  ctx.arcTo(x,y,x+w,y,r);
  ctx.closePath();
  if(fill) ctx.fill();
  if(stroke) ctx.stroke();
}


function updateFloatingHeader(){
  const topbar = document.querySelector('.topbar');
  if(!topbar) return;
  topbar.classList.remove('floating');
}

function scrollToTopSmooth(){
  try{
    window.scrollTo({top:0, behavior:'smooth'});
  }catch(e){
    window.scrollTo(0,0);
  }
}
function updateBackToTopVisibility(){
  if(!ui.backToTopBtn) return;
  const show = (window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0) > 320;
  ui.backToTopBtn.classList.toggle('visible', show);
}

function setActiveView(viewId){
  if(viewId === 'warView') viewId = 'warAutoView';
  $all('.view').forEach(v => v.classList.toggle('active', v.id === viewId));
  $all('[data-view]').forEach(btn => btn.classList.toggle('active', btn.dataset.view === viewId));
  updateTopbarTitle(viewId);
  if(viewId === 'warAutoView') renderWarAutoView({ force:true });
  if(viewId === 'warRankingView') renderWarRankingView(true);
  if(viewId === 'membersSyncView') renderMembersSyncView(true);
  if(viewId === 'apiLogsView') renderApiLogsView(true);
  if(viewId === 'decksView') renderDecksView(false);
  toggleViewMenu(false);
  if(ui.heroSection){ ui.heroSection.classList.toggle('hidden', ['classificationView','vaultView','membersView','usersView','archivedView','warAutoView','warRankingView','membersSyncView','apiLogsView','decksView'].includes(viewId)); }
  if(ui.weekHeroPicker){ ui.weekHeroPicker.classList.toggle('hidden', ['arenaView','eliteView','warAutoView','warRankingView','membersSyncView','apiLogsView','decksView'].includes(viewId)); }
  if(viewId !== 'vaultView') lastNonVaultView = viewId;
  closeDrawer();
  requestAnimationFrame(applyDynamicTopSpacing);
  window.scrollTo({top:0, behavior:'smooth'});
}
function openDrawer(force=true){
  if(!ui.sideDrawer) return;
  const shouldOpen = typeof force === 'boolean' ? force : true;
  ui.sideDrawer.classList.toggle('drawer-open', shouldOpen);
  ui.sideDrawer.setAttribute('aria-hidden', shouldOpen ? 'false' : 'true');
  document.body.classList.toggle('drawer-visible', shouldOpen);
  if(shouldOpen) updateDrawerProfileSummary(true);
}

function closeDrawer(){
  if(!ui.sideDrawer) return;
  ui.sideDrawer.classList.remove('drawer-open');
  ui.sideDrawer.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('drawer-visible');
}

function handleTouchStart(e){
  if(e.touches.length !== 1) return;
  const target = e.target;
  if(target.closest('input, textarea, select, button, .drawer-panel, .modal-card')) return;
  const t = e.touches[0];
  touchMenuState = {x:t.clientX, y:t.clientY, handled:false};
}
function handleTouchMove(e){
  if(!touchMenuState || touchMenuState.handled || e.touches.length !== 1) return;
  const t = e.touches[0];
  const dx = t.clientX - touchMenuState.x;
  const dy = Math.abs(t.clientY - touchMenuState.y);
  if(dy > 42) { touchMenuState = null; return; }
  if(!document.body.classList.contains('drawer-visible') && touchMenuState.x > (window.innerWidth - 44) && dx < -50){
    openDrawer(true);
    touchMenuState.handled = true;
    return;
  }
  if(document.body.classList.contains('drawer-visible') && dx > 50){
    closeDrawer();
    touchMenuState.handled = true;
  }
}
function handleTouchEnd(){
  touchMenuState = null;
}

function isVaultUnlocked(){
  try{
    return sessionStorage.getItem(VAULT_SESSION_KEY) === '1';
  }catch(e){
    return false;
  }
}
function unlockVaultSession(){
  try{ sessionStorage.setItem(VAULT_SESSION_KEY, '1'); }catch(e){}
}
function closeVaultPrompt(){
  if(!ui.vaultAccessModal) return;
  ui.vaultAccessModal.classList.add('hidden');
  ui.vaultAccessModal.setAttribute('aria-hidden','true');
  ui.vaultAccessError?.classList.add('hidden');
  if(ui.vaultPasswordInput) ui.vaultPasswordInput.value = '';
  document.body.style.overflow = '';
}
function openVaultPrompt(){
  if(!ui.vaultAccessModal) return;
  ui.vaultAccessModal.classList.remove('hidden');
  ui.vaultAccessModal.setAttribute('aria-hidden','false');
  ui.vaultAccessError?.classList.add('hidden');
  document.body.style.overflow = 'hidden';
  requestAnimationFrame(() => ui.vaultPasswordInput?.focus());
}
function signalVaultError(){
  const card = ui.vaultAccessModal?.querySelector('.vault-lock-card');
  ui.vaultAccessError?.classList.remove('hidden');
  if(card){
    card.classList.remove('error');
    void card.offsetWidth;
    card.classList.add('error');
  }
}
function requestVaultAccess(){
  if(isVaultUnlocked()){
    setActiveView('vaultView');
    return;
  }
  openVaultPrompt();
}

function bind(){
  ui.monthSelect.addEventListener('change', e => { state.meta.currentMonth = e.target.value; state.ui.classificationMonth = e.target.value; saveState(); render(); });
  ui.classificationMonthSelect?.addEventListener('change', e => { state.ui.classificationMonth = e.target.value; saveState(); render(); });
  ui.weekSelect.addEventListener('change', e => { state.meta.currentWeek = Number(e.target.value); saveState(); render(); });
  document.body.addEventListener('click', e => {
    const menuTrigger = e.target.closest('#currentViewBadge');
    if(menuTrigger){
      toggleViewMenu();
      return;
    }
    if(e.target.closest('[data-close-view-menu]')){ toggleViewMenu(false); return; }
    if(ui.viewMenuDropdown && !e.target.closest('.view-menu-wrap')) toggleViewMenu(false);
    const viewBtn = e.target.closest('[data-view]');
    if(viewBtn){
      if(viewBtn.dataset.view === 'vaultView'){
        requestVaultAccess();
      }else{
        setActiveView(viewBtn.dataset.view);
      }
    }
    const rankBtn = e.target.closest('[data-rank-mode]');
    if(rankBtn){
      rankMode = rankBtn.dataset.rankMode;
      $all('[data-rank-mode]').forEach(btn => btn.classList.toggle('active', btn === rankBtn));
      render();
    }
    const warBtn = e.target.closest('[data-war-filter]');
    if(warBtn){
      warFilter = warBtn.dataset.warFilter;
      $all('[data-war-filter]').forEach(btn => btn.classList.toggle('active', btn === warBtn));
      render();
    }
    const collapseBtn = e.target.closest('[data-collapse-member]');
    if(collapseBtn){
      const [mode, encodedName] = String(collapseBtn.dataset.collapseMember || '').split('|');
      toggleMemberCollapse(mode, decodeURIComponent(encodedName || ''));
      return;
    }
    const attackBtn = e.target.closest('[data-toggle-attack]');
    if(attackBtn) toggleAttack(attackBtn.dataset.toggleAttack);
    const partBtn = e.target.closest('[data-toggle-participation]');
    if(partBtn) toggleParticipation(partBtn.dataset.toggleParticipation);
    const quickPosBtn = e.target.closest('[data-quick-position]');
    if(quickPosBtn) setTournamentPosition(quickPosBtn.dataset.quickPosition, quickPosBtn.dataset.positionValue);
    const monthChip = e.target.closest('[data-classification-month]');
    if(monthChip){
      state.ui.classificationMonth = monthChip.dataset.classificationMonth;
      saveState();
      renderClassification();
      if(ui.classificationMonthSelect) ui.classificationMonthSelect.value = state.ui.classificationMonth;
    }
    const heroMonthChip = e.target.closest('[data-month-chip]');
    if(heroMonthChip){
      state.meta.currentMonth = heroMonthChip.dataset.monthChip;
      state.ui.classificationMonth = state.meta.currentMonth;
      saveState();
      render();
    }
    const heroWeekChip = e.target.closest('[data-week-chip]');
    if(heroWeekChip){
      state.meta.currentWeek = Number(heroWeekChip.dataset.weekChip || 1);
      saveState();
      render();
    }
    const openUserBtn = e.target.closest('[data-open-user-edit]');
    if(openUserBtn){ openUserEdit(openUserBtn.dataset.openUserEdit); return; }
    const saveUserBtn = e.target.closest('[data-save-user-profile]');
    if(saveUserBtn && window.TOPBRS_AUTH_UI?.saveUserProfileFromInputs){
      window.TOPBRS_AUTH_UI.saveUserProfileFromInputs(saveUserBtn.dataset.saveUserProfile);
      closeUserEdit();
      return;
    }
    const deleteUserBtn = e.target.closest('[data-delete-user-profile]');
    if(deleteUserBtn && window.TOPBRS_AUTH_UI?.deleteUser){
      if(confirm('Remover este usuário do sistema?')){
        window.TOPBRS_AUTH_UI.deleteUser(deleteUserBtn.dataset.deleteUserProfile);
        closeUserEdit();
      }
      return;
    }
    const memberOpen = e.target.closest('[data-open-member]');
    if(memberOpen) openMember(memberOpen.dataset.openMember);
    const memberActionBtn = e.target.closest('[data-open-member-action]');
    if(memberActionBtn){ openMemberAction(memberActionBtn.dataset.openMemberAction); return; }
    const actionChoiceBtn = e.target.closest('[data-member-action-choice]');
    if(actionChoiceBtn){ applyMemberAction(actionChoiceBtn.dataset.memberActionChoice, actionChoiceBtn.dataset.memberActionName); return; }
    const toggleArchiveBtn = e.target.closest('[data-toggle-archive]');
    if(toggleArchiveBtn){ toggleArchive(toggleArchiveBtn.dataset.toggleArchive); return; }
    const warAutoToggleBtn = e.target.closest('[data-war-auto-toggle]');
    if(warAutoToggleBtn){ toggleWarAutoMember(warAutoToggleBtn.dataset.warAutoToggle); return; }
    const restoreMemberBtn = e.target.closest('[data-restore-member]');
    if(restoreMemberBtn){ toggleArchive(restoreMemberBtn.dataset.restoreMember); return; }
    const deleteMemberBtn = e.target.closest('[data-delete-member]');
    if(deleteMemberBtn){ deleteArchivedMember(deleteMemberBtn.dataset.deleteMember); return; }
    const saveMemberTagBtn = e.target.closest('[data-save-member-tag]');
    if(saveMemberTagBtn){ saveMemberTag(saveMemberTagBtn.dataset.saveMemberTag); return; }
    const syncIntegrateBtn = e.target.closest('[data-sync-integrate]');
    if(syncIntegrateBtn){ integrateSyncedMember(syncIntegrateBtn.dataset.syncIntegrate); return; }
    const saveNoteBtn = e.target.closest('[data-save-member-note]');
    if(saveNoteBtn) saveMemberNote(saveNoteBtn.dataset.saveMemberNote);
    if(e.target.matches('[data-close-modal]') || e.target === ui.memberModal) closeMember();
    if(e.target.matches('[data-close-user-edit]') || e.target === ui.userEditModal) closeUserEdit();
    if(e.target.matches('[data-close-member-action]') || e.target === ui.memberActionModal) closeMemberAction();
    if(e.target.matches('[data-open-goals]')) openGoals();
    if(e.target.matches('[data-close-goal]') || e.target === ui.goalModal) closeGoals();
    if(e.target.matches('[data-close-create-member]') || e.target === ui.createMemberModal) closeCreateMemberModal();
    if(e.target === ui.vaultAccessModal || e.target === ui.vaultAccessCancelBtn) { closeVaultPrompt(); setActiveView(lastNonVaultView || 'arenaView'); }
    if(e.target.closest('[data-scroll-top]') || e.target === ui.backToTopBtn) scrollToTopSmooth();
    const clearBtn = e.target.closest('[data-tool-clear]');
    if(clearBtn){
      const mode = clearBtn.dataset.toolClear;
      if(mode === 'war'){ state.ui.warQuery = ''; state.ui.warRole = 'ALL'; }
      if(mode === 'tournament'){ state.ui.tournamentQuery = ''; state.ui.tournamentRole = 'ALL'; }
      saveState();
      render();
    }
  });
  ui.currentViewBadge?.addEventListener('click', ()=> openDrawer(true));
  ui.menuToggleBtn?.addEventListener('click', ()=> openDrawer(true));
  ui.warAutoRefreshBtn?.addEventListener('click', ()=> runWarAutoRefreshCycle('manual'));
  ui.warRankingRefreshBtn?.addEventListener('click', ()=> renderWarRankingView(true));
  document.addEventListener('click', (e) => {
    const mb = e.target.closest('[data-war-ranking-month]');
    if(mb){ state.ui ||= {}; state.ui.warRankingMonth = mb.dataset.warRankingMonth; saveState(); renderWarRankingView(true); }
    const wb = e.target.closest('[data-war-ranking-week]');
    if(wb){ state.ui ||= {}; state.ui.warRankingWeek = Number(wb.dataset.warRankingWeek || 1); saveState(); renderWarRankingView(true); }
  });
  ui.membersSyncRefreshBtn?.addEventListener('click', ()=> renderMembersSyncView(true));
  ui.apiLogsRefreshBtn?.addEventListener('click', ()=> renderApiLogsView(true));
  ui.warAutoPrepareBtn?.addEventListener('click', ()=> prepareWarAutoWeekFromRoster());
  ui.warAutoMonthChipBar?.addEventListener('click', e => {
    const btn = e.target.closest('[data-war-auto-month]');
    if(!btn) return;
    const nextMonth = btn.dataset.warAutoMonth;
    if(!nextMonth) return;
    state.ui ||= {};
    state.ui.warAutoMonth = nextMonth;
    saveState();
    renderWarAutoPeriodControls();
    renderWarAutoView();
  renderWarRankingView();
  renderMembersSyncView();
  renderApiLogsView();
  updateDrawerProfileSummary();
  renderDecksView();
  });
  ui.warAutoWeekChipBar?.addEventListener('click', e => {
    const btn = e.target.closest('[data-war-auto-week]');
    if(!btn) return;
    const nextWeek = Number(btn.dataset.warAutoWeek || 1);
    state.ui ||= {};
    state.ui.warAutoWeek = nextWeek;
    saveState();
    renderWarAutoPeriodControls();
    renderWarAutoView();
  renderWarRankingView();
  renderMembersSyncView();
  renderApiLogsView();
  updateDrawerProfileSummary();
  renderDecksView();
  });
  ui.drawerBackdrop?.addEventListener('click', closeDrawer);
  document.getElementById('syncRefreshBtn')?.addEventListener('click', manualRefreshSync);
  document.body.addEventListener('change', e => {
    if(e.target.matches('[data-position-input]')){
      updatePosition(e.target.dataset.positionInput, e.target.value);
    }
    if(e.target.matches('#classificationRoleSelect')){
      state.ui.classificationRole = e.target.value || 'ALL';
      saveState();
      renderClassification();
    }
    if(e.target.matches('[data-tool-role="war"]')){
      state.ui.warRole = e.target.value || 'ALL';
      saveState();
      render();
    }
    if(e.target.matches('[data-tool-role="tournament"]')){
      state.ui.tournamentRole = e.target.value || 'ALL';
      saveState();
      render();
    }
    if(e.target.matches('[data-member-profile-month]')){
      state.ui.memberProfileMonth = e.target.value || state.meta.currentMonth;
      saveState();
      openMember(e.target.dataset.memberProfileMonth);
    }
  });
  document.body.addEventListener('input', e => {
    if(e.target.matches('#classificationQueryInput')){
      state.ui.classificationQuery = e.target.value || '';
      saveState();
      renderClassification();
    }
    if(e.target.matches('[data-tool-query="war"]')){
      state.ui.warQuery = e.target.value || '';
      saveState();
      applyToolFilters('war');
    }
    if(e.target.matches('[data-tool-query="tournament"]')){
      state.ui.tournamentQuery = e.target.value || '';
      saveState();
      applyToolFilters('tournament');
    }
  });
  $('#goalForm').addEventListener('submit', e => {
    e.preventDefault();
    const month = state.meta.currentMonth;
    state.goals[month] = {
      attacks: Number($('#goalAttacksInput').value || 0),
      tournament: Number($('#goalTournamentInput').value || 0)
    };
    saveState();
    closeGoals();
    render();
  });
  $('#exportBtn').addEventListener('click', exportBackup);
  $('#importInput').addEventListener('change', e => e.target.files[0] && importBackup(e.target.files[0]));
  $('#restoreSeedBtn').addEventListener('click', () => {
    if(confirm('Restaurar agora a base original da V5.5.10 e ignorar o cache antigo?')){
      const restored = ensureDataCompleteness(deepClone(seedData));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(restored));
      location.reload();
    }
  });
  $('#resetBtn').addEventListener('click', () => {
    if(confirm('Limpar o app e apagar também a cópia migrada das versões anteriores?')){
      localStorage.removeItem(STORAGE_KEY);
      location.reload();
    }
  });
  ui.vaultAccessForm?.addEventListener('submit', e => {
    e.preventDefault();
    const value = (ui.vaultPasswordInput?.value || '').trim();
    if(value === VAULT_PASSWORD){
      unlockVaultSession();
      closeVaultPrompt();
      setActiveView('vaultView');
    }else{
      signalVaultError();
      if(ui.vaultPasswordInput){
        ui.vaultPasswordInput.focus();
        ui.vaultPasswordInput.select?.();
      }
    }
  });
  $('#addMemberBtn').addEventListener('click', addMember);
  ui.createMemberForm?.addEventListener('submit', e => { e.preventDefault(); createMemberFromModal(); });
  ui.backToTopBtn?.addEventListener('click', scrollToTopSmooth);
  window.addEventListener('scroll', updateBackToTopVisibility, {passive:true});
  
  document.addEventListener('touchstart', handleTouchStart, {passive:true});
  document.addEventListener('touchmove', handleTouchMove, {passive:true});
  document.addEventListener('touchend', handleTouchEnd, {passive:true});
  document.addEventListener('touchcancel', handleTouchEnd, {passive:true});
  updateBackToTopVisibility();
  $('#shareRankingBtn').addEventListener('click', openShareCard);

  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    deferredPrompt = e;
    ui.installBtn.classList.remove('hidden');
  });
  ui.installBtn.addEventListener('click', async() => {
    if(deferredPrompt){
      deferredPrompt.prompt();
      deferredPrompt = null;
      ui.installBtn.classList.add('hidden');
    }else{
      alert('No iPhone: abra no Safari > Compartilhar > Adicionar à Tela de Início.');
    }
  });
  if('serviceWorker' in navigator){
    navigator.serviceWorker.register('sw.js?v=6.1-auth');
  }
}
document.addEventListener('visibilitychange', () => {
  if(document.hidden){
    clearWarAutoRefreshTimer();
  }else if(activeViewId === 'warAutoView'){
    runWarAutoRefreshCycle('resume');
    startWarAutoRefreshTimer();
  }
});

window.TOPBRS_APP = {
  getState(){ return deepClone(state); },
  replaceState(nextState){
    const incoming = nextState && typeof nextState === 'object' ? deepClone(nextState) : {};
    if(!Array.isArray(incoming.authUsers) && Array.isArray(state.authUsers)){
      incoming.authUsers = deepClone(state.authUsers);
    }
    const hydrated = ensureDataCompleteness(mergeWithSeed(incoming));
    for(const key of Object.keys(state)){ delete state[key]; }
    Object.assign(state, hydrated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    render();
  },
  saveState,
  render,
  markSyncTimestamp,
  monthLabel
};
bind();
updateTopbarTitle(document.querySelector('.view.active')?.id || 'arenaView');
render();
if((document.querySelector('.view.active')?.id || 'arenaView') === 'warAutoView'){ startWarAutoRefreshTimer(); }
updateFloatingHeader();
})();


document.addEventListener('click', (event) => {
  const target = event.target.closest('[data-save-user-edit]');
  if(!target) return;
  const uid = target.dataset.saveUserEdit;
  const users = state.users || [];
  const index = users.findIndex(item => item.uid === uid);
  if(index === -1) return;
  users[index] = {
    ...users[index],
    name: String(document.getElementById('userEditName')?.value || '').trim(),
    nick: String(document.getElementById('userEditNick')?.value || '').trim(),
    clanRole: String(document.getElementById('userEditClanRole')?.value || 'Membro'),
    accessRole: String(document.getElementById('userEditAccessRole')?.value || 'viewer')
  };
  state.users = users;
  saveState();
  ui.userEditModal?.classList.add('hidden');
  render();
  showToast('Usuário atualizado com sucesso.');
});


/* v6.4.17 + Guerra Auto 1.5.6 */
function fixHeaderOverlap(){
  const header = document.querySelector('.topbar');
  if(!header) return;
  const height = header.offsetHeight;
  document.documentElement.style.setProperty('--header-offset', height + 'px');
}

window.addEventListener('load', fixHeaderOverlap);
window.addEventListener('resize', fixHeaderOverlap);

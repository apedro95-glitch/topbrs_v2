import { initializeApp, getApps, getApp } from 'https://www.gstatic.com/firebasejs/11.6.0/firebase-app.js';
import { getAuth, onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/11.6.0/firebase-auth.js';
import { getFirestore, collection, doc, onSnapshot, setDoc, writeBatch, serverTimestamp } from 'https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js';

const cfg = window.TOPBRS_FIREBASE_CONFIG || {};
const stateDocPath = cfg.stateDocPath || 'live/topbrs_state';
const [colName = 'live', docId = 'topbrs_state'] = stateDocPath.split('/');
const namespace = String(docId || 'topbrs_state').replace(/_state$/i, '') || 'topbrs';
let appApi = null;
let db = null;
let auth = null;
let unsub = null;
let localWriteTimer = null;
let applyingRemote = false;
let currentUser = null;
let initialized = false;
let remoteDocHashes = new Map();

function waitForApp(){
  return new Promise(resolve => {
    const tick = () => {
      if(window.TOPBRS_APP){ resolve(window.TOPBRS_APP); return; }
      setTimeout(tick, 80);
    };
    tick();
  });
}
function badge(){ return document.getElementById('firebaseSyncBadge'); }
function authBtn(){ return document.getElementById('firebaseAuthBtn'); }
function canEdit(){
  const sessionRole = String(window.TOPBRS_ACCESS?.accessRole || '').toLowerCase();
  return !!currentUser && ((!!cfg.adminEmail && String(currentUser.email || '').toLowerCase() === String(cfg.adminEmail || '').toLowerCase()) || sessionRole === 'editor' || sessionRole === 'admin');
}
function isAdmin(){ return canEdit(); }
function setBadge(text, mode='offline'){
  const el = badge();
  if(!el) return;
  el.textContent = text;
  el.classList.remove('online','viewer','offline');
  el.classList.add(mode);
}
function applyViewerMode(){
  document.body.classList.toggle('viewer-mode', !isAdmin());
  const btn = authBtn();
  if(btn) btn.textContent = canEdit() ? 'Sair líder' : 'Entrar líder';
  setBadge(!cfg.enabled ? 'Local' : (canEdit() ? 'Online edit' : 'Leitura'), canEdit() ? 'online' : (!cfg.enabled ? 'offline' : 'viewer'));
}
function attachAuthButton(){
  const btn = authBtn();
  if(!btn || btn.dataset.boundFirebase) return;
  btn.dataset.boundFirebase = '1';
  btn.addEventListener('click', async() => { if(canEdit()) await signOut(auth); });
}
function clone(obj){ return JSON.parse(JSON.stringify(obj)); }
function stableStringify(value){
  return JSON.stringify(sortDeep(value));
}
function sortDeep(value){
  if(Array.isArray(value)) return value.map(sortDeep);
  if(value && typeof value === 'object'){
    return Object.keys(value).sort().reduce((acc, key) => {
      acc[key] = sortDeep(value[key]);
      return acc;
    }, {});
  }
  return value;
}
function docKey(name){ return `${namespace}_${name}`; }
function monthSlug(month){
  return String(month || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toUpperCase();
}
function serializeState(fullState){
  const state = clone(fullState || {});
  const docs = new Map();
  docs.set(docKey('meta'), {
    kind: 'meta',
    meta: state.meta || {},
    updatedBy: currentUser?.email || 'admin',
    updatedAt: serverTimestamp()
  });
  docs.set(docKey('goals'), {
    kind: 'goals',
    goals: state.goals || {},
    updatedBy: currentUser?.email || 'admin',
    updatedAt: serverTimestamp()
  });
  docs.set(docKey('members'), {
    kind: 'members',
    members: Array.isArray(state.members) ? state.members : [],
    updatedBy: currentUser?.email || 'admin',
    updatedAt: serverTimestamp()
  });
  docs.set(docKey('history'), {
    kind: 'history',
    history: Array.isArray(state.history) ? state.history : [],
    updatedBy: currentUser?.email || 'admin',
    updatedAt: serverTimestamp()
  });

  const months = state.months && typeof state.months === 'object' ? state.months : {};
  for(const [month, monthDataRaw] of Object.entries(months)){
    const monthData = monthDataRaw || {};
    const slug = monthSlug(month);
    const weeks = monthData.weeks && typeof monthData.weeks === 'object' ? monthData.weeks : {};
    for(let week = 1; week <= 4; week++){
      docs.set(docKey(`month_${slug}_week_${week}`), {
        kind: 'month_week',
        month,
        week,
        data: weeks[String(week)] || {},
        updatedBy: currentUser?.email || 'admin',
        updatedAt: serverTimestamp()
      });
    }
    docs.set(docKey(`month_${slug}_tournament`), {
      kind: 'month_tournament',
      month,
      data: monthData.tournament || {},
      updatedBy: currentUser?.email || 'admin',
      updatedAt: serverTimestamp()
    });
    docs.set(docKey(`month_${slug}_summary`), {
      kind: 'month_summary',
      month,
      data: monthData.summaryOriginal || {},
      updatedBy: currentUser?.email || 'admin',
      updatedAt: serverTimestamp()
    });
  }

  docs.set(docKey('manifest'), {
    kind: 'manifest',
    namespace,
    stateDocPath,
    months: Object.keys(months),
    schemaVersion: 2,
    updatedBy: currentUser?.email || 'admin',
    updatedAt: serverTimestamp()
  });
  return docs;
}
function buildStateFromDocs(baseState, docsById){
  const next = clone(baseState || {});
  if(docsById.get(docKey('meta'))?.meta) next.meta = docsById.get(docKey('meta')).meta;
  if(docsById.get(docKey('goals'))?.goals) next.goals = docsById.get(docKey('goals')).goals;
  if(Array.isArray(docsById.get(docKey('members'))?.members)) next.members = docsById.get(docKey('members')).members;
  if(Array.isArray(docsById.get(docKey('history'))?.history)) next.history = docsById.get(docKey('history')).history;
  next.months ||= {};

  for(const payload of docsById.values()){
    if(!payload || !payload.kind || !payload.month) continue;
    next.months[payload.month] ||= { weeks:{}, tournament:{}, summaryOriginal:{} };
    if(payload.kind === 'month_week'){
      next.months[payload.month].weeks ||= {};
      next.months[payload.month].weeks[String(payload.week)] = payload.data || {};
    }else if(payload.kind === 'month_tournament'){
      next.months[payload.month].tournament = payload.data || {};
    }else if(payload.kind === 'month_summary'){
      next.months[payload.month].summaryOriginal = payload.data || {};
    }
  }
  return next;
}
function updateSyncLabelFromDocs(docsById){
  const metaDoc = docsById.get(docKey('manifest')) || docsById.get(docKey('meta'));
  const stamp = metaDoc?.updatedAt?.toDate?.();
  if(stamp && window.TOPBRS_APP?.render){
    const syncNode = document.getElementById('heroSync');
    if(syncNode) syncNode.textContent = 'salvo ' + stamp.toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit'});
  }
}
function startRealtime(){
  if(unsub) unsub();
  const colRef = collection(db, colName);
  unsub = onSnapshot(colRef, snapshot => {
    if(!appApi) return;
    const docsById = new Map();
    snapshot.forEach(entry => {
      if(!entry.id.startsWith(`${namespace}_`)) return;
      docsById.set(entry.id, entry.data());
      const cloned = clone(entry.data());
      delete cloned.updatedAt;
      remoteDocHashes.set(entry.id, stableStringify(cloned));
    });
    if(!docsById.size) return;
    const nextState = buildStateFromDocs(appApi.getState(), docsById);
    applyingRemote = true;
    appApi.replaceState(nextState, { source: 'firebase' });
    applyingRemote = false;
    updateSyncLabelFromDocs(docsById);
    setBadge(canEdit() ? 'Líder online' : 'Leitura online', canEdit() ? 'online' : 'viewer');
  }, err => {
    console.error(err);
    setBadge('Erro sync', 'offline');
  });
}
async function flushState(nextState){
  const docs = serializeState(nextState);
  const batch = writeBatch(db);
  let changedCount = 0;
  for(const [id, payload] of docs.entries()){
    const comparePayload = clone(payload);
    delete comparePayload.updatedAt;
    const hash = stableStringify(comparePayload);
    if(remoteDocHashes.get(id) === hash) continue;
    batch.set(doc(db, colName, id), payload, { merge: true });
    remoteDocHashes.set(id, hash);
    changedCount += 1;
  }
  if(!changedCount) return false;
  await batch.commit();
  return true;
}
function queueWrite(nextState){
  if(!cfg.enabled || !db || !canEdit() || applyingRemote) return;
  clearTimeout(localWriteTimer);
  const payload = clone(nextState);
  localWriteTimer = setTimeout(async() => {
    try{
      const changed = await flushState(payload);
      setBadge(changed ? 'Líder online' : 'Sem mudanças', changed ? 'online' : 'viewer');
    }catch(err){
      console.error(err);
      setBadge('Falha sync', 'offline');
      alert('Não foi possível salvar no Firebase. Confira as regras, o projeto e se você entrou como líder.');
    }
  }, 500);
}

window.TOPBRS_REMOTE = {
  onLocalSave(nextState){ queueWrite(nextState); },
  afterRender(){ attachAuthButton(); applyViewerMode(); },
  isAdmin: canEdit,
  canEdit,
  isConfigured(){ return !!cfg.enabled; },
  getNamespace(){ return namespace; },
  getCollection(){ return colName; }
};

(async function init(){
  appApi = await waitForApp();
  attachAuthButton();
  applyViewerMode();
  if(!cfg.enabled){
    return;
  }
  const firebaseApp = getApps().length ? getApp() : initializeApp(cfg.firebaseConfig);
  db = getFirestore(firebaseApp);
  auth = getAuth(firebaseApp);
  window.TOPBRS_FIREBASE = { app: firebaseApp, db, auth };
  window.db = db;
  onAuthStateChanged(auth, user => {
    currentUser = user;
    applyViewerMode();
    if(!initialized){
      startRealtime();
      initialized = true;
    }
  });
})();

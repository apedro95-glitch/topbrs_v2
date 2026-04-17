import { initializeApp, getApps, getApp } from 'https://www.gstatic.com/firebasejs/11.6.0/firebase-app.js';
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail, signOut, EmailAuthProvider, reauthenticateWithCredential, updatePassword } from 'https://www.gstatic.com/firebasejs/11.6.0/firebase-auth.js';
import { getFirestore, doc, getDoc, setDoc, getDocs, collection, serverTimestamp, deleteDoc, query, where, limit } from 'https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js';

const cfg = window.TOPBRS_FIREBASE_CONFIG || {};
const app = getApps().length ? getApp() : initializeApp(cfg.firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const adminEmail = String(cfg.adminEmail || '').toLowerCase();
const $ = (id) => document.getElementById(id);
const els = {
  authGate: $('authGate'), authLoader: $('authLoader'), authMessage: $('authMessage'),
  loginForm: $('loginForm'), registerForm: $('registerForm'), forgotPasswordBtn: $('forgotPasswordBtn'),
  forgotPasswordModal: $('forgotPasswordModal'), forgotPasswordForm: $('forgotPasswordForm'), forgotPasswordEmail: $('forgotPasswordEmail'), forgotPasswordMessage: $('forgotPasswordMessage'),
  profileMenuBtn: $('profileMenuBtn'), profileAvatar: $('profileAvatar'), drawerProfileSummary: $('drawerProfileSummary'),
  profilePopover: $('profilePopover'), profilePopoverHeader: $('profilePopoverHeader'), logoutBtn: $('logoutBtn'), editProfileOpenBtn: $('editProfileOpenBtn'),
  changePasswordOpenBtn: $('changePasswordOpenBtn'), changePasswordModal: $('changePasswordModal'),
  changePasswordForm: $('changePasswordForm'), changePasswordMessage: $('changePasswordMessage'),
  profileEditModal: $('profileEditModal'), profileEditForm: $('profileEditForm'), profileEditMessage: $('profileEditMessage'),
  profileEditName: $('profileEditName'), profileEditNick: $('profileEditNick'), profileEditRole: $('profileEditRole'), profileEditTag: $('profileEditTag'), profileEditTagHint: $('profileEditTagHint'), profileEditEmail: $('profileEditEmail'),
  playerTagRequiredModal: $('playerTagRequiredModal'), playerTagRequiredForm: $('playerTagRequiredForm'), playerTagRequiredInput: $('playerTagRequiredInput'), playerTagRequiredMessage: $('playerTagRequiredMessage'), playerTagRequiredCloseBtn: $('playerTagRequiredCloseBtn'),
  registerNick: $('registerNick'), registerPlayerTag: $('registerPlayerTag'), validatePlayerTagBtn: $('validatePlayerTagBtn'), tagValidationStatus: $('tagValidationStatus')
};
let currentProfile = null;
const USERS_CACHE_KEY = 'topbrs-auth-users-cache-v1';
const PROFILE_CACHE_PREFIX = 'topbrs-profile-cache-v1:';
const PROFILE_EMAIL_CACHE_PREFIX = 'topbrs-profile-email-cache-v1:';
const CLASH_API_BASE = String(cfg.clashApiBase || '').replace(/\/$/, '');
let runtimeClashApiBase = CLASH_API_BASE;
let clashApiBasePromise = null;
let validatedRegisterPlayer = null;
document.body.classList.add('auth-booting');

function readCache(key){
  try{ const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : null; }catch(e){ return null; }
}
function writeCache(key, value){
  try{ localStorage.setItem(key, JSON.stringify(value)); }catch(e){}
}
function removeCache(key){
  try{ localStorage.removeItem(key); }catch(e){}
}
function profileCacheKey(uid){ return `${PROFILE_CACHE_PREFIX}${uid}`; }
function profileEmailCacheKey(email){ return `${PROFILE_EMAIL_CACHE_PREFIX}${String(email||'').toLowerCase()}`; }
function normalizeUsers(list){
  return (Array.isArray(list) ? list : [])
    .filter(user => user && user.accessRole !== 'deleted')
    .sort((a,b)=>String(a.nick||a.name||'').localeCompare(String(b.nick||b.name||'')));
}
function setUsersInApp(users){
  if(!window.TOPBRS_APP || !window.TOPBRS_APP.getState || !window.TOPBRS_APP.replaceState) return;
  const appState = window.TOPBRS_APP.getState();
  appState.authUsers = users;
  window.TOPBRS_APP.replaceState(appState);
}
function applyCachedUsersToApp(){
  const cached = readCache(USERS_CACHE_KEY);
  if(!cached) return false;
  const users = normalizeUsers(cached);
  setUsersInApp(users);
  return users.length > 0;
}
function buildAccessPayload(user, profile, accessRole){
  return {uid:user.uid, email:user.email, accessRole, clanRole: profile.clanRole || 'Membro', nick: profile.nick || profile.name || user.email, playerTag: profile.playerTag || '', linkedMemberName: profile.linkedMemberName || '', ghostAdmin: !!profile.ghostAdmin, canEdit: accessRole==='admin' || accessRole==='editor'};
}
function applySessionUi(user, profile, accessRole){
  currentProfile = {uid:user.uid, ...profile, accessRole};
  window.TOPBRS_ACCESS = buildAccessPayload(user, profile, accessRole);
  if(els.profileAvatar) els.profileAvatar.textContent = roleEmoji(accessRole);
  if(els.drawerProfileSummary){
    els.drawerProfileSummary.classList.remove('hidden');
    els.drawerProfileSummary.innerHTML = `<div class="profile-summary-main"><strong>${displayLabel(window.TOPBRS_ACCESS)}</strong><small>${user.email}</small></div>`;
  }
  if(els.profilePopoverHeader){
    els.profilePopoverHeader.innerHTML = `<strong>${displayLabel(window.TOPBRS_ACCESS)}</strong><small>${user.email}</small>`;
  }
  updateAccessControlledUi(accessRole);
}

function isPlayerTagLocked(profile){
  return !!String(profile?.playerTag || '').trim();
}
function openProfileEditModal(){
  if(!currentProfile || !els.profileEditModal) return;
  const locked = isPlayerTagLocked(currentProfile);
  const isGhostAdmin = !!currentProfile.ghostAdmin;
  if(els.profileEditName) els.profileEditName.value = currentProfile.name || '';
  if(els.profileEditNick) { els.profileEditNick.value = currentProfile.nick || ''; els.profileEditNick.disabled = true; }
  if(els.profileEditRole) els.profileEditRole.value = currentProfile.clanRole || 'Membro';
  if(els.profileEditTag) {
    els.profileEditTag.value = currentProfile.playerTag || '';
    els.profileEditTag.disabled = true;
  }
  if(els.profileEditTagHint){
    els.profileEditTagHint.textContent = 'Nick e tag do jogador são controlados pelo sistema. Somente admin pode alterar esses campos.';
    els.profileEditTagHint.classList.remove('hidden');
  }
  if(els.profileEditEmail) els.profileEditEmail.value = currentProfile.email || '';
  clearMessage(els.profileEditMessage);
  els.profileEditModal.classList.remove('hidden');
  requestAnimationFrame(()=> els.profileEditName?.focus());
}
function closeProfileEditModal(){
  els.profileEditModal?.classList.add('hidden');
  clearMessage(els.profileEditMessage);
}
function openPlayerTagRequiredModal(){
  if(!currentProfile || currentProfile.ghostAdmin || String(currentProfile.playerTag || '').trim() || !els.playerTagRequiredModal) return;
  clearMessage(els.playerTagRequiredMessage);
  if(els.playerTagRequiredInput) els.playerTagRequiredInput.value = '';
  els.playerTagRequiredModal.classList.remove('hidden');
  requestAnimationFrame(()=> els.playerTagRequiredInput?.focus());
}
function closePlayerTagRequiredModal(){
  els.playerTagRequiredModal?.classList.add('hidden');
  clearMessage(els.playerTagRequiredMessage);
}
async function saveOwnProfile(formType='profile'){
  if(!currentProfile) return;
  const name = String((formType==='required' ? currentProfile.name : els.profileEditName?.value) || '').trim();
  const nick = String((formType==='required' ? currentProfile.nick : els.profileEditNick?.value) || '').trim();
  const email = String((formType==='required' ? currentProfile.email : els.profileEditEmail?.value) || '').trim();
  const tagInput = formType==='required' ? els.playerTagRequiredInput?.value : els.profileEditTag?.value;
  const playerTag = normalizePlayerTag(tagInput || currentProfile.playerTag || '');
  const locked = isPlayerTagLocked(currentProfile);
  const messageNode = formType==='required' ? els.playerTagRequiredMessage : els.profileEditMessage;
  if(!name || !nick || !email){
    showMessage(messageNode, 'Preencha nome, nick e email para continuar.');
    return;
  }
  if(!isGhostAdmin && formType==='required' && !playerTag){
    showMessage(messageNode, 'Defina sua tag de jogo para continuar.');
    return;
  }
  if(!isGhostAdmin && !locked && !playerTag){
    showMessage(messageNode, 'Defina sua tag de jogo para continuar.');
    return;
  }
  const payload = {
    uid: currentProfile.uid,
    email,
    name,
    nick,
    clanRole: currentProfile.clanRole || 'Membro',
    accessRole: currentProfile.accessRole || 'viewer',
    linkedMemberName: currentProfile.linkedMemberName || '',
    ghostAdmin: !!currentProfile.ghostAdmin
  };
  if(isGhostAdmin){
    payload.playerTag = currentProfile.playerTag || '';
  }else if(locked){
    payload.playerTag = currentProfile.playerTag || '';
  }else{
    payload.playerTag = playerTag;
  }
  await saveProfile(currentProfile.uid, payload);
  if(!isGhostAdmin && payload.playerTag){
    updateRosterMemberLink(payload.playerTag, { uid: currentProfile.uid, email: payload.email, linkedMemberName: payload.linkedMemberName || payload.nick || payload.name, isLinked: true });
  }
  currentProfile = {...currentProfile, ...payload};
  applySessionUi({uid: currentProfile.uid, email}, currentProfile, currentProfile.accessRole || 'viewer');
  loadUsersIntoState({ useCacheFirst: false, silent: true }).catch(()=>{});
  window.TOPBRS_APP?.render?.();
  if(formType==='required'){
    closePlayerTagRequiredModal();
  }else{
    showMessage(els.profileEditMessage, 'Perfil atualizado com sucesso.', 'success');
    setTimeout(()=>closeProfileEditModal(), 650);
  }
}
function setLoginButtonLoading(loading){
  const btn = els.loginForm?.querySelector('button.primary');
  if(!btn) return;
  if(loading){
    if(!btn.dataset.defaultLabel) btn.dataset.defaultLabel = btn.textContent;
    btn.classList.add('auth-loading');
    btn.textContent = 'Entrando...';
  }else{
    btn.classList.remove('auth-loading');
    btn.textContent = btn.dataset.defaultLabel || 'Entrar';
  }
}
function showMessage(node, text, type='error'){ if(!node) return; node.textContent=text; node.className=`auth-message ${type}`; node.classList.remove('hidden'); }
function clearMessage(node){ if(!node) return; node.textContent=''; node.className='auth-message hidden'; }
function toggleLoader(show){ els.authLoader?.classList.toggle('hidden', !show); }
function toggleAuth(show){ document.documentElement.classList.toggle('auth-locked', show); document.body.classList.toggle('auth-locked', show); els.authGate?.classList.toggle('hidden', !show); }
function authTab(tab){ document.querySelectorAll('[data-auth-tab]').forEach(btn=>btn.classList.toggle('active', btn.dataset.authTab===tab)); els.loginForm?.classList.toggle('hidden', tab!=='login'); els.registerForm?.classList.toggle('hidden', tab!=='register'); clearMessage(els.authMessage); }
function roleEmoji(accessRole){ return accessRole==='admin' ? '👑' : accessRole==='editor' ? '🧑🏼‍💻' : '👤'; }


async function loadClashApiBase(force=false){
  if(!force && runtimeClashApiBase) return runtimeClashApiBase;
  if(!force && clashApiBasePromise) return clashApiBasePromise;
  clashApiBasePromise = (async()=>{
    try{
      const snap = await getDoc(doc(db, 'system', 'apiConfig'));
      const remote = String(snap.data()?.clashApiBase || '').trim().replace(/\/$/, '');
      runtimeClashApiBase = remote || CLASH_API_BASE;
      window.TOPBRS_RUNTIME_CONFIG = window.TOPBRS_RUNTIME_CONFIG || {};
      window.TOPBRS_RUNTIME_CONFIG.clashApiBase = runtimeClashApiBase;
    }catch(e){
      runtimeClashApiBase = CLASH_API_BASE;
    }finally{
      clashApiBasePromise = null;
    }
    return runtimeClashApiBase;
  })();
  return clashApiBasePromise;
}

function normalizePlayerTag(value=''){
  let tag = String(value || '').trim().toUpperCase().replace(/\s+/g, '');
  if(!tag) return '';
  if(!tag.startsWith('#')) tag = `#${tag.replace(/^#+/, '')}`;
  return tag;
}



loadClashApiBase().catch(()=>{});

function clearRegisterValidation(){
  validatedRegisterPlayer = null;
  if(els.registerNick) els.registerNick.value = '';
  clearMessage(els.tagValidationStatus);
}

async function validatePlayerTagWithApi(rawTag=''){
  const normalized = normalizePlayerTag(rawTag);
  if(!normalized) throw new Error('Digite uma tag para validar.');
  const apiBase = await loadClashApiBase(true);
  if(!apiBase) throw new Error('API temporariamente indisponível.');
  const endpoint = `${apiBase}/player/${encodeURIComponent(normalized)}`;
  let response;
  try{
    response = await fetch(endpoint, { cache: 'no-store' });
  }catch(e){
    throw new Error('API temporariamente indisponível.');
  }
  const data = await response.json().catch(()=>({}));
  if(!response.ok){
    if(response.status === 404) throw new Error('Tag inválida ou não encontrada.');
    throw new Error('API temporariamente indisponível.');
  }
  if(!data?.name || !data?.tag) throw new Error('API temporariamente indisponível.');
  return { name:String(data.name||'').trim(), tag: normalizePlayerTag(data.tag||normalized) };
}

function showMenuHintOnce(uid){
  const hint = document.getElementById('menuHint');
  if(!hint || !uid) return;
  const key = `topbrs-menu-hint-${uid}`;
  try{
    if(localStorage.getItem(key) === '1') return;
    localStorage.setItem(key, '1');
  }catch(e){}
  hint.classList.remove('hidden');
  hint.classList.add('show');
  setTimeout(()=> hint.classList.remove('show'), 5200);
}
function displayLabel(profile){ const nick = profile?.nick || profile?.name || 'Usuário'; const cargo = profile?.clanRole || 'Membro'; return `${nick} - ${cargo}`; }

function getRosterMembers(){
  return Array.isArray(window.TOPBRS_APP?.getState?.().members) ? window.TOPBRS_APP.getState().members : [];
}
function findRosterMemberByTag(playerTag=''){
  const normalized = normalizePlayerTag(playerTag);
  if(!normalized) return null;
  return getRosterMembers().find(member => normalizePlayerTag(member.playerTag || member.tag || '') === normalized) || null;
}
function updateRosterMemberLink(playerTag, payload={}){
  const normalized = normalizePlayerTag(playerTag);
  if(!normalized || !window.TOPBRS_APP?.getState || !window.TOPBRS_APP?.replaceState) return;
  const appState = window.TOPBRS_APP.getState();
  if(!Array.isArray(appState.members)) return;
  let changed = false;
  appState.members = appState.members.map(member => {
    const memberTag = normalizePlayerTag(member.playerTag || member.tag || '');
    if(memberTag !== normalized) return member;
    changed = true;
    return {
      ...member,
      playerTag: normalized,
      linkedAuthUid: payload.uid || member.linkedAuthUid || '',
      linkedEmail: payload.email || member.linkedEmail || '',
      linkedMemberName: payload.linkedMemberName || member.linkedMemberName || member.name || '',
      isLinked: payload.isLinked !== undefined ? payload.isLinked : true
    };
  });
  if(changed) window.TOPBRS_APP.replaceState(appState);
}
async function findLinkedUserProfileByPlayerTag(playerTag=''){
  const normalized = normalizePlayerTag(playerTag);
  if(!normalized) return null;
  const snap = await getDocs(query(collection(db,'members'), where('playerTag','==', normalized), limit(10)));
  if(snap.empty) return null;
  const linkedDoc = snap.docs.find(entry => {
    const data = entry.data() || {};
    const source = String(data.source || '').toLowerCase();
    const isRosterSeed = source.startsWith('guerra-auto-roster');
    const isRosterDocId = String(entry.id || '').startsWith('#');
    const hasAuthIdentity = !!String(data.uid || entry.id || '').trim() && !!String(data.email || '').trim();
    const isActuallyLinked = !!data.isLinked || !!String(data.linkedAuthUid || '').trim() || (!!hasAuthIdentity && !isRosterSeed && !isRosterDocId);
    return isActuallyLinked && !data.ghostAdmin;
  });
  return linkedDoc ? { uid:linkedDoc.id, ...linkedDoc.data() } : null;
}

function updateAccessControlledUi(accessRole='viewer'){
  const isAdmin = accessRole === 'admin';
  document.body.classList.toggle('access-admin', isAdmin);
  const canManage = accessRole === 'admin' || accessRole === 'editor';
  document.querySelectorAll('[data-view="usersView"], [data-view="vaultView"]').forEach(btn => btn.classList.toggle('hidden', !isAdmin));
  document.querySelectorAll('[data-view="archivedView"]').forEach(btn => btn.classList.toggle('hidden', !canManage));
  document.querySelectorAll('#usersView, #vaultView').forEach(section => section.classList.toggle('hidden', !isAdmin));
  document.querySelectorAll('#archivedView').forEach(section => section.classList.toggle('hidden', !canManage));
  const currentActive = document.querySelector('.view.active');
  if((!isAdmin && currentActive && (currentActive.id === 'usersView' || currentActive.id === 'vaultView')) || (!canManage && currentActive && currentActive.id === 'archivedView')){
    document.querySelector('[data-view="arenaView"]')?.click();
  }
}
async function getProfile(uid){ const snap = await getDoc(doc(db,'members',uid)); return snap.exists() ? snap.data() : null; }
async function getBlocked(uid){ const snap = await getDoc(doc(db,'blockedUsers',uid)); return snap.exists() ? snap.data() : null; }
async function saveProfile(uid, data){
  await setDoc(doc(db,'members',uid), data, {merge:true});
  const serializable = {
    uid,
    email: data.email || currentProfile?.email || '',
    name: data.name || currentProfile?.name || '',
    nick: data.nick || currentProfile?.nick || '',
    playerTag: data.playerTag || currentProfile?.playerTag || '',
    clanRole: data.clanRole || currentProfile?.clanRole || 'Membro',
    accessRole: data.accessRole || currentProfile?.accessRole || 'viewer',
    linkedMemberName: data.linkedMemberName || currentProfile?.linkedMemberName || '',
    ghostAdmin: !!(data.ghostAdmin ?? currentProfile?.ghostAdmin)
  };
  writeCache(profileCacheKey(uid), serializable);
  if(serializable.email) writeCache(profileEmailCacheKey(serializable.email), serializable);
}
async function blockUserProfile(uid, profile){
  await setDoc(doc(db,'blockedUsers',uid), {uid, email: profile?.email || '', deletedAt: serverTimestamp()}, {merge:true});
  await deleteDoc(doc(db,'members',uid));
  removeCache(profileCacheKey(uid));
  if(profile?.email) removeCache(profileEmailCacheKey(profile.email));
}
async function loadUsersIntoState(options = {}){
  const { useCacheFirst = true, silent = false } = options;
  if(useCacheFirst){
    const cachedUsers = readCache(USERS_CACHE_KEY);
    if(cachedUsers){
      const users = normalizeUsers(cachedUsers);
      setUsersInApp(users);
      if(!silent) window.TOPBRS_APP?.render?.();
    }
  }
  const snap = await getDocs(collection(db,'members'));
  const users = normalizeUsers(snap.docs.map(d=>({uid:d.id,...d.data()})));
  writeCache(USERS_CACHE_KEY, users);
  setUsersInApp(users);
  try{ window.TOPBRS_APP?.markSyncTimestamp?.(Date.now(), 'online'); }catch(e){}
  if(!silent) window.TOPBRS_APP?.render?.();
  return users;
}
async function applySession(user){
  document.body.classList.remove('auth-booting');
  if(!user){
    currentProfile = null;
    window.TOPBRS_ACCESS = {accessRole:'viewer', canEdit:false};
    updateAccessControlledUi('viewer');
    toggleLoader(false);
    setLoginButtonLoading(false);
    toggleAuth(true);
    return;
  }

  const defaultProfile = {
    uid:user.uid,
    email:user.email || '',
    name:user.email?.toLowerCase()===adminEmail ? 'Líder' : '',
    nick:user.email?.toLowerCase()===adminEmail ? 'TopBRS' : '',
    clanRole:user.email?.toLowerCase()===adminEmail ? 'Líder' : 'Membro',
    accessRole:user.email?.toLowerCase()===adminEmail ? 'admin' : 'viewer'
  };
  const cachedProfile = readCache(profileCacheKey(user.uid)) || readCache(profileEmailCacheKey(user.email)) || defaultProfile;
  const cachedAccessRole = user.email?.toLowerCase()===adminEmail ? 'admin' : (cachedProfile.accessRole || 'viewer');

  // pinta a UI imediatamente com cache/local defaults
  applySessionUi(user, cachedProfile, cachedAccessRole);
  applyCachedUsersToApp();
  toggleAuth(false);
  toggleLoader(false);
  setLoginButtonLoading(false);
  showMenuHintOnce(user.uid);
  window.TOPBRS_APP?.render?.();

  // sincroniza dados reais em segundo plano
  const blocked = await getBlocked(user.uid);
  if(blocked){
    await signOut(auth);
    removeCache(profileCacheKey(user.uid));
    removeCache(profileEmailCacheKey(user.email));
    showMessage(els.authMessage,'Seu acesso foi removido do sistema.');
    updateAccessControlledUi('viewer');
    toggleAuth(true);
    return;
  }

  let profile = await getProfile(user.uid);
  if(!profile){
    profile = { ...defaultProfile, createdAt: serverTimestamp() };
    await saveProfile(user.uid, profile);
  }

  const accessRole = user.email?.toLowerCase()===adminEmail ? 'admin' : (profile.accessRole || 'viewer');
  // cache serializável
  writeCache(profileCacheKey(user.uid), {
    uid:user.uid,
    email:user.email || '',
    name: profile.name || '',
    nick: profile.nick || '',
    playerTag: profile.playerTag || '',
    clanRole: profile.clanRole || 'Membro',
    accessRole,
    linkedMemberName: profile.linkedMemberName || '',
    ghostAdmin: !!profile.ghostAdmin
  });
  writeCache(profileEmailCacheKey(user.email), {
    uid:user.uid,
    email:user.email || '',
    name: profile.name || '',
    nick: profile.nick || '',
    playerTag: profile.playerTag || '',
    clanRole: profile.clanRole || 'Membro',
    accessRole,
    linkedMemberName: profile.linkedMemberName || '',
    ghostAdmin: !!profile.ghostAdmin
  });

  applySessionUi(user, profile, accessRole);
  if(!profile.ghostAdmin && profile.playerTag){
    updateRosterMemberLink(profile.playerTag, { uid: user.uid, email: user.email || '', linkedMemberName: profile.linkedMemberName || profile.nick || profile.name, isLinked: true });
  }
  window.TOPBRS_APP?.render?.();
  loadUsersIntoState({ useCacheFirst: true, silent: true }).catch(()=>{});
  if(!profile.ghostAdmin){ setTimeout(()=> openPlayerTagRequiredModal(), 250); }
}
window.TOPBRS_AUTH_UI = {
  async refreshUsersNow(){
    return await loadUsersIntoState({ useCacheFirst:false, silent:false });
  },
  async saveUserProfileFromInputs(uid){

    const q = (s) => document.querySelector(s)?.value?.trim() || '';
    const name = q(`[data-user-name="${uid}"]`), nick = q(`[data-user-nick="${uid}"]`), playerTag = normalizePlayerTag(q(`[data-user-player-tag="${uid}"]`)), clanRole = q(`[data-user-clan-role="${uid}"]`) || 'Membro';
    const accessRole = document.querySelector(`[data-user-access-role="${uid}"]`)?.value || 'viewer';
    await saveProfile(uid, {name, nick, playerTag, clanRole, accessRole, updatedAt: serverTimestamp()});
    await loadUsersIntoState(); if(currentProfile?.uid===uid) await applySession(auth.currentUser); showToast('Perfil atualizado com sucesso.');
  },
  async deleteUser(uid){
    const profile = await getProfile(uid);
    if(!profile) return;
    await blockUserProfile(uid, profile);
    await loadUsersIntoState();
    if(currentProfile?.uid===uid){ await signOut(auth); return; }
    showToast('Usuário removido do sistema.');
    window.TOPBRS_APP?.render?.();
  }
};

document.querySelectorAll('[data-auth-tab]').forEach(btn=>btn.addEventListener('click',()=>authTab(btn.dataset.authTab)));
els.loginForm?.addEventListener('submit', async (e)=>{
  e.preventDefault();
  clearMessage(els.authMessage);
  setLoginButtonLoading(true);
  toggleLoader(true);
  try{
    const email = $('loginEmail').value.trim();
    const password = $('loginPassword').value;
    await signInWithEmailAndPassword(auth, email, password);
  }catch(err){
    setLoginButtonLoading(false);
    toggleLoader(false);
    const code = String(err?.code || '');
    const message =
      code.includes('invalid-credential') || code.includes('wrong-password') || code.includes('user-not-found')
        ? 'Email ou senha incorretos.'
        : code.includes('too-many-requests')
          ? 'Muitas tentativas. Aguarde um pouco e tente novamente.'
          : code.includes('network-request-failed')
            ? 'Falha de conexão. Verifique sua internet e tente novamente.'
            : 'Não foi possível entrar agora. Tente novamente.';
    showMessage(els.authMessage, message);
  }
});
els.registerForm?.addEventListener('submit', async (e)=>{
  e.preventDefault();
  clearMessage(els.authMessage);
  try{
    const name = $('registerName').value.trim();
    const playerTag = normalizePlayerTag($('registerPlayerTag').value);
    const email = $('registerEmail').value.trim();
    const password = $('registerPassword').value;
    const validatedTag = normalizePlayerTag(validatedRegisterPlayer?.tag || '');
    const nick = String(validatedRegisterPlayer?.name || els.registerNick?.value || '').trim();
    if(!name || !playerTag || !email || !password){
      showMessage(els.authMessage,'Preencha nome, tag, email e senha para continuar.');
      return;
    }
    if(!validatedRegisterPlayer || validatedTag !== playerTag || !nick){
      showMessage(els.authMessage,'Valide a tag antes de criar a conta.');
      return;
    }
    const linkedRosterMember = findRosterMemberByTag(playerTag);
    if(!linkedRosterMember){
      showMessage(els.authMessage,'Sua tag ainda não foi cadastrada no sistema pelo administrador.');
      return;
    }
    const existingByTag = await findLinkedUserProfileByPlayerTag(playerTag);
    if(existingByTag && String(existingByTag.uid || '') !== String(linkedRosterMember.linkedAuthUid || '')){
      showMessage(els.authMessage,'Essa tag já está vinculada a outra conta.');
      return;
    }
    if(linkedRosterMember.isLinked && linkedRosterMember.linkedAuthUid && String(linkedRosterMember.linkedEmail || '').toLowerCase() && String(linkedRosterMember.linkedEmail || '').toLowerCase() !== email.toLowerCase()){
      showMessage(els.authMessage,'Essa tag já está vinculada a outra conta.');
      return;
    }
    const cred = await createUserWithEmailAndPassword(auth,email,password);
    const payload = {
      uid: cred.user.uid,
      email,
      name,
      nick,
      playerTag,
      clanRole: linkedRosterMember.role || 'Membro',
      accessRole: 'viewer',
      linkedMemberName: linkedRosterMember.name || nick,
      isLinked: true,
      createdAt: serverTimestamp()
    };
    await saveProfile(cred.user.uid, payload);
    updateRosterMemberLink(playerTag, { uid: cred.user.uid, email, linkedMemberName: linkedRosterMember.name || nick, isLinked: true });
    await signOut(auth);
    authTab('login');
    showMessage(els.authMessage,'Cadastro criado e vinculado ao seu membro. Agora faça login.','success');
    els.registerForm.reset();
    clearRegisterValidation();
  }catch(err){
    const code = String(err?.code || '');
    if(code.includes('email-already-in-use')) showMessage(els.authMessage,'Esse email já está em uso.');
    else showMessage(els.authMessage,'Não foi possível cadastrar. Verifique os dados e tente de novo.');
  }
});
els.validatePlayerTagBtn?.addEventListener('click', async ()=>{
  clearMessage(els.authMessage);
  try{
    els.validatePlayerTagBtn.disabled = true;
    showMessage(els.tagValidationStatus, 'Validando tag...', 'success');
    const result = await validatePlayerTagWithApi(els.registerPlayerTag?.value || '');
    if(els.registerPlayerTag) els.registerPlayerTag.value = result.tag;
    if(els.registerNick) els.registerNick.value = result.name;
    validatedRegisterPlayer = result;
    showMessage(els.tagValidationStatus, `Tag válida: ${result.name}`, 'success');
  }catch(err){
    clearRegisterValidation();
    showMessage(els.tagValidationStatus, err?.message || 'Não foi possível validar a tag.');
  }finally{
    if(els.validatePlayerTagBtn) els.validatePlayerTagBtn.disabled = false;
  }
});
els.registerPlayerTag?.addEventListener('input', ()=>{
  const nextTag = normalizePlayerTag(els.registerPlayerTag?.value || '');
  const currentTag = normalizePlayerTag(validatedRegisterPlayer?.tag || '');
  if(nextTag !== currentTag) clearRegisterValidation();
});

els.forgotPasswordBtn?.addEventListener('click', ()=> els.forgotPasswordModal?.classList.remove('hidden'));
document.querySelector('[data-close-forgot-password]')?.addEventListener('click', ()=> els.forgotPasswordModal?.classList.add('hidden'));
els.forgotPasswordForm?.addEventListener('submit', async (e)=>{ e.preventDefault(); try{ await sendPasswordResetEmail(auth, els.forgotPasswordEmail.value.trim()); showMessage(els.forgotPasswordMessage,'Email de recuperação enviado.','success'); }catch{ showMessage(els.forgotPasswordMessage,'Não foi possível enviar a recuperação.'); } });
els.profileMenuBtn?.addEventListener('click', ()=> els.profilePopover?.classList.toggle('hidden'));
document.addEventListener('click', (e)=>{ const editBtn=e.target.closest('#drawerProfileEditBtn'); if(editBtn){ openProfileEditModal(); } });

els.profilePopover?.addEventListener('click', e=>{ if(e.target===els.profilePopover) els.profilePopover.classList.add('hidden'); });
els.editProfileOpenBtn?.addEventListener('click', ()=>{ els.profilePopover?.classList.add('hidden'); openProfileEditModal(); });
els.changePasswordOpenBtn?.addEventListener('click', ()=>{ els.profilePopover?.classList.add('hidden'); els.changePasswordModal?.classList.remove('hidden'); });
document.querySelector('[data-close-change-password]')?.addEventListener('click', ()=> els.changePasswordModal?.classList.add('hidden'));
document.querySelectorAll('[data-close-profile-edit]').forEach(btn=>btn.addEventListener('click', closeProfileEditModal));
els.profileEditModal?.addEventListener('click', e=>{ if(e.target===els.profileEditModal) closeProfileEditModal(); });
els.profileEditForm?.addEventListener('submit', async(e)=>{ e.preventDefault(); try{ await saveOwnProfile('profile'); }catch(err){ showMessage(els.profileEditMessage, 'Não foi possível atualizar o perfil.'); } });
els.playerTagRequiredCloseBtn?.addEventListener('click', closePlayerTagRequiredModal);
els.playerTagRequiredModal?.addEventListener('click', e=>{ if(e.target===els.playerTagRequiredModal) closePlayerTagRequiredModal(); });
els.playerTagRequiredForm?.addEventListener('submit', async(e)=>{ e.preventDefault(); try{ await saveOwnProfile('required'); }catch(err){ showMessage(els.playerTagRequiredMessage, 'Não foi possível salvar sua tag agora.'); } });
els.changePasswordForm?.addEventListener('submit', async (e)=>{ e.preventDefault(); try{ const current=$('currentPasswordInput').value, next=$('newPasswordInput').value, conf=$('confirmPasswordInput').value; if(next!==conf) throw new Error('A nova senha e a confirmação não conferem.'); const user=auth.currentUser; const credential=EmailAuthProvider.credential(user.email,current); await reauthenticateWithCredential(user,credential); await updatePassword(user,next); showMessage(els.changePasswordMessage,'Senha alterada com sucesso.','success'); els.changePasswordForm.reset(); }catch(err){ showMessage(els.changePasswordMessage, err.message || 'Não foi possível alterar a senha.'); } });
els.logoutBtn?.addEventListener('click', async ()=>{ els.profilePopover?.classList.add('hidden'); await signOut(auth); });
document.addEventListener('click', e=>{ if(e.target===els.changePasswordModal) els.changePasswordModal.classList.add('hidden'); if(e.target===els.forgotPasswordModal) els.forgotPasswordModal.classList.add('hidden'); });
onAuthStateChanged(auth, applySession);

function bindPasswordToggles(){
  document.querySelectorAll('.password-toggle').forEach(btn=>{
    if(btn.dataset.boundPasswordToggle) return;
    btn.dataset.boundPasswordToggle='1';
    btn.addEventListener('click', ()=>{
      const input = document.getElementById(btn.dataset.target);
      if(!input) return;
      const visible = input.type === 'password';
      input.type = visible ? 'text' : 'password';
      btn.classList.toggle('is-visible', visible);
      btn.setAttribute('aria-pressed', visible ? 'true' : 'false');
      btn.setAttribute('aria-label', visible ? 'Ocultar senha' : 'Mostrar senha');
      input.focus({preventScroll:true});
      try{ input.setSelectionRange(input.value.length, input.value.length); }catch(e){}
    });
  });
}
bindPasswordToggles();
document.addEventListener('DOMContentLoaded', bindPasswordToggles);


// ===== LOGIN PREMIUM LOADING =====
function setLoginLoading(btn, loading){
  if(!btn) return;
  if(loading){
    btn.dataset.originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Entrando...';
  }else{
    btn.disabled = false;
    btn.innerHTML = btn.dataset.originalText || 'Entrar';
  }
}

document.addEventListener('submit', function(e){
  const form = e.target.closest('.auth-form');
  if(!form) return;

  const btn = form.querySelector('button.primary');
  if(!btn) return;

  setLoginLoading(btn, true);

  setTimeout(()=>{ // simulação visual (não interfere no login real)
    setLoginLoading(btn, false);
  },1200);
});


window.TOPBRS_RUNTIME_CONFIG = window.TOPBRS_RUNTIME_CONFIG || {};
window.TOPBRS_RUNTIME_CONFIG.clashApiBase = runtimeClashApiBase;
window.TOPBRS_API = window.TOPBRS_API || {};
window.TOPBRS_API.loadClashApiBase = async function(force=false){
  const value = await loadClashApiBase(force);
  window.TOPBRS_RUNTIME_CONFIG.clashApiBase = value;
  return value;
};

import {
  collection,
  doc,
  setDoc,
  getDocs,
  query,
  where
} from 'https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js';

(function(){
  function getDb(){
    return window.TOPBRS_FIREBASE?.db || window.db || window.firebaseDb || window.TOPBRS_DB || null;
  }

  function getCurrentWeekId(){
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = now.getDate();
    const week = Math.ceil(day / 7);
    return `${year}-${month}-week-${week}`;
  }

  const MONTH_TO_NUMBER = {
    JANEIRO:'01', FEVEREIRO:'02', 'MARÇO':'03', MARCO:'03', ABRIL:'04', MAIO:'05', JUNHO:'06',
    JULHO:'07', AGOSTO:'08', SETEMBRO:'09', OUTUBRO:'10', NOVEMBRO:'11', DEZEMBRO:'12'
  };

  function normalizeMonthKey(month){
    return String(month || '').trim().toUpperCase();
  }

  function getWeekIdFor(monthKey, weekNumber, year){
    const resolvedYear = Number(year || new Date().getFullYear());
    const resolvedWeek = Math.min(5, Math.max(1, Number(weekNumber || 1)));
    const monthNumber = MONTH_TO_NUMBER[normalizeMonthKey(monthKey)] || String(new Date().getMonth() + 1).padStart(2, '0');
    return `${resolvedYear}-${monthNumber}-week-${resolvedWeek}`;
  }

  function parseGetWarWeekArgs(options){
    if(typeof options === 'string'){
      return { weekId: options };
    }
    if(options && typeof options === 'object'){
      return options;
    }
    return {};
  }

  async function initWarWeek(){
    const db = getDb();
    if(!db){
      alert('Banco Firebase ainda não ficou disponível. Aguarde alguns segundos e tente novamente.');
      throw new Error('Firebase db indisponível');
    }
    const weekId = getCurrentWeekId();
    await setDoc(doc(db, 'war_weeks', weekId), {
      weekId,
      version: '1.3.4',
      createdAt: new Date().toISOString(),
      status: 'active'
    }, { merge: true });
    alert('Semana criada: ' + weekId);
    return weekId;
  }

  async function initMemberWar(playerTag, playerName){
    const db = getDb();
    if(!db){
      alert('Banco Firebase ainda não ficou disponível. Aguarde alguns segundos e tente novamente.');
      throw new Error('Firebase db indisponível');
    }
    const weekId = getCurrentWeekId();
    const cleanTag = String(playerTag || '').trim();
    const cleanName = String(playerName || '').trim();
    if(!cleanTag || !cleanName){
      alert('Informe playerTag e nome do membro.');
      return;
    }

    await setDoc(doc(db, 'members', cleanTag.replace(/[^A-Za-z0-9#_-]/g, '')), {
      playerTag: cleanTag,
      name: cleanName,
      updatedAt: new Date().toISOString(),
      source: 'war-service-v1.3.4'
    }, { merge: true });

    const days = ['thu','fri','sat','sun'];
    for(const day of days){
      const id = `${weekId}_${cleanTag.replace(/[^A-Za-z0-9#_-]/g, '')}_${day}`;
      await setDoc(doc(db, 'war_daily_status', id), {
        weekId,
        playerTag: cleanTag,
        playerName: cleanName,
        day,
        attacksUsed: 0,
        maxAttacks: 4,
        updatedAt: new Date().toISOString(),
        version: '1.3.4'
      }, { merge: true });
    }
    alert('Membro preparado: ' + cleanName);
  }


  function sanitizeDocId(value){
    return String(value || '').trim().replace(/[^A-Za-z0-9#_-]/g, '');
  }

  function buildFallbackTag(member, index){
    const raw = member?.playerTag || member?.tag || member?.id || member?.name || `member-${index+1}`;
    const clean = sanitizeDocId(raw).replace(/^#+/, '');
    return `#${clean || `member-${index+1}`}`;
  }

  async function initWeekForMembers(members = [], options = {}){
    const db = getDb();
    if(!db){
      alert('Banco Firebase ainda não ficou disponível. Aguarde alguns segundos e tente novamente.');
      throw new Error('Firebase db indisponível');
    }
    const parsed = parseGetWarWeekArgs(options);
    const weekId = parsed.weekId || getWeekIdFor(parsed.month, parsed.week, parsed.year);
    const roster = Array.isArray(members) ? members.filter(Boolean) : [];
    if(!roster.length){
      if(!options?.silent) alert('Nenhum membro real disponível para preparar a Guerra Auto.');
      return { weekId, prepared: 0 };
    }
    const days = ['thu','fri','sat','sun'];
    let prepared = 0;
    for(let i=0;i<roster.length;i++){
      const member = roster[i] || {};
      const playerName = String(member.name || member.nick || '').trim();
      if(!playerName) continue;
      const playerTag = buildFallbackTag(member, i);
      const safeTag = sanitizeDocId(playerTag);
      await setDoc(doc(db, 'members', safeTag), {
        playerTag,
        name: playerName,
        role: String(member.role || 'Membro'),
        source: 'guerra-auto-roster-v1.3.4',
        updatedAt: new Date().toISOString()
      }, { merge: true });
      for(const day of days){
        const id = `${weekId}_${safeTag}_${day}`;
        await setDoc(doc(db, 'war_daily_status', id), {
          weekId,
          playerTag,
          playerName,
          role: String(member.role || 'Membro'),
          day,
          attacksUsed: 0,
          maxAttacks: 4,
          updatedAt: new Date().toISOString(),
          source: 'guerra-auto-roster-v1.3.4'
        }, { merge: true });
      }
      prepared += 1;
    }
    return { weekId, prepared };
  }

  function formatWarWeek(result){
    if(!Array.isArray(result) || !result.length){
      return 'Nenhum dado de guerra encontrado para a semana atual.';
    }
    return result.map((m) => {
      return [
        m.name || m.playerTag,
        `Qui: ${m.thu}/4`,
        `Sex: ${m.fri}/4`,
        `Sáb: ${m.sat}/4`,
        `Dom: ${m.sun}/4`,
        `Total: ${m.total}/16`
      ].join(' | ');
    }).join('\n\n');
  }

  
async function getWarWeek(options = false){
  const db = getDb();
  if(!db){
    alert('Banco Firebase ainda não ficou disponível. Aguarde alguns segundos e tente novamente.');
    return [];
  }
  const parsed = parseGetWarWeekArgs(options);
  const showAlert = typeof options === 'boolean' ? options : Boolean(parsed.showAlert);
  const weekId = parsed.weekId || getWeekIdFor(parsed.month, parsed.week, parsed.year);
  const snapshot = await getDocs(query(collection(db, 'war_daily_status'), where('weekId', '==', weekId)));
  const map = {};
  snapshot.forEach((entry) => {
    const data = entry.data();
    if(!map[data.playerTag]){
      map[data.playerTag] = {
        playerTag: data.playerTag,
        name: data.playerName,
        thu: 0,
        fri: 0,
        sat: 0,
        sun: 0,
        total: 0,
        weekId
      };
    }
    map[data.playerTag][data.day] = Number(data.attacksUsed || 0);
  });
  const result = Object.values(map).map((m) => {
    m.total = m.thu + m.fri + m.sat + m.sun;
    return m;
  });
  console.log('WAR_SERVICE.getWarWeek()', weekId, result);
  if(showAlert){
    alert(formatWarWeek(result));
  }
  return result;
}

async function testCreateMember()
{
    await initMemberWar('#ABC123', 'Teste Player');
  }

  async function testReadWarWeek(){
    return getWarWeek(true);
  }

  window.WAR_SERVICE = {
    version: '1.3.4',
    getCurrentWeekId,
    getWeekIdFor,
    initWarWeek,
    initMemberWar,
    getWarWeek,
    testCreateMember,
    testReadWarWeek,
    initWeekForMembers
  };
})();

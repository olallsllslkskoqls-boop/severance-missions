const api = (() => {
  const backendUrl = 'https://script.google.com/macros/s/AKfycbwzi7F5y3QmP0cblyVoo5pivYKxvYkBY8ZzjOqYr5JnJTAnwqSsfHWOvtbj4xbQKF3J/exec';
  const demoMode = !backendUrl;
  const prefix = 'missionboard.';

  const read = (key, fallback) => {
    try {
      const raw = localStorage.getItem(prefix + key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (err) {
      return fallback;
    }
  };

  const write = (key, value) => {
    try {
      localStorage.setItem(prefix + key, JSON.stringify(value));
    } catch (err) {}
  };

  const forget = (key) => {
    try {
      localStorage.removeItem(prefix + key);
    } catch (err) {}
  };

  const fail = (error, extra) => ({ ok: false, error, ...(extra || {}) });

  const loadJson = async (path) => {
    const res = await fetch(path, { cache: 'no-store' });
    if (!res.ok) throw new Error(`${path} returned ${res.status}`);
    return res.json();
  };

  const remote = async (action, payload) => {
    const session = read('session', null);
    const res = await fetch(backendUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action, token: session ? session.token : '', ...payload })
    });
    if (!res.ok) throw new Error(`Board returned ${res.status}`);
    return res.json();
  };

  const demo = (() => {
    const lower = (text) => String(text == null ? '' : text).trim().toLowerCase();
    const cleanName = (text) => String(text == null ? '' : text)
      .replace(/["“”][^"“”]*["“”]/g, ' ')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' ');
    const sameName = (a, b) => cleanName(a) !== '' && cleanName(a) === cleanName(b);
    const username = (value) => String(value == null ? '' : value).trim().replace(/^@/, '');
    const loadMissions = async () => read('demoMissions', null) || loadJson('data/missions.json');
    const saveMissions = (list) => write('demoMissions', list);

    const whoIs = (token, roster, loreTeam) => {
      let session = null;
      try {
        session = JSON.parse(String(token || '').replace(/^demo:/, ''));
      } catch (err) {}
      if (!session) return { error: fail('Your sign-in ran out. Verify again.', { signedOut: true }) };
      const loreMember = loreTeam.find((m) => lower(m.roblox) === lower(session.r));
      if (session.k === 'lore') {
        if (!loreMember) return { error: fail('You’re not on the active lore team list anymore.', { signedOut: true }) };
        return { me: { kind: 'lore', roblox: loreMember.roblox, loreName: '', squad: null, isAdmin: true, loreRank: loreMember.rank } };
      }
      const player = roster.find((p) => lower(p.roblox) === lower(session.r) && sameName(p.loreName, session.n));
      if (!player) return { error: fail('That character isn’t on the squad sheet anymore. Verify again with your current character.', { signedOut: true }) };
      return { me: { kind: 'player', roblox: player.roblox, loreName: player.loreName, squad: player.squad, isAdmin: !!loreMember, loreRank: loreMember ? loreMember.rank : '' } };
    };

    const actions = {
      requestCode: async ({ roblox, loreName }, { roster, loreTeam }) => {
        const name = username(roblox);
        const lore = String(loreName || '').trim();
        if (!name) return fail('Type your Roblox username.');
        let target;
        if (lore) {
          const player = roster.find((p) => lower(p.roblox) === lower(name) && sameName(p.loreName, lore));
          if (!player) return fail('That Roblox account and lore name aren’t in the same row on the squad sheet. Check both, or ask to be added.');
          target = { kind: 'player', roblox: player.roblox, loreName: player.loreName, squad: player.squad };
        } else {
          const loreMember = loreTeam.find((m) => lower(m.roblox) === lower(name));
          if (!loreMember) return fail('Type your lore name too. Only the lore team can sign in without one.');
          target = { kind: 'lore', roblox: loreMember.roblox, loreName: '', squad: null };
        }
        const code = String(100000 + Math.floor(Math.random() * 900000));
        write('demoPending', { ...target, code, expires: Date.now() + 5 * 60 * 1000 });
        return { ok: true, ...target, demoCode: code };
      },

      verifyCode: async ({ roblox, code }, { roster, loreTeam }) => {
        const pending = read('demoPending', null);
        if (!pending || lower(pending.roblox) !== lower(username(roblox)) || Date.now() > pending.expires) return fail('That code ran out or was never sent. Send a new one.');
        if (String(code).trim() !== pending.code) return fail('That code doesn’t match. Check your screen, or send a new one.');
        forget('demoPending');
        const token = 'demo:' + JSON.stringify({ r: pending.roblox, n: pending.loreName, k: pending.kind });
        const who = whoIs(token, roster, loreTeam);
        if (who.error) return who.error;
        return { ok: true, token, me: who.me };
      },

      getBoard: async (payload, ctx) => {
        const who = whoIs(payload.token, ctx.roster, ctx.loreTeam);
        if (who.error) return who.error;
        return { ok: true, me: who.me, missions: await loadMissions() };
      },

      claim: async ({ token, missionId }, ctx) => {
        const who = whoIs(token, ctx.roster, ctx.loreTeam);
        if (who.error) return who.error;
        const squad = who.me.squad;
        if (!squad) return fail('Only squad members can claim missions.');
        const list = await loadMissions();
        const mission = list.find((m) => m.id === missionId);
        if (!mission) return fail('That mission isn’t on the board anymore.');
        const current = list.find((m) => m.claims.includes(squad));
        if (current) return fail(`Squad ${squad} is already on “${current.title}”. Drop it first.`);
        if (mission.claims.length >= mission.squadsNeeded) return fail('Every squad slot on this mission is taken.');
        mission.claims.push(squad);
        saveMissions(list);
        return { ok: true };
      },

      drop: async ({ token, missionId }, ctx) => {
        const who = whoIs(token, ctx.roster, ctx.loreTeam);
        if (who.error) return who.error;
        const squad = who.me.squad;
        const list = await loadMissions();
        const mission = list.find((m) => m.id === missionId);
        if (!squad || !mission || !mission.claims.includes(squad)) return fail('Your squad isn’t on that mission.');
        mission.claims = mission.claims.filter((s) => s !== squad);
        saveMissions(list);
        return { ok: true };
      },

      postMission: async ({ token, mission }, ctx) => {
        const who = whoIs(token, ctx.roster, ctx.loreTeam);
        if (who.error) return who.error;
        if (!who.me.isAdmin) return fail('Only the lore team can do that.');
        const title = String(mission.title || '').trim();
        if (!title) return fail('Give the mission a title first.');
        const list = await loadMissions();
        const id = `${lower(title).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'mission'}-${Math.random().toString(36).slice(2, 6)}`;
        list.push({
          ...mission,
          id,
          title,
          host: String(mission.host || '').trim() || who.me.roblox,
          squadsNeeded: Math.min(18, Math.max(1, parseInt(mission.squadsNeeded, 10) || 1)),
          claims: [],
          postedBy: who.me.roblox,
          postedAt: new Date().toISOString()
        });
        saveMissions(list);
        return { ok: true, id };
      },

      updateMission: async ({ token, missionId, mission }, ctx) => {
        const who = whoIs(token, ctx.roster, ctx.loreTeam);
        if (who.error) return who.error;
        if (!who.me.isAdmin) return fail('Only the lore team can do that.');
        const title = String(mission.title || '').trim();
        if (!title) return fail('A mission needs a title.');
        const list = await loadMissions();
        const current = list.find((m) => m.id === missionId);
        if (!current) return fail('That mission isn’t on the board anymore.');
        const squadsNeeded = Math.min(18, Math.max(1, parseInt(mission.squadsNeeded, 10) || 1));
        const taken = current.claims.length;
        if (taken > squadsNeeded) return fail(`${taken} squads are already on it. Keep Squads needed at ${taken} or more, or clear claims first.`);
        Object.assign(current, mission, {
          id: current.id,
          title,
          host: String(mission.host || '').trim() || who.me.roblox,
          squadsNeeded,
          claims: current.claims,
          postedBy: current.postedBy,
          postedAt: current.postedAt
        });
        saveMissions(list);
        return { ok: true };
      },

      removeMission: async ({ token, missionId }, ctx) => {
        const who = whoIs(token, ctx.roster, ctx.loreTeam);
        if (who.error) return who.error;
        if (!who.me.isAdmin) return fail('Only the lore team can do that.');
        saveMissions((await loadMissions()).filter((m) => m.id !== missionId));
        return { ok: true };
      },

      clearClaims: async ({ token, missionId }, ctx) => {
        const who = whoIs(token, ctx.roster, ctx.loreTeam);
        if (who.error) return who.error;
        if (!who.me.isAdmin) return fail('Only the lore team can do that.');
        const list = await loadMissions();
        const mission = list.find((m) => m.id === missionId);
        if (mission) mission.claims = [];
        saveMissions(list);
        return { ok: true };
      },

      getLoreTeam: async ({ token }, ctx) => {
        const who = whoIs(token, ctx.roster, ctx.loreTeam);
        if (who.error) return who.error;
        if (!who.me.isAdmin) return fail('Only the lore team can do that.');
        return { ok: true, me: who.me, members: ctx.loreTeam };
      }
    };

    return async (action, payload) => {
      const handler = actions[action];
      if (!handler) return fail('Unknown request.');
      const session = read('session', null);
      const ctx = { roster: await loadJson('data/roster.json'), loreTeam: await loadJson('data/admins.json') };
      return handler({ token: session ? session.token : '', ...payload }, ctx);
    };
  })();

  const send = async (action, payload = {}) => {
    try {
      const data = demoMode ? await demo(action, payload) : await remote(action, payload);
      if (data && data.signedOut) {
        forget('session');
        write('flash', data.error);
      }
      if (data && data.ok && data.me) {
        const session = read('session', null);
        if (session) write('session', { ...session, ...data.me });
      }
      return data || fail('No answer from the board.');
    } catch (err) {
      console.warn('Board request failed:', err);
      return fail('Couldn’t reach the board right now. Try again in a moment.');
    }
  };

  const verifyCode = async (roblox, code) => {
    const res = await send('verifyCode', { roblox, code });
    if (res.ok) {
      const session = { token: res.token, ...res.me };
      write('session', session);
      return { ok: true, session };
    }
    return res;
  };

  const takeFlash = () => {
    const text = read('flash', '');
    forget('flash');
    return text;
  };

  const resetDemo = () => ['demoMissions', 'demoPending'].forEach(forget);

  return {
    demoMode,
    getSession: () => read('session', null),
    signOut: () => forget('session'),
    takeFlash,
    requestCode: (roblox, loreName) => send('requestCode', { roblox, loreName }),
    verifyCode,
    getBoard: () => send('getBoard'),
    claim: (missionId) => send('claim', { missionId }),
    drop: (missionId) => send('drop', { missionId }),
    postMission: (mission) => send('postMission', { mission }),
    updateMission: (missionId, mission) => send('updateMission', { missionId, mission }),
    removeMission: (missionId) => send('removeMission', { missionId }),
    clearClaims: (missionId) => send('clearClaims', { missionId }),
    getLoreTeam: () => send('getLoreTeam'),
    resetDemo
  };
})();

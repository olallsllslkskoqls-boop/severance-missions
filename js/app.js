(() => {
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

  const el = (tag, props, ...kids) => {
    const node = document.createElement(tag);
    Object.entries(props || {}).forEach(([key, value]) => {
      if (value == null || value === false) return;
      if (key === 'class') node.className = value;
      else if (key === 'text') node.textContent = value;
      else if (key.startsWith('on')) node.addEventListener(key.slice(2).toLowerCase(), value);
      else node.setAttribute(key, value === true ? '' : value);
    });
    kids.flat().forEach((kid) => {
      if (kid == null || kid === false) return;
      node.append(kid instanceof Node ? kid : document.createTextNode(String(kid)));
    });
    return node;
  };

  const showMsg = (node, text, kind) => {
    if (!node) return;
    node.textContent = text || '';
    node.hidden = !text;
    node.classList.toggle('error', kind === 'error');
    node.classList.toggle('ok', kind === 'ok');
  };

  const busy = async (button, task) => {
    if (button) button.disabled = true;
    try {
      return await task();
    } finally {
      if (button && button.isConnected) button.disabled = false;
    }
  };

  const whoLine = (me) => (me.squad ? `Squad ${me.squad}` : (me.loreRank || 'Lore team'));

  const statusOf = (mission, squad) => {
    const count = mission.claims.length;
    if (squad != null && mission.claims.includes(squad)) return { text: 'YOUR SQUAD’S MISSION', cls: 'status-mine' };
    if (count >= mission.squadsNeeded) return { text: 'CLAIMED', cls: 'status-claimed' };
    if (count > 0) return { text: `${count} OF ${mission.squadsNeeded} SQUADS`, cls: 'status-partial' };
    return { text: 'NOT CLAIMED', cls: 'status-open' };
  };

  const isFull = (mission) => mission.claims.length >= mission.squadsNeeded;
  const squadsText = (n) => (n === 1 ? '1 squad' : `${n} squads`);

  const missionDetail = (mission, { squad = null, action = null, preview = false } = {}) => {
    const clean = (value) => String(value ?? '').trim();
    const fact = (label, value) => el('div', null,
      el('dt', { text: label }),
      clean(value) ? el('dd', { text: clean(value) }) : el('dd', { class: 'unset', text: 'Not set' }));
    const para = (value) => (clean(value) ? el('p', { text: clean(value) }) : el('p', { class: 'unset', text: 'Not set' }));
    const section = (heading, content) => el('section', null, el('h3', { text: heading }), content);
    const status = statusOf(mission, squad);
    const count = mission.claims.length;
    const title = clean(mission.title);
    const host = clean(mission.host);
    const objectives = (mission.objectives || []).map(clean).filter(Boolean);
    const claimedLine = count
      ? `On it: ${mission.claims.map((s) => `Squad ${s}`).join(', ')} (${count} of ${mission.squadsNeeded})`
      : `No squads yet (0 of ${mission.squadsNeeded})`;

    return [
      el('div', { class: 'mission-head' },
        el('div', { class: 'row' },
          el('span', { class: `status tag ${status.cls}`, text: status.text }),
          preview ? null : el('span', { class: 'claimed-line', text: claimedLine })),
        el('div', { class: 'title-block' },
          el('h2', { class: title ? 'serif' : 'serif unset', text: title ? `“${title}”` : 'Untitled mission' }),
          el('p', { class: 'host-line' }, 'Host: ', host ? el('strong', { text: host }) : el('strong', { class: 'unset', text: 'Not set' }))),
        action),
      el('dl', { class: 'facts' },
        fact('Rank', mission.rank),
        fact('Faction', mission.faction),
        fact('Squads needed', mission.squadsNeeded),
        fact('Squad member limit', mission.memberLimit)),
      el('dl', { class: 'facts' },
        fact('Pay per squad member', mission.pay),
        fact('Bonus', mission.bonus),
        fact('Failure', mission.failure)),
      el('dl', { class: 'facts' },
        fact('Location', mission.location),
        fact('Departure', mission.departure),
        fact('Time limit', mission.timeLimit)),
      el('div', { class: 'mission-body' },
        section('Brief summary', para(mission.summary)),
        section('Objectives', objectives.length
          ? el('ol', null, objectives.map((o) => el('li', { text: o })))
          : el('p', { class: 'unset', text: 'Not set' })),
        section('Intel', para(mission.intel)),
        section('Optional requirements', para(mission.optionalRequirements)))
    ];
  };

  const parseMission = (text) => {
    const labels = {
      'host': 'host',
      'rank': 'rank',
      'faction': 'faction',
      'squads needed': 'squadsNeeded',
      'squad member limit': 'memberLimit',
      'pay per squad member': 'pay',
      'bonus': 'bonus',
      'failure': 'failure',
      'location': 'location',
      'departure': 'departure',
      'time limit': 'timeLimit',
      'brief summary': 'summary',
      'objectives': 'objectives',
      'intel': 'intel',
      'optional requirements': 'optionalRequirements'
    };
    const out = { title: '' };
    Object.values(labels).forEach((key) => { out[key] = ''; });
    const objectives = [];
    let current = null;

    String(text || '').replace(/```/g, '').split(/\r?\n/).forEach((raw) => {
      const line = raw.trim();
      if (!line) return;
      if (!out.title && /^["“].*["”]$/.test(line)) {
        out.title = line.replace(/^["“]|["”]$/g, '').trim();
        return;
      }
      const match = line.match(/^([A-Za-z ]+):\s*(.*)$/);
      const key = match ? labels[match[1].trim().toLowerCase()] : null;
      if (key) {
        current = key;
        if (key === 'objectives') {
          if (match[2].trim()) objectives.push(match[2].trim());
        } else {
          out[key] = match[2].trim();
        }
        return;
      }
      if (current === 'objectives') {
        const item = line.match(/^\d+[.)]\s*(.*)$/);
        objectives.push(item ? item[1] : line);
        return;
      }
      if (current) out[current] = out[current] ? `${out[current]} ${line}` : line;
    });

    out.objectives = objectives.join('\n');
    out.squadsNeeded = (out.squadsNeeded.match(/\d+/) || [''])[0];
    return out;
  };

  const landing = () => {
    const arts = $$('.hero-art');
    const thumbs = $$('.thumb');
    const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let current = 0;
    let timer = null;

    const showArt = (index) => {
      current = index;
      arts.forEach((art, n) => art.classList.toggle('on', n === index));
      thumbs.forEach((thumb, n) => thumb.setAttribute('aria-pressed', String(n === index)));
    };
    const startRotation = () => {
      clearInterval(timer);
      if (!calm) timer = setInterval(() => showArt((current + 1) % arts.length), 7000);
    };
    thumbs.forEach((thumb, n) => thumb.addEventListener('click', () => {
      showArt(n);
      startRotation();
    }));
    startRotation();

    const steps = { name: $('#step-name'), code: $('#step-code'), done: $('#step-done') };
    const showStep = (key) => Object.entries(steps).forEach(([name, node]) => { node.hidden = name !== key; });
    const topAction = $('#top-action');
    const robloxInput = $('#roblox-name');
    const nameInput = $('#lore-name');
    const codeInput = $('#verify-code');
    let pending = null;

    const showSignedIn = (session) => {
      $('#done-name').textContent = session.loreName || `@${session.roblox}`;
      $('#done-meta').textContent = `${whoLine(session)} · @${session.roblox}`;
      topAction.textContent = 'Open the board';
      topAction.href = 'board.html';
      topAction.className = 'btn btn-red btn-small';
      showStep('done');
    };
    const showSignedOut = () => {
      topAction.textContent = 'Verify';
      topAction.href = '#verify';
      topAction.className = 'btn btn-ghost btn-small';
      showStep('name');
    };

    const sendCode = async (roblox, loreName) => {
      const res = await api.requestCode(roblox, loreName);
      if (!res.ok) {
        showMsg($('#name-error'), res.error, 'error');
        showStep('name');
        return false;
      }
      pending = { roblox: res.roblox, loreName: res.loreName };
      $('#code-who').textContent = res.kind === 'lore'
        ? `your screen (@${res.roblox}, lore team)`
        : `${res.loreName}’s screen (Squad ${res.squad})`;
      const demo = $('#demo-code');
      demo.hidden = !res.demoCode;
      if (res.demoCode) $('strong', demo).textContent = res.demoCode;
      codeInput.value = '';
      showMsg($('#code-error'), '');
      showStep('code');
      codeInput.focus();
      return true;
    };

    $('#name-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      showMsg($('#name-error'), '');
      await busy(e.submitter, () => sendCode(robloxInput.value, nameInput.value));
    });

    codeInput.addEventListener('input', () => {
      codeInput.value = codeInput.value.replace(/\D/g, '').slice(0, 6);
      showMsg($('#code-error'), '');
    });

    $('#code-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      if (codeInput.value.length < 6) {
        showMsg($('#code-error'), 'The code is 6 digits.', 'error');
        return;
      }
      const res = await busy(e.submitter, () => api.verifyCode(pending.roblox, codeInput.value));
      if (!res.ok) {
        showMsg($('#code-error'), res.error, 'error');
        return;
      }
      showSignedIn(res.session);
    });

    $('#resend').addEventListener('click', async (e) => {
      const button = e.currentTarget;
      const sent = await busy(button, () => sendCode(pending.roblox, pending.loreName));
      if (!sent) return;
      button.textContent = 'Sent again';
      setTimeout(() => { button.textContent = 'Send a new code'; }, 3000);
    });

    $('#not-me').addEventListener('click', () => {
      showStep('name');
      robloxInput.focus();
    });

    $('#sign-out').addEventListener('click', () => {
      api.signOut();
      showSignedOut();
    });

    if (api.demoMode) {
      $('#demo-names').hidden = false;
      $$('#demo-names [data-roblox]').forEach((button) => button.addEventListener('click', () => {
        robloxInput.value = button.dataset.roblox;
        nameInput.value = button.dataset.name || '';
        showMsg($('#name-error'), '');
        robloxInput.focus();
      }));
    }

    const session = api.getSession();
    if (session) showSignedIn(session);
    else showSignedOut();
    const note = api.takeFlash();
    if (note && !session) showMsg($('#name-error'), note, 'error');
  };

  const board = async () => {
    if (!api.getSession()) {
      location.replace('index.html');
      return;
    }

    const list = $('#mission-list');
    const detail = $('#mission');
    let me = api.getSession();
    let missions = [];
    let filter = 'all';
    let selected = decodeURIComponent(location.hash.slice(1)) || null;
    let actionError = '';

    $('#sign-out').addEventListener('click', () => {
      api.signOut();
      location.href = 'index.html';
    });

    const showMe = () => {
      $('#user-name').textContent = me.loreName || `@${me.roblox}`;
      $('#user-meta').textContent = me.squad ? `Squad ${me.squad} · verified` : (me.loreRank || 'Lore team');
      $('#admin-link').hidden = !me.isAdmin;
    };

    const refresh = async () => {
      const res = await api.getBoard();
      if (!res.ok && res.signedOut) {
        location.replace('index.html');
        return;
      }
      if (res.ok) {
        missions = res.missions;
        me = res.me;
      } else {
        actionError = res.error;
      }
      render();
    };

    const run = async (button, task) => {
      const res = await busy(button, task);
      actionError = res.ok ? '' : res.error;
      await refresh();
    };

    const select = (id) => {
      selected = id;
      actionError = '';
      history.replaceState(null, '', `#${encodeURIComponent(id)}`);
      render();
      if (window.innerWidth < 960) detail.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    const actionFor = (mission, mine) => {
      const squad = me.squad;
      const box = el('div', { class: 'action' });
      const note = (text) => el('span', { class: 'note', text });
      if (!squad) {
        box.append(note('The lore team posts missions but doesn’t claim them.'));
      } else if (mission.claims.includes(squad)) {
        box.append(
          el('button', { class: 'btn btn-ghost', type: 'button', text: 'Drop mission', onClick: (e) => run(e.currentTarget, () => api.drop(mission.id)) }),
          note(`Squad ${squad} is on this one. Dropping frees the slot for another squad.`));
      } else if (isFull(mission)) {
        box.append(
          el('button', { class: 'btn btn-off', type: 'button', disabled: true, text: 'Claimed' }),
          note('Every squad slot on this mission is taken.'));
      } else if (mine) {
        box.append(
          el('button', { class: 'btn btn-off', type: 'button', disabled: true, text: `Claim for Squad ${squad}` }),
          note(`Squad ${squad} is already on “${mine.title}”. Drop it first.`));
      } else {
        const left = mission.squadsNeeded - mission.claims.length;
        box.append(
          el('button', { class: 'btn btn-red', type: 'button', text: `Claim for Squad ${squad}`, onClick: (e) => run(e.currentTarget, () => api.claim(mission.id)) }),
          note(mission.squadsNeeded > 1 ? `${left} of ${mission.squadsNeeded} squad slots left.` : 'Takes 1 squad.'));
      }
      if (actionError) box.append(el('p', { class: 'msg error', role: 'alert', text: actionError }));
      return box;
    };

    const render = () => {
      showMe();
      const squad = me.squad;
      const mine = squad ? missions.find((m) => m.claims.includes(squad)) || null : null;
      const open = missions.filter((m) => !isFull(m)).length;
      const counts = { all: missions.length, open, claimed: missions.length - open };
      const labels = { all: 'All', open: 'Not claimed', claimed: 'Claimed' };

      $('#board-counts').textContent = `Shinobi faction · ${open} open · ${counts.claimed} claimed`;
      $('#squad-title').textContent = squad ? `Squad ${squad}` : 'Lore team';
      $('#squad-slot').textContent = squad ? (mine ? '1 / 1 mission' : '0 / 1 mission') : '';
      $('#squad-slot').classList.toggle('full', !!mine);
      $('#squad-line').textContent = squad
        ? (mine ? `On “${mine.title}”.` : 'No mission yet. Anyone in the squad can claim one.')
        : 'You can read the board here. Post and manage missions from the admin panel.';

      $$('.tab').forEach((tab) => {
        const key = tab.dataset.filter;
        tab.textContent = `${labels[key]} (${counts[key]})`;
        tab.setAttribute('aria-pressed', String(key === filter));
      });

      if (!missions.some((m) => m.id === selected)) selected = missions[0] ? missions[0].id : null;

      const shown = missions.filter((m) => filter === 'all' || (filter === 'open' ? !isFull(m) : isFull(m)));
      list.replaceChildren(...shown.map((m) => {
        const status = statusOf(m, squad);
        return el('li', null,
          el('button', { class: 'mission-item', type: 'button', 'aria-pressed': String(m.id === selected), onClick: () => select(m.id) },
            el('span', { class: 'rank', 'aria-hidden': 'true', text: m.rank }),
            el('span', { class: 'info' },
              el('span', { class: 'title', text: `“${m.title}”` }),
              el('span', { class: 'meta', text: `Host: ${m.host || 'Not set'}` }),
              el('span', { class: 'meta', text: m.location }),
              el('span', { class: 'meta', text: `${m.pay} per member · ${squadsText(m.squadsNeeded)}` }),
              el('span', { class: `status ${status.cls}`, text: status.text }))));
      }));
      $('#list-empty').hidden = shown.length > 0;

      const mission = missions.find((m) => m.id === selected);
      if (!mission) {
        detail.replaceChildren(el('div', { class: 'mission-body' }, el('p', { class: 'muted', text: 'No missions are posted right now.' })));
        return;
      }
      detail.replaceChildren(...missionDetail(mission, { squad, action: actionFor(mission, mine) }));
    };

    $$('.tab').forEach((tab) => tab.addEventListener('click', () => {
      filter = tab.dataset.filter;
      render();
    }));

    showMe();
    await refresh();
    setInterval(() => { if (!document.hidden) refresh(); }, 30000);
  };

  const admin = async () => {
    const session = api.getSession();
    if (!session) {
      location.replace('index.html');
      return;
    }
    const first = await api.getLoreTeam();
    if (!first.ok) {
      location.replace(first.signedOut ? 'index.html' : 'board.html');
      return;
    }

    const me = first.me;
    $('#user-name').textContent = me.loreName || `@${me.roblox}`;
    $('#user-meta').textContent = me.loreRank || 'Lore team';

    const form = $('#post-form');
    const fields = ['title', 'host', 'rank', 'faction', 'squadsNeeded', 'memberLimit', 'pay', 'bonus', 'failure', 'location', 'departure', 'timeLimit', 'summary', 'objectives', 'intel', 'optionalRequirements'];
    let confirmId = null;

    const resetForm = () => {
      form.reset();
      form.elements.host.value = me.roblox;
    };

    const readForm = () => {
      const data = {};
      fields.forEach((key) => { data[key] = form.elements[key].value.trim(); });
      data.squadsNeeded = Math.max(1, parseInt(data.squadsNeeded, 10) || 1);
      data.objectives = data.objectives.split(/\n+/).map((t) => t.replace(/^\d+[.)]\s*/, '').trim()).filter(Boolean);
      return data;
    };

    const fillForm = (data) => fields.forEach((key) => {
      const value = data[key];
      if (value == null || value === '') return;
      form.elements[key].value = value;
    });

    const renderPreview = () => {
      $('#preview').replaceChildren(...missionDetail({ ...readForm(), claims: [] }, { preview: true }));
    };

    form.addEventListener('input', () => {
      renderPreview();
      showMsg($('#post-msg'), '');
    });

    $('#fill').addEventListener('click', () => {
      const parsed = parseMission($('#paste').value);
      if (!parsed.title && !parsed.rank && !parsed.summary) {
        showMsg($('#paste-msg'), 'Couldn’t read that. Check it uses the usual mission format.', 'error');
        return;
      }
      showMsg($('#paste-msg'), '');
      resetForm();
      fillForm(parsed);
      renderPreview();
    });

    $('#clear').addEventListener('click', () => {
      $('#paste').value = '';
      resetForm();
      showMsg($('#paste-msg'), '');
      showMsg($('#post-msg'), '');
      renderPreview();
    });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const data = readForm();
      if (!data.title) {
        showMsg($('#post-msg'), 'Give the mission a title first.', 'error');
        $('#f-title').focus();
        return;
      }
      const res = await busy(e.submitter, () => api.postMission(data));
      if (!res.ok) {
        showMsg($('#post-msg'), res.error, 'error');
        return;
      }
      resetForm();
      $('#paste').value = '';
      renderPreview();
      showMsg($('#post-msg'), `Posted “${data.title}”. It’s on the board now.`, 'ok');
      renderPosted();
    });

    const renderPosted = async () => {
      const rows = $('#posted-rows');
      const res = await api.getBoard();
      if (!res.ok) {
        rows.replaceChildren(el('div', { class: 'table-row' }, el('span', { class: 'msg error', text: res.error })));
        return;
      }
      if (!res.missions.length) {
        rows.replaceChildren(el('div', { class: 'table-row' }, el('span', { class: 'muted', text: 'No missions posted.' })));
        return;
      }
      rows.replaceChildren(...res.missions.map((m) => {
        const status = statusOf(m, null);
        const confirming = confirmId === m.id;
        return el('div', { class: 'table-row' },
          el('span', { class: 'serif row-title', text: `“${m.title}”` }),
          el('span', { text: m.host || 'Not set' }),
          el('span', { class: 'strong', text: m.rank }),
          el('span', { text: `${m.claims.length} of ${m.squadsNeeded}` }),
          el('span', { class: `status ${status.cls}`, text: status.text }),
          el('span', { class: 'actions' },
            el('button', {
              class: 'btn btn-ghost btn-small',
              type: 'button',
              disabled: !m.claims.length,
              text: 'Clear claims',
              onClick: async (e) => {
                await busy(e.currentTarget, () => api.clearClaims(m.id));
                renderPosted();
              }
            }),
            el('button', {
              class: `btn btn-small ${confirming ? 'btn-danger' : 'btn-ghost'}`,
              type: 'button',
              text: confirming ? 'Click again to remove' : 'Remove',
              onClick: async (e) => {
                if (!confirming) {
                  confirmId = m.id;
                  renderPosted();
                  return;
                }
                confirmId = null;
                await busy(e.currentTarget, () => api.removeMission(m.id));
                renderPosted();
              }
            })));
      }));
    };

    const renderLoreTeam = (members) => {
      $('#lore-list').replaceChildren(...members.map((m) => el('li', null,
        el('span', { class: 'who' },
          el('strong', { text: `@${m.roblox}` }),
          el('span', { text: m.rank || 'Lore team' })))));
    };

    if (api.demoMode) {
      $('#demo-row').hidden = false;
      $('#demo-reset').addEventListener('click', () => {
        api.resetDemo();
        location.reload();
      });
    }

    resetForm();
    renderPreview();
    renderPosted();
    renderLoreTeam(first.members);
  };

  const pages = { landing, board, admin };
  const start = () => {
    const page = pages[document.body.dataset.page];
    if (page) page();
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();

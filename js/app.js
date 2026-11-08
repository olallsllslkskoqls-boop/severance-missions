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

  const svgNS = 'http://www.w3.org/2000/svg';
  const svg = (tag, attrs, ...kids) => {
    const node = document.createElementNS(svgNS, tag);
    Object.entries(attrs || {}).forEach(([key, value]) => node.setAttribute(key, value));
    kids.forEach((kid) => node.append(kid));
    return node;
  };
  const kunai = (cls = '') => svg('svg', { class: `kunai ${cls}`.trim(), viewBox: '0 0 28 96', 'aria-hidden': 'true', focusable: 'false' }, svg('use', { href: '#kunai' }));

  const kanjiDigits = ['〇', '一', '二', '三', '四', '五', '六', '七', '八', '九'];
  const kanjiNum = (n) => {
    if (!Number.isInteger(n) || n < 1 || n > 99) return String(n);
    const tens = Math.floor(n / 10);
    const ones = n % 10;
    return `${tens > 1 ? kanjiDigits[tens] : ''}${tens ? '十' : ''}${ones ? kanjiDigits[ones] : ''}`;
  };
  const squadKanji = (n) => `第${kanjiNum(n)}班`;

  const rankParts = (rank) => {
    const text = String(rank ?? '').trim();
    return { letter: text.charAt(0).toUpperCase(), mod: text.slice(1) };
  };
  const enso = (rank) => {
    const { letter, mod } = rankParts(rank);
    return el('span', { class: 'enso', 'aria-hidden': 'true' },
      svg('svg', { viewBox: '0 0 66 66' }, svg('circle', { cx: '33', cy: '33', r: '27' })),
      el('span', { text: letter || '?' }),
      mod ? el('small', { text: mod }) : null);
  };

  const whoLine = (me) => (me.squad ? `Squad ${me.squad}` : (me.loreRank || 'Lore team'));

  const statusOf = (mission, squad) => {
    const count = mission.claims.length;
    if (squad != null && mission.claims.includes(squad)) return { text: 'YOUR SQUAD', cls: 'is-mine', jp: squadKanji(squad) };
    if (count >= mission.squadsNeeded) return { text: 'CLAIMED', cls: 'is-claimed', jp: '受諾済' };
    if (count > 0) return { text: `${count} OF ${mission.squadsNeeded} SQUADS`, cls: 'is-partial', jp: '募集中' };
    return { text: 'OPEN', cls: 'is-open', jp: '募集中' };
  };

  const isFull = (mission) => mission.claims.length >= mission.squadsNeeded;
  const squadsText = (n) => (n === 1 ? '1 squad' : `${n} squads`);

  const missionDetail = (mission, { squad = null, action = null, preview = false } = {}) => {
    const clean = (value) => String(value ?? '').trim();
    const fact = (jp, label, value) => el('div', null,
      el('dt', null, el('span', { class: 'jp', 'aria-hidden': 'true', text: jp }), el('span', { class: 'en', text: label })),
      clean(value) ? el('dd', { text: clean(value) }) : el('dd', { class: 'unset', text: 'Not set' }));
    const para = (value) => (clean(value) ? el('p', { text: clean(value) }) : el('p', { class: 'unset', text: 'Not set' }));
    const section = (jp, heading, content) => el('section', { class: 'sheet-section' },
      el('h3', null, el('span', { class: 'jp', 'aria-hidden': 'true', text: jp }), heading),
      content);
    const status = statusOf(mission, squad);
    const count = mission.claims.length;
    const title = clean(mission.title);
    const host = clean(mission.host);
    const { letter } = rankParts(mission.rank);
    const objectives = (mission.objectives || []).map(clean).filter(Boolean);
    const claimedLine = count
      ? `On it: ${mission.claims.map((s) => `Squad ${s}`).join(', ')} (${count} of ${mission.squadsNeeded})`
      : `No squads yet (0 of ${mission.squadsNeeded})`;

    return [
      el('div', { class: 'sheet-main' },
        el('div', { class: 'sheet-status' },
          el('span', { class: 'chip', text: status.text }),
          preview ? null : el('span', { class: 'claimed-line', text: claimedLine })),
        el('div', { class: 'title-block' },
          el('h2', { class: title ? null : 'unset', text: title || 'Untitled mission' }),
          el('p', { class: 'host-line' }, 'Host: ', host ? el('strong', { text: host }) : el('strong', { class: 'unset', text: 'Not set' }))),
        action,
        section('概要', 'Brief summary', para(mission.summary)),
        section('目標', 'Objectives', objectives.length
          ? el('ol', { class: 'objectives' }, objectives.map((o, i) => el('li', null,
            el('span', { class: 'num', 'aria-hidden': 'true', text: kanjiNum(i + 1) }),
            el('span', { text: o }))))
          : el('p', { class: 'unset', text: 'Not set' })),
        section('情報', 'Intel', para(mission.intel)),
        section('任意', 'Optional requirements', para(mission.optionalRequirements))),
      el('div', { class: 'sheet-side' },
        el('dl', { class: 'facts' },
          fact('級', 'Rank', mission.rank),
          fact('所属', 'Faction', mission.faction),
          fact('班数', 'Squads needed', mission.squadsNeeded),
          fact('人数', 'Member limit', mission.memberLimit),
          fact('報酬', 'Pay per member', mission.pay),
          fact('賞与', 'Bonus', mission.bonus),
          fact('失敗', 'Failure', mission.failure),
          fact('場所', 'Location', mission.location),
          fact('出発', 'Departure', mission.departure),
          fact('期限', 'Time limit', mission.timeLimit)),
        el('span', { class: 'sheet-vertical', 'aria-hidden': 'true', text: letter ? `任務指令書 · ${letter}級` : '任務指令書' }))
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
      showStep('done');
    };
    const showSignedOut = () => {
      topAction.textContent = 'Verify';
      topAction.href = '#verify';
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
    const sheetWrap = $('#sheet-wrap');
    const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
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
      const top = sheetWrap.getBoundingClientRect().top;
      if (top < 0 || top > window.innerHeight * 0.6) sheetWrap.scrollIntoView({ behavior: calm ? 'auto' : 'smooth', block: 'start' });
    };

    const actionFor = (mission, mine) => {
      const squad = me.squad;
      const box = el('div', { class: 'action' });
      const note = (text) => el('span', { class: 'note', text });
      if (!squad) {
        box.append(note('The lore team posts missions but doesn’t claim them.'));
      } else if (mission.claims.includes(squad)) {
        box.append(
          el('button', { class: 'btn btn-ink', type: 'button', text: 'Drop mission', onClick: (e) => run(e.currentTarget, () => api.drop(mission.id)) }),
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
          el('button', { class: 'btn btn-seal', type: 'button', onClick: (e) => run(e.currentTarget, () => api.claim(mission.id)) },
            el('span', { class: 'seal', 'aria-hidden': 'true', text: '受' }),
            `Claim for Squad ${squad}`),
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
      const labels = { all: 'All', open: 'Open', claimed: 'Claimed' };

      $('#board-counts').textContent = `Shinobi faction · ${open} open · ${counts.claimed} claimed`;
      $('#squad-kanji').textContent = squad ? squadKanji(squad) : '伝承';
      $('#squad-title').textContent = squad ? `SQUAD ${squad}` : 'LORE TEAM';
      $('#squad-slot').textContent = squad ? `Mission slot ${mine ? 1 : 0} / 1` : '';
      $('#squad-slot').classList.toggle('full', !!mine);
      $('#squad-line').textContent = squad
        ? (mine ? `On ${mine.title}.` : 'No mission yet. Anyone in the squad can claim one.')
        : 'You can read the board here. Post and manage missions from the admin panel.';

      $$('.tab').forEach((tab) => {
        const key = tab.dataset.filter;
        $('.en', tab).textContent = `${labels[key]} ${counts[key]}`;
        tab.setAttribute('aria-pressed', String(key === filter));
      });

      if (!missions.some((m) => m.id === selected)) selected = missions[0] ? missions[0].id : null;

      const line = (label, value) => el('span', null, el('span', { class: 'k', 'aria-hidden': 'true', text: label }), value || 'Not set');
      const shown = missions.filter((m) => filter === 'all' || (filter === 'open' ? !isFull(m) : isFull(m)));
      list.replaceChildren(...shown.map((m) => {
        const status = statusOf(m, squad);
        const on = m.id === selected;
        const stamped = status.cls === 'is-claimed' || status.cls === 'is-mine';
        return el('li', { class: `notice ${status.cls}${on ? ' is-on' : ''}` },
          el('button', { class: 'notice-card paper', type: 'button', 'aria-pressed': String(on), onClick: () => select(m.id) },
            el('span', { class: 'strip', 'aria-hidden': 'true', text: status.jp }),
            el('span', { class: 'notice-body' },
              el('span', { class: 'notice-top' },
                enso(m.rank),
                el('span', { class: 'notice-kicker' },
                  el('span', { text: `Rank ${m.rank || '?'} · ${m.faction || 'Shinobi'}` }),
                  el('span', { class: 'status', text: status.text }))),
              el('span', { class: 'notice-title', text: m.title || 'Untitled mission' }),
              el('span', { class: 'brush-rule', 'aria-hidden': 'true' }),
              el('span', { class: 'notice-lines' },
                line('場所', m.location),
                line('報酬', m.pay ? `${m.pay} per member` : ''),
                line('班数', squadsText(m.squadsNeeded))),
              el('span', { class: 'notice-foot' },
                el('span', { text: 'Host' }),
                el('span', { class: 'host-seal stamp' },
                  el('span', { class: 'jp', 'aria-hidden': 'true', text: '担当' }),
                  el('span', { class: 'name', text: m.host || 'Not set' })))),
            stamped
              ? el('span', { class: 'big-stamp', 'aria-hidden': 'true' },
                el('span', { class: 'jp', text: '受諾' }),
                el('span', { class: 'en', text: m.claims.map((s) => `SQUAD ${s}`).join(' · ') }))
              : null),
          kunai());
      }));
      $('#list-empty').hidden = shown.length > 0;

      const mission = missions.find((m) => m.id === selected);
      if (!mission) {
        detail.className = 'paper sheet sheet-flow';
        detail.replaceChildren(el('p', { class: 'sheet-note', text: 'No missions are posted right now.' }));
        return;
      }
      detail.className = `paper sheet sheet-flow ${statusOf(mission, squad).cls}`;
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
          el('span', { class: 'row-title', text: m.title }),
          el('span', { text: m.host || 'Not set' }),
          el('span', { class: 'strong', text: m.rank }),
          el('span', { text: `${m.claims.length} of ${m.squadsNeeded}` }),
          el('span', { class: `status ${status.cls}`, text: status.text }),
          el('span', { class: 'actions' },
            el('button', {
              class: 'btn btn-ink btn-small',
              type: 'button',
              disabled: !m.claims.length,
              text: 'Clear claims',
              onClick: async (e) => {
                await busy(e.currentTarget, () => api.clearClaims(m.id));
                renderPosted();
              }
            }),
            el('button', {
              class: `btn btn-small ${confirming ? 'btn-danger' : 'btn-ink'}`,
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

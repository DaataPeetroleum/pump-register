export function dailyTransactions(ledger, date) {
  const rows = ledger.filter(entry => entry.d === date && ['credit', 'pay'].includes(entry.k));
  const total = kind => rows.filter(entry => entry.k === kind)
    .reduce((sum, entry) => sum + Math.round(Number(entry.a) * 100), 0) / 100;
  return {rows, credit: total('credit'), recovery: total('pay')};
}

export function normalizeWorkspace(snapshot) {
  for (const tab of snapshot.tabs || []) if (tab.group || tab.date) tab.date = snapshot.date;
  return snapshot;
}

export function install(api) {
  const select = selector => document.querySelector(selector);
  const tabs = [
    ['customerlist', 'All Customers / تمام گاہک'],
    ['v94daily', 'Daily Transactions / روزانہ لین دین'],
    ['customeradd', 'Add Customer / نیا گاہک']
  ];
  const style = document.createElement('style');
  style.textContent = `
    #entryPage .v94r-tabs{display:flex;gap:5px;grid-column:1/-1;overflow-x:auto;margin:7px 0}
    #entryPage .v94r-tabs button{flex:1;min-width:100px;min-height:40px;padding:6px;font-size:12px;white-space:normal}
    #entryPage .v94r-tabs [aria-selected=true],#entryPage .v94r-chips [aria-pressed=true]{background:#123d71!important;color:white!important;border-color:#123d71!important}
    #entryPage .v94r-chips{display:flex;flex-wrap:wrap;gap:5px;margin:6px 0}
    #entryPage .v94r-chips button{width:auto;min-height:36px;padding:5px 10px;font-size:12px}
    #entryPage .v94r-quick{grid-column:1/-1;display:grid;gap:8px;border:1px solid #9ab1c8;border-radius:8px;padding:10px;margin:8px 0;background:var(--v6-surface,#fff);color:var(--v6-text,#172b46)}
    #entryPage .v94r-quick label{display:grid;gap:3px}
    #entryPage .v94r-quick input,#entryPage .v94r-quick select{width:100%;min-width:0}
    #entryPage .v94r-preview{padding:8px;background:var(--v6-bg,#e7eef7);color:var(--v6-text,#172b46);border-radius:5px;white-space:pre-line}
    #entryPage .v94r-entry{margin:4px 0 4px 8px;min-height:32px;padding:4px 10px}
    #entryPage .v94r-daily{grid-column:1/-1;overflow-x:auto}
    #entryPage .v94r-daily table{width:100%}
    #entryPage .v94r-saved{grid-column:1/-1;padding:10px;background:var(--v6-surface,#e5f3e9);color:var(--v6-text,#172b46)}
    #entryPage [data-v94r-customer] .v5-mode,#entryPage [data-v94r-customer] .v4modes{display:none!important}
    #entryPage .v94r-selected{color:#123d71;font-weight:700}
    @media(max-width:500px){#entryPage .v94r-tabs button{min-width:95px;font-size:11px}}
  `;
  document.head.append(style);
  api.addMode(['v94daily', 'Daily Transactions', 'روزانہ لین دین']);
  api.addMode(['v94saved', 'Customer Saved', 'گاہک محفوظ']);
  api.wrapRestore(normalizeWorkspace);

  function activateSelected(key) {
    if (api.getBusy()) return;
    const target = api.getWorks().get(key);
    api.clearAuto();
    if (target?.group) api.openGroup(target.group, target.mode, api.getDay().date);
    else {
      if (target?.date) target.date = api.getDay().date;
      api.activateWork(key);
    }
  }

  window.addEventListener('click', event => {
    const button = event.target.closest('[data-work],[data-easy]');
    if (!button) return;
    if (button.dataset.work) {
      event.stopImmediatePropagation();
      activateSelected(button.dataset.work);
      return;
    }
    const groups = {reading: ['reading', 'reading:0'], delivery: ['stock', 'delivery'], cashin: ['cash', 'v45dr']};
    const target = groups[button.dataset.easy];
    if (!target || api.getRole() === 'staff') return;
    event.stopImmediatePropagation();
    if (api.getBusy()) return;
    const old = api.getWorks().get(api.groupKey(target[0]));
    api.clearAuto();
    api.openGroup(target[0], old?.mode || target[1], api.getDay().date);
  }, true);
  for (const id of ['v5Tasks', 'v5MobileTasks']) {
    const control = select('#' + id);
    if (control) control.onchange = event => activateSelected(event.target.value);
  }

  function ready(date, user) {
    const day = api.getDay();
    if (api.getUser() !== user || !user || api.getRole() === 'staff') throw Error('Manager access required');
    if (!api.dateMatches(date, day.date, select('#epDate')?.value) || api.getWork()?.date !== date)
      throw Error('Business date changed — draft retained. Reopen its original date.');
    if (api.getBusy() || !api.getReady() || day.closed || day.v37Deleted)
      throw Error('Wait for an open, synchronized business date.');
  }

  function quickEntry(host, customer, initialKind = 'credit') {
    host.querySelector('.v94r-quick')?.remove();
    const date = api.getDay().date;
    const user = api.getUser();
    const draftKey = api.key('v94r-quick', date, customer.ref || customer.n);
    const draft = api.read(draftKey) || {};
    let vehicle = null;
    let kind = initialKind;
    let saving = false;
    const box = document.createElement('section');
    box.className = 'v94r-quick v33-form';
    box.dataset.date = date;
    box.innerHTML = `<b>${api.esc(customer.n)} · ${api.esc(date)}</b>
      <div class="v94r-chips" data-kind></div>
      <label>Select account / vehicle — خود منتخب کریں</label><div class="v94r-chips" data-vehicles></div>
      <label>Amount / رقم<input data-amount type="number" min="0.01" step="0.01"></label>
      <div data-recovery><label>Recovery method / وصولی کا ذریعہ<select data-account></select></label>
      <label data-recipient-label><span></span><input data-recipient></label>
      <label>Reference / حوالہ<input data-reference></label></div>
      <label>Particulars / تفصیل<input data-details></label>
      <div class="v94r-preview" aria-live="polite"></div>
      <div class="v33-actions"><button type="button" class="alt" data-cancel>Close / بند کریں</button>
      <button type="button" class="gold" data-save>Confirm & Save / تصدیق اور محفوظ</button></div>
      <small role="status"></small>`;
    const query = selector => box.querySelector(selector);
    const amount = query('[data-amount]');
    amount.value = draft.amount || '';
    query('[data-details]').value = draft.details || '';
    const accounts = api.accounts();
    query('[data-account]').innerHTML = accounts.map(account => `<option value="${api.esc(account.id)}">${api.esc(account.title)}</option>`).join('');
    query('[data-account]').value = accounts.some(account => account.id === draft.account) ? draft.account : 'cash';
    query('[data-recipient]').value = draft.recipient || '';
    query('[data-reference]').value = draft.reference || '';
    function currentCustomer() {
      return api.getMeta().cu.find(item => customer.ref ? item.ref === customer.ref : item.n === customer.n);
    }
    function preview() {
      const current = currentCustomer() || customer;
      const recovery = kind === 'pay';
      const account = query('[data-account]').value;
      query('[data-recovery]').hidden = !recovery;
      query('[data-recipient-label]').hidden = !api.special(account);
      query('[data-recipient-label] span').textContent = api.recipientLabel(account);
      const pending = api.pending().filter(entry => entry.c === customer.n && entry.v === vehicle && entry.d === date && !api.getMeta().lg.some(saved => saved.ref === entry.ref));
      const balance = vehicle === null ? null : api.totals(current, vehicle, date).b + pending.reduce((sum, entry) => sum + (entry.k === 'credit' ? 1 : -1) * entry.a, 0);
      const closing = balance === null ? null : balance + (recovery ? -1 : 1) * (Number(amount.value) || 0);
      query('.v94r-preview').textContent = `${customer.n}\n${vehicle === null ? 'No vehicle/account selected / انتخاب باقی ہے' : vehicle || 'Customer Khata / کسٹمر کھاتہ'} · ${date}\n${recovery ? 'Recovery / وصولی' : 'Credit Sale / ادھار'}: ${api.fmt(Number(amount.value) || 0)}\n${closing === null ? '' : (closing < 0 ? 'To Pay / دینا ہے: ' : 'To Receive / لینا ہے: ') + api.fmt(Math.abs(closing))}`;
      query('[data-save]').disabled = saving || vehicle === null || !api.validAmount(amount.value) || !!current.archived;
      if (!saving) api.write(draftKey, {amount: amount.value, details: query('[data-details]').value, account,
        recipient: query('[data-recipient]').value, reference: query('[data-reference]').value, kind});
    }
    function choices() {
      query('[data-kind]').replaceChildren();
      for (const [value, label] of [['credit', 'Credit Sale / ادھار'], ['pay', 'Recovery / وصولی']]) {
        const button = document.createElement('button');
        button.type = 'button'; button.className = 'alt'; button.textContent = label;
        button.setAttribute('aria-pressed', String(kind === value));
        button.onclick = () => {if (saving) return; kind = value; vehicle = null; choices(); preview();};
        query('[data-kind]').append(button);
      }
      query('[data-vehicles]').replaceChildren();
      const current = currentCustomer() || customer;
      for (const value of ['', ...api.vehicles(current)]) {
        const button = document.createElement('button');
        button.type = 'button'; button.className = 'alt';
        button.textContent = (vehicle === value ? '✓ ' : '') + (value || 'Customer Khata / کسٹمر کھاتہ');
        button.setAttribute('aria-pressed', String(vehicle === value));
        button.disabled = saving || kind === 'credit' && (current.inactiveVehicles || []).includes(value);
        button.onclick = () => {vehicle = value; choices(); preview();};
        query('[data-vehicles]').append(button);
      }
    }
    box.addEventListener('input', preview);
    query('[data-account]').onchange = () => {query('[data-recipient]').value = ''; preview();};
    query('[data-cancel]').onclick = () => {if (!saving) box.remove();};
    query('[data-save]').onclick = async () => {
      if (saving) return;
      try {
        ready(date, user);
        const current = currentCustomer();
        if (!current || current.archived || vehicle === null || !api.validAmount(amount.value)) throw Error('Select a valid customer, account/vehicle and amount.');
        if (kind === 'pay') api.recoveryInfo(query('[data-account]').value, query('[data-recipient]').value, query('[data-reference]').value);
        if (!confirm(query('.v94r-preview').textContent + '\nSave this entry? / محفوظ کریں؟')) return;
        ready(date, user);
        saving = true;
        const entry = api.queue(current, vehicle, kind, amount.value, query('[data-account]').value,
          query('[data-details]').value, query('[data-recipient]').value, query('[data-reference]').value);
        amount.value = ''; vehicle = null;
        for (const selector of ['[data-details]', '[data-recipient]', '[data-reference]']) query(selector).value = '';
        api.write(draftKey, null);
        choices(); preview();
        query('[role=status]').textContent = 'Saved on device — pending sync / سنک باقی ہے';
        await api.flush();
        if (box.isConnected) query('[role=status]').textContent = api.getMeta().lg.some(saved => saved.ref === entry.ref && api.equal(saved, entry))
          ? 'Saved & server verified / محفوظ اور تصدیق شدہ' : 'Pending sync — do not re-enter / دوبارہ اندراج نہ کریں';
      } catch (error) {query('[role=status]').textContent = error.message;}
      finally {saving = false; if (box.isConnected) {choices(); preview();}}
    };
    host.append(box); choices(); preview();
    box.scrollIntoView({block: 'nearest'});
    return box;
  }

  function customerTabs(host, mode) {
    host.dataset.v94rCustomer = 'true';
    for (const control of host.querySelectorAll('.v5-mode,.v4modes')) control.style.setProperty('display', 'none', 'important');
    host.querySelector('.v94r-tabs')?.remove();
    const navigation = document.createElement('div');
    navigation.className = 'v94r-tabs'; navigation.setAttribute('aria-label', 'Customer sections');
    navigation.setAttribute('role', 'tablist');
    for (const [value, label] of tabs) {
      const button = document.createElement('button');
      button.type = 'button'; button.className = 'alt'; button.textContent = label;
      button.setAttribute('role', 'tab'); button.setAttribute('aria-selected', String(value === mode || mode === 'v94saved' && value === 'customeradd'));
      button.onclick = () => {api.clearAuto(); api.openGroup('customer', value, api.getDay().date);};
      navigation.append(button);
    }
    host.firstElementChild.after(navigation);
  }

  function dailyView(workspace) {
    api.showEntry('Customers / گاہک', api.epDate() + '<div class="v94r-daily"></div>');
    api.epBindDate(() => {});
    const host = api.entryPage.querySelector('.ep');
    customerTabs(host, workspace.mode); api.toolbar(host, 'customer');
    const target = host.querySelector('.v94r-daily');
    let signature = '';
    const update = () => {
      if (!target.isConnected) return;
      const date = api.getDay().date;
      const data = dailyTransactions(api.getMeta().lg || [], date);
      const pending = api.pending().filter(entry => entry.d === date && !data.rows.some(saved => saved.ref === entry.ref));
      const next = JSON.stringify([date, data, pending]);
      if (signature !== next) {
        signature = next;
        target.innerHTML = `<h3>${api.esc(date)}</h3><p>Credit Sale / ادھار: <b data-credit-total>${api.fmt(data.credit)}</b> · Recovery / وصولی: <b data-recovery-total>${api.fmt(data.recovery)}</b></p>
          <p>Opening balances excluded / ابتدائی بقایا شامل نہیں · ${pending.length} pending sync</p>
          <table><thead><tr><th>Customer / گاہک</th><th>Vehicle / گاڑی</th><th>Credit / ادھار</th><th>Recovery / وصولی</th><th>Particulars / تفصیل</th></tr></thead><tbody>${data.rows.map(entry => `<tr><td>${api.esc(entry.c)}</td><td>${api.esc(entry.v || 'Customer Khata')}</td><td>${entry.k === 'credit' ? api.fmt(entry.a) : '—'}</td><td>${entry.k === 'pay' ? api.fmt(entry.a) : '—'}</td><td>${api.esc([entry.method, entry.details, entry.remarks, entry.recipient, entry.reference].filter(Boolean).join(' · '))}</td></tr>`).join('') || '<tr><td colspan="5">No saved transactions / کوئی لین دین نہیں</td></tr>'}</tbody></table>`;
      }
      setTimeout(update, 800);
    };
    update();
  }

  function decorateList(host) {
    for (const form of host.querySelectorAll('.v33-form:not(.v94r-quick):not(.v77-picker)')) {
      if (form.dataset.v94rDate) continue;
      const date = api.getDay().date, user = api.getUser();
      form.dataset.v94rDate = date;
      const save = [...form.querySelectorAll('button')].find(button => button.textContent === 'Save');
      if (!save) continue;
      const preview = document.createElement('div'); preview.className = 'v94r-preview'; save.parentElement.before(preview);
      const update = () => {
        const draft = api.read(api.key('inline', date, 'customer'))?.form;
        if (draft) preview.textContent = `${draft.customer}\n${draft.vehicle || 'Customer Khata / کسٹمر کھاتہ'} · ${date}\n${draft.kind === 'credit' ? 'Credit Sale / ادھار' : 'Recovery / وصولی'}: ${api.fmt(Number(draft.amount) || 0)}`;
      };
      form.addEventListener('input', update); form.addEventListener('change', update); update();
      const original = save.onclick;
      save.onclick = () => {
        try {ready(date, user); update(); if (confirm(preview.textContent + '\nSave this entry?')) original();}
        catch (error) {api.notice(error.message, true);}
      };
    }
    for (const card of host.querySelectorAll('.v33-card')) {
      if (!card.querySelector(':scope > .v94r-entry')) {
        const name = card.querySelector('.v35-name b')?.textContent.slice(2);
        const customer = api.getMeta().cu.find(item => item.n === name);
        if (!customer) continue;
        const button = document.createElement('button');
        button.className = 'alt v94r-entry'; button.type = 'button'; button.textContent = '+ Entry / اندراج';
        button.disabled = !!customer.archived;
        button.onclick = () => quickEntry(card, customer);
        card.querySelector('.v33-summary').after(button);
      }
    }
    for (const dropdown of host.querySelectorAll('.v77-picker select:not([data-v94r-chips])')) {
      dropdown.dataset.v94rChips = 'true'; dropdown.hidden = true;
      dropdown.style.setProperty('display', 'none', 'important');
      const chips = document.createElement('div'); chips.className = 'v94r-chips';
      for (const option of dropdown.options) {
        if (!option.value) continue;
        const button = document.createElement('button'); button.type = 'button'; button.className = 'alt';
        const selected = dropdown.value === option.value;
        button.textContent = (selected ? '✓ ' : '') + option.textContent.replace('Opening Balance / ابتدائی بقایا', 'Customer Khata / کسٹمر کھاتہ');
        button.setAttribute('aria-pressed', String(selected));
        button.onclick = () => {dropdown.value = option.value; dropdown.onchange?.();};
        chips.append(button);
      }
      dropdown.after(chips);
    }
    for (const option of host.querySelectorAll('[aria-label="Opening balance type"] option')) {
      const text = option.value === '-1' ? 'To Pay (−) — دینا ہے' : 'To Receive (+) — لینا ہے';
      if (option.textContent !== text) option.textContent = text;
    }
    for (const label of host.querySelectorAll('.v33-total > b:first-child')) {
      if (label.textContent === 'Receivable / لینا ہے') label.textContent = 'To Receive / لینا ہے';
      if (label.textContent === 'Advance / دینا ہے') label.textContent = 'To Pay / دینا ہے';
    }
  }

  function enhanceCreation(host, workspace) {
    const save = select('#epSave');
    if (!save) return;
    const original = save.onclick;
    const info = document.createElement('p');
    info.className = 'v4-note';
    info.textContent = 'Name required; mobile and vehicle optional. Save customer first, then add same-day Credit Sale / Recovery here. Opening balance is not a daily sale. / پہلے گاہک محفوظ کریں، پھر اسی جگہ ادھار یا وصولی درج کریں۔';
    save.before(info);
    const preview = document.createElement('div'); preview.className = 'v94r-preview'; save.before(preview);
    const update = () => {
      const opening = Number(select('#v43CustomerOpening')?.value) || 0;
      const allocated = [...host.querySelectorAll('input[id^="v71Amount"]')].reduce((sum, input) => sum + (Number(input.value) || 0), 0);
      const total = Math.round((opening + allocated) * 100) / 100;
      preview.textContent = `${api.getDay().date} · ${total < 0 ? 'To Pay / دینا ہے' : 'To Receive / لینا ہے'}: ${api.fmt(Math.abs(total))}\nOpening / closing before transactions; daily credit: 0, recovery: 0`;
    };
    host.addEventListener('input', update); host.addEventListener('change', update); update();
    save.onclick = async () => {
      const date = api.getDay().date, user = api.getUser();
      const name = select('#epNewName')?.value.trim();
      const oldRefs = new Set(api.getMeta().cu.map(customer => customer.ref));
      try {ready(date, user);} catch (error) {api.notice(error.message, true); return;}
      await original();
      const created = api.getMeta().cu.find(customer => customer.n === name && !oldRefs.has(customer.ref) && customer.createdBusinessDate === date);
      if (!created || api.getUser() !== user || api.getDay().date !== date || api.getWork() !== workspace) return;
      api.clearAuto();
      workspace.mode = 'v94saved';
      api.write(api.key('v94r-saved', date, 'customer'), {ref: created.ref});
      showSaved(workspace);
      api.clean(workspace);
    };
  }

  function showSaved(workspace) {
    const saved = api.read(api.key('v94r-saved', workspace.date, 'customer'));
    const customer = api.getMeta().cu.find(item => item.ref === saved?.ref);
    api.showEntry('Customer Saved / گاہک محفوظ', api.epDate() + '<div class="v94r-saved"></div>');
    api.epBindDate(() => {});
    const host = api.entryPage.querySelector('.ep'); customerTabs(host, 'v94saved');
    const summary = host.querySelector('.v94r-saved');
    summary.textContent = customer ? `${customer.n} — Customer saved & verified. Add Credit Sale or Recovery below; each is a separate transaction. / گاہک محفوظ ہے، اب لین دین درج کریں۔` : 'Open All Customers to select a saved customer.';
    if (customer) quickEntry(host, customer);
    const another = document.createElement('button'); another.type = 'button'; another.className = 'alt';
    another.textContent = '+ Another Customer / مزید گاہک';
    another.onclick = () => api.openGroup('customer', 'customeradd', api.getDay().date); host.append(another);
  }

  let observer;
  api.wrapRender((workspace, original) => {
    observer?.disconnect();
    if (workspace.group === 'customer' && workspace.mode === 'v94daily') {dailyView(workspace); return;}
    if (workspace.group === 'customer' && workspace.mode === 'v94saved') {showSaved(workspace); return;}
    original();
    if (workspace.group !== 'customer' || api.getRole() === 'staff') return;
    const host = api.entryPage.querySelector('.ep');
    if (!host) return;
    customerTabs(host, workspace.mode);
    if (workspace.mode === 'customeradd') enhanceCreation(host, workspace);
    const decorate = () => {
      observer?.disconnect(); decorateList(host);
      if (host.isConnected) observer.observe(host, {childList: true, subtree: true});
    };
    observer = new MutationObserver(decorate); decorate();
  });
}

import { DEFAULT_WORK_PROFILE, getLocalDateKey, getPontoFieldIssues, normalizeWorkProfile, parseMinutes, formatMinutesToHM, formatMinutesToTime, calculateSummary, validateTimeSegments, validateWorkProfile } from '../../shared/js/time_core.js';
import { mountWorkProfileForm } from '../../shared/js/work_profile_ui.js';
export { validateTimeSegments };

let historyData = [];
let lastComplianceKey = null;
const DRAFT_STORAGE_KEY = 'ponto_current_draft';
const WORK_PROFILE_STORAGE_KEY = 'ponto_work_profile_v1';
let workProfile = normalizeWorkProfile(DEFAULT_WORK_PROFILE);

export function loadWorkProfile() {
  try {
    const rawProfile = localStorage.getItem(WORK_PROFILE_STORAGE_KEY);
    if (!rawProfile) {
      workProfile = normalizeWorkProfile(DEFAULT_WORK_PROFILE);
      return workProfile;
    }

    const parsed = JSON.parse(rawProfile);
    const validation = validateWorkProfile(parsed);
    workProfile = validation.valid ? normalizeWorkProfile(parsed) : normalizeWorkProfile(DEFAULT_WORK_PROFILE);
  } catch (error) {
    console.warn('Não foi possível recuperar o perfil de jornada.', error);
    workProfile = normalizeWorkProfile(DEFAULT_WORK_PROFILE);
  }

  return workProfile;
}

export function getWorkProfile() {
  return workProfile;
}

export function saveWorkProfile(profile) {
  const validation = validateWorkProfile(profile);
  if (!validation.valid) return validation;

  const normalized = normalizeWorkProfile(profile);
  try {
    localStorage.setItem(WORK_PROFILE_STORAGE_KEY, JSON.stringify(normalized));
  } catch (error) {
    return { valid: false, errors: ['Não foi possível salvar as configurações neste armazenamento.'] };
  }

  workProfile = normalized;
  return { valid: true, profile: workProfile, errors: [] };
}

export function loadHistory() {
  historyData = JSON.parse(localStorage.getItem('ponto_history') || '[]');
  return historyData;
}

export function getHistoryData() {
  return historyData;
}

export function findHistoryItem(date) {
  return historyData.find(item => item.date === date);
}

export function saveHistoryItem({ date, entry1, exit1, entry2, exit2, workProfile: selectedProfile = workProfile }) {
  const profile = normalizeWorkProfile(selectedProfile);
  const summary = calculateSummary({ entry1, exit1, entry2, exit2, workProfile: profile });
  if (!summary.validation.valid) return summary.validation;

  const { workedMinutes: worked, balanceMinutes: balance } = summary;
  const item = { date, e1: entry1, s1: exit1, e2: entry2, s2: exit2, worked, balance, workProfile: profile };

  historyData.unshift(item);
  localStorage.setItem('ponto_history', JSON.stringify(historyData));
  return { valid: true, item };
}

export function deleteHistoryItem(index) {
  if (!confirm('Tem certeza que deseja excluir este registro do histórico?')) {
    return false;
  }

  historyData.splice(index, 1);
  localStorage.setItem('ponto_history', JSON.stringify(historyData));
  return true;
}

export function exportHistoryCSV(filenamePrefix = 'historico_ponto') {
  if (historyData.length === 0) {
    return { valid: false, message: 'Sem histórico para exportar.' };
  }

  let csv = 'Data,Entrada1,Saida1,Entrada2,Saida2,Trabalhado_Minutos,Saldo_Minutos\n';
  historyData.forEach(h => {
    csv += `${h.date},${h.e1},${h.s1},${h.e2},${h.s2},${h.worked},${h.balance}\n`;
  });

  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filenamePrefix}_${getLocalDateKey()}.csv`;
  a.click();
  URL.revokeObjectURL(url);

  return { valid: true };
}

const ids = {
  targetWorkHours: 'input-target-work-hours',
  entry1: 'input-entrada-manha',
  exit1: 'input-saida-almoco',
  entry2: 'input-volta-almoco',
  exit2: 'input-saida-tarde',
  historyCount: 'history-count',
  historyTableBody: 'history-table-body',
  historyEmptyMsg: 'history-empty-msg',
  btnEntry1: 'btn-entrada',
  btnExit1: 'btn-almoco',
  btnEntry2: 'btn-volta',
  btnSave: 'btn-salvar',
  btnHistory: 'btn-history',
  btnExport: 'btn-export',
  btnClear: 'btn-limpar'
};

const el = (id) => document.getElementById(id);
const getValue = (id) => {
  const element = el(id);
  return element ? element.value : '';
};

const DEFAULT_LUNCH_DURATION_MINUTES = 60; // 1 hora de almoço
const DEFAULT_MORNING_SHIFT_MINUTES = 4 * 60; // 4 horas de turno da manhã

function updateInputSuggestions(entry1, exit1, entry2, targetMinutes) {
  const entry1Input = el(ids.entry1);
  const exit1Input = el(ids.exit1);
  const entry2Input = el(ids.entry2);
  const exit2Input = el(ids.exit2);

  if (exit1Input) exit1Input.placeholder = 'Automático';
  if (entry2Input) entry2Input.placeholder = 'Automático';
  if (exit2Input) exit2Input.placeholder = 'Automático';

  const e1m = parseMinutes(entry1);
  const s1m = parseMinutes(exit1);
  const e2m = parseMinutes(entry2);

  if (e1m !== null && exit1Input && !exit1Input.value) {
    exit1Input.placeholder = formatMinutesToTime(e1m + DEFAULT_MORNING_SHIFT_MINUTES);
  }
  if (s1m !== null && entry2Input && !entry2Input.value) {
    entry2Input.placeholder = formatMinutesToTime(s1m + DEFAULT_LUNCH_DURATION_MINUTES);
  }
  if (e1m !== null && s1m !== null && e2m !== null && exit2Input && !exit2Input.value) {
    const morningWorked = s1m - e1m;
    const remainingWork = targetMinutes - morningWorked;
    if (remainingWork > 0) {
      exit2Input.placeholder = formatMinutesToTime(e2m + remainingWork);
    } else {
      exit2Input.placeholder = 'Meta atingida';
    }
  }
}

function updateComplianceUI(compliance) {
  const box = el('compliance-box');
  const statusEl = el('compliance-status');
  const msgList = el('compliance-messages');
  if (!box || !statusEl || !msgList) return;

  // calculateTime roda a cada segundo. Não recrie os elementos se o
  // resultado não mudou, pois isso reinicia a animação msg-in continuamente.
  const complianceKey = JSON.stringify(compliance);
  if (complianceKey === lastComplianceKey) return;
  lastComplianceKey = complianceKey;

  msgList.innerHTML = '';

  if (compliance.isConforme) {
    box.className = 'compliance-box bg-emerald-950/40 border border-emerald-800 text-emerald-300';
    statusEl.innerHTML = '<svg class="compliance-icon is-valid" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12 4 4L19 6"/><circle cx="12" cy="12" r="10"/></svg> Dentro do Perfil Configurado';
    box.classList.remove('hidden');
  } else {
    box.className = 'compliance-box bg-rose-950/40 border border-rose-800 text-rose-300';
    const missingPunches = compliance.messages.some(message => message.startsWith('Faltam marcações obrigatórias'));
    const status = missingPunches ? 'Aguardando as quatro batidas' : 'Fora do Perfil Configurado';
    statusEl.innerHTML = `<svg class="compliance-icon is-invalid" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4m0 4h.01"/></svg> ${status}`;
    compliance.messages.forEach(msg => {
      const li = document.createElement('li');
      li.textContent = msg;
      msgList.appendChild(li);
    });
    box.classList.remove('hidden');
  }
}
function calculateTime() {
  const entry1 = getValue(ids.entry1);
  const exit1 = getValue(ids.exit1);
  const entry2 = getValue(ids.entry2);
  const exit2 = getValue(ids.exit2);
  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const summary = calculateSummary({ entry1, exit1, entry2, exit2, workProfile, nowMinutes });

  const balanceEl = el('hours-balance');
  const workedEl = el('worked-time-text');
  const remainingEl = el('remaining-time-text');
  const progressBar = el('progress-bar');
  const historyCountEl = el(ids.historyCount);
  if (balanceEl) balanceEl.innerText = formatMinutesToHM(summary.balanceMinutes);
  if (workedEl) workedEl.innerText = formatMinutesToHM(summary.workedMinutes);
  if (remainingEl) remainingEl.innerText = formatMinutesToHM(summary.remainingMinutes);
  if (progressBar) {
    progressBar.style.width = `${summary.progressPct}%`;
    progressBar.parentElement.setAttribute('aria-valuenow', String(summary.progressPct));
  }
  if (historyCountEl) historyCountEl.innerText = `${getHistoryData().length} registro(s)`;

  updateComplianceUI(summary.compliance);
  updateFieldIssues(getPontoFieldIssues({ entry1, exit1, entry2, exit2, workProfile }));
  updateInputSuggestions(entry1, exit1, entry2, summary.targetMinutes);
}

function updateFieldIssues(issues) {
  ['entry1', 'exit1', 'entry2', 'exit2'].forEach((key) => {
    const input = el(ids[key]);
    if (!input) return;
    const messages = issues[key];
    const invalid = messages.length > 0;
    input.classList.toggle('field-invalid', invalid);
    input.setAttribute('aria-invalid', String(invalid));
    input.title = messages.join(' ');
  });
}

function startLiveTimer() {
  if (window.timerInterval) clearInterval(window.timerInterval);
  window.timerInterval = setInterval(calculateTime, 1000);
}

function fillCurrentTime(inputId) {
  const now = new Date();
  const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const input = el(inputId);
  if (input) input.value = timeStr;
  saveDraft();
  calculateTime();
  showToast('Horário atual registrado!');
}

function clearTodayInputs() {
  [ids.entry1, ids.exit1, ids.entry2, ids.exit2].forEach((id) => {
    const input = el(id);
    if (input) input.value = '';
  });
  saveDraft();
  calculateTime();
  showToast('Campos limpos com sucesso.');
}

function saveTodayEntry() {
  const dateStr = getLocalDateKey();
  const entry1 = getValue(ids.entry1);
  const exit1 = getValue(ids.exit1);
  const entry2 = getValue(ids.entry2);
  const exit2 = getValue(ids.exit2);
  const result = saveHistoryItem({ date: dateStr, entry1, exit1, entry2, exit2, workProfile });
  if (!result.valid) {
    showToast(result.message);
    return;
  }

  renderHistoryTable();
  showToast('Registro do dia salvo no histórico!');
}

function renderHistoryTable() {
  const historyData = getHistoryData();
  const tbody = el(ids.historyTableBody);
  const emptyMsg = el(ids.historyEmptyMsg);
  if (!tbody || !emptyMsg) return;

  tbody.innerHTML = '';

  if (historyData.length === 0) {
    emptyMsg.classList.remove('hidden');
    return;
  }

  emptyMsg.classList.add('hidden');

  historyData.forEach((item, idx) => {
    const tr = document.createElement('tr');
    tr.className = 'hover:bg-slate-800/40 transition border-b border-slate-800';
    tr.innerHTML = `
      <td class="p-3 font-medium text-white">${item.date}</td>
      <td class="p-3">${item.e1 || '--'}</td>
      <td class="p-3">${item.s1 || '--'}</td>
      <td class="p-3">${item.e2 || '--'}</td>
      <td class="p-3">${item.s2 || '--'}</td>
      <td class="p-3">${formatMinutesToHM(item.worked)}</td>
      <td class="p-3 text-right">
        <button type="button" class="delete-row-btn text-rose-400 hover:text-rose-300 p-1" data-index="${idx}" title="Excluir">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h16M10 4h4m-8 3 1 14h10l1-14M10 11v6m4-6v6"/></svg>
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function handleHistoryDelete(index) {
  const removed = deleteHistoryItem(index);
  if (removed) {
    renderHistoryTable();
    showToast('Item excluído.');
  }
}

function exportHistoryFile() {
  const result = exportHistoryCSV();
  if (!result.valid) {
    showToast(result.message);
    return;
  }
  showToast('Arquivo CSV baixado!');
}

function openWebHistory() {
  const historyUrl = 'https://azevedowba.github.io/pontocerto/?view=history';
  if (typeof chrome !== 'undefined' && chrome.tabs?.create) {
    chrome.tabs.create({ url: historyUrl });
    return;
  }
  window.open(historyUrl, '_blank', 'noopener');
}

function showToast(message) {
  const container = el('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerHTML = `<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M12 11v5m0-8h.01"/></svg><span>${message}</span>`;
  container.appendChild(toast);

  requestAnimationFrame(() => {
    toast.classList.add('toast-show');
  });

  setTimeout(() => {
    toast.classList.remove('toast-show');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

function bindEvents() {
  const entry1Button = el(ids.btnEntry1);
  const exit1Button = el(ids.btnExit1);
  const entry2Button = el(ids.btnEntry2);
  const saveButton = el(ids.btnSave);
  const historyButton = el(ids.btnHistory);
  const settingsButton = el('btn-settings-toggle');
  const settingsPanel = el('work-profile-panel');
  const exportButton = el(ids.btnExport);
  const clearButton = el(ids.btnClear);
  const historyTable = el(ids.historyTableBody);

  if (entry1Button) entry1Button.addEventListener('click', () => fillCurrentTime(ids.entry1));
  if (exit1Button) exit1Button.addEventListener('click', () => fillCurrentTime(ids.exit1));
  if (entry2Button) entry2Button.addEventListener('click', () => fillCurrentTime(ids.entry2));
  if (saveButton) saveButton.addEventListener('click', saveTodayEntry);
  if (historyButton) historyButton.addEventListener('click', openWebHistory);
  if (settingsButton && settingsPanel) {
    settingsButton.addEventListener('click', () => {
      const isOpening = settingsPanel.classList.contains('hidden');
      settingsPanel.classList.toggle('hidden', !isOpening);
      settingsButton.setAttribute('aria-expanded', String(isOpening));
      if (isOpening) {
        settingsPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  }
  if (exportButton) exportButton.addEventListener('click', exportHistoryFile);
  if (clearButton) clearButton.addEventListener('click', clearTodayInputs);

  if (historyTable) {
    historyTable.addEventListener('click', (event) => {
      const button = event.target.closest('.delete-row-btn');
      if (!button) return;
      const index = Number(button.dataset.index);
      if (!Number.isNaN(index)) handleHistoryDelete(index);
    });
  }

  ['targetWorkHours', 'entry1', 'exit1', 'entry2', 'exit2'].forEach((key) => {
    const input = el(ids[key]);
    if (input) {
      input.addEventListener('input', () => {
        calculateTime();
        saveDraft();
      });
    }
  });
}

function saveDraft() {
  const draft = {
    date: getLocalDateKey(),
    targetWorkHours: getValue(ids.targetWorkHours),
    entry1: getValue(ids.entry1),
    exit1: getValue(ids.exit1),
    entry2: getValue(ids.entry2),
    exit2: getValue(ids.exit2)
  };

  try {
    localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));
  } catch (error) {
    console.warn('Não foi possível salvar o rascunho do ponto.', error);
  }
}

function loadDraft() {
  try {
    const rawDraft = localStorage.getItem(DRAFT_STORAGE_KEY);
    if (!rawDraft) return null;

    const draft = JSON.parse(rawDraft);
    if (!draft || draft.date !== getLocalDateKey()) return null;
    return draft;
  } catch (error) {
    console.warn('Não foi possível recuperar o rascunho do ponto.', error);
    return null;
  }
}

function initializeInputs() {
  if (el(ids.targetWorkHours)) el(ids.targetWorkHours).value = formatMinutesToTime(workProfile.targetMinutes);
  const draft = loadDraft();
  if (draft) {
    if (el(ids.entry1)) el(ids.entry1).value = draft.entry1 || '';
    if (el(ids.exit1)) el(ids.exit1).value = draft.exit1 || '';
    if (el(ids.entry2)) el(ids.entry2).value = draft.entry2 || '';
    if (el(ids.exit2)) el(ids.exit2).value = draft.exit2 || '';
    return;
  }

  const todayStr = getLocalDateKey();
  const saved = findHistoryItem(todayStr);
  if (saved) {
    if (el(ids.entry1)) el(ids.entry1).value = saved.e1 || '';
    if (el(ids.exit1)) el(ids.exit1).value = saved.s1 || '';
    if (el(ids.entry2)) el(ids.entry2).value = saved.e2 || '';
    if (el(ids.exit2)) el(ids.exit2).value = saved.s2 || '';
  } else {
    if (el(ids.entry1)) el(ids.entry1).value = '08:00';
    if (el(ids.exit1)) el(ids.exit1).value = '12:00';
    if (el(ids.entry2)) el(ids.entry2).value = '13:00';
  }
}

function initPopup() {
  // app_logic.js também é importado pela página web para reutilizar o histórico.
  // Inicialize a interface e o timer somente no documento do popup.
  if (!el('compliance-box')) return;

  loadWorkProfile();
  loadHistory();
  initializeInputs();
  calculateTime();
  renderHistoryTable();
  bindEvents();
  mountWorkProfileForm(el('work-profile-form-container'), {
    profile: workProfile,
    onSave: saveWorkProfile,
    onSaved: (profile) => {
    workProfile = profile;
    if (el(ids.targetWorkHours)) el(ids.targetWorkHours).value = formatMinutesToTime(profile.targetMinutes);
    calculateTime();
    }
  });
  startLiveTimer();
}

document.addEventListener('DOMContentLoaded', initPopup);


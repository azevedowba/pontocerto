import { parseMinutes, formatMinutesToHM, formatMinutesToTime, calculateSummary } from '../../shared/js/time_core.js';

let historyData = [];

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

export function validateTimeSegments({ entry1, exit1, entry2, exit2 }) {
  const e1 = parseMinutes(entry1);
  const s1 = parseMinutes(exit1);
  const e2 = parseMinutes(entry2);
  const s2 = parseMinutes(exit2);

  if (e1 !== null && s1 !== null && s1 <= e1) {
    return { valid: false, message: 'Saída da manhã deve ser após entrada da manhã.' };
  }
  if (e2 !== null && s1 !== null && e2 < s1) {
    return { valid: false, message: 'Volta do almoço deve ser após saída do almoço.' };
  }
  if (s2 !== null && e2 !== null && s2 <= e2) {
    return { valid: false, message: 'Saída da tarde deve ser após volta do almoço.' };
  }
  return { valid: true, message: '' };
}

export function saveHistoryItem({ date, entry1, exit1, entry2, exit2, targetWorkHours = '08:10' }) {
  const validation = validateTimeSegments({ entry1, exit1, entry2, exit2 });
  if (!validation.valid) {
    return validation;
  }

  const targetMinutes = parseMinutes(targetWorkHours) || (8 * 60 + 10);
  const e1m = parseMinutes(entry1);
  const s1m = parseMinutes(exit1);
  const e2m = parseMinutes(entry2);
  const s2m = parseMinutes(exit2);

  let worked = 0;
  if (e1m !== null && s1m !== null && s1m > e1m) worked += (s1m - e1m);
  if (e2m !== null && s2m !== null && s2m > e2m) worked += (s2m - e2m);

  const balance = worked - targetMinutes;
  const item = { date, e1: entry1, s1: exit1, e2: entry2, s2: exit2, worked, balance };

  const existingIndex = historyData.findIndex(h => h.date === date);
  if (existingIndex >= 0) {
    historyData[existingIndex] = item;
  } else {
    historyData.unshift(item);
  }

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
  a.download = `${filenamePrefix}_${new Date().toISOString().split('T')[0]}.csv`;
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

  msgList.innerHTML = '';

  if (compliance.isConforme) {
    box.className = 'compliance-box bg-emerald-950/40 border border-emerald-800 text-emerald-300';
    statusEl.innerHTML = `<i class="fa-solid fa-circle-check text-emerald-400"></i> Dia Conforme com as Regras`;
    box.classList.remove('hidden');
  } else {
    box.className = 'compliance-box bg-rose-950/40 border border-rose-800 text-rose-300';
    statusEl.innerHTML = `<i class="fa-solid fa-triangle-exclamation text-rose-400"></i> Dia Não Conforme`;
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
  const targetWorkHours = getValue(ids.targetWorkHours) || '08:10';

  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const summary = calculateSummary({ entry1, exit1, entry2, exit2, targetWorkHours, nowMinutes });

  const balanceEl = el('hours-balance');
  const historyCountEl = el(ids.historyCount);
  if (balanceEl) balanceEl.innerText = formatMinutesToHM(summary.balanceMinutes);
  if (historyCountEl) historyCountEl.innerText = `${getHistoryData().length} registro(s)`;

  updateComplianceUI(summary.compliance);
  updateInputSuggestions(entry1, exit1, entry2, summary.targetMinutes);
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
  calculateTime();
  showToast('Horário atual registrado!');
}

function clearTodayInputs() {
  [ids.entry1, ids.exit1, ids.entry2, ids.exit2].forEach((id) => {
    const input = el(id);
    if (input) input.value = '';
  });
  calculateTime();
  showToast('Campos limpos com sucesso.');
}

function saveTodayEntry() {
  const dateStr = new Date().toISOString().split('T')[0];
  const entry1 = getValue(ids.entry1);
  const exit1 = getValue(ids.exit1);
  const entry2 = getValue(ids.entry2);
  const exit2 = getValue(ids.exit2);
  const targetWorkHours = getValue(ids.targetWorkHours) || '08:10';

  const result = saveHistoryItem({ date: dateStr, entry1, exit1, entry2, exit2, targetWorkHours });
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
          <i class="fa-solid fa-trash"></i>
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

function showToast(message) {
  const container = el('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerHTML = `<i class="fa-solid fa-circle-info toast-icon"></i><span>${message}</span>`;
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
  const exportButton = el(ids.btnExport);
  const clearButton = el(ids.btnClear);
  const historyTable = el(ids.historyTableBody);

  if (entry1Button) entry1Button.addEventListener('click', () => fillCurrentTime(ids.entry1));
  if (exit1Button) exit1Button.addEventListener('click', () => fillCurrentTime(ids.exit1));
  if (entry2Button) entry2Button.addEventListener('click', () => fillCurrentTime(ids.entry2));
  if (saveButton) saveButton.addEventListener('click', saveTodayEntry);
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
      input.addEventListener('input', calculateTime);
    }
  });
}

function initializeInputs() {
  const todayStr = new Date().toISOString().split('T')[0];
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
  loadHistory();
  initializeInputs();
  calculateTime();
  renderHistoryTable();
  bindEvents();
  startLiveTimer();
}

document.addEventListener('DOMContentLoaded', initPopup);


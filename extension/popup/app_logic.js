import { parseMinutes, formatMinutesToHM } from '../../shared/js/time_core.js';

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

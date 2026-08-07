const DEFAULT_TARGET_MINUTES = 8 * 60 + 10;

export function parseMinutes(timeStr) {
    if (!timeStr) return null;
    const [h, m] = timeStr.split(':').map(Number);
    if (Number.isNaN(h) || Number.isNaN(m)) return null;
    return h * 60 + m;
}

export function formatMinutesToHM(minutes) {
    const h = Math.floor(Math.abs(minutes) / 60);
    const m = Math.abs(minutes) % 60;
    const sign = minutes < 0 ? '-' : '';
    return `${sign}${String(h).padStart(2, '0')}h ${String(m).padStart(2, '0')}m`;
}

export function formatMinutesToTime(minutes) {
    const normalized = ((minutes % 1440) + 1440) % 1440;
    const h = Math.floor(normalized / 60);
    const m = normalized % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
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

export function getShiftMinutes({ entry, exit }) {
    const start = parseMinutes(entry);
    const end = parseMinutes(exit);
    return start !== null && end !== null && end > start ? end - start : 0;
}

export function calculateWorkedMinutes({ entry1, exit1, entry2, exit2, nowMinutes = null }) {
    const shift1 = getShiftMinutes({ entry: entry1, exit: exit1 });
    const shift2 = getShiftMinutes({ entry: entry2, exit: exit2 });
    let total = shift1 + shift2;

    const e1 = parseMinutes(entry1);
    const e2 = parseMinutes(entry2);

    if (nowMinutes !== null && shift1 === 0 && e1 !== null && parseMinutes(exit1) === null && nowMinutes > e1) {
        total += nowMinutes - e1;
    }
    if (nowMinutes !== null && shift2 === 0 && e2 !== null && parseMinutes(exit2) === null && nowMinutes > e2) {
        total += nowMinutes - e2;
    }

    return total;
}

export function calculateTargetExit({ entry1, exit1, entry2, targetMinutes = DEFAULT_TARGET_MINUTES }) {
    const e1 = parseMinutes(entry1);
    const s1 = parseMinutes(exit1);
    const e2 = parseMinutes(entry2);

    if (e1 === null || s1 === null || e2 === null || s1 <= e1) {
        return null;
    }

    const morningWorked = s1 - e1;
    const remaining = Math.max(0, targetMinutes - morningWorked);

    if (remaining === 0) {
        return { label: 'Meta atingida', minutes: e2 };
    }

    return { label: formatMinutesToTime(e2 + remaining), minutes: e2 + remaining };
}

export function calculateBalance(workedMinutes, targetMinutes = DEFAULT_TARGET_MINUTES) {
    return workedMinutes - targetMinutes;
}

export function calculateSummary({ entry1, exit1, entry2, exit2, targetWorkHours = '08:10', nowMinutes = null }) {
    const targetMinutes = parseMinutes(targetWorkHours) || DEFAULT_TARGET_MINUTES;
    const validation = validateTimeSegments({ entry1, exit1, entry2, exit2 });
    const workedMinutes = calculateWorkedMinutes({ entry1, exit1, entry2, exit2, nowMinutes });
    const balanceMinutes = calculateBalance(workedMinutes, targetMinutes);
    const remainingMinutes = Math.max(0, targetMinutes - workedMinutes);
    const targetExit = calculateTargetExit({ entry1, exit1, entry2, targetMinutes });
    const progressPct = targetMinutes > 0 ? Math.min(100, Math.max(0, Math.round((workedMinutes / targetMinutes) * 100))) : 0;
    const hoursDecimal = (remainingMinutes / 60).toFixed(2);

    return {
        validation,
        targetMinutes,
        workedMinutes,
        balanceMinutes,
        remainingMinutes,
        targetExit,
        progressPct,
        hoursDecimal
    };
}

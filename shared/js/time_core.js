const DEFAULT_TARGET_MINUTES = 8 * 60;

// Constantes para Horários e Durações (em minutos)
const MIN_ENTRY_FLEX_MINUTES = 7 * 60; // 07:00
const MAX_ENTRY_FLEX_MINUTES = 9 * 60; // 09:00

const CORE1_START_MINUTES = 9 * 60; // 09:00
const CORE1_END_MINUTES = 11 * 60 + 30; // 11:30

const CORE2_START_MINUTES = 14 * 60; // 14:00
const CORE2_END_MINUTES = 17 * 60; // 17:00

const MIN_EXIT_FLEX_MINUTES = 17 * 60; // 17:00
const MAX_EXIT_FLEX_MINUTES = 19 * 60; // 19:00

const MIN_LUNCH_DURATION_MINUTES = 30; // 30 minutos
const MAX_LUNCH_DURATION_MINUTES = 2 * 60 + 30; // 2 horas e 30 minutos

const MIN_SHIFT_DURATION_MINUTES = 3 * 60; // 3 horas
const MAX_SHIFT_DURATION_MINUTES = 5 * 60; // 5 horas

const DAILY_WORK_TOLERANCE_MINUTES = 10; // Tolerância de 10 minutos adicionais para jornada diária

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
    const compliance = validatePontoCompliance({ entry1, exit1, entry2, exit2, targetWorkHours });
    const workedMinutes = calculateWorkedMinutes({ entry1, exit1, entry2, exit2, nowMinutes });
    const balanceMinutes = calculateBalance(workedMinutes, targetMinutes);
    const remainingMinutes = Math.max(0, targetMinutes - workedMinutes);
    const targetExit = calculateTargetExit({ entry1, exit1, entry2, targetMinutes });
    const progressPct = targetMinutes > 0 ? Math.min(100, Math.max(0, Math.round((workedMinutes / targetMinutes) * 100))) : 0;
    const hoursDecimal = (remainingMinutes / 60).toFixed(2);

    return {
        validation,
        compliance,
        targetMinutes,
        workedMinutes,
        balanceMinutes,
        remainingMinutes,
        targetExit,
        progressPct,
        hoursDecimal
    };
}

export function validatePontoCompliance({ entry1, exit1, entry2, exit2, targetWorkHours = '08:10' }) {
    const messages = [];
    const e1 = parseMinutes(entry1);
    const s1 = parseMinutes(exit1);
    const e2 = parseMinutes(entry2);
    const s2 = parseMinutes(exit2);
    const targetMinutes = parseMinutes(targetWorkHours) || DEFAULT_TARGET_MINUTES;

    // 1. No mínimo 4 marcações completas
    if (e1 === null || s1 === null || e2 === null || s2 === null) {
        return {
            isConforme: false,
            messages: ['Faltam marcações obrigatórias (são necessárias as 4 marcações: Entrada, Saída Almoço, Volta Almoço, Saída Tarde).']
        };
    }

    // 2. Sequência lógica
    const seqValidation = validateTimeSegments({ entry1, exit1, entry2, exit2 });
    if (!seqValidation.valid) {
        messages.push(seqValidation.message);
    }

    // 3. Horário Flexível de Entrada e Saída
    if (e1 < MIN_ENTRY_FLEX_MINUTES || e1 > MAX_ENTRY_FLEX_MINUTES) {
        messages.push('Entrada fora da janela flexível (07:00 às 09:00).');
    }
    if (s2 < MIN_EXIT_FLEX_MINUTES || s2 > MAX_EXIT_FLEX_MINUTES) {
        messages.push('Saída fora da janela flexível (17:00 às 19:00).');
    }

    // 4. Intervalo de Almoço (30 min a 2h30)
    const lunchDuration = e2 - s1;
    if (lunchDuration < MIN_LUNCH_DURATION_MINUTES) {
        messages.push('Intervalo de almoço menor que o mínimo de 30 minutos.');
    }
    if (lunchDuration > MAX_LUNCH_DURATION_MINUTES) {
        messages.push('Intervalo de almoço maior que o máximo de 2h30.');
    }

    // 5. Horário Núcleo (Presença obrigatória: 09:00-11:30 e 14:00-17:00)
    if (e1 > CORE1_START_MINUTES) {
        messages.push('Funcionário ausente no início do horário núcleo 1 (09:00).');
    }
    if (s1 < CORE1_END_MINUTES) {
        messages.push('Saída para o almoço antes do término do horário núcleo 1 (11:30).');
    }
    if (e2 > CORE2_START_MINUTES) {
        messages.push('Retorno do almoço após o início do horário núcleo 2 (14:00).');
    }
    if (s2 < CORE2_END_MINUTES) {
        messages.push('Saída antes do término do horário núcleo 2 (17:00).');
    }

    // 6. Jornada Mínima/Máxima por Turno (3h a 5h)
    const shift1 = s1 - e1;
    if (shift1 < MIN_SHIFT_DURATION_MINUTES || shift1 > MAX_SHIFT_DURATION_MINUTES) {
        messages.push('Turno da manhã fora da duração permitida (3h a 5h).');
    }
    const shift2 = s2 - e2;
    if (shift2 < MIN_SHIFT_DURATION_MINUTES || shift2 > MAX_SHIFT_DURATION_MINUTES) {
        messages.push('Turno da tarde fora da duração permitida (3h a 5h).');
    }

            // 7. Jornada diária conforme as regras do regulamento flexível:
    // Mínimo de 08h00 de trabalho (jornada base) e tolerância de até 10 minutos adicionais (máximo de 08h10).
    const workedMinutes = shift1 + shift2;
    const baseContractMinutes = 8 * 60; // 08:00
    const maxConformeMinutes = baseContractMinutes + DAILY_WORK_TOLERANCE_MINUTES; // 08:10

    if (workedMinutes < baseContractMinutes) {
        messages.push('Jornada diária incompleta (abaixo de 08:00).');
    }
    if (workedMinutes > maxConformeMinutes) {
        messages.push('Jornada diária excede o limite permitido para o dia ser considerado conforme (máximo de 08:10).');
    }

    return {
        isConforme: messages.length === 0,
        messages
    };
}


// Meta padrão exibida pela web e pela extensão.
export const DEFAULT_TARGET_WORK_HOURS = '08:00';
const DEFAULT_TARGET_MINUTES = 8 * 60;

export const DEFAULT_WORK_PROFILE = Object.freeze({
    schemaVersion: 1,
    name: 'Perfil inicial',
    targetMinutes: DEFAULT_TARGET_MINUTES,
    rules: {
        entryWindow: { enabled: true, start: 7 * 60, end: 9 * 60 },
        exitWindow: { enabled: true, start: 17 * 60, end: 19 * 60 },
        corePeriods: {
            enabled: true,
            periods: [
                { start: 9 * 60, end: 11 * 60 + 30 },
                { start: 14 * 60, end: 17 * 60 }
            ]
        },
        lunchDuration: { enabled: true, minMinutes: 30, maxMinutes: 150 },
        shiftDuration: { enabled: true, minMinutes: 180, maxMinutes: 300 },
        overtimeTolerance: { enabled: true, minutes: 10 }
    }
});

function copyDefaultWorkProfile() {
    return {
        schemaVersion: DEFAULT_WORK_PROFILE.schemaVersion,
        name: DEFAULT_WORK_PROFILE.name,
        targetMinutes: DEFAULT_WORK_PROFILE.targetMinutes,
        rules: {
            entryWindow: { ...DEFAULT_WORK_PROFILE.rules.entryWindow },
            exitWindow: { ...DEFAULT_WORK_PROFILE.rules.exitWindow },
            corePeriods: {
                enabled: DEFAULT_WORK_PROFILE.rules.corePeriods.enabled,
                periods: DEFAULT_WORK_PROFILE.rules.corePeriods.periods.map(period => ({ ...period }))
            },
            lunchDuration: { ...DEFAULT_WORK_PROFILE.rules.lunchDuration },
            shiftDuration: { ...DEFAULT_WORK_PROFILE.rules.shiftDuration },
            overtimeTolerance: { ...DEFAULT_WORK_PROFILE.rules.overtimeTolerance }
        }
    };
}

function normalizeInteger(value, fallback, min, max) {
    const number = Number(value);
    return Number.isInteger(number) && number >= min && number <= max ? number : fallback;
}

function normalizeEnabled(value, fallback) {
    return typeof value === 'boolean' ? value : fallback;
}

export function normalizeWorkProfile(profile) {
    const defaults = copyDefaultWorkProfile();
    if (!profile || typeof profile !== 'object') return defaults;

    const inputRules = profile.rules && typeof profile.rules === 'object' ? profile.rules : {};
    const normalizeWindow = (key) => {
        const value = inputRules[key] || {};
        return {
            enabled: normalizeEnabled(value.enabled, defaults.rules[key].enabled),
            start: normalizeInteger(value.start, defaults.rules[key].start, 0, 1439),
            end: normalizeInteger(value.end, defaults.rules[key].end, 1, 1440)
        };
    };
    const coreInput = inputRules.corePeriods || {};
    const corePeriods = Array.isArray(coreInput.periods) ? coreInput.periods : [];

    return {
        schemaVersion: 1,
        name: typeof profile.name === 'string' && profile.name.trim() ? profile.name.trim().slice(0, 60) : defaults.name,
        targetMinutes: normalizeInteger(profile.targetMinutes, defaults.targetMinutes, 1, 1439),
        rules: {
            entryWindow: normalizeWindow('entryWindow'),
            exitWindow: normalizeWindow('exitWindow'),
            corePeriods: {
                enabled: normalizeEnabled(coreInput.enabled, defaults.rules.corePeriods.enabled),
                periods: defaults.rules.corePeriods.periods.map((defaultPeriod, index) => {
                    const period = corePeriods[index] || {};
                    return {
                        start: normalizeInteger(period.start, defaultPeriod.start, 0, 1439),
                        end: normalizeInteger(period.end, defaultPeriod.end, 1, 1440)
                    };
                })
            },
            lunchDuration: {
                enabled: normalizeEnabled(inputRules.lunchDuration?.enabled, defaults.rules.lunchDuration.enabled),
                minMinutes: normalizeInteger(inputRules.lunchDuration?.minMinutes, defaults.rules.lunchDuration.minMinutes, 0, 720),
                maxMinutes: normalizeInteger(inputRules.lunchDuration?.maxMinutes, defaults.rules.lunchDuration.maxMinutes, 1, 720)
            },
            shiftDuration: {
                enabled: normalizeEnabled(inputRules.shiftDuration?.enabled, defaults.rules.shiftDuration.enabled),
                minMinutes: normalizeInteger(inputRules.shiftDuration?.minMinutes, defaults.rules.shiftDuration.minMinutes, 1, 720),
                maxMinutes: normalizeInteger(inputRules.shiftDuration?.maxMinutes, defaults.rules.shiftDuration.maxMinutes, 1, 720)
            },
            overtimeTolerance: {
                enabled: normalizeEnabled(inputRules.overtimeTolerance?.enabled, defaults.rules.overtimeTolerance.enabled),
                minutes: normalizeInteger(inputRules.overtimeTolerance?.minutes, defaults.rules.overtimeTolerance.minutes, 0, 240)
            }
        }
    };
}

export function validateWorkProfile(profile) {
    const errors = [];
    if (!profile || typeof profile !== 'object') {
        return { valid: false, errors: ['Perfil de jornada inválido.'] };
    }
    if (typeof profile.name !== 'string' || !profile.name.trim() || profile.name.trim().length > 60) {
        errors.push('Informe um nome para o perfil com até 60 caracteres.');
    }

    const rules = profile.rules || {};
    const validateWindow = (rule, label) => {
        if (rule?.enabled && (!Number.isInteger(rule.start) || !Number.isInteger(rule.end) || rule.start < 0 || rule.end > 1440 || rule.start >= rule.end)) {
            errors.push(`A faixa de ${label} precisa ter início anterior ao fim.`);
        }
    };
    validateWindow(rules.entryWindow, 'entrada');
    validateWindow(rules.exitWindow, 'saída');

    if (!Number.isInteger(profile.targetMinutes) || profile.targetMinutes < 1 || profile.targetMinutes > 1439) {
        errors.push('A meta diária precisa estar entre 00:01 e 23:59.');
    }
    if (rules.corePeriods?.enabled) {
        if (!Array.isArray(rules.corePeriods.periods) || rules.corePeriods.periods.length !== 2 || rules.corePeriods.periods.some(period => !Number.isInteger(period.start) || !Number.isInteger(period.end) || period.start < 0 || period.end > 1440 || period.start >= period.end)) {
            errors.push('Informe início e fim válidos para os dois períodos núcleo.');
        } else if (rules.corePeriods.periods[0].end > rules.corePeriods.periods[1].start) {
            errors.push('O período núcleo da manhã deve terminar antes do início do período da tarde.');
        }
    }
    for (const [key, label] of [['lunchDuration', 'intervalo de almoço'], ['shiftDuration', 'duração dos turnos']]) {
        const rule = rules[key];
        const minimumAllowed = key === 'shiftDuration' ? 1 : 0;
        if (rule?.enabled && (!Number.isInteger(rule.minMinutes) || !Number.isInteger(rule.maxMinutes) || rule.minMinutes < minimumAllowed || rule.maxMinutes > 720 || rule.minMinutes >= rule.maxMinutes)) {
            errors.push(`Os limites de ${label} são inválidos: o mínimo deve ser menor que o máximo.`);
        }
    }
    const tolerance = rules.overtimeTolerance;
    if (tolerance?.enabled && (!Number.isInteger(tolerance.minutes) || tolerance.minutes < 0 || tolerance.minutes > 240)) {
        errors.push('A tolerância diária deve estar entre 0 e 240 minutos.');
    }
    if (tolerance?.enabled && Number.isInteger(profile.targetMinutes) && Number.isInteger(tolerance.minutes) && profile.targetMinutes + tolerance.minutes > 1439) {
        errors.push('A meta somada à tolerância não pode ultrapassar 23:59.');
    }

    return { valid: errors.length === 0, errors };
}

export function getLocalDateKey(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

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

function formatDurationForRule(minutes) {
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    if (hours === 0) return `${minutes} minutos`;
    return `${hours}h${remainingMinutes ? `${remainingMinutes}m` : ''}`;
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

function resolveWorkProfile(workProfile, targetWorkHours) {
    const profile = normalizeWorkProfile(workProfile);
    const targetFromInput = parseMinutes(targetWorkHours);
    if (targetFromInput !== null && targetFromInput > 0) {
        profile.targetMinutes = targetFromInput;
    }
    return profile;
}

export function getPontoFieldIssues({ entry1, exit1, entry2, exit2, workProfile = DEFAULT_WORK_PROFILE, targetWorkHours = null }) {
    const issues = { entry1: [], exit1: [], entry2: [], exit2: [] };
    const addIssue = (fields, message) => {
        fields.forEach(field => issues[field].push(message));
    };
    const profile = resolveWorkProfile(workProfile, targetWorkHours);
    const { rules } = profile;
    const e1 = parseMinutes(entry1);
    const s1 = parseMinutes(exit1);
    const e2 = parseMinutes(entry2);
    const s2 = parseMinutes(exit2);

    if (e1 !== null && rules.entryWindow.enabled && (e1 < rules.entryWindow.start || e1 > rules.entryWindow.end)) {
        addIssue(['entry1'], `Entrada fora da janela flexível (${formatMinutesToTime(rules.entryWindow.start)} às ${formatMinutesToTime(rules.entryWindow.end)}).`);
    }
    if (s2 !== null && rules.exitWindow.enabled && (s2 < rules.exitWindow.start || s2 > rules.exitWindow.end)) {
        addIssue(['exit2'], `Saída fora da janela flexível (${formatMinutesToTime(rules.exitWindow.start)} às ${formatMinutesToTime(rules.exitWindow.end)}).`);
    }
    if (rules.corePeriods.enabled) {
        const [morningCore, afternoonCore] = rules.corePeriods.periods;
        if (e1 !== null && e1 > morningCore.start) {
            addIssue(['entry1'], `Entrada após o início do horário núcleo (${formatMinutesToTime(morningCore.start)}).`);
        }
        if (s1 !== null && s1 < morningCore.end) {
            addIssue(['exit1'], `Saída para o almoço antes do término do horário núcleo (${formatMinutesToTime(morningCore.end)}).`);
        }
        if (e2 !== null && e2 > afternoonCore.start) {
            addIssue(['entry2'], `Retorno do almoço após o início do horário núcleo (${formatMinutesToTime(afternoonCore.start)}).`);
        }
        if (s2 !== null && s2 < afternoonCore.end) {
            addIssue(['exit2'], `Saída antes do término do horário núcleo (${formatMinutesToTime(afternoonCore.end)}).`);
        }
    }

    if (e1 !== null && s1 !== null) {
        if (s1 <= e1) addIssue(['entry1', 'exit1'], 'Saída da manhã deve ser após entrada da manhã.');
        const morningDuration = s1 - e1;
        if (rules.shiftDuration.enabled && (morningDuration < rules.shiftDuration.minMinutes || morningDuration > rules.shiftDuration.maxMinutes)) {
            addIssue(['entry1', 'exit1'], `Turno da manhã fora da duração permitida (${formatDurationForRule(rules.shiftDuration.minMinutes)} a ${formatDurationForRule(rules.shiftDuration.maxMinutes)}).`);
        }
    }
    if (s1 !== null && e2 !== null) {
        if (e2 < s1) addIssue(['exit1', 'entry2'], 'Volta do almoço deve ser após saída do almoço.');
        const lunchDuration = e2 - s1;
        if (rules.lunchDuration.enabled && lunchDuration < rules.lunchDuration.minMinutes) {
            addIssue(['exit1', 'entry2'], `Intervalo de almoço menor que o mínimo de ${formatDurationForRule(rules.lunchDuration.minMinutes)}.`);
        } else if (rules.lunchDuration.enabled && lunchDuration > rules.lunchDuration.maxMinutes) {
            addIssue(['exit1', 'entry2'], `Intervalo de almoço maior que o máximo de ${formatDurationForRule(rules.lunchDuration.maxMinutes)}.`);
        }
    }
    if (e2 !== null && s2 !== null) {
        if (s2 <= e2) addIssue(['entry2', 'exit2'], 'Saída da tarde deve ser após volta do almoço.');
        const afternoonDuration = s2 - e2;
        if (rules.shiftDuration.enabled && (afternoonDuration < rules.shiftDuration.minMinutes || afternoonDuration > rules.shiftDuration.maxMinutes)) {
            addIssue(['entry2', 'exit2'], `Turno da tarde fora da duração permitida (${formatDurationForRule(rules.shiftDuration.minMinutes)} a ${formatDurationForRule(rules.shiftDuration.maxMinutes)}).`);
        }
    }
    if (e1 !== null && s1 !== null && e2 !== null && s2 !== null) {
        const workedMinutes = (s1 - e1) + (s2 - e2);
        if (workedMinutes < profile.targetMinutes) {
            addIssue(['exit1', 'exit2'], `Jornada diária incompleta (abaixo de ${formatMinutesToTime(profile.targetMinutes)}).`);
        }
        const tolerance = rules.overtimeTolerance.enabled ? rules.overtimeTolerance.minutes : 0;
        if (workedMinutes > profile.targetMinutes + tolerance) {
            addIssue(['exit1', 'exit2'], `Jornada diária excede o limite permitido para o perfil (máximo de ${formatMinutesToTime(profile.targetMinutes + tolerance)}).`);
        }
    }

    return issues;
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

export function calculateSummary({ entry1, exit1, entry2, exit2, targetWorkHours = null, workProfile = DEFAULT_WORK_PROFILE, nowMinutes = null }) {
    const profile = resolveWorkProfile(workProfile, targetWorkHours);
    const targetMinutes = profile.targetMinutes;
    const validation = validateTimeSegments({ entry1, exit1, entry2, exit2 });
    const compliance = validatePontoCompliance({ entry1, exit1, entry2, exit2, workProfile: profile });
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

export function validatePontoCompliance({ entry1, exit1, entry2, exit2, targetWorkHours = null, workProfile = DEFAULT_WORK_PROFILE }) {
    const e1 = parseMinutes(entry1);
    const s1 = parseMinutes(exit1);
    const e2 = parseMinutes(entry2);
    const s2 = parseMinutes(exit2);
    const profile = resolveWorkProfile(workProfile, targetWorkHours);

    if (e1 === null || s1 === null || e2 === null || s2 === null) {
        return {
            isConforme: false,
            messages: ['Faltam marcações obrigatórias (são necessárias as 4 marcações: Entrada, Saída Almoço, Volta Almoço, Saída Tarde).']
        };
    }

    const fieldIssues = getPontoFieldIssues({ entry1, exit1, entry2, exit2, workProfile: profile });
    const messages = [...new Set(Object.values(fieldIssues).flat())];

    return {
        isConforme: messages.length === 0,
        messages
    };
}


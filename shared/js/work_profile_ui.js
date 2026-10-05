import { formatMinutesToTime, parseMinutes, validateWorkProfile } from './time_core.js';

const WORK_PROFILE_FORM_MARKUP = `
  <form id="work-profile-form" class="work-profile-form">
    <div class="work-profile-grid">
      <fieldset class="work-profile-group">
        <legend>Perfil e jornada diária</legend>
        <label class="work-profile-field">Nome do perfil
          <input name="name" type="text" maxlength="60" required>
        </label>
        <label class="work-profile-field">Meta diária
          <input name="target" type="time" min="00:01" max="23:59" required>
        </label>
        <label class="work-profile-toggle"><input name="tolerance-enabled" type="checkbox"> Aplicar tolerância adicional</label>
        <label class="work-profile-field">Tolerância máxima (minutos)
          <input name="tolerance-minutes" type="number" min="0" max="240" step="1" required>
        </label>
      </fieldset>

      <fieldset class="work-profile-group">
        <legend>Faixas flexíveis</legend>
        <label class="work-profile-toggle"><input name="entry-enabled" type="checkbox"> Validar janela de entrada</label>
        <div class="work-profile-pair">
          <label class="work-profile-field">Entrada a partir de<input name="entry-start" type="time" required></label>
          <label class="work-profile-field">Entrada até<input name="entry-end" type="time" required></label>
        </div>
        <label class="work-profile-toggle"><input name="exit-enabled" type="checkbox"> Validar janela de saída</label>
        <div class="work-profile-pair">
          <label class="work-profile-field">Saída a partir de<input name="exit-start" type="time" required></label>
          <label class="work-profile-field">Saída até<input name="exit-end" type="time" required></label>
        </div>
      </fieldset>

      <fieldset class="work-profile-group">
        <legend>Horários núcleo</legend>
        <label class="work-profile-toggle"><input name="core-enabled" type="checkbox"> Validar presença nos períodos núcleo</label>
        <div class="work-profile-pair">
          <label class="work-profile-field">Período 1: início<input name="core1-start" type="time" required></label>
          <label class="work-profile-field">Período 1: fim<input name="core1-end" type="time" required></label>
        </div>
        <div class="work-profile-pair">
          <label class="work-profile-field">Período 2: início<input name="core2-start" type="time" required></label>
          <label class="work-profile-field">Período 2: fim<input name="core2-end" type="time" required></label>
        </div>
      </fieldset>

      <fieldset class="work-profile-group">
        <legend>Intervalo de almoço</legend>
        <label class="work-profile-toggle"><input name="lunch-enabled" type="checkbox"> Validar duração do intervalo</label>
        <div class="work-profile-pair">
          <label class="work-profile-field">Mínimo (minutos)<input name="lunch-min" type="number" min="0" max="720" step="1" required></label>
          <label class="work-profile-field">Máximo (minutos)<input name="lunch-max" type="number" min="1" max="720" step="1" required></label>
        </div>
      </fieldset>

      <fieldset class="work-profile-group">
        <legend>Duração dos turnos</legend>
        <label class="work-profile-toggle"><input name="shift-enabled" type="checkbox"> Validar duração de cada turno</label>
        <div class="work-profile-pair">
          <label class="work-profile-field">Mínimo (minutos)<input name="shift-min" type="number" min="1" max="720" step="1" required></label>
          <label class="work-profile-field">Máximo (minutos)<input name="shift-max" type="number" min="1" max="720" step="1" required></label>
        </div>
      </fieldset>
    </div>

    <p class="work-profile-note">O resultado indica aderência ao perfil configurado. Não é uma avaliação jurídica. As configurações são locais e ainda não sincronizam entre web e extensão.</p>
    <p class="work-profile-feedback" role="status" aria-live="polite"></p>
    <button class="work-profile-save" type="submit">Salvar configurações</button>
  </form>
`;

function getField(form, name) {
  return form.elements.namedItem(name);
}

function setValue(form, name, value) {
  const input = getField(form, name);
  if (input) input.value = value;
}

function setChecked(form, name, checked) {
  const input = getField(form, name);
  if (input) input.checked = checked;
}

function setRuleEnabled(form, checkboxName, fieldNames) {
  const checkbox = getField(form, checkboxName);
  fieldNames.forEach(name => {
    const input = getField(form, name);
    if (input) input.disabled = !checkbox.checked;
  });
}

function populateForm(form, profile) {
  setValue(form, 'name', profile.name);
  setValue(form, 'target', formatMinutesToTime(profile.targetMinutes));
  setChecked(form, 'tolerance-enabled', profile.rules.overtimeTolerance.enabled);
  setValue(form, 'tolerance-minutes', profile.rules.overtimeTolerance.minutes);
  setChecked(form, 'entry-enabled', profile.rules.entryWindow.enabled);
  setValue(form, 'entry-start', formatMinutesToTime(profile.rules.entryWindow.start));
  setValue(form, 'entry-end', formatMinutesToTime(profile.rules.entryWindow.end));
  setChecked(form, 'exit-enabled', profile.rules.exitWindow.enabled);
  setValue(form, 'exit-start', formatMinutesToTime(profile.rules.exitWindow.start));
  setValue(form, 'exit-end', formatMinutesToTime(profile.rules.exitWindow.end));
  setChecked(form, 'core-enabled', profile.rules.corePeriods.enabled);
  setValue(form, 'core1-start', formatMinutesToTime(profile.rules.corePeriods.periods[0].start));
  setValue(form, 'core1-end', formatMinutesToTime(profile.rules.corePeriods.periods[0].end));
  setValue(form, 'core2-start', formatMinutesToTime(profile.rules.corePeriods.periods[1].start));
  setValue(form, 'core2-end', formatMinutesToTime(profile.rules.corePeriods.periods[1].end));
  setChecked(form, 'lunch-enabled', profile.rules.lunchDuration.enabled);
  setValue(form, 'lunch-min', profile.rules.lunchDuration.minMinutes);
  setValue(form, 'lunch-max', profile.rules.lunchDuration.maxMinutes);
  setChecked(form, 'shift-enabled', profile.rules.shiftDuration.enabled);
  setValue(form, 'shift-min', profile.rules.shiftDuration.minMinutes);
  setValue(form, 'shift-max', profile.rules.shiftDuration.maxMinutes);

  setRuleEnabled(form, 'tolerance-enabled', ['tolerance-minutes']);
  setRuleEnabled(form, 'entry-enabled', ['entry-start', 'entry-end']);
  setRuleEnabled(form, 'exit-enabled', ['exit-start', 'exit-end']);
  setRuleEnabled(form, 'core-enabled', ['core1-start', 'core1-end', 'core2-start', 'core2-end']);
  setRuleEnabled(form, 'lunch-enabled', ['lunch-min', 'lunch-max']);
  setRuleEnabled(form, 'shift-enabled', ['shift-min', 'shift-max']);
}

function readForm(form) {
  const value = name => getField(form, name)?.value ?? '';
  const checked = name => Boolean(getField(form, name)?.checked);
  return {
    schemaVersion: 1,
    name: value('name').trim(),
    targetMinutes: parseMinutes(value('target')),
    rules: {
      entryWindow: { enabled: checked('entry-enabled'), start: parseMinutes(value('entry-start')), end: parseMinutes(value('entry-end')) },
      exitWindow: { enabled: checked('exit-enabled'), start: parseMinutes(value('exit-start')), end: parseMinutes(value('exit-end')) },
      corePeriods: {
        enabled: checked('core-enabled'),
        periods: [
          { start: parseMinutes(value('core1-start')), end: parseMinutes(value('core1-end')) },
          { start: parseMinutes(value('core2-start')), end: parseMinutes(value('core2-end')) }
        ]
      },
      lunchDuration: { enabled: checked('lunch-enabled'), minMinutes: Number(value('lunch-min')), maxMinutes: Number(value('lunch-max')) },
      shiftDuration: { enabled: checked('shift-enabled'), minMinutes: Number(value('shift-min')), maxMinutes: Number(value('shift-max')) },
      overtimeTolerance: { enabled: checked('tolerance-enabled'), minutes: Number(value('tolerance-minutes')) }
    }
  };
}

export function mountWorkProfileForm(container, { profile, onSave, onSaved = () => {} }) {
  if (!container) return;
  container.innerHTML = WORK_PROFILE_FORM_MARKUP;
  const form = container.querySelector('#work-profile-form');
  const feedback = form.querySelector('.work-profile-feedback');
  populateForm(form, profile);

  form.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
    checkbox.addEventListener('change', () => {
      const controls = {
        'tolerance-enabled': ['tolerance-minutes'],
        'entry-enabled': ['entry-start', 'entry-end'],
        'exit-enabled': ['exit-start', 'exit-end'],
        'core-enabled': ['core1-start', 'core1-end', 'core2-start', 'core2-end'],
        'lunch-enabled': ['lunch-min', 'lunch-max'],
        'shift-enabled': ['shift-min', 'shift-max']
      };
      setRuleEnabled(form, checkbox.name, controls[checkbox.name] || []);
    });
  });

  form.addEventListener('submit', event => {
    event.preventDefault();
    if (!form.reportValidity()) return;

    const nextProfile = readForm(form);
    const validation = validateWorkProfile(nextProfile);
    if (!validation.valid) {
      feedback.textContent = validation.errors.join(' ');
      feedback.className = 'work-profile-feedback is-error';
      return;
    }

    const result = onSave(nextProfile);
    if (!result?.valid) {
      feedback.textContent = result?.errors?.join(' ') || 'Não foi possível salvar o perfil.';
      feedback.className = 'work-profile-feedback is-error';
      return;
    }

    populateForm(form, result.profile);
    feedback.textContent = 'Perfil salvo neste ambiente.';
    feedback.className = 'work-profile-feedback is-success';
    onSaved(result.profile);
  });
}

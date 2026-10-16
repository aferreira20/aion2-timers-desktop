/*
 * UI translations (English / Brazilian Portuguese).
 * Static text uses data-i18n / data-i18n-ph / data-i18n-title attributes;
 * dynamic text calls t(key, vars).
 */

const STRINGS = {
  en: {
    server: 'Server', local: 'Local',
    tabUpcoming: 'Upcoming', tabOdyle: 'Odyle', tabTimers: 'Timers', tabSettings: 'Settings',
    hintUpcoming: 'Times shown in your local clock. Toggle the bell to mute an event.',
    noEvents: 'No events enabled.',
    mute: 'Mute', unmute: 'Unmute',
    timer: 'Timer',
    odyleTitle: 'Odyle Energy', odyleNext: 'Next +{gain}', odyleFullAt: 'Full at', odyleTimeToCap: 'Time to cap',
    odyleCurrent: 'Energy (before the +)', odylePh: 'e.g. 60',
    odyleBonus: 'From items (the +N)', odyleBonusPh: 'e.g. 810',
    odyleItems: '(+{n} from items)', odyleTotal: 'Total available',
    odyleNormal: 'Normal · 560', odyleMember: 'Membership · 840',
    aOdyleLate: 'Filled up {time}, while the app was closed. Spend it before regeneration is wasted.', odyleCap: 'Cap', odyleGain: 'Gain', odyleEvery: 'Every (min)',
    odyleNotify: 'Alert when full', odyleSet: 'Set energy', odyleSetBelow: 'Set your energy below', odyleFullNow: 'FULL — spend it!',
    odyleHint: '+15 every 3 h up to the cap: 560, or 840 with Membership (per character). Energy from items, shown in game as (+N), is kept apart: it does not regenerate and does not count toward the cap. Re-sync any time from the in-game values.',
    timerName: 'Name', timerNamePh: 'e.g. Spacetime Rift, boss respawn', timerMinutes: 'Minutes', timerRepeat: 'Repeat',
    timerStart: 'Start timer', noTimers: 'No custom timers yet.', timerDefaultName: '{min} min timer',
    restart: 'Restart', remove: 'Remove', done: 'done', finished: 'Finished', ends: 'Ends {when}',
    language: 'Language', langAuto: 'Automatic (system)',
    region: 'Server region',
    region_na_east: 'NA East', region_na_west: 'NA West', region_eu: 'Europe', region_sa: 'South America',
    region_asia: 'Asia', region_kr: 'Korea', region_tw: 'Taiwan',
    hintRegion: 'Global servers run events on the region’s local clock; daily and weekly resets are at 16:00 KST for everyone. Times are community-sourced (shugo.gg) — NCSOFT has not published them. Edit any event if your server differs.',
    confirmRegion: 'Switch region? Default event times will be replaced with that region’s schedule (your on/off choices and custom events are kept).',
    lasts: '{min} min', activeLeft: 'active · {time}', activeUntil: 'Running until {when}',
    warnBefore: 'Warn before (min)', alertAtStart: 'Also alert at start time',
    hintOffset: 'Check the in-game “Daily recharge in” tooltip: if the reset doesn’t match, adjust the offset.',
    alertsTitle: 'Alerts', overlayOn: 'Show alert over the game (overlay)',
    overlayCorner: 'Where the alert appears on screen', overlaySeconds: 'On screen (seconds)',
    soundOn: 'Play a chime', toastOn: 'Also send a Windows notification', autostartOn: 'Start with Windows (in the tray)',
    testAlert: 'Test alert',
    hintFullscreen: 'The overlay appears with the game in windowed or borderless mode. In exclusive full screen only the chime gets through.',
    pos_top_left: 'Top left', pos_top_center: 'Top center', pos_top_right: 'Top right',
    pos_bottom_left: 'Bottom left', pos_bottom_center: 'Bottom center', pos_bottom_right: 'Bottom right',
    eventsTitle: 'Scheduled events', eventsSub: '(server time)', addEvent: '+ Add event', restoreDefaults: 'Restore defaults',
    edit: 'Edit', enabled: 'Enabled',
    eName: 'Name', eCategory: 'Category', eType: 'Type', eWeekly: 'Fixed days / times', eInterval: 'Repeating interval',
    eTimes: 'Times (HH:MM, comma separated)', eFirstAt: 'First at (HH:MM)', eEvery: 'Every (min)', eNote: 'Note',
    save: 'Save', cancel: 'Cancel', delete: 'Delete',
    errWeekly: 'Pick at least one day and one valid HH:MM time.',
    errInterval: 'Enter a valid HH:MM start and an interval of at least 5 minutes.',
    confirmDelete: 'Delete "{name}"?',
    confirmRestore: 'Restore the default event list? Your custom events will be removed.',
    newEvent: 'New event', untitled: 'Untitled event', defaultCategory: 'Event', customCategory: 'Custom',
    today: 'Today', tomorrow: 'Tomorrow', now: 'now', daily: 'Daily',
    everyFrom: 'Every {every} min from {anchor}',
    days: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
    cat_Reset: 'Reset', 'cat_Abyss Boss': 'Abyss Boss', 'cat_PvP Event': 'PvP Event', cat_Custom: 'Custom',
    cat_Rift: 'Rift', cat_Siege: 'Siege', 'cat_Field Event': 'Field Event',
    eDuration: 'Duration (min, optional)',
    // Alerts
    aWarnTitle: '{name} in {min} min', aWarnBody: '{category} at {time}.{note}',
    aStartTitle: '{name} — now!', aStartBody: '{category}.{note}',
    aTimerRepeat: 'Restarting ({min} min)', aTimerDone: 'Timer finished',
    aOdyleTitle: 'Odyle Energy is full', aOdyleBody: 'Reached {cap}. Spend it before regeneration is wasted.',
    aTestTitle: 'Test alert', aTestBody: 'This is how AION 2 Timers will look over your game.',
    trayIn: '{name} in {time}', trayOpen: 'Open AION 2 Timers', trayTest: 'Test alert', trayQuit: 'Quit',
    names: {},
    notes: {
      'daily-reset': 'Duty Missions, Nightmare, event keys refill',
      'weekly-reset': 'Raids, Daily Dungeon (14), Abyss time, Ascension Trial wipe',
      'rift': 'Portal open for the first 10 min',
      'kaira': 'Appears at a random spot and leaves after 30 min',
      'artifact-siege': 'Abyss artifact battle',
      'siege-bosses': 'Lower: Tamasa, Kairah, Argo · Middle: Ducal, Marakha, Dramos',
      'nahma': 'Lower Reshanta + Enraged version in Middle Reshanta',
      'shugo': 'Field minigames',
      'invasion': 'Field invasion event',
      'kr-siege': 'Group 1 · Group 2 at 21:50 · Group 3 at 22:20',
      'kr-siege-bosses': 'Group 1 · Group 2 at 22:15 · Group 3 at 22:45',
      'kr-nahma': 'Group 1 · Group 2 at 22:30 · Group 3 at 23:00'
    }
  },
  'pt-BR': {
    server: 'Servidor', local: 'Local',
    tabUpcoming: 'Próximos', tabOdyle: 'Odyle', tabTimers: 'Timers', tabSettings: 'Ajustes',
    hintUpcoming: 'Horários no seu relógio local. Toque no sino para silenciar um evento.',
    noEvents: 'Nenhum evento ativo.',
    mute: 'Silenciar', unmute: 'Ativar som',
    timer: 'Timer',
    odyleTitle: 'Energia Odyle', odyleNext: 'Próximo +{gain}', odyleFullAt: 'Cheia em', odyleTimeToCap: 'Tempo até encher',
    odyleCurrent: 'Energia (antes do +)', odylePh: 'ex.: 60',
    odyleBonus: 'De itens (o +N)', odyleBonusPh: 'ex.: 810',
    odyleItems: '(+{n} de itens)', odyleTotal: 'Total disponível',
    odyleNormal: 'Normal · 560', odyleMember: 'Membership · 840',
    aOdyleLate: 'Encheu {time}, com o app fechado. Use antes de desperdiçar a regeneração.', odyleCap: 'Máximo', odyleGain: 'Ganho', odyleEvery: 'A cada (min)',
    odyleNotify: 'Avisar quando encher', odyleSet: 'Definir energia', odyleSetBelow: 'Informe sua energia abaixo', odyleFullNow: 'CHEIA — use agora!',
    odyleHint: '+15 a cada 3 h até o máximo: 560, ou 840 com Membership (por personagem). A energia de itens, que o jogo mostra como (+N), fica à parte: não regenera e não conta para o máximo. Ressincronize quando quiser com os valores do jogo.',
    timerName: 'Nome', timerNamePh: 'ex.: Fenda espaço-temporal, respawn de boss', timerMinutes: 'Minutos', timerRepeat: 'Repetir',
    timerStart: 'Iniciar timer', noTimers: 'Nenhum timer personalizado ainda.', timerDefaultName: 'Timer de {min} min',
    restart: 'Reiniciar', remove: 'Remover', done: 'fim', finished: 'Concluído', ends: 'Termina {when}',
    language: 'Idioma', langAuto: 'Automático (sistema)',
    region: 'Região do servidor',
    region_na_east: 'NA Leste', region_na_west: 'NA Oeste', region_eu: 'Europa', region_sa: 'América do Sul',
    region_asia: 'Ásia', region_kr: 'Coreia', region_tw: 'Taiwan',
    hintRegion: 'Nos servidores Global os eventos seguem o relógio local da região; os resets diário e semanal são às 16:00 KST para todos. Horários levantados pela comunidade (shugo.gg) — a NCSOFT não os publica. Edite qualquer evento se o seu servidor for diferente.',
    confirmRegion: 'Trocar de região? Os horários padrão dos eventos serão substituídos pelos da nova região (eventos ligados/desligados e personalizados são mantidos).',
    lasts: '{min} min', activeLeft: 'ativo · {time}', activeUntil: 'Em andamento até {when}',
    warnBefore: 'Avisar antes (min)', alertAtStart: 'Avisar também na hora do evento',
    hintOffset: 'Confira a dica “Daily recharge in” no jogo: se o reset não bater, ajuste o fuso.',
    alertsTitle: 'Alertas', overlayOn: 'Mostrar alerta por cima do jogo (overlay)',
    overlayCorner: 'Onde o alerta aparece na tela', overlaySeconds: 'Tempo na tela (segundos)',
    soundOn: 'Tocar um som', toastOn: 'Enviar também notificação do Windows', autostartOn: 'Iniciar com o Windows (na bandeja)',
    testAlert: 'Testar alerta',
    hintFullscreen: 'O overlay aparece com o jogo em janela ou tela cheia sem bordas. Em tela cheia exclusiva, só o som chega.',
    pos_top_left: 'Canto superior esquerdo', pos_top_center: 'Centro superior', pos_top_right: 'Canto superior direito',
    pos_bottom_left: 'Canto inferior esquerdo', pos_bottom_center: 'Centro inferior', pos_bottom_right: 'Canto inferior direito',
    eventsTitle: 'Eventos agendados', eventsSub: '(hora do servidor)', addEvent: '+ Adicionar evento', restoreDefaults: 'Restaurar padrão',
    edit: 'Editar', enabled: 'Ativo',
    eName: 'Nome', eCategory: 'Categoria', eType: 'Tipo', eWeekly: 'Dias / horários fixos', eInterval: 'Intervalo repetido',
    eTimes: 'Horários (HH:MM, separados por vírgula)', eFirstAt: 'Primeiro às (HH:MM)', eEvery: 'A cada (min)', eNote: 'Observação',
    save: 'Salvar', cancel: 'Cancelar', delete: 'Excluir',
    errWeekly: 'Escolha pelo menos um dia e um horário HH:MM válido.',
    errInterval: 'Informe um início HH:MM válido e um intervalo de pelo menos 5 minutos.',
    confirmDelete: 'Excluir "{name}"?',
    confirmRestore: 'Restaurar a lista padrão de eventos? Seus eventos personalizados serão removidos.',
    newEvent: 'Novo evento', untitled: 'Evento sem nome', defaultCategory: 'Evento', customCategory: 'Personalizado',
    today: 'Hoje', tomorrow: 'Amanhã', now: 'agora', daily: 'Diário',
    everyFrom: 'A cada {every} min a partir de {anchor}',
    days: ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'],
    cat_Reset: 'Reset', 'cat_Abyss Boss': 'Boss do Abismo', 'cat_PvP Event': 'Evento PvP', cat_Custom: 'Personalizado',
    cat_Rift: 'Fenda', cat_Siege: 'Cerco', 'cat_Field Event': 'Evento de campo',
    eDuration: 'Duração (min, opcional)',
    aWarnTitle: '{name} em {min} min', aWarnBody: '{category} às {time}.{note}',
    aStartTitle: '{name} — agora!', aStartBody: '{category}.{note}',
    aTimerRepeat: 'Reiniciando ({min} min)', aTimerDone: 'Timer concluído',
    aOdyleTitle: 'Energia Odyle cheia', aOdyleBody: 'Chegou a {cap}. Use antes de desperdiçar a regeneração.',
    aTestTitle: 'Alerta de teste', aTestBody: 'É assim que o AION 2 Timers vai aparecer sobre o jogo.',
    trayIn: '{name} em {time}', trayOpen: 'Abrir AION 2 Timers', trayTest: 'Testar alerta', trayQuit: 'Sair',
    // Names as shown by the Brazilian Portuguese game client.
    names: {
      kaira: 'Vigilante Kairah', nahma: 'Senhor Guardião Nahma',
      executors: 'Executores', 'artifact-siege': 'Cerco de Artefatos'
    },
    notes: {
      'daily-reset': 'Missões diárias, Nightmare e chaves de evento recarregam',
      'weekly-reset': 'Raids, Daily Dungeon (14), tempo de Abismo, Ascension Trial zera',
      'rift': 'Portal aberto nos primeiros 10 min',
      'kaira': 'Surge em um ponto aleatório e vai embora após 30 min',
      'artifact-siege': 'Batalha pelos artefatos do Abismo',
      'siege-bosses': 'Piso Inferior: Tamasa, Kairah, Argo · Piso Intermediário: Ducal, Marakha, Dramos',
      'nahma': 'Piso Inferior de Reshanta + versão Enraged no Piso Intermediário',
      'shugo': 'Minigames no mapa',
      'invasion': 'Evento de invasão no mapa',
      'kr-siege': 'Grupo 1 · Grupo 2 às 21:50 · Grupo 3 às 22:20',
      'kr-siege-bosses': 'Grupo 1 · Grupo 2 às 22:15 · Grupo 3 às 22:45',
      'kr-nahma': 'Grupo 1 · Grupo 2 às 22:30 · Grupo 3 às 23:00'
    }
  }
};

const LANGS = ['en', 'pt-BR'];
let LANG = 'en';

function resolveLang(pref) {
  if (LANGS.includes(pref)) return pref;
  const nav = (navigator.language || 'en').toLowerCase();
  return nav.startsWith('pt') ? 'pt-BR' : 'en';
}

function setLang(pref) {
  LANG = resolveLang(pref);
  document.documentElement.lang = LANG;
}

function t(key, vars) {
  let s = STRINGS[LANG][key];
  if (s === undefined) s = STRINGS.en[key];
  if (s === undefined) return key;
  if (typeof s !== 'string') return s;
  return vars ? s.replace(/\{(\w+)\}/g, (m, k) => (vars[k] !== undefined ? vars[k] : m)) : s;
}

const dayNames = () => t('days');
const catLabel = (c) => STRINGS[LANG]['cat_' + c] || c;

// Built-in events keep their English name in storage; show the translated one
// unless the user renamed the event.
function nameLabel(ev) {
  if (!ev.nameKey) return ev.name;
  const def = buildDefaultEvents('sa').find(d => d.nameKey === ev.nameKey);
  if (def && ev.name !== def.name) return ev.name;
  return STRINGS[LANG].names[ev.nameKey] || ev.name;
}

// A user-written note wins; otherwise the built-in note for the event, translated.
function noteLabel(ev) {
  if (ev.note) return ev.note;
  if (!ev.noteKey) return '';
  return STRINGS[LANG].notes[ev.noteKey] || STRINGS.en.notes[ev.noteKey] || '';
}

function applyI18n(root = document) {
  root.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n); });
  root.querySelectorAll('[data-i18n-ph]').forEach(el => { el.placeholder = t(el.dataset.i18nPh); });
  root.querySelectorAll('[data-i18n-title]').forEach(el => { el.title = t(el.dataset.i18nTitle); });
}

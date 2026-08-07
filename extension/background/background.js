console.log('Ponto Certo background service worker iniciado.');

chrome.runtime.onInstalled.addListener(() => {
    console.log('Ponto Certo extension instalada.');
});

chrome.alarms.onAlarm.addListener((alarm) => {
    console.log('Alarme disparado:', alarm.name);
});

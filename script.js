// Элементы UI
const UI = {
    topBar: document.getElementById('topBar'),
    stage: document.getElementById('stage'),
    dData: document.getElementById('displayData'),
    dImg: document.getElementById('displayImg'),
    history: document.getElementById('history'),
    status: document.getElementById('status'),
    btnVerify: document.getElementById('btnVerify'),
    modals: { set: document.getElementById('modalSettings'), rec: document.getElementById('modalRecall') },
    icons: { mode: document.getElementById('iconMode'), unq: document.getElementById('iconUnique'), auto: document.getElementById('iconAuto'), snd: document.getElementById('iconSound') }
};

// Состояние приложения
let S = {
    mode: 'numbers', 
    unique: false, 
    auto: null, 
    sound: false, 
    started: false,
    deck: [], 
    sessionSeq: [], 
    histView: [], 
    voices: [],
    prefs: { showHistory: true, showVerifyAlways: true }
};

// База Карт
const SUITS = { 'S':'♠', 'H':'♥', 'D':'♦', 'C':'♣' };
const VALS = { '2':'2','3':'3','4':'4','5':'5','6':'6','7':'7','8':'8','9':'9','0':'10','J':'В','Q':'Д','K':'К','A':'Т' };
let allCardCodes = [];

// Предзагрузка изображений
['S','H','D','C'].forEach(s => Object.keys(VALS).forEach(v => {
    allCardCodes.push(v+s);
    let img = new Image(); img.src = `https://deckofcardsapi.com/static/img/${v+s}.png`;
}));

// Инициализация звука
if ('speechSynthesis' in window) {
    window.speechSynthesis.onvoiceschanged = () => S.voices = window.speechSynthesis.getVoices();
}

function speak(text, isCard, num) {
    if (!S.sound || !('speechSynthesis' in window)) return;
    try {
        window.speechSynthesis.cancel();
        let phrase = text;
        if (text === "СТАРТ" || text === "ВСЁ") phrase = text === "ВСЁ" ? "Всё! Готово" : "Начинаем";
        else if (isCard) {
            const sv = {'S':'пик','H':'червей','D':'бубен','C':'треф'};
            const vv = {'2':'Двойка','3':'Тройка','4':'Четверка','5':'Пятерка','6':'Шестерка','7':'Семерка','8':'Восьмерка','9':'Девятка','0':'Десятка','J':'Валет','Q':'Дама','K':'Король','A':'Туз'};
            phrase = `${vv[text[0]]} ${sv[text[1]]}`;
        } else {
            if (text.startsWith('0') && text.length === 2 && num < 10 && num > 0) phrase = "Ноль " + num;
            else if (text === "00") phrase = "Ноль ноль";
            else if (text.length === 3 && text.startsWith('00')) phrase = "Ноль ноль " + parseInt(text);
            else if (text.length === 3 && text.startsWith('0')) phrase = "Ноль " + parseInt(text);
        }
        const ut = new SpeechSynthesisUtterance(phrase);
        ut.lang = 'ru-RU';
        const ruVoices = S.voices.filter(v => v.lang.startsWith('ru'));
        if(ruVoices.length > 0) {
            ut.voice = ruVoices.find(v => v.name.includes('Google') || v.name.includes('Premium')) || ruVoices[0];
        }
        window.speechSynthesis.speak(ut);
    } catch(e) {}
}

// Применение настроек интерфейса
window.updateUIPreferences = function() {
    S.prefs.showHistory = document.getElementById('chkHistory').checked;
    S.prefs.showVerifyAlways = document.getElementById('chkVerify').checked;
    
    if (S.prefs.showHistory) UI.history.classList.remove('hidden');
    else UI.history.classList.add('hidden');

    checkVerifyButtonVisibility();
}

function checkVerifyButtonVisibility(isFinished = false) {
    if (!S.started) {
        UI.btnVerify.classList.remove('visible');
        return;
    }
    // Если колода закончилась ИЛИ в настройках включено "всегда", то показываем
    if (isFinished || S.prefs.showVerifyAlways) {
        UI.btnVerify.classList.add('visible');
    } else {
        UI.btnVerify.classList.remove('visible');
    }
}

// Сборка колоды
function buildDeck() {
    S.deck = [];
    if (S.mode === 'numbers') {
        let min = parseInt(document.getElementById('inpMin').value) || 0;
        let max = parseInt(document.getElementById('inpMax').value) || 99;
        if (min > max) [min, max] = [max, min];
        for (let i = min; i <= max; i++) S.deck.push(i);
    } else {
        const sF = [];
        if(document.getElementById('cS').checked) sF.push('S');
        if(document.getElementById('cH').checked) sF.push('H');
        if(document.getElementById('cD').checked) sF.push('D');
        if(document.getElementById('cC').checked) sF.push('C');
        
        const rF = [];
        if(document.getElementById('rLow').checked) rF.push('2','3','4','5');
        if(document.getElementById('rMid').checked) rF.push('6','7','8','9','0');
        if(document.getElementById('rHigh').checked) rF.push('J','Q','K','A');

        S.deck = allCardCodes.filter(c => sF.includes(c[1]) && rF.includes(c[0]));
        if(S.deck.length === 0) {
            alert("Колода пуста! Включены настройки по умолчанию.");
            document.getElementById('cS').checked = true; document.getElementById('rLow').checked = true;
            buildDeck(); return;
        }
    }
    // Перемешивание
    for (let i = S.deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [S.deck[i], S.deck[j]] = [S.deck[j], S.deck[i]];
    }
}

// Сброс на стартовый экран
window.resetToStart = function() {
    if (S.auto) window.toggleAuto();
    S.started = false; S.sessionSeq = []; S.histView = [];
    UI.history.innerHTML = ''; 
    checkVerifyButtonVisibility();
    
    UI.dImg.style.display = 'none'; UI.dData.style.display = 'block';
    UI.dData.textContent = "СТАРТ"; UI.dData.className = 'start-text fade-in';
    updateStatus();
}

function updateStatus() {
    let txt = [];
    if (S.auto) txt.push("▶ АВТО");
    if (S.unique) txt.push(`ОСТАЛОСЬ: ${S.deck.length}`);
    else if (S.started) txt.push(`В ПАМЯТИ: ${S.sessionSeq.length}`); // Обновленный текст
    
    UI.status.textContent = txt.join(" | ");
    if (txt.length) UI.status.classList.add('visible');
    else UI.status.classList.remove('visible');
}

// Главная функция генерации
window.generate = function() {
    if (!S.started) { 
        S.started = true; 
        if (S.unique) buildDeck(); 
        checkVerifyButtonVisibility();
    }
    
    let item;
    if (S.unique) {
        if (S.deck.length === 0) { finishSequence(); return; }
        item = S.deck.pop();
    } else {
        if (S.mode === 'numbers') {
            let min = parseInt(document.getElementById('inpMin').value) || 0;
            let max = parseInt(document.getElementById('inpMax').value) || 99;
            if (min > max) [min, max] = [max, min];
            item = Math.floor(Math.random() * (max - min + 1)) + min;
        } else {
            buildDeck(); item = S.deck[Math.floor(Math.random() * S.deck.length)];
        }
    }
    drawItem(item);
}

function drawItem(item) {
    UI.dData.classList.remove('fade-in'); void UI.dData.offsetWidth;
    let histObj = { raw: item, text: '', isRed: false, isCard: S.mode === 'cards' };

    if (S.mode === 'numbers') {
        UI.dImg.style.display = 'none'; UI.dData.style.display = 'block';
        let max = parseInt(document.getElementById('inpMax').value) || 99;
        const txt = item.toString().padStart(max > 99 ? 3 : 2, '0');
        UI.dData.textContent = txt;
        UI.dData.className = txt.length > 2 ? 'small fade-in' : 'fade-in';
        histObj.text = txt; speak(txt, false, item);
    } else {
        UI.dData.style.display = 'none'; UI.dImg.style.display = 'block';
        UI.dImg.src = `https://deckofcardsapi.com/static/img/${item}.png`;
        histObj.text = `${VALS[item[0]]}${SUITS[item[1]]}`;
        histObj.isRed = ['H','D'].includes(item[1]);
        speak(item, true);
    }

    S.sessionSeq.push(histObj);
    S.histView.unshift(histObj);
    if (S.histView.length > 6) S.histView.pop();
    
    UI.history.innerHTML = '';
    S.histView.forEach((h, i) => {
        let el = document.createElement('div');
        el.className = 'hist-item' + (h.isRed ? ' red' : '');
        el.textContent = h.text;
        if(i>0) { el.style.transform = `scale(${1 - i*0.1})`; el.style.opacity = 0.5 - i*0.1; }
        UI.history.appendChild(el);
    });
    updateStatus();
}

function finishSequence() {
    if(S.auto) window.toggleAuto();
    UI.dImg.style.display = 'none'; UI.dData.style.display = 'block';
    UI.dData.textContent = "ВСЁ"; UI.dData.className = 'start-text fade-in';
    speak("ВСЁ"); 
    updateStatus();
    checkVerifyButtonVisibility(true); // Форсируем показ кнопки в конце
}

// UI Логика
window.toggleMenu = function() {
    UI.topBar.classList.toggle('visible');
    if(UI.topBar.classList.contains('visible')) {
        setTimeout(() => { 
            if (document.activeElement.tagName !== 'INPUT') UI.topBar.classList.remove('visible');
        }, 5000);
    }
}

window.toggleMode = function() {
    S.mode = S.mode === 'numbers' ? 'cards' : 'numbers';
    UI.icons.mode.textContent = S.mode === 'cards' ? '🃏' : '🔢';
    UI.icons.mode.classList.toggle('active', S.mode === 'cards');
    document.getElementById('setNumbers').style.display = S.mode === 'numbers' ? 'block' : 'none';
    document.getElementById('setCards').style.display = S.mode === 'cards' ? 'block' : 'none';
    
    // Авто-смена режима 🔀 для карт
    if (S.mode === 'cards' && !S.unique) window.toggleUnique();
    else if (S.mode === 'numbers' && S.unique) window.toggleUnique();
    
    window.resetToStart();
}

window.toggleUnique = function() {
    S.unique = !S.unique;
    UI.icons.unq.textContent = S.unique ? '🔀' : '♾️';
    UI.icons.unq.classList.toggle('active', S.unique);
    window.resetToStart();
}

window.toggleSound = function() {
    S.sound = !S.sound;
    UI.icons.snd.textContent = S.sound ? '🔊' : '🔇';
    UI.icons.snd.classList.toggle('active', S.sound);
    if(S.sound && S.voices.length === 0) window.speechSynthesis.getVoices();
}

window.toggleAuto = function() {
    if (S.auto) {
        clearInterval(S.auto); S.auto = null;
        UI.icons.auto.textContent = "▶️"; UI.icons.auto.classList.remove('active');
    } else {
        if (!S.started && S.unique && S.deck.length===0) buildDeck();
        window.generate();
        const ms = parseFloat(document.getElementById('inpTimer').value) * 1000;
        S.auto = setInterval(window.generate, ms);
        UI.icons.auto.textContent = "⏸️"; UI.icons.auto.classList.add('active');
    }
    updateStatus();
}

window.handleStageClick = function() {
    if (UI.topBar.classList.contains('visible')) {
        UI.topBar.classList.remove('visible'); return;
    }
    if (S.auto) window.toggleAuto(); else window.generate();
}

window.openSettings = function() { 
    UI.modals.set.classList.add('open'); 
    UI.topBar.classList.remove('visible');
    if(S.auto) window.toggleAuto(); 
}
window.closeSettings = function() { 
    UI.modals.set.classList.remove('open'); 
    updateUIPreferences();
    window.resetToStart(); 
}

// Модалка Проверки
window.openRecall = function() {
    if(S.auto) window.toggleAuto();
    const grid = document.getElementById('recallGrid'); grid.innerHTML = '';
    S.sessionSeq.forEach(item => {
        const cell = document.createElement('div');
        cell.className = 'recall-cell'; cell.textContent = item.text;
        if (item.isRed) cell.dataset.red = "true";
        cell.onclick = function() { this.classList.add('revealed'); if (this.dataset.red) this.classList.add('red'); };
        grid.appendChild(cell);
    });
    UI.modals.rec.classList.add('open');
}

window.closeRecall = function() { UI.modals.rec.classList.remove('open'); }

window.revealAll = function() {
    document.querySelectorAll('.recall-cell').forEach(c => {
        c.classList.add('revealed'); if (c.dataset.red) c.classList.add('red');
    });
}

window.exportData = function() {
    let date = new Date().toLocaleString('ru-RU');
    let type = S.mode === 'numbers' ? 'Числа' : 'Карты';
    let str = `## Тренировка (${type}) - ${date}\n\n**Последовательность:**\n`;
    str += S.sessionSeq.map(i => i.text).join(' - ') + `\n\n*Элементов в памяти: ${S.sessionSeq.length}*`;
    try { navigator.clipboard.writeText(str).then(() => alert("Скопировано для базы знаний!")); } 
    catch(e) { alert("Ошибка копирования."); }
}

document.addEventListener('keydown', (e) => {
    if(e.code === 'Space') { e.preventDefault(); window.handleStageClick(); }
    if(e.code === 'KeyA') window.toggleAuto();
});

/* Greek Balda: a word game against the computer.
 *
 * Each turn a player places one letter in an empty cell next to an existing
 * letter, then spells a word through orthogonally adjacent cells that uses the
 * new letter. A word scores one point per letter and can be played only once.
 * The game ends when the board is full or both players pass in a row.
 */
(function () {
  'use strict';

  const BOARD_SIZES = [5, 6, 7]; // the board is SIZE x SIZE; the start word fills the middle row
  const DEFAULT_SIZE = 5;
  const MIN_WORD = 3;
  const AI_DELAY_MS = 700;
  const HINTS_PER_GAME = 3;
  const ALPHABET = 'ΑΒΓΔΕΖΗΘΙΚΛΜΝΞΟΠΡΣΤΥΦΧΨΩ';
  const KEY_ROWS = ['ΕΡΤΥΘΙΟΠ', 'ΑΣΔΦΓΗΞΚΛ', 'ΖΧΨΩΒΝΜ'];
  // Latin keys mapped to the letters at the same position on a Greek keyboard.
  const LATIN_TO_GREEK = {
    a: 'Α', b: 'Β', c: 'Ψ', d: 'Δ', e: 'Ε', f: 'Φ', g: 'Γ', h: 'Η', i: 'Ι',
    j: 'Ξ', k: 'Κ', l: 'Λ', m: 'Μ', n: 'Ν', o: 'Ο', p: 'Π', r: 'Ρ', s: 'Σ',
    t: 'Τ', u: 'Θ', v: 'Ω', w: 'Σ', x: 'Χ', y: 'Υ', z: 'Ζ'
  };
  const OPPONENTS = [
    'Άλμπερτ Αϊνστάιν', 'Μάρεϋ Μπούκτσιν', 'Εμιλιάνο Ζαπάτα', 'Φρόντο', 'Χάρι Πότερ',
    'Αντώνης Σαμαράς', 'Τσίπρας', 'Πυθαγόρας', 'Σωκράτης', 'Ευκλείδης', 'Πλάτων',
    'Ηρόδοτος', 'Δημόκριτος'
  ];
  const LEVELS = { easy: 'Εύκολο', medium: 'Μέτριο', hard: 'Δύσκολο' };
  // nouns: js/nouns.js, loaded with the page. all: js/dictionary.js, loaded on demand.
  const WORD_LISTS = {
    nouns: { label: 'Ουσιαστικά', global: 'BALDA_NOUNS', src: 'js/nouns.js' },
    all: { label: 'Όλες οι λέξεις', global: 'BALDA_DICTIONARY', src: 'js/dictionary.js' }
  };
  const STORAGE_KEY = 'greek-balda';

  // Board geometry of the current game, set by setBoardSize().
  let SIZE = 0;
  let CELLS = 0;
  let NEIGHBORS = [];

  function neighborsFor(size) {
    return Array.from({ length: size * size }, (_, i) => {
      const r = Math.floor(i / size);
      const c = i % size;
      const out = [];
      if (r > 0) out.push(i - size);
      if (r < size - 1) out.push(i + size);
      if (c > 0) out.push(i - 1);
      if (c < size - 1) out.push(i + 1);
      return out;
    });
  }

  /* ---------- Dictionary ---------- */

  // Word lists are front-coded sorted lists (see tools/build_dictionary.py).
  // A '~' after a word marks it rare: the player may use it, the computer won't.
  function decodeDictionary(data) {
    const words = [];
    const rare = [];
    let prev = '';
    let i = 0;
    while (i < data.length) {
      const shared = data.charCodeAt(i++) - 48;
      let suffix = '';
      let code;
      while (i < data.length && (code = data.charCodeAt(i)) >= 97 && code <= 120) {
        suffix += ALPHABET[code - 97];
        i++;
      }
      prev = prev.slice(0, shared) + suffix;
      if (data[i] === '~') {
        rare.push(words.length);
        i++;
      }
      words.push(prev);
    }
    return new Dictionary(words, rare);
  }

  class Dictionary {
    constructor(sortedWords, rareIndices) {
      this.words = sortedWords;
      this.rare = new Uint8Array(sortedWords.length);
      for (const i of rareIndices) this.rare[i] = 1;
    }
    lowerBound(s) {
      let lo = 0;
      let hi = this.words.length;
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (this.words[mid] < s) lo = mid + 1;
        else hi = mid;
      }
      return lo;
    }
    has(word) {
      return this.words[this.lowerBound(word)] === word;
    }
    // Words the computer may play and suggest as hints.
    isCommon(word) {
      const i = this.lowerBound(word);
      return this.words[i] === word && !this.rare[i];
    }
    hasPrefix(prefix) {
      const w = this.words[this.lowerBound(prefix)];
      return w !== undefined && w.startsWith(prefix);
    }
    randomWord(length) {
      const pool = this.words.filter((w, i) => w.length === length && !this.rare[i]);
      return pool[Math.floor(Math.random() * pool.length)];
    }
  }

  /* ---------- Move search ---------- */

  // Every legal move: one new letter in an empty cell next to a letter, plus a
  // path through adjacent cells that spells an unused common dictionary word using it.
  // Paths are pruned as soon as no dictionary word starts with their prefix.
  function findMoves(board, dict, used) {
    const moves = new Map();
    const visited = new Array(CELLS).fill(false);
    const path = [];

    function extend(cell, prefix, placed) {
      if (!dict.hasPrefix(prefix)) return;
      visited[cell] = true;
      path.push(cell);
      if (placed && prefix.length >= MIN_WORD && !used.has(prefix) && !moves.has(prefix) && dict.isCommon(prefix)) {
        moves.set(prefix, { word: prefix, path: path.slice(), cell: placed.cell, letter: placed.letter });
      }
      for (const n of NEIGHBORS[cell]) {
        if (visited[n]) continue;
        if (board[n]) {
          extend(n, prefix + board[n], placed);
        } else if (!placed) {
          for (const letter of ALPHABET) extend(n, prefix + letter, { cell: n, letter });
        }
      }
      path.pop();
      visited[cell] = false;
    }

    for (let c = 0; c < CELLS; c++) {
      if (board[c]) {
        extend(c, board[c], null);
      } else if (NEIGHBORS[c].some((n) => board[n])) {
        for (const letter of ALPHABET) extend(c, letter, { cell: c, letter });
      }
    }
    return [...moves.values()];
  }

  function pick(list) {
    return list[Math.floor(Math.random() * list.length)];
  }

  function chooseMove(moves, level) {
    if (!moves.length) return null;
    const sorted = moves.slice().sort((a, b) => b.word.length - a.word.length);
    if (level === 'hard') {
      const best = sorted[0].word.length;
      return pick(sorted.filter((m) => m.word.length === best));
    }
    if (level === 'medium') {
      return pick(sorted.slice(0, Math.max(1, Math.ceil(sorted.length * 0.3))));
    }
    const short = sorted.filter((m) => m.word.length <= 4);
    return pick(short.length ? short : sorted.slice(-Math.ceil(sorted.length / 2)));
  }

  /* ---------- Persistence (best effort) ---------- */

  function loadPrefs() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
    } catch (e) {
      return {};
    }
  }

  function savePrefs(prefs) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
    } catch (e) {
      /* storage unavailable: preferences just won't persist */
    }
  }

  /* ---------- Game ---------- */

  const $ = (sel) => document.querySelector(sel);
  const el = {
    board: $('#board'),
    status: $('#status'),
    word: $('#current-word'),
    keyboard: $('#keyboard'),
    submit: $('#submit'),
    undo: $('#undo'),
    cancel: $('#cancel'),
    pass: $('#pass'),
    hint: $('#hint'),
    hintCount: $('#hint-count'),
    newGame: $('#new-game'),
    dialog: $('#start-dialog'),
    form: $('#start-form'),
    nameInput: $('#player-name'),
    levelInput: $('#level'),
    sizeInput: $('#board-size'),
    overDialog: $('#over-dialog'),
    overEmoji: $('#over-emoji'),
    overTitle: $('#over-title'),
    overReason: $('#over-reason'),
    overPlayer: $('#over-player'),
    overPc: $('#over-pc'),
    overRecord: $('#over-record'),
    overNewGame: $('#over-new-game'),
    overSettings: $('#over-settings'),
    overClose: $('#over-close'),
    banner: $('#over-banner'),
    bannerTitle: $('#over-banner-title'),
    bannerScore: $('#over-banner-score'),
    bannerDetails: $('#banner-details'),
    bannerNewGame: $('#banner-new-game'),
    wordListInput: $('#word-list'),
    startButton: $('#start-form button[type="submit"]'),
    result: $('#result'),
    record: $('#record'),
    playerName: $('#player .name'),
    pcName: $('#pc .name'),
    playerScore: $('#player .count'),
    pcScore: $('#pc .count'),
    playerWords: $('#player .words'),
    pcWords: $('#pc .words'),
    playerCol: $('#player'),
    pcCol: $('#pc'),
    level: $('#level-label')
  };

  const prefs = loadPrefs();
  prefs.record = prefs.record || { wins: 0, losses: 0, draws: 0 };

  const dictionaries = {};
  let state = null;
  let statusTimer = null;
  let dragging = false;

  function newState(playerName, level, wordList) {
    return {
      dict: dictionaries[wordList],
      wordList,
      board: new Array(CELLS).fill(''),
      // place: pick a cell; letter: pick its letter; select: spell a word; ai; over
      phase: 'place',
      pending: null, // { cell, letter }
      path: [],
      used: new Set(),
      scores: { player: 0, pc: 0 },
      words: { player: [], pc: [] },
      passes: 0,
      hints: HINTS_PER_GAME,
      hintCell: null,
      lastMove: [],
      lastPlayer: null, // who played the most recent word: 'player' | 'pc'
      level,
      playerName,
      pcName: pick(OPPONENTS),
      moves: 0
    };
  }

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.onload = resolve;
      script.onerror = () => reject(new Error('Failed to load ' + src));
      document.head.appendChild(script);
    });
  }

  async function loadDictionary(name) {
    if (dictionaries[name]) return dictionaries[name];
    const list = WORD_LISTS[name];
    if (!window[list.global]) await loadScript(list.src);
    dictionaries[name] = decodeDictionary(window[list.global]);
    window[list.global] = null; // free the encoded string
    return dictionaries[name];
  }

  function setBoardSize(size) {
    if (size === SIZE) return;
    SIZE = size;
    CELLS = size * size;
    NEIGHBORS = neighborsFor(size);
    // On the root element, because --cell-size in css/style.css is computed there.
    document.documentElement.style.setProperty('--size', size);
    buildBoard();
  }

  function startGame(playerName, level, wordList, size) {
    setBoardSize(size);
    state = newState(playerName, level, wordList);
    const first = state.dict.randomWord(SIZE);
    const row = Math.floor(SIZE / 2) * SIZE;
    for (let i = 0; i < first.length; i++) state.board[row + i] = first[i];
    state.used.add(first);
    el.playerName.textContent = playerName;
    el.pcName.textContent = state.pcName;
    el.level.textContent = LEVELS[level] + ' · ' + WORD_LISTS[wordList].label + ' · ' + SIZE + '×' + SIZE;
    setStatus('Το παιχνίδι άρχισε με τη λέξη «' + first + '». Διάλεξε ένα κενό κουτί.');
    render();
  }

  function letterAt(i) {
    if (state.board[i]) return state.board[i];
    if (state.pending && state.pending.cell === i) return state.pending.letter || '';
    return '';
  }

  function isAvailable(i) {
    return !state.board[i] && NEIGHBORS[i].some((n) => state.board[n]);
  }

  function currentWord() {
    return state.path.map(letterAt).join('');
  }

  function defaultStatus() {
    switch (state.phase) {
      case 'place': return 'Σειρά σου: διάλεξε ένα κενό κουτί δίπλα σε γράμμα.';
      case 'letter': return 'Γράψε ένα γράμμα (πληκτρολόγιο ή οθόνη).';
      case 'select': return 'Φτιάξε τη λέξη: πάτα ή σύρε πάνω στα γράμματα, μετά Enter.';
      case 'ai': return state.pcName + ' σκέφτεται...';
      default: return '';
    }
  }

  // kind: 'info' | 'error' | 'success'. Temporary messages fall back to the turn hint.
  function setStatus(text, kind, temporary) {
    clearTimeout(statusTimer);
    el.status.textContent = text;
    el.status.dataset.kind = kind || 'info';
    if (temporary) {
      statusTimer = setTimeout(() => setStatus(defaultStatus()), 3500);
    }
  }

  /* ---------- Rendering ---------- */

  function buildBoard() {
    el.board.innerHTML = '';
    for (let i = 0; i < CELLS; i++) {
      const cell = document.createElement('button');
      cell.type = 'button';
      cell.className = 'cell';
      cell.dataset.index = i;
      el.board.appendChild(cell);
    }
  }

  function buildKeyboard() {
    el.keyboard.innerHTML = '';
    for (const row of KEY_ROWS) {
      const rowEl = document.createElement('div');
      rowEl.className = 'key-row';
      for (const letter of row) {
        const key = document.createElement('button');
        key.type = 'button';
        key.className = 'key';
        key.textContent = letter;
        key.dataset.letter = letter;
        rowEl.appendChild(key);
      }
      el.keyboard.appendChild(rowEl);
    }
  }

  function render() {
    const humanTurn = ['place', 'letter', 'select'].includes(state.phase);
    const cells = el.board.children;
    for (let i = 0; i < CELLS; i++) {
      const cell = cells[i];
      const letter = letterAt(i);
      const order = state.path.indexOf(i);
      cell.textContent = letter;
      cell.classList.toggle('filled', !!state.board[i]);
      cell.classList.toggle('available', humanTurn && isAvailable(i));
      cell.classList.toggle('pending', !!state.pending && state.pending.cell === i);
      cell.classList.toggle('in-path', order >= 0);
      cell.classList.toggle('path-end', order >= 0 && order === state.path.length - 1);
      cell.classList.toggle('last-move', state.lastMove.includes(i));
      cell.classList.toggle('hinted', state.hintCell === i);
      if (order >= 0) cell.dataset.order = order + 1;
      else delete cell.dataset.order;
      cell.setAttribute('aria-label', 'Κουτί ' + (Math.floor(i / SIZE) + 1) + '-' + ((i % SIZE) + 1) + (letter ? ': ' + letter : ': κενό'));
    }

    const word = currentWord();
    el.word.textContent = word || ' ';
    el.word.classList.toggle('empty', !word);

    const typing = state.phase === 'letter' || state.phase === 'select';
    el.keyboard.classList.toggle('active', typing);
    for (const key of el.keyboard.querySelectorAll('.key')) {
      key.disabled = !typing;
      key.classList.toggle('chosen', !!state.pending && state.pending.letter === key.dataset.letter);
    }

    el.submit.disabled = state.phase !== 'select' || state.path.length < 1;
    el.undo.disabled = !(state.phase === 'select' && (state.path.length || state.pending));
    el.cancel.disabled = !state.pending || !humanTurn;
    el.pass.disabled = !humanTurn;
    el.hint.disabled = !humanTurn || state.hints === 0;
    el.hintCount.textContent = state.hints;

    el.playerScore.textContent = state.scores.player;
    el.pcScore.textContent = state.scores.pc;
    renderWords(el.playerWords, state.words.player, state.lastPlayer === 'player');
    renderWords(el.pcWords, state.words.pc, state.lastPlayer === 'pc');
    el.playerCol.classList.toggle('active', humanTurn);
    el.pcCol.classList.toggle('active', state.phase === 'ai');
    document.body.dataset.phase = state.phase;
    el.banner.hidden = state.phase !== 'over';
  }

  // Newest word first; the most recent word of the game is highlighted.
  function renderWords(list, words, hasLatest) {
    if (list.childElementCount !== words.length) {
      list.innerHTML = '';
      for (let i = words.length - 1; i >= 0; i--) {
        const li = document.createElement('li');
        li.textContent = words[i];
        const len = document.createElement('span');
        len.textContent = words[i].length;
        li.appendChild(len);
        list.appendChild(li);
      }
    }
    for (const li of list.children) li.classList.remove('latest');
    if (hasLatest && list.firstElementChild) list.firstElementChild.classList.add('latest');
  }

  function shake() {
    el.word.classList.remove('shake');
    void el.word.offsetWidth; // restart the animation
    el.word.classList.add('shake');
  }

  /* ---------- Player actions ---------- */

  function choosePendingCell(i) {
    state.pending = { cell: i, letter: null };
    state.path = [];
    state.phase = 'letter';
    setStatus(defaultStatus());
  }

  function typeLetter(letter) {
    if (!state.pending) return;
    state.pending.letter = letter;
    if (state.phase === 'letter') {
      state.phase = 'select';
      state.path = [];
    }
    setStatus(defaultStatus());
    render();
  }

  function cancelMove() {
    if (!['place', 'letter', 'select'].includes(state.phase)) return;
    state.pending = null;
    state.path = [];
    state.phase = 'place';
    setStatus(defaultStatus());
    render();
  }

  function undo() {
    if (state.phase !== 'select') return;
    if (state.path.length) {
      state.path.pop();
    } else {
      state.pending.letter = null;
      state.phase = 'letter';
      setStatus(defaultStatus());
    }
    render();
  }

  function addToPath(i) {
    const path = state.path;
    const last = path[path.length - 1];
    const pos = path.indexOf(i);
    if (pos >= 0) {
      path.length = pos + 1; // jump back to an earlier letter
    } else if (!path.length || NEIGHBORS[last].includes(i)) {
      path.push(i);
    } else {
      state.path = [i]; // not adjacent: start a new word here
    }
  }

  function onCellDown(i) {
    if (state.phase === 'place' || state.phase === 'letter') {
      if (isAvailable(i)) choosePendingCell(i);
      else if (state.phase === 'place') setStatus('Διάλεξε κενό κουτί δίπλα σε γράμμα.', 'error', true);
      render();
      return false;
    }
    if (state.phase !== 'select') return false;
    if (!letterAt(i)) {
      if (isAvailable(i)) choosePendingCell(i); // move the new letter elsewhere
      render();
      return false;
    }
    if (state.path.length && state.path[state.path.length - 1] === i) {
      submitWord(); // tapping the last letter again submits
      return false;
    }
    addToPath(i);
    render();
    return true;
  }

  function onCellDrag(i) {
    if (state.phase !== 'select' || !letterAt(i)) return;
    const path = state.path;
    const last = path[path.length - 1];
    if (i === last) return;
    if (path.length > 1 && path[path.length - 2] === i) {
      path.pop(); // dragging back over the previous letter
    } else if (!path.includes(i) && NEIGHBORS[last].includes(i)) {
      path.push(i);
    } else {
      return;
    }
    render();
  }

  function submitWord() {
    if (state.phase !== 'select') return;
    const word = currentWord();
    let error = null;
    if (word.length < MIN_WORD) error = 'Η λέξη πρέπει να έχει τουλάχιστον ' + MIN_WORD + ' γράμματα.';
    else if (!state.path.includes(state.pending.cell)) error = 'Η λέξη πρέπει να περιέχει το νέο γράμμα.';
    else if (state.used.has(word)) error = 'Η λέξη «' + word + '» έχει ήδη παιχτεί.';
    else if (!state.dict.has(word)) {
      error = state.wordList === 'nouns'
        ? 'Δεν ξέρω το ουσιαστικό «' + word + '». Μετράνε μόνο ουσιαστικά στην ονομαστική.'
        : 'Δεν ξέρω τη λέξη «' + word + '».';
    }
    if (error) {
      setStatus(error, 'error', true);
      shake();
      state.path = [];
      render();
      return;
    }
    applyMove('player', state.pending.cell, state.pending.letter, word, state.path.slice());
    setStatus('Μπράβο! «' + word + '»: +' + word.length, 'success');
    afterMove('ai');
  }

  function applyMove(who, cell, letter, word, path) {
    state.board[cell] = letter;
    state.used.add(word);
    state.scores[who] += word.length;
    state.words[who].push(word);
    state.lastMove = path;
    state.lastPlayer = who;
    state.pending = null;
    state.path = [];
    state.hintCell = null;
    state.passes = 0;
    state.moves++;
  }

  function afterMove(next) {
    if (state.board.every((l) => l)) {
      endGame('Το ταμπλό γέμισε.');
      return;
    }
    if (next === 'ai') {
      aiTurn();
    } else {
      state.phase = 'place';
      render();
    }
  }

  function pass() {
    if (!['place', 'letter', 'select'].includes(state.phase)) return;
    if (!window.confirm('Σίγουρα θες να πας πάσο;')) return;
    state.pending = null;
    state.path = [];
    state.hintCell = null;
    state.passes++;
    if (state.passes >= 2) {
      endGame('Πάσο και από τους δύο.');
      return;
    }
    aiTurn();
  }

  function hint() {
    if (state.hints === 0) return;
    const moves = findMoves(state.board, state.dict, state.used);
    if (!moves.length) {
      setStatus('Δεν βλέπω καμία λέξη. Ίσως ήρθε η ώρα για πάσο.', 'info', true);
      return;
    }
    const move = chooseMove(moves, 'medium');
    state.hints--;
    state.hintCell = move.cell;
    setStatus('Υπόδειξη: δοκίμασε το γράμμα «' + move.letter + '» στο κουτί που αναβοσβήνει (λέξη ' + move.word.length + ' γραμμάτων).', 'info');
    render();
  }

  /* ---------- Computer turn ---------- */

  function aiTurn() {
    state.phase = 'ai';
    state.pending = null;
    state.path = [];
    render();
    const announced = el.status.dataset.kind === 'success' ? el.status.textContent + ' ' : '';
    setStatus(announced + state.pcName + ' σκέφτεται...');
    setTimeout(() => {
      const move = chooseMove(findMoves(state.board, state.dict, state.used), state.level);
      if (!move) {
        state.passes++;
        if (state.passes >= 2) {
          endGame('Πάσο και από τους δύο.');
          return;
        }
        state.lastMove = [];
        state.phase = 'place';
        setStatus(state.pcName + ' πάει πάσο. Σειρά σου.', 'info');
        render();
        return;
      }
      applyMove('pc', move.cell, move.letter, move.word, move.path);
      setStatus(state.pcName + ': «' + move.word + '» (+' + move.word.length + '). Σειρά σου.', 'info');
      afterMove('player');
    }, AI_DELAY_MS);
  }

  /* ---------- Start / end ---------- */

  function endGame(reason) {
    state.phase = 'over';
    state.pending = null;
    state.path = [];
    state.hintCell = null;
    const { player, pc } = state.scores;
    state.outcome = player > pc ? 'win' : player < pc ? 'loss' : 'draw';
    state.endReason = reason;
    prefs.record[{ win: 'wins', loss: 'losses', draw: 'draws' }[state.outcome]]++;
    savePrefs(prefs);
    const title = OUTCOMES[state.outcome].title(state.pcName);
    const score = player + ' – ' + pc;
    setStatus('Το παιχνίδι τελείωσε: ' + reason.charAt(0).toLowerCase() + reason.slice(1));
    el.bannerTitle.textContent = 'Τέλος παιχνιδιού: ' + title;
    el.bannerScore.textContent = state.playerName + ' ' + score + ' ' + state.pcName;
    render();
    openOverDialog();
  }

  const OUTCOMES = {
    win: { emoji: '🏆', title: () => 'Κέρδισες!' },
    loss: { emoji: '😔', title: (pcName) => 'Κέρδισε ' + pcName },
    draw: { emoji: '🤝', title: () => 'Ισοπαλία!' }
  };

  function longestWord(words) {
    return words.reduce((best, w) => (w.length > best.length ? w : best), '');
  }

  function fillOverPlayer(box, name, points, words, winner) {
    box.querySelector('.over-name').textContent = name;
    box.querySelector('.over-points').textContent = points;
    const best = longestWord(words);
    box.querySelector('.over-best').textContent = words.length
      ? words.length + (words.length === 1 ? ' λέξη' : ' λέξεις') + ' · καλύτερη «' + best + '»'
      : 'καμία λέξη';
    box.classList.toggle('winner', winner);
  }

  function openOverDialog() {
    const outcome = OUTCOMES[state.outcome];
    el.overDialog.dataset.outcome = state.outcome;
    el.overEmoji.textContent = outcome.emoji;
    el.overTitle.textContent = outcome.title(state.pcName);
    el.overReason.textContent = state.endReason;
    fillOverPlayer(el.overPlayer, state.playerName, state.scores.player, state.words.player, state.outcome === 'win');
    fillOverPlayer(el.overPc, state.pcName, state.scores.pc, state.words.pc, state.outcome === 'loss');
    el.overRecord.textContent = recordText();
    if (!el.overDialog.open) el.overDialog.showModal();
    el.overNewGame.focus();
  }

  function recordText() {
    const r = prefs.record;
    return 'Νίκες ' + r.wins + ' · Ήττες ' + r.losses + ' · Ισοπαλίες ' + r.draws;
  }

  function renderRecord() {
    el.record.textContent = recordText();
  }

  // Starts a game with the saved settings, loading the word list first if needed.
  async function beginGame() {
    await loadDictionary(prefs.wordList);
    startGame(prefs.name, prefs.level, prefs.wordList, prefs.size);
  }

  function openStartDialog() {
    el.result.textContent = '';
    el.result.hidden = true;
    el.nameInput.value = prefs.name || '';
    el.levelInput.value = prefs.level || 'medium';
    el.wordListInput.value = WORD_LISTS[prefs.wordList] ? prefs.wordList : 'nouns';
    el.sizeInput.value = BOARD_SIZES.includes(prefs.size) ? prefs.size : DEFAULT_SIZE;
    renderRecord();
    if (!el.dialog.open) el.dialog.showModal();
    el.nameInput.focus();
  }

  /* ---------- Events ---------- */

  function cellIndexFrom(target) {
    const cell = target && target.closest && target.closest('.cell');
    return cell ? Number(cell.dataset.index) : null;
  }

  function bindEvents() {
    el.board.addEventListener('pointerdown', (e) => {
      const i = cellIndexFrom(e.target);
      if (i === null) return;
      e.preventDefault();
      dragging = onCellDown(i);
      if (el.board.hasPointerCapture(e.pointerId)) el.board.releasePointerCapture(e.pointerId);
    });
    el.board.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      const i = cellIndexFrom(document.elementFromPoint(e.clientX, e.clientY));
      if (i !== null) onCellDrag(i);
    });
    window.addEventListener('pointerup', () => { dragging = false; });
    window.addEventListener('pointercancel', () => { dragging = false; });
    // Board cells are buttons; keyboard users activate them with Enter/Space.
    el.board.addEventListener('click', (e) => {
      if (e.detail !== 0) return; // pointer clicks are handled on pointerdown
      const i = cellIndexFrom(e.target);
      if (i !== null) onCellDown(i);
    });

    el.keyboard.addEventListener('click', (e) => {
      const key = e.target.closest('.key');
      if (key && !key.disabled) typeLetter(key.dataset.letter);
    });
    el.submit.addEventListener('click', submitWord);
    el.undo.addEventListener('click', undo);
    el.cancel.addEventListener('click', cancelMove);
    el.pass.addEventListener('click', pass);
    el.hint.addEventListener('click', hint);
    el.newGame.addEventListener('click', () => {
      if (state && state.phase !== 'over' && state.moves > 0 && !window.confirm('Θέλεις να αρχίσεις νέο παιχνίδι;')) return;
      openStartDialog();
    });

    el.form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (el.startButton.disabled) return;
      const name = el.nameInput.value.trim() || 'Παίκτης';
      prefs.name = name;
      prefs.level = el.levelInput.value;
      prefs.wordList = el.wordListInput.value;
      prefs.size = Number(el.sizeInput.value);
      savePrefs(prefs);
      const label = el.startButton.textContent;
      el.startButton.disabled = true;
      el.startButton.textContent = 'Φόρτωση λεξικού...';
      try {
        await loadDictionary(prefs.wordList);
      } catch (err) {
        el.result.textContent = 'Δεν φόρτωσε το λεξικό. Δοκίμασε ξανά.';
        el.result.hidden = false;
        return;
      } finally {
        el.startButton.disabled = false;
        el.startButton.textContent = label;
      }
      el.dialog.close();
      startGame(name, prefs.level, prefs.wordList, prefs.size);
    });
    // Before the first game there is nothing behind the dialog to return to.
    el.dialog.addEventListener('cancel', (e) => {
      if (!state) e.preventDefault();
    });

    // End of game: new game with the same settings, change settings, or look at the board.
    el.overNewGame.addEventListener('click', () => {
      el.overDialog.close();
      beginGame();
    });
    el.overSettings.addEventListener('click', () => {
      el.overDialog.close();
      openStartDialog();
    });
    el.overClose.addEventListener('click', () => el.overDialog.close());
    el.bannerNewGame.addEventListener('click', () => beginGame());
    el.bannerDetails.addEventListener('click', () => openOverDialog());

    document.addEventListener('keydown', (e) => {
      if (el.dialog.open || el.overDialog.open || !state || e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === 'Enter' && state.phase === 'select') {
        e.preventDefault();
        submitWord();
      } else if (e.key === 'Escape') {
        cancelMove();
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        undo();
      } else if (e.key.length === 1 && (state.phase === 'letter' || state.phase === 'select')) {
        const letter = toGreekLetter(e.key);
        if (letter) typeLetter(letter);
      }
    });
  }

  function toGreekLetter(key) {
    const latin = LATIN_TO_GREEK[key.toLowerCase()];
    if (latin) return latin;
    const greek = key.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace('ς', 'Σ');
    return ALPHABET.includes(greek) ? greek : null;
  }

  function init() {
    setBoardSize(DEFAULT_SIZE);
    buildKeyboard();
    bindEvents();
    el.status.textContent = 'Γράψε το όνομά σου και πάτα «Ξεκίνα».';
    openStartDialog();
  }

  // Exposed for debugging in the console.
  window.balda = {
    get state() { return state; },
    get dictionary() { return state && state.dict; },
    loadDictionary,
    findMoves: () => findMoves(state.board, state.dict, state.used)
  };

  init();
})();

/* ============================================================
   HOME ROW MASTER — game.js (VS Code Webview version)
   ============================================================ */

'use strict';

const HOME_ROW_CHARS = 'asdfghjkl;';

const KEY_MAP = {
  'a':'key-a','s':'key-s','d':'key-d','f':'key-f',
  'g':'key-g','h':'key-h','j':'key-j','k':'key-k',
  'l':'key-l',';':'key-semi',
  'q':'key-q','w':'key-w','e':'key-e','r':'key-r',
  't':'key-t','y':'key-y','u':'key-u','i':'key-i',
  'o':'key-o','p':'key-p',
  'z':'key-z','x':'key-x','c':'key-c','v':'key-v',
  'b':'key-b','n':'key-n','m':'key-m',
  ' ': 'key-space',
};

// acquire VS Code API (safely)
const vscode = typeof acquireVsCodeApi !== 'undefined' ? acquireVsCodeApi() : null;

// DOM refs
const sequenceDisplay = document.getElementById('sequenceDisplay');
const scoreVal        = document.getElementById('scoreVal');
const scoreLabel      = document.getElementById('scoreLabel');
const streakVal       = document.getElementById('streakVal');
const streakLabel     = document.getElementById('streakLabel');
const bestStreakVal   = document.getElementById('bestStreakVal');
const bestStreakLabel = document.getElementById('bestStreakLabel');
const accuracyVal     = document.getElementById('accuracyVal');
const hintText        = document.getElementById('hintText');
const difficultySelect = document.getElementById('difficultySelect');
const resetBtn        = document.getElementById('resetBtn');

// Mode refs
const modeBtns        = document.querySelectorAll('.mode-btn');

// Overlay refs
const gameOverOverlay = document.getElementById('gameOverOverlay');
const overWpmVal      = document.getElementById('overWpmVal');
const overAccuracyVal = document.getElementById('overAccuracyVal');
const playAgainBtn    = document.getElementById('playAgainBtn');



// State
let state = {
  mode: 'letters', // 'letters' or 'words'
  score: 0, streak: 0, bestStreak: 0, bestWPM: 0,
  totalKeys: 0, correctKeys: 0,
  sequence: '', currentIndex: 0,
  seqLength: 6, highScore: 0,
  difficulty: 'easy', // 'easy', 'medium', 'hard'
  timeLeft: 60,
  timerStarted: false,
  timerInterval: null,
  lastPoemIndex: -1,
  lastFactIndex: -1,
  lastKeyPressTime: 0,
  lastShortcutTime: 0,
  timerPaused: false,
};

// ── Persistence ──────────────────────────────────────────────────────────────
function loadStats() {
  // 1. Try to load from immediately cached VS Code webview state
  if (vscode) {
    const cached = vscode.getState();
    if (cached) {
      state.highScore = cached.highScore || 0;
      state.bestStreak = cached.bestStreak || 0;
      state.bestWPM = cached.bestWpm || 0;
      state.mode = cached.mode || 'letters';
      state.seqLength = cached.seqLength || 6;
      updateDifficultyField();
    }
    // 2. Request latest values from VS Code's globalState
    vscode.postMessage({ command: 'getStats' });
  } else {
    // Fallback for direct browser preview
    const savedStreak = localStorage.getItem('hrm_beststreak');
    state.bestStreak = savedStreak ? parseInt(savedStreak, 10) : 0;
    const savedWpm = localStorage.getItem('hrm_bestwpm');
    state.bestWPM = savedWpm ? parseInt(savedWpm, 10) : 0;
    const savedMode = localStorage.getItem('hrm_mode');
    state.mode = savedMode === 'words' ? 'words' : 'letters';
    const savedSeqLength = localStorage.getItem('hrm_seqlength');
    state.seqLength = savedSeqLength ? parseInt(savedSeqLength, 10) : 6;
    updateDifficultyField();
  }
}

function saveStats() {
  if (vscode) {
    // Cache immediately in Webview State
    vscode.setState({
      highScore: state.highScore,
      bestStreak: state.bestStreak,
      bestWpm: state.bestWPM,
      mode: state.mode,
      seqLength: state.seqLength
    });
    // Save to Extension Host globalState
    vscode.postMessage({
      command: 'saveStats',
      highScore: state.highScore,
      bestStreak: state.bestStreak,
      bestWpm: state.bestWPM,
      mode: state.mode,
      seqLength: state.seqLength
    });
  } else {
    localStorage.setItem('hrm_beststreak', state.bestStreak);
    localStorage.setItem('hrm_bestwpm', state.bestWPM);
    localStorage.setItem('hrm_mode', state.mode);
    localStorage.setItem('hrm_seqlength', state.seqLength);
  }
}

function updateDifficultyField() {
  if (state.seqLength === 6) state.difficulty = 'easy';
  else if (state.seqLength === 9) state.difficulty = 'medium';
  else if (state.seqLength === 12) state.difficulty = 'hard';
  if (difficultySelect) {
    difficultySelect.value = state.seqLength.toString();
  }
}

// Listen for stats loaded from VS Code host
if (vscode) {
  window.addEventListener('message', event => {
    const message = event.data;
    if (message.command === 'loadStats') {
      state.highScore = message.highScore || 0;
      state.bestStreak = message.bestStreak || 0;
      state.bestWPM = message.bestWpm || 0;
      state.mode = message.mode || 'letters';
      state.seqLength = message.seqLength || 6;
      updateDifficultyField();
      initGame();
    }
  });
}

const COMMON_WORDS = [
  'the', 'be', 'to', 'of', 'and', 'a', 'in', 'that', 'have', 'i', 'it', 'for', 'not', 'on', 'with', 'he', 'as', 'you', 'do', 'at',
  'this', 'but', 'his', 'by', 'from', 'they', 'we', 'say', 'her', 'she', 'or', 'an', 'will', 'my', 'one', 'all', 'would', 'there', 'their', 'what',
  'so', 'up', 'out', 'if', 'about', 'who', 'get', 'which', 'go', 'me', 'when', 'make', 'can', 'like', 'time', 'no', 'just', 'him', 'know', 'take',
  'people', 'into', 'year', 'your', 'good', 'some', 'could', 'them', 'see', 'other', 'than', 'then', 'now', 'look', 'only', 'come', 'its', 'over', 'think',
  'also', 'back', 'after', 'use', 'two', 'how', 'our', 'work', 'first', 'well', 'way', 'even', 'new', 'want', 'because', 'any', 'these', 'give', 'day',
  'most', 'us'
];

const POEMS = [
  "two roads diverged in a yellow wood and sorry i could not travel both and be one traveler long i stood and looked down one as far as i could to where it bent in the undergrowth",
  "hope is the thing with feathers that perches in the soul and sings the tune without the words and never stops at all",
  "hold fast to dreams for if dreams die life is a broken winged bird that cannot fly hold fast to dreams for when dreams go life is a barren field frozen with snow",
  "out of the night that covers me black as the pit from pole to pole i thank whatever gods may be for my unconquerable soul",
  "she walks in beauty like the night of cloudless climes and starry skies and all thats best of dark and bright meet in her aspect and her eyes",
  "tell me not in mournful numbers life is but an empty dream for the soul is dead that slumbers and things are not what they seem",
  "tyger tyger burning bright in the forests of the night what immortal hand or eye could frame thy fearful symmetry",
  "whose woods these are i think i know his house is in the village though he will not see me stopping here to watch his woods fill up with snow",
  "nature first green is gold her hardest hue to hold her early leaf a flower but only so an hour then leaf subsides to leaf so eden sank to grief so dawn goes down to day nothing gold can stay",
  "had i the heavens embroidered cloths enwrought with golden and silver light the blue and the dim and the dark cloths of night and light and the half light",
  "shall i compare thee to a summers day thou art more lovely and more temperate rough winds do shake the darling buds of may and summers lease hath all too short a date",
  "do not go gentle into that good night old age should burn and rave at close of day rage rage against the dying of the light",
  "i wandered lonely as a cloud that floats on high oer vales and hills when all at once i saw a crowd a host of golden daffodils beside the lake beneath the trees fluttering and dancing in the breeze",
  "once upon a midnight dreary while i pondered weak and weary over many a quaint and curious volume of forgotten lore while i nodded nearly napping suddenly there came a tapping",
  "some say the world will end in fire some say in ice from what i have tasted of desire i hold with those who favor fire",
  "if you can keep your head when all about you are losing theirs and blaming it on you if you can trust yourself when all men doubt you but make allowance for their doubting too",
  "the woods are lovely dark and deep but i have promises to keep and miles to go before i sleep and miles to go before i sleep",
  "i have a little shadow that goes in and out with me and what can be the use of him is more than i can see he is very very like me from the heels up to the head and i see him jump before me when i jump into my bed",
  "the sea is calm tonight the tide is full the moon lies fair upon the straits on the french coast the light gleams and is gone the cliffs of england stand glimmering and vast out in the tranquil bay",
  "success is counted sweetest by those who never succeed to comprehend a nectar requires sorest need not one of all the purple host who took the flag today can tell the definition so clear of victory",
  "because i could not stop for death he kindly stopped for me the carriage held but just ourselves and immortality",
  "water water everywhere and all the boards did shrink water water everywhere nor any drop to drink",
  "gather ye rosebuds while ye may old time is still a flying and this same flower that smiles today tomorrow will be dying",
  "this is the way the world ends this is the way the world ends this is the way the world ends not with a bang but a whimper",
  "o captain my captain our fearful trip is done the ship has weathered every rack the prize we sought is won",
  "when you are old and grey and full of sleep and nodding by the fire take down this book and slowly read and dream of the soft look your eyes had once and of their shadows deep"
];

const FACTS = [
  "honey never spoils you can eat three thousand year old honey and it still tastes perfectly fine",
  "bananas are berries but strawberries are not because of the way their seeds develop",
  "a day on venus is longer than a year on venus because it rotates so slowly on its axis",
  "wombats produce cubic poop which stops the droppings from rolling away from their territory",
  "the total weight of all the ants on earth is roughly equal to the total weight of all humans",
  "octopuses have three hearts and blue blood because they use copper based proteins to transport oxygen",
  "a group of flamingos is officially called a flamboyance which matches their bright pink feathers",
  "cows have best friends and experience high levels of stress when they are separated from them",
  "sea otters hold hands when they sleep to keep from drifting apart in the water",
  "the electric chair was invented by a dentist named alfred southwick in the late nineteenth century",
  "the first computer bug was a real moth found trapped in a relay of the mark two computer in nineteen forty seven",
  "clouds look light and fluffy but a typical cumulus cloud weighs about one million pounds",
  "bananas are curved because they grow towards the sun in a process called negative geotropism",
  "honeybees can flap their wings about two hundred times per second which creates their signature buzzing sound",
  "a single strand of spaghetti is called a spaghetto and a single piece of graffiti is a graffito",
  "whip cracks make a loud noise because the tip of the whip is moving so fast it breaks the sound barrier",
  "sea turtles cry salty tears to rid their bodies of the excess salt they swallow while living in the ocean",
  "the heart of a blue whale is so massive that a human could swim through its largest arteries",
  "hot water will turn into ice faster than cold water in a phenomenon known as the mpemba effect",
  "an elephant can smell water from several miles away and they are excellent swimmers despite their size",
  "the first person to survive going over niagara falls in a barrel was a sixty three year old schoolteacher named annie edson taylor",
  "the shortest war in history lasted only thirty eight minutes between the united kingdom and zanzibar in eighteen ninety six",
  "it is impossible to hum while holding your nose closed because humming requires air to pass through your nose",
  "a bolt of lightning contains enough energy to toast one hundred thousand slices of bread",
  "there are more trees on earth than stars in the milky way galaxy by about three trillion to four hundred billion",
  "koalas have individual fingerprints that are almost identical to human fingerprints even under a microscope",
  "the moon has moonquakes which are similar to earthquakes but are caused by tidal stresses and thermal change",
  "a teaspoon of a neutron star would weigh about six billion tons because of its incredibly dense matter",
  "slugs have four noses which are actually sensory tentacles used for smelling tasting and feeling their way around"
];

// ─── Letters generation based on difficulty ───────────────────
function generateLetters(length) {
  const easyKeys = 'asdfjkl;';
  const allKeys = 'asdfghjkl;';
  const leftHandEasy = 'asdf';
  const rightHandEasy = 'jkl;';
  const leftHandAll = 'asdfg';
  const rightHandAll = 'hjkl;';

  function isLeftHand(char) {
    return leftHandAll.includes(char);
  }

  function getAdjacentKeys(char) {
    const idx = allKeys.indexOf(char);
    if (idx === -1) return [];
    const adj = [];
    if (idx > 0) adj.push(allKeys[idx - 1]);
    if (idx < allKeys.length - 1) adj.push(allKeys[idx + 1]);
    return adj;
  }

  let result = '';
  let difficulty = 'easy';
  if (state.seqLength === 9) difficulty = 'medium';
  else if (state.seqLength === 12) difficulty = 'hard';

  // Seed the first character
  let currentKey = '';
  if (difficulty === 'easy') {
    currentKey = easyKeys.charAt(Math.floor(Math.random() * easyKeys.length));
  } else {
    currentKey = allKeys.charAt(Math.floor(Math.random() * allKeys.length));
  }
  result += currentKey;

  for (let i = 1; i < length; i++) {
    let nextKey = '';
    const rand = Math.random();

    if (difficulty === 'easy') {
      // 35% hand alternation, 35% adjacent roll, 20% repeat, 10% random (from easyKeys)
      if (rand < 0.35) {
        const left = isLeftHand(currentKey);
        const pool = left ? rightHandEasy : leftHandEasy;
        nextKey = pool.charAt(Math.floor(Math.random() * pool.length));
      } else if (rand < 0.70) {
        const adj = getAdjacentKeys(currentKey).filter(k => easyKeys.includes(k));
        if (adj.length > 0) {
          nextKey = adj[Math.floor(Math.random() * adj.length)];
        } else {
          nextKey = easyKeys.charAt(Math.floor(Math.random() * easyKeys.length));
        }
      } else if (rand < 0.90) {
        nextKey = currentKey;
      } else {
        nextKey = easyKeys.charAt(Math.floor(Math.random() * easyKeys.length));
      }
    } else if (difficulty === 'medium') {
      // 25% hand alternation, 25% adjacent, 10% repeat, 40% random
      if (rand < 0.25) {
        const left = isLeftHand(currentKey);
        const pool = left ? rightHandAll : leftHandAll;
        nextKey = pool.charAt(Math.floor(Math.random() * pool.length));
      } else if (rand < 0.50) {
        const adj = getAdjacentKeys(currentKey);
        if (adj.length > 0) {
          nextKey = adj[Math.floor(Math.random() * adj.length)];
        } else {
          nextKey = allKeys.charAt(Math.floor(Math.random() * allKeys.length));
        }
      } else if (rand < 0.60) {
        nextKey = currentKey;
      } else {
        nextKey = allKeys.charAt(Math.floor(Math.random() * allKeys.length));
      }
    } else {
      // Hard: 100% random across allKeys
      nextKey = allKeys.charAt(Math.floor(Math.random() * allKeys.length));
    }

    result += nextKey;
    currentKey = nextKey;
  }

  return result;
}

// ── Sequence ──────────────────────────────────────────────────────────────────
function generateSequence() {
  if (state.mode === 'letters') {
    return generateLetters(100);
  } else if (state.mode === 'words') {
    let words = [];
    for (let i = 0; i < 60; i++) {
      words.push(COMMON_WORDS[Math.floor(Math.random() * COMMON_WORDS.length)]);
    }
    return words.join(' ');
  } else if (state.mode === 'poems') {
    state.lastPoemIndex = Math.floor(Math.random() * POEMS.length);
    return POEMS[state.lastPoemIndex];
  } else if (state.mode === 'facts') {
    state.lastFactIndex = Math.floor(Math.random() * FACTS.length);
    return FACTS[state.lastFactIndex];
  }
  return '';
}

// ── Display & Teleprompter scrolling ──────────────────────────
function updateScroll() {
  const track = document.getElementById('sequenceTrack');
  if (!track) return;
  
  const currentSpan = document.getElementById(`seqChar${state.currentIndex}`);
  if (!currentSpan) return;
  
  const trackRect = track.getBoundingClientRect();
  const charRect = currentSpan.getBoundingClientRect();
  const displayRect = sequenceDisplay.getBoundingClientRect();
  
  const charRelativeLeft = charRect.left - trackRect.left;
  const displayWidth = displayRect.width;
  
  // Align active character at 25% of the display viewport width
  const targetX = (displayWidth * 0.25) - charRelativeLeft - (charRect.width / 2);
  
  track.style.transform = `translateX(${targetX}px)`;
}

window.addEventListener('resize', updateScroll);

function appendToSequence(newText) {
  const startIndex = state.sequence.length;
  state.sequence += newText;
  
  const track = document.getElementById('sequenceTrack');
  if (!track) return;
  
  if (state.mode === 'letters') {
    for (let i = 0; i < newText.length; i++) {
      const globalIndex = startIndex + i;
      const span = document.createElement('span');
      span.className = 'seq-char';
      span.textContent = newText[i].toUpperCase();
      span.id = `seqChar${globalIndex}`;
      track.appendChild(span);
    }
  } else {
    const words = newText.split(' ');
    let globalIndex = startIndex;
    
    words.forEach((word, wordIdx) => {
      if (word.length === 0) {
        const spaceSpan = document.createElement('span');
        spaceSpan.className = 'seq-char char-space';
        spaceSpan.textContent = '\u00A0';
        spaceSpan.id = `seqChar${globalIndex}`;
        track.appendChild(spaceSpan);
        globalIndex++;
        return;
      }
      
      const wordDiv = document.createElement('div');
      wordDiv.className = 'seq-word';
      
      for (let i = 0; i < word.length; i++) {
        const span = document.createElement('span');
        span.className = 'seq-char';
        span.textContent = word[i].toUpperCase();
        span.id = `seqChar${globalIndex}`;
        wordDiv.appendChild(span);
        globalIndex++;
      }
      
      track.appendChild(wordDiv);
      
      if (wordIdx < words.length - 1 || newText.endsWith(' ')) {
        const spaceSpan = document.createElement('span');
        spaceSpan.className = 'seq-char char-space';
        spaceSpan.textContent = '\u00A0';
        spaceSpan.id = `seqChar${globalIndex}`;
        track.appendChild(spaceSpan);
        globalIndex++;
      }
    });
  }
}

// ── Render ────────────────────────────────────────────────────────────────────
function renderSequence() {
  sequenceDisplay.innerHTML = '';
  
  const track = document.createElement('div');
  track.id = 'sequenceTrack';
  track.className = 'sequence-track ' + (state.mode === 'letters' ? 'mode-letters' : 'mode-words');
  
  if (state.mode === 'letters') {
    for (let i = 0; i < state.sequence.length; i++) {
      const span = document.createElement('span');
      span.className = 'seq-char';
      span.textContent = state.sequence[i].toUpperCase();
      span.id = `seqChar${i}`;
      
      if (i < state.currentIndex) {
        span.classList.add('char-done');
      } else if (i === state.currentIndex) {
        span.classList.add('char-current');
      }
      track.appendChild(span);
    }
  } else {
    const words = state.sequence.split(' ');
    let globalIndex = 0;
    
    words.forEach((word, wordIdx) => {
      if (word.length === 0) {
        const spaceSpan = document.createElement('span');
        spaceSpan.className = 'seq-char char-space';
        spaceSpan.textContent = '\u00A0';
        spaceSpan.id = `seqChar${globalIndex}`;
        
        if (globalIndex < state.currentIndex) {
          spaceSpan.classList.add('char-done');
        } else if (globalIndex === state.currentIndex) {
          spaceSpan.classList.add('char-current');
        }
        track.appendChild(spaceSpan);
        globalIndex++;
        return;
      }
      
      const wordDiv = document.createElement('div');
      wordDiv.className = 'seq-word';
      
      for (let i = 0; i < word.length; i++) {
        const span = document.createElement('span');
        span.className = 'seq-char';
        span.textContent = word[i].toUpperCase();
        span.id = `seqChar${globalIndex}`;
        
        if (globalIndex < state.currentIndex) {
          span.classList.add('char-done');
        } else if (globalIndex === state.currentIndex) {
          span.classList.add('char-current');
        }
        wordDiv.appendChild(span);
        globalIndex++;
      }
      
      track.appendChild(wordDiv);
      
      if (wordIdx < words.length - 1 || state.sequence.endsWith(' ')) {
        const spaceSpan = document.createElement('span');
        spaceSpan.className = 'seq-char char-space';
        spaceSpan.textContent = '\u00A0';
        spaceSpan.id = `seqChar${globalIndex}`;
        
        if (globalIndex < state.currentIndex) {
          spaceSpan.classList.add('char-done');
        } else if (globalIndex === state.currentIndex) {
          spaceSpan.classList.add('char-current');
        }
        track.appendChild(spaceSpan);
        globalIndex++;
      }
    });
  }
  
  sequenceDisplay.appendChild(track);
  
  // Highlight words mode wrapper on sequenceDisplay for styling
  if (state.mode !== 'letters') {
    sequenceDisplay.classList.add('mode-words');
  } else {
    sequenceDisplay.classList.remove('mode-words');
  }
  
  // Initial scroll calculation
  setTimeout(updateScroll, 20);
}

function calculateWPM() {
  if (!state.timerStarted) return 0;
  const elapsedSeconds = 60 - state.timeLeft;
  if (elapsedSeconds <= 0) return 0;
  return Math.round((state.correctKeys / 5) / (elapsedSeconds / 60));
}

function updateStats() {
  if (state.mode === 'words' || state.mode === 'poems' || state.mode === 'facts') {
    scoreLabel.textContent = 'WPM';
    bestStreakLabel.textContent = 'Best WPM';
    streakLabel.textContent = 'Time ⏱️';

    scoreVal.textContent = calculateWPM();
    bestStreakVal.textContent = state.bestWPM;
    streakVal.textContent = `${state.timeLeft}s`;
  } else {
    scoreLabel.textContent = 'Score';
    bestStreakLabel.textContent = 'Best Streak';
    streakLabel.textContent = 'Streak 🔥';

    scoreVal.textContent = state.score;
    bestStreakVal.textContent = state.bestStreak;
    streakVal.textContent = state.streak;
  }

  const acc = state.totalKeys > 0
    ? Math.round((state.correctKeys / state.totalKeys) * 100) : 100;
  accuracyVal.textContent = acc + '%';
}

// ── Keyboard visual ───────────────────────────────────────────────────────────
function flashKey(char, type) {
  const id = KEY_MAP[char.toLowerCase()];
  if (!id) return;
  const el = document.getElementById(id);
  if (!el) return;

  el.classList.remove('key-active', 'key-correct', 'key-wrong');
  el.classList.add(type === 'correct' ? 'key-correct' : type === 'wrong' ? 'key-wrong' : 'key-active');

  setTimeout(() => {
    el.classList.remove('key-active', 'key-correct', 'key-wrong');
  }, 160);
}

// ── Lifecycle ─────────────────────────────────────────────────────────────────
function initGame() {
  if (state.timerInterval) {
    clearInterval(state.timerInterval);
    state.timerInterval = null;
  }

  if (state.hintTimeout) {
    clearTimeout(state.hintTimeout);
    state.hintTimeout = null;
  }



  state.score = 0;
  state.streak = 0;
  state.totalKeys = 0;
  state.correctKeys = 0;
  state.currentIndex = 0;
  state.timeLeft = 60;
  state.timerStarted = false;
  state.lastPoemIndex = -1;
  state.lastFactIndex = -1;
  state.lastKeyPressTime = 0;
  state.timerPaused = false;
  
  state.sequence = generateSequence();

  // Highlight active mode button
  modeBtns.forEach(btn => {
    if (btn.dataset.mode === state.mode) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });

  // Toggle difficulty selector visibility based on mode
  const diffSelector = document.getElementById('difficultySelector');
  if (state.mode === 'poems' || state.mode === 'facts') {
    if (diffSelector) diffSelector.style.display = 'none';
  } else {
    if (diffSelector) diffSelector.style.display = 'flex';
  }

  hintText.textContent = (state.mode === 'words' || state.mode === 'poems' || state.mode === 'facts')
    ? 'Start typing to start the 1-minute test!'
    : 'Press any home row key to begin!';
  hintText.className = 'hint';

  updateStats();
  renderSequence();
}

function startTimer() {
  state.timerStarted = true;
  state.timerPaused = false;
  state.lastKeyPressTime = Date.now();
  state.timerInterval = setInterval(() => {
    // Inactivity check: 5 seconds threshold
    if (Date.now() - state.lastKeyPressTime > 5000) {
      if (!state.timerPaused) {
        state.timerPaused = true;
        hintText.textContent = 'Typing paused due to inactivity. Press any key to resume.';
        hintText.className = 'hint warning';
      }
      return;
    }

    state.timeLeft--;
    if (state.timeLeft <= 0) {
      clearInterval(state.timerInterval);
      state.timerInterval = null;
      endTimerGame();
    }
    updateStats();
  }, 1000);
}

function endTimerGame() {
  if (state.timerInterval) {
    clearInterval(state.timerInterval);
    state.timerInterval = null;
  }



  const finalWpm = calculateWPM();
  const acc = state.totalKeys > 0
    ? Math.round((state.correctKeys / state.totalKeys) * 100) : 100;

  if (finalWpm > state.bestWPM) {
    state.bestWPM = finalWpm;
    saveStats();
  }

  overWpmVal.textContent = finalWpm;
  overAccuracyVal.textContent = acc + '%';
  gameOverOverlay.removeAttribute('hidden');
}



// ── Input ─────────────────────────────────────────────────────────────────────
function handleBackspace() {
  if (state.currentIndex <= 0) return;

  const currentEl = document.getElementById(`seqChar${state.currentIndex}`);
  if (currentEl) {
    currentEl.classList.remove('char-current');
  }

  state.currentIndex--;

  const prevEl = document.getElementById(`seqChar${state.currentIndex}`);
  if (prevEl) {
    if (prevEl.classList.contains('char-done') && !prevEl.classList.contains('char-error')) {
      if (state.correctKeys > 0) state.correctKeys--;
    }
    if (state.totalKeys > 0) state.totalKeys--;

    prevEl.classList.remove('char-done', 'char-error', 'char-pop');
    prevEl.classList.add('char-current');
  }

  state.streak = 0;

  updateScroll();
  updateStats();
}

function handleKey(e) {
  if (e.ctrlKey || e.altKey || e.metaKey) {
    state.lastShortcutTime = Date.now();
    return;
  }
  if (e.key.length > 1 && e.key !== 'Backspace' && e.key !== ' ') {
    return;
  }

  state.lastKeyPressTime = Date.now();

  if (state.timerPaused) {
    state.timerPaused = false;
    hintText.textContent = "";
    hintText.className = "hint";
  }

  if (e.key === ' ') {
    e.preventDefault();
  }

  if (!gameOverOverlay.hasAttribute('hidden')) return;
  if (e.key === 'Backspace') {
    e.preventDefault();
    handleBackspace();
    return;
  }

  if (e.key.length !== 1) return;

  const key = e.key.toLowerCase();
  
  if ((state.mode === 'words' || state.mode === 'poems' || state.mode === 'facts') && !state.timerStarted) {
    startTimer();
  }

  state.totalKeys++;

  const expected = state.sequence[state.currentIndex];
  const charEl = document.getElementById(`seqChar${state.currentIndex}`);

  if (key === expected) {
    state.correctKeys++;
    flashKey(e.key, 'correct');

    if (charEl) {
      charEl.classList.remove('char-current');
      charEl.classList.add('char-done', 'char-pop');
    }
  } else {
    flashKey(e.key, 'wrong');

    if (charEl) {
      charEl.classList.remove('char-current');
      charEl.classList.add('char-done', 'char-error');
      
      charEl.classList.add('char-wrong');
      setTimeout(() => charEl.classList.remove('char-wrong'), 180);
    }

    state.streak = 0;
    
    const expectedLabel = expected === ' ' ? 'SPACE' : expected.toUpperCase();
    hintText.textContent = `Expected "${expectedLabel}"`;
    hintText.className = 'hint';
  }

  state.currentIndex++;

  const nextCharEl = document.getElementById(`seqChar${state.currentIndex}`);
  if (nextCharEl) {
    nextCharEl.classList.add('char-current');
  }

  // Teleprompter continuous appending near the end
  const remainingChars = state.sequence.length - state.currentIndex;
  if (remainingChars < 40) {
    let textToAppend = '';
    if (state.mode === 'letters') {
      textToAppend = generateLetters(50);
    } else if (state.mode === 'words') {
      let words = [];
      for (let i = 0; i < 30; i++) {
        words.push(COMMON_WORDS[Math.floor(Math.random() * COMMON_WORDS.length)]);
      }
      textToAppend = ' ' + words.join(' ');
    } else if (state.mode === 'poems') {
      let nextIndex;
      do {
        nextIndex = Math.floor(Math.random() * POEMS.length);
      } while (nextIndex === state.lastPoemIndex && POEMS.length > 1);
      state.lastPoemIndex = nextIndex;
      const nextPoem = POEMS[nextIndex];
      textToAppend = ' ' + nextPoem;
    } else if (state.mode === 'facts') {
      let nextIndex;
      do {
        nextIndex = Math.floor(Math.random() * FACTS.length);
      } while (nextIndex === state.lastFactIndex && FACTS.length > 1);
      state.lastFactIndex = nextIndex;
      const nextFact = FACTS[nextIndex];
      textToAppend = ' ' + nextFact;
    }
    appendToSequence(textToAppend);
  }

  // scoring for letters mode
  if (state.mode === 'letters') {
    if (state.currentIndex % state.seqLength === 0) {
      const startIdx = state.currentIndex - state.seqLength;
      let hasErrors = false;
      for (let i = startIdx; i < state.currentIndex; i++) {
        const checkEl = document.getElementById(`seqChar${i}`);
        if (checkEl && checkEl.classList.contains('char-error')) {
          hasErrors = true;
          break;
        }
      }

      if (!hasErrors) {
        state.score++;
        state.streak++;
        if (state.score > state.highScore) {
          state.highScore = state.score;
        }
        if (state.streak > state.bestStreak) {
          state.bestStreak = state.streak;
        }
        saveStats();

        hintText.textContent = state.streak > 1
          ? `🔥 ${state.streak} in a row!`
          : '✅ Nice one!';
        hintText.className = 'hint success';

        if (state.hintTimeout) clearTimeout(state.hintTimeout);
        state.hintTimeout = setTimeout(() => {
          hintText.textContent = '';
        }, 1000);
      }
    }
  }

  updateScroll();
  updateStats();
}

// ── Mode ──────────────────────────────────────────────────────────────────────
modeBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    modeBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    state.mode = btn.dataset.mode;
    saveStats();
    initGame();
    btn.blur();
  });
});

// ── Difficulty ────────────────────────────────────────────────────────────────
if (difficultySelect) {
  difficultySelect.addEventListener('change', (e) => {
    state.seqLength = parseInt(e.target.value, 10);
    updateDifficultyField();
    saveStats();
    initGame();
    difficultySelect.blur();
  });
}

// ── Reset ─────────────────────────────────────────────────────────────────────
resetBtn.addEventListener('click', () => {
  initGame();
  resetBtn.blur();
});

// ── Play Again ────────────────────────────────────────────────────────────────
playAgainBtn.addEventListener('click', () => {
  gameOverOverlay.setAttribute('hidden', '');
  initGame();
  playAgainBtn.blur();
});

// ── Inactivity Restart button ─────────────────────────────────────────────────


// ── Mouse tracking for focus control ──────────────────────────────────────────
let isMouseInside = false;
document.addEventListener('mouseenter', () => {
  isMouseInside = true;
});
document.addEventListener('mouseleave', () => {
  isMouseInside = false;
});
document.addEventListener('mousemove', () => {
  isMouseInside = true;
});

// ── Boot ──────────────────────────────────────────────────────────────────────
document.addEventListener('keydown', handleKey);
window.addEventListener('blur', () => {
  if (!gameOverOverlay.hasAttribute('hidden')) return;
  if (!isMouseInside) return;

  const now = Date.now();
  const elapsedShortcut = now - (state.lastShortcutTime || 0);
  if (elapsedShortcut < 500) return;

  const elapsedKeyPress = now - (state.lastKeyPressTime || 0);
  const threshold = state.timerStarted ? 5000 : 2000;
  if (elapsedKeyPress < threshold) {
    if (vscode) {
      vscode.postMessage({ command: 'refocus' });
    }
  }
});
loadStats();
// Set initial active difficulty dropdown state based on state.seqLength
if (difficultySelect) {
  difficultySelect.value = state.seqLength.toString();
}
initGame();

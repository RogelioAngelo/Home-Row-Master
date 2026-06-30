"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
function activate(context) {
    const provider = new HomerowWebviewViewProvider(context.extensionUri, context.globalState);
    // Register the WebviewViewProvider
    context.subscriptions.push(vscode.window.registerWebviewViewProvider(HomerowWebviewViewProvider.viewType, provider, {
        webviewOptions: {
            retainContextWhenHidden: true
        }
    }));
    // The command "homerow.openTrainer" will focus the Home Row Master view container
    const disposable = vscode.commands.registerCommand('homerow.openTrainer', () => {
        vscode.commands.executeCommand('homerow.webviewView.focus');
    });
    context.subscriptions.push(disposable);
}
function deactivate() { }
// ─── Webview View Provider ───────────────────────────────────────────────────
class HomerowWebviewViewProvider {
    constructor(_extensionUri, _globalState) {
        this._extensionUri = _extensionUri;
        this._globalState = _globalState;
    }
    resolveWebviewView(webviewView, context, _token) {
        this._view = webviewView;
        // Configure the Webview options
        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [
                vscode.Uri.joinPath(this._extensionUri, 'media')
            ]
        };
        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);
        // Listen to messages from the webview
        webviewView.webview.onDidReceiveMessage(message => {
            switch (message.command) {
                case 'refocus':
                    vscode.commands.executeCommand('homerow.webviewView.focus');
                    break;
                case 'saveStats':
                    this._globalState.update('hrm_highscore', message.highScore || 0);
                    this._globalState.update('hrm_beststreak', message.bestStreak || 0);
                    this._globalState.update('hrm_bestwpm', message.bestWpm || 0);
                    this._globalState.update('hrm_mode', message.mode || 'letters');
                    this._globalState.update('hrm_seqlength', message.seqLength || 6);
                    break;
                case 'getStats':
                    const highScore = this._globalState.get('hrm_highscore', 0);
                    const bestStreak = this._globalState.get('hrm_beststreak', 0);
                    const bestWpm = this._globalState.get('hrm_bestwpm', 0);
                    const mode = this._globalState.get('hrm_mode', 'letters');
                    const seqLength = this._globalState.get('hrm_seqlength', 6);
                    webviewView.webview.postMessage({
                        command: 'loadStats',
                        highScore,
                        bestStreak,
                        bestWpm,
                        mode,
                        seqLength
                    });
                    break;
            }
        });
    }
    _getHtmlForWebview(webview) {
        const cssUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'game.css'));
        const jsUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'game.js'));
        const nonce = getNonce();
        return /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="Content-Security-Policy" content="
    default-src 'none';
    style-src ${webview.cspSource} https://fonts.googleapis.com;
    font-src https://fonts.gstatic.com;
    img-src ${webview.cspSource} data:;
    script-src 'nonce-${nonce}';
  ">
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600;700&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="${cssUri}" />
  <title>Home Row Master</title>
</head>
<body>

  <!-- Header -->
  <header class="header">
    <div class="logo">
      <span class="logo-icon">⌨</span>
      <span class="logo-text">Home Row <strong>Master</strong></span>
    </div>
    <div class="header-actions">
      <button class="reset-btn" id="resetBtn" title="Reset stats">Reset</button>
    </div>
  </header>

  <!-- Stats Bar -->
  <div class="stats-bar">
    <div class="stat">
      <span class="stat-value" id="scoreVal">0</span>
      <span class="stat-label" id="scoreLabel">Score</span>
    </div>
    <div class="stat hs">
      <span class="stat-value" id="bestStreakVal">0</span>
      <span class="stat-label" id="bestStreakLabel">Best Streak</span>
    </div>
    <div class="stat">
      <span class="stat-value" id="streakVal">0</span>
      <span class="stat-label" id="streakLabel">Streak 🔥</span>
    </div>
    <div class="stat">
      <span class="stat-value" id="accuracyVal">100%</span>
      <span class="stat-label">Accuracy</span>
    </div>
  </div>

  <!-- Control Bar -->
  <div class="control-bar">
    <div class="mode-selector" id="modeSelector">
      <button class="mode-btn active" data-mode="letters" id="modeLetters">Letters</button>
      <button class="mode-btn" data-mode="words" id="modeWords">Words</button>
      <button class="mode-btn" data-mode="poems" id="modePoems">Poems</button>
      <button class="mode-btn" data-mode="facts" id="modeFacts">Facts</button>
    </div>
    <div class="difficulty-selector" id="difficultySelector">
      <select class="diff-select" id="difficultySelect" aria-label="Select difficulty">
        <option value="6">Easy</option>
        <option value="9">Med</option>
        <option value="12">Hard</option>
      </select>
    </div>
  </div>

  <!-- Game Area -->
  <main class="game-area">
    <div class="sequence-display" id="sequenceDisplay" aria-live="polite"></div>
    <p class="hint" id="hintText">Press any home row key to begin!</p>



    <!-- On-screen Keyboard -->
    <div class="keyboard" id="keyboard" aria-hidden="true">
      <div class="kb-row kb-row-top">
        <div class="key" id="key-q">Q</div>
        <div class="key" id="key-w">W</div>
        <div class="key" id="key-e">E</div>
        <div class="key" id="key-r">R</div>
        <div class="key" id="key-t">T</div>
        <div class="key" id="key-y">Y</div>
        <div class="key" id="key-u">U</div>
        <div class="key" id="key-i">I</div>
        <div class="key" id="key-o">O</div>
        <div class="key" id="key-p">P</div>
      </div>
      <div class="kb-row kb-row-home">
        <div class="key home-key" id="key-a">A</div>
        <div class="key home-key" id="key-s">S</div>
        <div class="key home-key" id="key-d">D</div>
        <div class="key home-key" id="key-f">F</div>
        <div class="key home-key" id="key-g">G</div>
        <div class="key home-key" id="key-h">H</div>
        <div class="key home-key" id="key-j">J</div>
        <div class="key home-key" id="key-k">K</div>
        <div class="key home-key" id="key-l">L</div>
        <div class="key home-key" id="key-semi">;</div>
      </div>
      <div class="kb-row kb-row-bottom">
        <div class="key" id="key-z">Z</div>
        <div class="key" id="key-x">X</div>
        <div class="key" id="key-c">C</div>
        <div class="key" id="key-v">V</div>
        <div class="key" id="key-b">B</div>
        <div class="key" id="key-n">N</div>
        <div class="key" id="key-m">M</div>
      </div>
      <div class="kb-row kb-row-space">
        <div class="key space-key" id="key-space">Space</div>
      </div>
    </div>
  </main>

  <!-- Game Over Overlay -->
  <div class="overlay" id="gameOverOverlay" hidden>
    <div class="overlay-card">
      <div class="overlay-emoji">🏆</div>
      <div class="overlay-title">Time's Up!</div>
      <div class="overlay-stats">
        <div class="overlay-stat">
          <span class="overlay-stat-val" id="overWpmVal">0</span>
          <span class="overlay-stat-label">WPM</span>
        </div>
        <div class="overlay-stat">
          <span class="overlay-stat-val" id="overAccuracyVal">100%</span>
          <span class="overlay-stat-label">Accuracy</span>
        </div>
      </div>
      <button class="play-btn" id="playAgainBtn">Play Again</button>
    </div>
  </div>

  <script nonce="${nonce}" src="${jsUri}"></script>
</body>
</html>`;
    }
}
HomerowWebviewViewProvider.viewType = 'homerow.webviewView';
function getNonce() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let nonce = '';
    for (let i = 0; i < 32; i++) {
        nonce += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return nonce;
}
//# sourceMappingURL=extension.js.map
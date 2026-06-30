---
name: homerow_master
description: Launch the Home Row Master typing trainer. Triggers when the user wants to practice home row typing, open the typing trainer, or play the homerow game.
---

# Home Row Master Skill

When this skill is triggered, open the Home Row Master typing trainer for the user.

## Instructions

1. Open the typing trainer by running the following command to launch `popup.html` in the default browser:

```powershell
Start-Process "c:\Users\User\Desktop\personal projects\master the homerow extension\popup.html"
```

2. After launching, tell the user:
   - The game is now open in their browser
   - How to play: just start typing — the timer starts on the first keypress
   - Keys: only home row keys appear (`A S D F G H J K L ;`)
   - They have 30 seconds to complete as many sequences as possible
   - They can switch difficulty (Easy/Med/Hard) in the top-right of the popup

3. If the user asks to **improve** or **modify** the game, the source files are at:
   - `popup.html` — UI structure
   - `popup.css` — Styles/theme
   - `popup.js` — Game logic
   - `manifest.json` — Browser extension config (for loading in Chrome/Edge)

## Notes
- The game works as a standalone HTML file in the browser
- It also works as a Chrome/Edge extension via `chrome://extensions` → Load unpacked

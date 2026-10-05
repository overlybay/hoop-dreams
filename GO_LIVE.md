# HOOP DREAMS — Go Live Guide (v4)

Everything is ready. No coding needed — just upload and share.

## What you're publishing
A mobile web basketball game: **Hoop Dreams** — online streetball for **1–10 players** (up to 5v5), first team to 21, with a 2K-style **Pro Stick**, landscape play, and a **location picker** (Rucker Park, Venice Beach, Dyckman, The Cage, Drew League, or search any place on Earth).
4 files, no build step, no server to run:
- `index.html` — the page
- `game.js` — the whole game
- `style.css` — the look
- `GO_LIVE.md` — this guide

## Step 1 — Put the files on GitHub (5 min)
1. Go to **github.com** and sign in.
2. Click **+** (top right) → **New repository**. Name it `hoop-dreams`. Make it **Public**. Click **Create repository**.
3. On the repo page, click **Add file → Upload files**.
4. Drag in these 4 files from the `blacktop-21` folder: `index.html`, `game.js`, `style.css`, `GO_LIVE.md`.
5. Click **Commit changes**. (If you already uploaded an older version, upload these 4 again to replace them.)

## Step 2 — Put it on Vercel (3 min)
1. Go to **vercel.com** and sign in (you can sign in with GitHub).
2. Click **Add New… → Project**.
3. Find `hoop-dreams` in the list and click **Import**.
4. Don't change any settings — just click **Deploy**.
5. Wait ~1 minute. You'll get a URL like `https://hoop-dreams.vercel.app`. **That's your game.**

## Step 3 — Play tonight (up to 10 players)
1. Open the URL on your phone → **rotate it sideways** (the game plays in landscape).
2. Tap **HOST GAME**, type your name, text the 4-letter code / link to your friends (up to 9 can join).
3. Friends open the link → type their name → tap **JOIN** → they land in your lobby.
4. The lobby auto-splits everyone into **HOME (red)** and **AWAY (blue)** teams as they join.
5. Tap **START GAME** → **pick your court**: choose Rucker Park, Venice Beach, Dyckman, The Cage, Drew League, or search any place in the world. The court name gets painted on the asphalt and the skyline changes to match.
6. First team to 21 wins. **REMATCH** runs it back with the same teams.

## Controls — 2K Pro Stick (on your phone)
- **LEFT thumbstick** — move / dribble. Push it to the edge to sprint.
- **RIGHT thumbstick = THE PRO STICK** (this is the 2K signature):
  - **Flick left / right / down** — dribble moves (crossover, behind-the-back, hesitation). Fills your trick meter, can break ankles.
  - **Push UP and hold, then release** — jump shot with the timing meter (release in the green).
  - **Flick UP quick** — quick jumper.
  - **Hold DOWN near the basket** — post up / back down (harder to steal on).
  - **Flick DOWN quick** — stepback jumper.
  - **On defense:** flick any direction = steal swipe, push UP = block jump.
- Small buttons: **PASS**, **CUT** (off-ball dash), **SWITCH** (defense), **SPRINT**.

## Bluetooth controller (Xbox / PlayStation over Bluetooth)
- Pair your controller to your phone in Bluetooth settings first, then open the game.
- **Left stick** — move / dribble (push fully = sprint). **D-pad** also moves.
- **Right stick** — flick **up** = jumper, flick **left/right** = dribble move, **hold down** = post up, **tap down** = stepback. On defense: flick = steal, push up = block.
- **X / Square** — shoot (hold & release, same timing meter) · **A / Cross** — pass · **B / Circle** — dribble move
- **Y / Triangle** — block · **RB / R1** — steal · **LB / L1** (hold) — sprint
- **Start / Options** — pause (practice) or press twice to quit
- While you're playing on the controller, the on-screen touch controls **auto-hide** for a clean screen (a tiny 🎮 icon stays so you can still pause/quit). They come right back if the controller disconnects or you stop using it for a few seconds.

## Rules
- **1–10 players**, up to 5v5. Short-handed teams just play short — street rules.
- First **team** to **21** wins, no win-by-2
- Inside the arc = **2 pts**, beyond the arc = **3 pts**
- After a basket, the other team checks the ball at the top of the key
- Misses are live rebounds — anyone can grab them
- Dribble moves, stepbacks, steals, and deep 3s fill your **TRICK meter** — when it's full, your next shot is a guaranteed **GAMEBREAKER**

## About the locations
- Preset legendary courts come with their own vibe: Venice Beach plays in the daytime, Rucker Park and The Cage at dusk, Dyckman and Drew League at night.
- Searching any place names that court after your search and drops you there (stylized backdrop unless you add a free photo token — see below).

## Real photo backdrops (free, no card)
The game can paint a REAL street-level photo of your court behind the players, using Mapillary (crowdsourced street photos, free, no card needed):
1. Go to **mapillary.com** and sign up free.
2. Open your **dashboard → developers** and copy your access token.
3. In the game, open the **📷 REAL PHOTO COURTS (FREE)** section on the main menu, paste the token, and hit **SAVE**.
4. Pick any court — a real photo of the spot loads behind the court automatically.

Notes:
- No token, no photo coverage at the spot, or no connection → the game quietly uses the stylized skyline instead. It never breaks.
- The token is saved on your phone only (localStorage) — nothing to rebuild or re-upload.
- Mapillary shows RECENT photos, not the 2007–2023 historical range — the time machine still needs Google later.
- Photo backdrops are credited in-game ("Imagery © Mapillary contributors").

## If something doesn't connect
- Every phone needs internet (Wi-Fi or data).
- If your friend's JOIN can't find the room, have them double-check the 4-letter code, or go back and **HOST GAME again** for a fresh code — the free connection server sometimes needs a retry.
- If someone's game freezes mid-match, they just rejoin with the same link (the host keeps the room running).
- **PRACTICE SOLO** on the menu always works with no connection — good for warmups.
- With 8–10 players the host's phone does the most work; if it gets choppy, fewer players per room plays smoother.

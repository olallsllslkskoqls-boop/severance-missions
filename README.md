# Mission Board

Severance mission board website. Squads verify with an in-game code and claim missions. The lore team posts them.

## Run it locally

Open this folder in VS Code, open `index.html`, click **Go Live**.
Don't double-click the HTML files, the pages need Live Server or a real host.

## Files

- `index.html` landing page and verification
- `board.html` mission board
- `admin.html` lore team panel
- `css/style.css` all styling
- `js/api.js` talks to the backend. `backendUrl` at the top: empty = demo mode, filled = real sheet
- `js/app.js` all page logic
- `data/` demo data, only used in demo mode
- `backend/Code.gs` the Google Apps Script that runs inside the squad sheet
- `img/` artwork and logo

## Going live

1. Open the **[SVR] Central Utility Sheet**, then **Extensions > Apps Script**. Delete what's in `Code.gs`, paste in `backend/Code.gs`, save.
2. Pick `setup` in the function dropdown and click **Run**. Allow the permissions. It creates the **Board Missions** tab with the current missions and logs how many squad members it found.
3. Make an Open Cloud key at create.roblox.com: **Open Cloud > API Keys > Create API Key**. Add **messaging-service**, pick the Nami Region experience, tick **universe-messaging-service:publish**. Accepted IP addresses: `0.0.0.0/0`. Copy the key.
4. Back in Apps Script: **Project Settings** (gear) **> Script Properties > Add script property**. Name `openCloudKey`, value is the key.
5. **Deploy > New deployment**, type **Web app**. Execute as **Me**, Who has access **Anyone**. Copy the URL that ends in `/exec`.
6. Paste that URL into `backendUrl` in `js/api.js`.
7. Publish the Nami Region place so live servers have `CoreRuntime.MissionBoardLink`.

After changing `Code.gs` later: **Deploy > Manage deployments > edit > Version: New version**. The URL stays the same.

## How the sheet is used

- **Reputation Sheet**: read live. Keep `Squad <number>` in each squad header and keep the Roblox User and Lore Name columns. Lore names must match the in-game name, or the code won't show.
- **Lore Team**: everyone marked Active can post and manage missions.
- **Board Missions**: one row per mission. You can edit it by hand. Claimed By holds squad numbers, like `4, 11`.

## Demo mode

While `backendUrl` is empty, the verify card shows the code the game would send, and everything is saved in your browser only. Demo accounts: `renn_tk` / Ren Takeda (Squad 4), `yuihoshi` / Yui Hoshino (Squad 11), `hamdi421` with no lore name (lore team).

# avatar-flag

Browser tool that slices and curves a wide PNG banner into the in-game flag pieces
(Flag1a/b/c, Flag2a/b/c, Flag1bLong, Flag2cLong) and also exports the rounded avatar.

No build step, no dependencies: open `index.html` in a browser.

## Features
- **Banner set** – drop a wide banner (260×146 template), get the 8 curved flag pieces + the 128×128 avatar. Download as ZIP, or pick individual pieces.
- **Rebuild** – load the exported pieces and un-curve them back into the flat banner.

## Files
- `index.html` – markup
- `style.css` – styles
- `app.js` – logic

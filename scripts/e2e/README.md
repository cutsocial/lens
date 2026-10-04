# Browser tests

These play real games in headless Chromium against a local game server, so nothing touches Firebase, Firestore or server.cut.social. Submissions are intercepted.

1. Game server (from the `submission-server` repo, next to this one):
   `LENS_DIR=../lens npm run dev:multiplayer`
2. Lens, pointed at it:
   `VITE_MP_DEV=1 VITE_MP_API=http://localhost:8090/mp VITE_SUBMISSION_API=http://localhost:8091/api/v1 npm start`
3. Tests (Python with `pip install playwright` and `playwright install chromium`):
   - `python scripts/e2e/multiplayer_main.py [screenshot-dir]`: two people play 3 rounds of `demo-multiplayer`; then one person alone gets the computer partner after 20 s, which must follow the fair bot's rules.
   - `python scripts/e2e/multiplayer_edge.py [screenshot-dir]`: `test-multiplayer` in Persian with a practice round; a partner who closes the tab; a partner who stops responding.

Restart the game server between runs: it keeps matches in memory, and players from a run that crashed can still be "waiting" for 30 s.

## Study builder

With `npm start` running (no game server needed):
- `python scripts/e2e/builder_build.py [out-dir]`: builds a study from scratch with every Lens 2 page type, edits text in English and Persian, breaks and fixes a setting, downloads it and runs the validator on the file.
- `python scripts/e2e/builder_roundtrip.py [id,id,...]`: opens published studies, visits every page, downloads them unchanged and checks each file comes back identical.

/**
 * Connection to the multiplayer server (server.cut.social/mp) and live
 * updates of the participant's own match.
 *
 * Production: anonymous Firebase sign-in, requests to the server with the
 * Firebase ID token, live updates from the `lens` Firestore database (the
 * access rules let a browser read only its own match). Firebase is loaded
 * only when a study actually has a multiplayer game.
 *
 * Local testing: with VITE_MP_DEV=1 there is no Firebase at all. The browser
 * gets a random id, and updates come from polling the server's dev-only
 * route (submission-server: `npm run dev:multiplayer`).
 */

// Public identifiers of the Lens web app in Firebase (not secrets).
const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyCQUUiayG-rfxmEY04eodK_pVGNCeUe5EM',
  authDomain: 'jamasp-gcp-project.firebaseapp.com',
  projectId: 'jamasp-gcp-project',
  storageBucket: 'jamasp-gcp-project.appspot.com',
  messagingSenderId: '730427234084',
  appId: '1:730427234084:web:1a961236b02b38c54745b1',
};
const DATABASE = 'lens';

export const MP_API = import.meta.env.VITE_MP_API || 'https://server.cut.social/mp';
const DEV = import.meta.env.VITE_MP_DEV === '1';

export class MpError extends Error {
  constructor(status, code, message) {
    super(message || code);
    this.status = status;
    this.code = code;
  }
}

async function post(path, token, body, { keepalive = false } = {}) {
  let resp;
  try {
    resp = await fetch(`${MP_API}${path}`, {
      method: 'POST',
      mode: 'cors',
      keepalive,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
  } catch (e) {
    throw new MpError(0, 'network', 'could not reach the server');
  }
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) throw new MpError(resp.status, data.error || 'server', data.message);
  return data;
}

let connection = null;

/**
 * Signs in (once per page) and returns
 *   { uid, call(path, body, opts), watch(matchId, onMatch, onError) -> unsubscribe }
 */
export function connect() {
  if (!connection) connection = (DEV ? connectDev() : connectFirebase()).catch((e) => { connection = null; throw e; });
  return connection;
}

async function connectFirebase() {
  const [{ initializeApp }, { getAuth, signInAnonymously }, { getFirestore, doc, onSnapshot }] = await Promise.all([
    import('firebase/app'), import('firebase/auth'), import('firebase/firestore'),
  ]);
  const app = initializeApp(FIREBASE_CONFIG, 'lens-multiplayer');
  const auth = getAuth(app);
  const cred = await signInAnonymously(auth);
  const db = getFirestore(app, DATABASE);
  return {
    uid: cred.user.uid,
    async call(path, body, opts) {
      const token = await auth.currentUser.getIdToken();
      return post(path, token, body, opts);
    },
    watch(matchId, onMatch, onError) {
      return onSnapshot(doc(db, 'matches', matchId),
        (snap) => { if (snap.exists()) onMatch(snap.data()); },
        (err) => onError && onError(err));
    },
  };
}

async function connectDev() {
  const uid = `dev${Math.random().toString(36).slice(2, 10)}`;
  const token = `dev-${uid}`;
  return {
    uid,
    call: (path, body, opts) => post(path, token, body, opts),
    watch(matchId, onMatch, onError) {
      let stopped = false;
      let last = null;
      const poll = async () => {
        if (stopped) return;
        try {
          const resp = await fetch(`${MP_API}/dev/match/${matchId}`, { headers: { Authorization: `Bearer ${token}` } });
          if (resp.ok) {
            const text = await resp.text();
            if (text !== last) { last = text; onMatch(JSON.parse(text)); }
          }
        } catch (e) {
          if (onError) onError(e);
        }
        if (!stopped) setTimeout(poll, 300);
      };
      poll();
      return () => { stopped = true; };
    },
  };
}

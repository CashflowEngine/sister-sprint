// Netzwerk über WebRTC (PeerJS). Ein Spieler ist Gastgeber, alle anderen
// verbinden sich direkt mit ihm. Es gibt keinen eigenen Spiel-Server.

const PREFIX = 'sistersprint-v1-';
const ICE = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:global.stun.twilio.com:3478' },
];

export const MAX_PLAYERS = 5;

export function randomCode() {
  const abc = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 5; i++) s += abc[Math.floor(Math.random() * abc.length)];
  return s;
}

export class Net {
  constructor(h) {
    this.h = h; // { onMessage(id, msg), onLeave(id), onClosed(reason) }
    this.peer = null;
    this.conns = new Map(); // nur Gastgeber: id -> Verbindung
    this.host = null; // nur Mitspieler: Verbindung zum Gastgeber
  }

  hostGame(code) {
    return new Promise((resolve, reject) => {
      if (typeof Peer === 'undefined') return reject(new Error('Netzwerk-Bibliothek konnte nicht geladen werden.'));
      const peer = new Peer(PREFIX + code, { debug: 1, config: { iceServers: ICE } });
      this.peer = peer;
      const timer = setTimeout(() => reject(new Error('Keine Verbindung zum Vermittlungs-Server.')), 15000);
      peer.on('open', () => { clearTimeout(timer); resolve(code); });
      peer.on('error', e => {
        clearTimeout(timer);
        if (e.type === 'unavailable-id') reject(Object.assign(new Error('Code vergeben'), { retry: true }));
        else reject(e);
      });
      peer.on('connection', conn => {
        conn.on('open', () => this.conns.set(conn.peer, conn));
        conn.on('data', d => this.h.onMessage(conn.peer, d));
        const leave = () => {
          if (this.conns.delete(conn.peer)) this.h.onLeave(conn.peer);
        };
        conn.on('close', leave);
        conn.on('error', leave);
      });
      peer.on('disconnected', () => { try { peer.reconnect(); } catch (_) { /* egal */ } });
    });
  }

  joinGame(code) {
    return new Promise((resolve, reject) => {
      if (typeof Peer === 'undefined') return reject(new Error('Netzwerk-Bibliothek konnte nicht geladen werden.'));
      const peer = new Peer({ debug: 1, config: { iceServers: ICE } });
      this.peer = peer;
      let done = false;
      const timer = setTimeout(() => { if (!done) reject(new Error('Zeitüberschreitung – das Spiel antwortet nicht.')); }, 15000);
      peer.on('error', e => {
        clearTimeout(timer);
        if (!done) reject(e.type === 'peer-unavailable' ? new Error('Spiel nicht gefunden. Ist der Gastgeber noch online?') : e);
      });
      peer.on('open', () => {
        const conn = peer.connect(PREFIX + code, { reliable: true });
        this.host = conn;
        conn.on('open', () => { done = true; clearTimeout(timer); resolve(peer.id); });
        conn.on('data', d => this.h.onMessage('H', d));
        conn.on('close', () => this.h.onClosed('Die Verbindung zum Gastgeber wurde beendet.'));
        conn.on('error', () => this.h.onClosed('Verbindungsfehler.'));
      });
    });
  }

  send(msg) { // Mitspieler -> Gastgeber
    if (this.host && this.host.open) this.host.send(msg);
  }

  sendTo(id, msg) {
    const c = this.conns.get(id);
    if (c && c.open) c.send(msg);
  }

  broadcast(msg) {
    for (const c of this.conns.values()) if (c.open) c.send(msg);
  }

  kick(id) {
    const c = this.conns.get(id);
    if (c) setTimeout(() => c.close(), 300);
  }

  get count() { return this.conns.size; }
}

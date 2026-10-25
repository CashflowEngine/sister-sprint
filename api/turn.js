// Vercel-Funktion: gibt kurzlebige TURN-Zugangsdaten (Cloudflare Realtime TURN) aus.
// Schlüssel nur als Umgebungsvariablen TURN_KEY_ID und TURN_KEY_API_TOKEN, nie im Code.
const TTL = 6 * 60 * 60; // 6 Stunden reichen für einen Spieleabend

export async function GET() {
  const keyId = process.env.TURN_KEY_ID;
  const token = process.env.TURN_KEY_API_TOKEN;
  const headers = { 'content-type': 'application/json', 'cache-control': 'no-store' };
  if (!keyId || !token) {
    // Ohne TURN-Schlüssel: leise antworten (200, leere Liste) -> Spiel nutzt nur STUN, kein roter Konsolenfehler
    return new Response(JSON.stringify({ iceServers: [], turn: false }), { status: 200, headers });
  }
  try {
    const r = await fetch(`https://rtc.live.cloudflare.com/v1/turn/keys/${encodeURIComponent(keyId)}/credentials/generate-ice-servers`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ ttl: TTL }),
    });
    if (!r.ok) return new Response(JSON.stringify({ error: 'turn upstream ' + r.status }), { status: 502, headers });
    const d = await r.json();
    const list = Array.isArray(d.iceServers) ? d.iceServers : [d.iceServers];
    // Port 53 wird von Browsern blockiert und nur verzögert -> herausfiltern
    const iceServers = list.filter(Boolean).map(s => ({
      ...s,
      urls: (Array.isArray(s.urls) ? s.urls : [s.urls]).filter(u => !/:53(\?|$)/.test(u)),
    })).filter(s => s.urls.length);
    return new Response(JSON.stringify({ iceServers, ttl: TTL }), { status: 200, headers });
  } catch (e) {
    return new Response(JSON.stringify({ error: 'turn failed' }), { status: 502, headers });
  }
}

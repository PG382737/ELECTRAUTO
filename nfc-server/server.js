const { NFC } = require('nfc-pcsc');
const { WebSocketServer } = require('ws');

const PORT = 6868;
const nfc = new NFC();
const wss = new WebSocketServer({ port: PORT });

let readerConnected = false;

console.log('');
console.log('===========================================');
console.log('   ÉLECTR\'AUTO QUÉBEC — NFC Server');
console.log('===========================================');
console.log(`   WebSocket: ws://localhost:${PORT}`);
console.log('   En attente du lecteur NFC...');
console.log('');

// Broadcast to all connected clients
function broadcast(data) {
    const msg = JSON.stringify(data);
    wss.clients.forEach(function (client) {
        if (client.readyState === client.OPEN) {
            client.send(msg);
        }
    });
}

// WebSocket connections
wss.on('connection', function (ws) {
    console.log('[WS] Client connecté');
    // Send reader status on connect
    ws.send(JSON.stringify({ type: 'status', reader: readerConnected }));

    ws.on('close', function () {
        console.log('[WS] Client déconnecté');
    });
});

// NFC reader
nfc.on('reader', function (reader) {
    readerConnected = true;
    console.log('[NFC] Lecteur détecté: ' + reader.reader.name);
    broadcast({ type: 'status', reader: true });

    reader.on('card', function (card) {
        var uid = card.uid ? card.uid.toUpperCase() : null;
        if (!uid) return;

        console.log('[NFC] Carte scannée — UID: ' + uid);
        broadcast({ type: 'nfc_tag', uid: uid, timestamp: new Date().toISOString() });
    });

    reader.on('card.off', function (card) {
        console.log('[NFC] Carte retirée');
    });

    reader.on('error', function (err) {
        console.error('[NFC] Erreur lecteur:', err.message);
    });

    reader.on('end', function () {
        readerConnected = false;
        console.log('[NFC] Lecteur déconnecté: ' + reader.reader.name);
        broadcast({ type: 'status', reader: false });
    });
});

nfc.on('error', function (err) {
    console.error('[NFC] Erreur:', err.message);
});

console.log('Serveur prêt. Ctrl+C pour quitter.');
console.log('');

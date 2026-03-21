"""
ÉLECTR'AUTO QUÉBEC — NFC Server
Pont entre le lecteur ACR122U et le navigateur web via WebSocket.
Usage: python server.py
"""

import asyncio
import json
import time
import threading
from smartcard.System import readers
from smartcard.CardMonitoring import CardMonitor, CardObserver
from smartcard.util import toHexString

PORT = 6868
clients = set()
reader_connected = False

# ---- WebSocket Server ----

async def ws_handler(websocket):
    clients.add(websocket)
    print("[WS] Client connecté")
    try:
        await websocket.send(json.dumps({"type": "status", "reader": reader_connected}))
        async for _ in websocket:
            pass  # Keep connection alive
    except Exception:
        pass
    finally:
        clients.discard(websocket)
        print("[WS] Client déconnecté")


def broadcast(data):
    msg = json.dumps(data)
    for ws in list(clients):
        try:
            asyncio.run_coroutine_threadsafe(ws.send(msg), loop)
        except Exception:
            pass


# ---- NFC Card Observer ----

class NFCObserver(CardObserver):
    def __init__(self):
        self.last_uid = None
        self.last_time = 0

    def update(self, observable, actions):
        global reader_connected
        added, removed = actions

        for card in added:
            try:
                connection = card.createConnection()
                connection.connect()

                # GET UID command (works with most NFC tags)
                GET_UID = [0xFF, 0xCA, 0x00, 0x00, 0x00]
                data, sw1, sw2 = connection.transmit(GET_UID)

                if sw1 == 0x90 and sw2 == 0x00:
                    uid = toHexString(data).replace(" ", "").upper()

                    # Debounce: ignore same card within 2 seconds
                    now = time.time()
                    if uid == self.last_uid and (now - self.last_time) < 2:
                        return

                    self.last_uid = uid
                    self.last_time = now

                    print(f"[NFC] Carte scannée — UID: {uid}")
                    broadcast({
                        "type": "nfc_tag",
                        "uid": uid,
                        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%S")
                    })
                else:
                    print(f"[NFC] Erreur lecture UID: SW={sw1:02X}{sw2:02X}")

            except Exception as e:
                print(f"[NFC] Erreur: {e}")

        for card in removed:
            pass


def check_readers():
    """Periodically check if reader is connected."""
    global reader_connected
    while True:
        try:
            r = readers()
            connected = len(r) > 0
            if connected != reader_connected:
                reader_connected = connected
                if connected:
                    print(f"[NFC] Lecteur détecté: {r[0]}")
                else:
                    print("[NFC] Lecteur déconnecté")
                broadcast({"type": "status", "reader": connected})
        except Exception:
            pass
        time.sleep(3)


# ---- Main ----

async def main():
    global loop
    loop = asyncio.get_event_loop()

    # Import here to avoid issues
    import websockets.asyncio.server as ws_server

    print("")
    print("===========================================")
    print("   ÉLECTR'AUTO QUÉBEC — NFC Server")
    print("===========================================")
    print(f"   WebSocket: ws://localhost:{PORT}")
    print("   En attente du lecteur NFC...")
    print("")

    # Start card monitor
    monitor = CardMonitor()
    observer = NFCObserver()
    monitor.addObserver(observer)

    # Start reader check thread
    reader_thread = threading.Thread(target=check_readers, daemon=True)
    reader_thread.start()

    # Start WebSocket server
    async with ws_server.serve(ws_handler, "localhost", PORT):
        print(f"   Serveur prêt sur le port {PORT}. Ctrl+C pour quitter.")
        print("")
        await asyncio.Future()  # Run forever


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\nServeur arrêté.")

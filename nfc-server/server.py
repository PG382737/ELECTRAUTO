"""
NFC Reader Server
Pont entre le lecteur ACR122U et le navigateur web via WebSocket.
Tourne silencieusement dans la barre système (system tray).
"""

import asyncio
import json
import time
import threading
import os
import sys
from smartcard.System import readers
from smartcard.CardMonitoring import CardMonitor, CardObserver
from smartcard.util import toHexString

PORT = 6868
clients = set()
reader_connected = False
loop = None
tray_icon = None

# ---- System Tray Icon ----

def create_tray_image(color="#DAA520"):
    """Create a simple NFC icon for the tray."""
    from PIL import Image, ImageDraw
    img = Image.new('RGBA', (64, 64), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    # Draw NFC-style arcs
    draw.ellipse([8, 8, 56, 56], outline=color, width=3)
    draw.ellipse([18, 18, 46, 46], outline=color, width=3)
    draw.ellipse([26, 26, 38, 38], fill=color)
    return img


def update_tray_status():
    """Update tray icon and tooltip based on connection status."""
    if not tray_icon:
        return
    try:
        if reader_connected:
            tray_icon.icon = create_tray_image("#22c55e")
            tray_icon.title = "NFC Reader — Lecteur connecté"
        else:
            tray_icon.icon = create_tray_image("#ef4444")
            tray_icon.title = "NFC Reader — Lecteur déconnecté"
    except Exception:
        pass


def quit_app(icon, item):
    """Quit the application from tray menu."""
    icon.stop()
    os._exit(0)


def run_tray():
    """Run system tray icon in its own thread."""
    global tray_icon
    import pystray
    tray_icon = pystray.Icon(
        "NFC Reader",
        create_tray_image("#DAA520"),
        "NFC Reader — Démarrage...",
        menu=pystray.Menu(
            pystray.MenuItem("NFC Reader Server", None, enabled=False),
            pystray.Menu.SEPARATOR,
            pystray.MenuItem("Quitter", quit_app)
        )
    )
    tray_icon.run()


# ---- WebSocket Server ----

async def ws_handler(websocket):
    clients.add(websocket)
    try:
        await websocket.send(json.dumps({"type": "status", "reader": reader_connected}))
        async for _ in websocket:
            pass
    except Exception:
        pass
    finally:
        clients.discard(websocket)


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

                GET_UID = [0xFF, 0xCA, 0x00, 0x00, 0x00]
                data, sw1, sw2 = connection.transmit(GET_UID)

                if sw1 == 0x90 and sw2 == 0x00:
                    uid = toHexString(data).replace(" ", "").upper()

                    now = time.time()
                    if uid == self.last_uid and (now - self.last_time) < 2:
                        return

                    self.last_uid = uid
                    self.last_time = now

                    broadcast({
                        "type": "nfc_tag",
                        "uid": uid,
                        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%S")
                    })

            except Exception:
                pass

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
                broadcast({"type": "status", "reader": connected})
                update_tray_status()
        except Exception:
            pass
        time.sleep(3)


# ---- Main ----

async def main():
    global loop
    loop = asyncio.get_event_loop()

    import websockets.asyncio.server as ws_server

    # Start system tray
    tray_thread = threading.Thread(target=run_tray, daemon=True)
    tray_thread.start()

    # Start card monitor
    monitor = CardMonitor()
    observer = NFCObserver()
    monitor.addObserver(observer)

    # Start reader check thread
    reader_thread = threading.Thread(target=check_readers, daemon=True)
    reader_thread.start()

    # Start WebSocket server
    async with ws_server.serve(ws_handler, "localhost", PORT):
        await asyncio.Future()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        if tray_icon:
            tray_icon.stop()

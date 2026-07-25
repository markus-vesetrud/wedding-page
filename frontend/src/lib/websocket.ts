import type { PublicAppState, WsDeltaUpdate, WsMessage } from '$shared/types';

export type StateCallback = (state: PublicAppState) => void;
export type DeltaCallback = (update: WsDeltaUpdate) => void;

interface WebSocketHandlers {
	onState: StateCallback;
	onDelta: DeltaCallback;
}

/**
 * Connects to the app WebSocket via the /api/negotiate endpoint.
 * Calls `onState` whenever the server sends a full state snapshot.
 * Returns helpers to send updates and close the socket.
 */
export function createWebSocket(handlers: WebSocketHandlers) {
	let ws: WebSocket | null = null;
	let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

	async function connect() {
		try {
			const res = await fetch('/api/negotiate', { method: 'POST' });
			if (!res.ok) {
				console.error('negotiate failed', res.status);
				scheduleReconnect();
				return;
			}
			const { url } = (await res.json()) as { url: string };

			ws = new WebSocket(url, 'json.webpubsub.azure.v1');

			ws.onopen = () => console.log('WebSocket connected');

			ws.onmessage = (event) => {
				try {
					const msg = JSON.parse(event.data) as WsMessage;

					if (msg.type === 'state') {
						handlers.onState(msg.data);
					}
					else if (
						msg.type === 'add' ||
						msg.type === 'update'
					) {
						handlers.onDelta(msg);
					}
				} catch (e) {
					console.warn('WebSocket message parse error', e);
				}
			};

			ws.onclose = () => {
				console.log('WebSocket closed');
				scheduleReconnect();
			};

			ws.onerror = (e) => {
				console.error('WebSocket error', e);
				ws?.close();
			};
		} catch (e) {
			console.error('connect error', e);
			scheduleReconnect();
		}
	}

	function scheduleReconnect() {
		if (reconnectTimer) return;
		reconnectTimer = setTimeout(() => {
			reconnectTimer = null;
			connect();
		}, 3000);
	}

	function close() {
		if (reconnectTimer) clearTimeout(reconnectTimer);
		ws?.close();
	}

	connect();

	return { close };
}

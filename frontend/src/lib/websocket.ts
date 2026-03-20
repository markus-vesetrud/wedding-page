import type { AppState, WsMessage } from './types';

export type StateCallback = (state: AppState) => void;

/**
 * Connects to Azure Web PubSub via the /api/negotiate endpoint.
 * Calls `onState` whenever the server sends a full state snapshot.
 * Returns helpers to send updates and close the socket.
 */
export function createWebSocket(onState: StateCallback) {
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
					const envelope = JSON.parse(event.data);
					// Web PubSub wraps messages in { type, ... }
					// Server messages come as { type: 'message', data: ... }
					let msg: WsMessage;
					if (envelope.type === 'message' && envelope.data) {
						msg = typeof envelope.data === 'string' ? JSON.parse(envelope.data) : envelope.data;
					} else if (envelope.data) {
						msg = typeof envelope.data === 'string' ? JSON.parse(envelope.data) : envelope.data;
					} else {
						// direct message
						msg = envelope;
					}
					if (msg.type === 'state' || msg.type === 'update') {
						onState(msg.data);
					}
				} catch (e) {
					console.warn('ws message parse error', e);
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

	function sendUpdate(state: AppState) {
		if (ws?.readyState === WebSocket.OPEN) {
			const msg: WsMessage = { type: 'update', data: state };
			ws.send(
				JSON.stringify({
					type: 'event',
					event: 'message',
					dataType: 'json',
					data: msg
				})
			);
		}
	}

	function close() {
		if (reconnectTimer) clearTimeout(reconnectTimer);
		ws?.close();
	}

	connect();

	return { sendUpdate, close };
}

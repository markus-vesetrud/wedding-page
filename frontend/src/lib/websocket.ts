import type { AppState, WsDeltaMessage, WsMessage } from './types';

export type StateCallback = (state: AppState) => void;
export type DeltaCallback = (update: WsDeltaMessage) => void;

interface WebSocketHandlers {
	onState: StateCallback;
	onDelta: DeltaCallback;
}

/**
 * Connects to Azure Web PubSub via the /api/negotiate endpoint.
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
					const envelope = JSON.parse(event.data);

					let msg: WsMessage;
					if (envelope.type === 'message' && envelope.data) {
						msg = typeof envelope.data === 'string' ? JSON.parse(envelope.data) : envelope.data;
					} else if (envelope.data) {
						msg = typeof envelope.data === 'string' ? JSON.parse(envelope.data) : envelope.data;
					} else {
						msg = envelope;
					}

					if (msg.type === 'state') {
						handlers.onState(msg.data);
						return;
					}

					if (
						msg.type === 'item-added' ||
						msg.type === 'item-checked' ||
						msg.type === 'item-unchecked'
					) {
						handlers.onDelta(msg);
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

	function close() {
		if (reconnectTimer) clearTimeout(reconnectTimer);
		ws?.close();
	}

	connect();

	return { close };
}

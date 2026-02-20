/** A single item in either the gift registry or guest list */
export interface ListItem {
	id: string;
	text: string;
	checked: boolean;
}

/** The full persisted state */
export interface AppState {
	gifts: ListItem[];
	guests: ListItem[];
}

/** Messages sent over the WebSocket */
export type WsMessage =
	| { type: 'state'; data: AppState }
	| { type: 'update'; data: AppState };

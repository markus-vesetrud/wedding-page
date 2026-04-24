
export interface Item {
	id: string;
	name: string;
	checked: boolean;
	updatedAt: Date;
}
export interface Guest extends Item {
	allergies?: string;
}

export interface Cake extends Item {
	servings: number;
	bakerName?: string;
}

export interface Gift extends Item {
	gifterName?: string;
}

/** The full persisted state */
export interface AppState {
	gifts: Gift[];
	guests: Guest[];
	cakes: Cake[];
}

export type ListName = keyof AppState;

export type ListEntity = Gift | Guest | Cake;

export type WsDeltaMessage =
	| { type: 'item-added'; list: ListName; item: ListEntity }
	| { type: 'item-checked'; list: ListName; item: ListEntity }
	| { type: 'item-unchecked'; list: ListName; item: ListEntity };

/** Messages sent over the WebSocket */
export type WsMessage =
	| { type: 'state'; data: AppState }
	| WsDeltaMessage;


interface Item {
	id: string;
	name: string;
	checked: boolean;
	updatedAt: Date;
}
export interface Guest extends Item{
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

/** Messages sent over the WebSocket */
export type WsMessage =
	| { type: 'state'; data: AppState }
	| { type: 'update'; data: AppState };

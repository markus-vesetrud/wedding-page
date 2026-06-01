export interface Item {
  id: string;
  name: string;
  checked: boolean;
  updatedAt: string;
}

export interface Guest extends Item {
  allergies?: string;
  invitationId?: string;
}

export interface Cake extends Item {
  servings: number;
  bakerName?: string;
}

export interface Gift extends Item {
  gifterName?: string;
}

export interface Invitation {
  id: string;
  name: string;
  guestIds: string[];
  visitedAt: string[];
}

export interface AppState {
  gifts: Gift[];
  guests: Guest[];
  cakes: Cake[];
  invitations: Invitation[];
}

export type ListName = keyof AppState;
export type ListEntity = Gift | Cake | Guest;

export type WsDeltaMessage =
  | { type: 'item-added'; list: ListName; item: ListEntity }
  | { type: 'item-checked'; list: ListName; item: ListEntity }
  | { type: 'item-unchecked'; list: ListName; item: ListEntity };

export type WsMessage =
  | { type: 'state'; data: AppState }
  | WsDeltaMessage;

export type DeltaUpdate = WsDeltaMessage;
export type BaseItem = Item;
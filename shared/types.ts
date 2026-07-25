export interface Item {
  id: string;
  name: string;
  updatedAt: string;
}

export enum Attendance {
  Attending = "Kommer",
  NotAttending = "Kommer ikke",
  NotAnswered = "Ikke svart"
}
export interface Guest extends Item {
  attendance: Attendance;
  allergies?: string;
  invitationId?: string;
}

export interface CakeSuggestion extends Item {
  bakerName?: string;
}

export interface Cake extends CakeSuggestion {
  claimed: boolean;
}

export interface Gift extends Item {
  gifterName?: string;
  claimed: boolean;
}

export interface Invitation {
  id: string;
  name: string;
  guestIds: string[];
  visitedAt: string[];
}

/** State broadcast to all connected clients — excludes unreviewed cake suggestions, which are admin-only. */
export interface PublicAppState {
  gifts: Gift[];
  guests: Guest[];
  cakes: Cake[];
  invitations: Invitation[];
}

export interface AppState extends PublicAppState {
  cakeSuggestions: CakeSuggestion[];
}

export type ListName = keyof AppState;
export type ListEntity = Gift | Cake | Guest | Invitation | CakeSuggestion;

export type WsDeltaUpdate =
  | { type: 'add'; list: ListName; item: ListEntity }
  | { type: 'update'; list: ListName; item: ListEntity };

export type WsDeltaType = WsDeltaUpdate['type'];

export type WsMessage =
  | { type: 'state'; data: PublicAppState }
  | WsDeltaUpdate;

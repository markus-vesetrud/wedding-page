export interface Item {
  id: string;
  name: string;
  updatedAt: string;
}

export enum Attendance {
  Attending = "Kommer",
  NotAttending = "Kommer ikke",
  Unsure = "Usikker"
}
export interface Guest extends Item {
  attendance: Attendance;
  allergies?: string;
  invitationId?: string;
}

export interface Cake extends Item {
  claimed: boolean;
  servings: number;
  bakerName?: string;
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

export interface AppState {
  gifts: Gift[];
  guests: Guest[];
  cakes: Cake[];
  invitations: Invitation[];
}

export type ListName = keyof AppState;
export type ListEntity = Gift | Cake | Guest | Invitation;

export type WsDeltaUpdate =
  | { type: 'add'; list: ListName; item: ListEntity }
  | { type: 'update'; list: ListName; item: ListEntity };

export type WsDeltaType = WsDeltaUpdate['type']; 

export type WsMessage =
  | { type: 'state'; data: AppState }
  | WsDeltaUpdate;

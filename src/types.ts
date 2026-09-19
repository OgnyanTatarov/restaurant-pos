export type Station = "kitchen" | "bar";
export type SideMode = "none" | "free" | "paid" | "mixed";
export type ModifierKind = "extra" | "leaveout";
export type Side = {
  id: string;
  name: string;
  price: number;
  deleted: boolean;
};
export type Modifier = {
  id: string;
  name: string;
  kind: ModifierKind;
  price: number;
  deleted: boolean;
};
export type Addon = {
  id: string;
  name: string;
  price: number;
  deleted: boolean;
};
export type AddonGroup = {
  id: string;
  name: string;
  deleted: boolean;
  extras: Addon[];
};
export type CookOption = {
  id: string;
  name: string;
  deleted: boolean;
};
export type LineChoices = {
  cook?: { id: string; name: string };
  side?: { id: string; name: string; price: number };
  extras: { id: string; name: string; price: number }[];
  leaveouts: { id: string; name: string }[];
};
export type Item = {
  id: string;
  menuId: string;
  name: string;
  price: number;
  station: Station;
  qty: number;
  note: string;
  sent: boolean;
  voided: boolean;
  voidReason?: string;
  paidQty?: number;
  choices?: LineChoices;
};
export type BillPayment = {
  id: string;
  at: string;
  payment: string;
  amount: number;
  items: { id: string; name: string; qty: number; amount: number }[];
};
export type Order = {
  id: string;
  tableId: string;
  tableName: string;
  status: "open" | "paid" | "void" | "deleted" | "merged";
  version: number;
  items: Item[];
  createdAt: string;
  closedAt?: string;
  openedBy: string;
  payment?: string;
  paidTotal?: number;
  payments?: BillPayment[];
  reason?: string;
};
export type Table = {
  id: string;
  name: string;
  room: string;
  seats: number;
  deleted: boolean;
};
export type Category = {
  id: string;
  name: string;
  deleted: boolean;
  sideMode: SideMode;
  sides: Side[];
};
export type MenuItem = {
  id: string;
  name: string;
  price: number;
  category: string;
  station: Station;
  available: boolean;
  deleted: boolean;
  image?: string;
  modifiers: Modifier[];
  addonGroups: AddonGroup[];
  cookOptions?: CookOption[];
  sideMode?: SideMode | "inherit";
};
export type Job = {
  id: string;
  orderId: string;
  tableName: string;
  station: Station | "bill";
  kind: string;
  items: Item[];
  status: string;
  createdAt: string;
  attempts: number;
  error: string;
  printerId?: string;
};
export type NamedPrinter = { id: string; name: string; device?: string };
export type PrinterAssignments = {
  named: NamedPrinter[];
  kitchen: string;
  bar: string;
  bill: string;
};
export type State = {
  schema: number;
  revision: number;
  settings: {
    name: string;
    currency: string;
    accent: string;
    ticketFooter: string;
    ticketFont: number;
    paperWidth: number;
    managerPinHash: string;
  };
  tables: Table[];
  categories: Category[];
  menu: MenuItem[];
  orders: Order[];
  jobs: Job[];
  audit: {
    id: string;
    at: string;
    actor: string;
    action: string;
    detail: string;
  }[];
};
export type Actor = { id: string; name: string; role: "manager" | "waiter" };
export type Command = {
  id: string;
  type: string;
  payload: Record<string, unknown>;
};
export type Connection = {
  mode: "lan" | "cloud";
  url: string;
  token: string;
  key: string;
  restaurantId: string;
};
declare global {
  interface Window {
    posDesktop?: Record<
      string,
      (...args: any[]) => Promise<{ ok: boolean; data: any; error?: string }>
    >;
  }
}

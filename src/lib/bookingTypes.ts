export type BookingStatus = 'Tentative' | 'Confirmed' | 'Completed' | 'Cancelled';

export interface EquipmentLine {
  id: number;
  itemName: string;
  spec: string;
  qty: number;
}

export interface Booking {
  id: number;
  eventTitle: string;
  clientName: string;
  clientEmail: string;
  clientPhone: string;
  eventType: string;
  venueName: string;
  venueAddress: string;
  eventDate: string; // YYYY-MM-DD
  setupTime: string; // HH:MM
  startTime: string; // HH:MM
  endTime: string; // HH:MM
  pickupDate: string;
  pickupTime: string;
  notes: string;
  status: BookingStatus;
  equipment: EquipmentLine[];
  services: string[];
  createdAt: string;
  updatedAt: string;
}

export const EVENT_TYPES = [
  'Wedding',
  'Quinceañera',
  'Birthday Party',
  'Corporate',
  'Sweet 16',
  'Graduation',
  'Anniversary',
  'Other',
];

export const ALL_SERVICES = [
  'LED Dance Floor',
  'Sound System',
  'DJ Equipment',
  'Uplighting',
  'String Lights',
  'Stage',
  'Wireless Mics',
  'Podium Mic',
  'Fog Machine',
  'Projector & Screen',
  'LED Backdrop',
  'Neon Signs',
  'Photo Booth',
  'Truss',
  'Confidence Monitor',
];

export const STATUSES: BookingStatus[] = ['Tentative', 'Confirmed', 'Completed', 'Cancelled'];

export const STEP_LABELS = ['Client', 'Schedule', 'Venue', 'Equipment', 'Services'];

let tempIdCounter = -1;

export function blankBooking(): Booking {
  return {
    id: 0,
    eventTitle: '',
    clientName: '',
    clientEmail: '',
    clientPhone: '',
    eventType: EVENT_TYPES[0],
    venueName: '',
    venueAddress: '',
    eventDate: '',
    setupTime: '',
    startTime: '',
    endTime: '',
    pickupDate: '',
    pickupTime: '',
    notes: '',
    status: 'Tentative',
    equipment: [],
    services: [],
    createdAt: '',
    updatedAt: '',
  };
}

// Negative placeholder ids for not-yet-saved rows in form state — the real
// (positive, autoincrement) id is assigned by the database on save.
export function blankEquipmentLine(): EquipmentLine {
  return { id: tempIdCounter--, itemName: '', spec: '', qty: 1 };
}

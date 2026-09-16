export type BookingStatus = 'Tentative' | 'Confirmed' | 'Completed' | 'Cancelled';

export interface EquipmentItem {
  id: string;
  itemName: string;
  spec?: string;
  qty: number;
}

export interface Booking {
  id: string;
  eventTitle: string;
  clientName: string;
  clientPhone: string;
  clientEmail: string;
  eventDate: string; // YYYY-MM-DD
  setupTime: string; // HH:MM
  startTime: string; // HH:MM
  endTime: string; // HH:MM
  pickupDate: string;
  pickupTime: string;
  venueName: string;
  venueAddress: string;
  eventType: string;
  notes: string;
  status: BookingStatus;
  services: string[];
  equipment: EquipmentItem[];
  createdAt: number;
  updatedAt: number;
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

export function blankBooking(): Booking {
  const now = Date.now();
  return {
    id: now.toString(36) + Math.random().toString(36).slice(2, 8),
    eventTitle: '',
    clientName: '',
    clientPhone: '',
    clientEmail: '',
    eventDate: '',
    setupTime: '',
    startTime: '',
    endTime: '',
    pickupDate: '',
    pickupTime: '',
    venueName: '',
    venueAddress: '',
    eventType: EVENT_TYPES[0],
    notes: '',
    status: 'Tentative',
    services: [],
    equipment: [],
    createdAt: now,
    updatedAt: now,
  };
}

export function blankEquipmentItem(): EquipmentItem {
  return { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), itemName: '', spec: '', qty: 1 };
}

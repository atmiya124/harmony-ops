export type Mode = 'calculator' | 'events';
export type BookingStatus = 'Tentative' | 'Confirmed' | 'Completed' | 'Cancelled';

export type EquipmentItem = {
  id: string;
  name: string;
  qty: number;
  spec?: string;
  dimensions?: string;
  notes?: string;
  source: 'manual' | 'attached';
};

export type EventBooking = {
  id: number;
  title: string;
  clientName: string;
  clientPhone: string;
  clientEmail: string;
  eventDate: string;
  setupTime: string;
  startTime: string;
  endTime: string;
  pickupDetail: string;
  venueName: string;
  venueAddress: string;
  eventType: string;
  status: BookingStatus;
  notes: string;
  services: string[];
  equipment: EquipmentItem[];
  attachedSpecs?: Array<{ dimensions: string; resolution: string; powerDraw: string }>;
};

export type PartnerSettings = {
  companyName: string;
  partnerEmails: string[];
  reminder7Days: boolean;
  reminder2Days: boolean;
  reminder1Day: boolean;
};

export const partnerSettings: PartnerSettings = {
  companyName: 'Harmony Production',
  partnerEmails: ['partners@harmonyproduction.ca', 'ops@harmonyproduction.ca'],
  reminder7Days: true,
  reminder2Days: true,
  reminder1Day: true,
};

export const equipmentCatalog = [
  { name: 'LED wall 8x14', pixelPitch: '3.9mm', resolution: '3840x1920', powerDraw: '3.8 kW', width: 8, height: 14 },
  { name: 'LED wall 8x12', pixelPitch: '3.9mm', resolution: '3840x1680', powerDraw: '3.4 kW', width: 8, height: 12 },
  { name: 'LED wall 10x12', pixelPitch: '4.8mm', resolution: '3200x1600', powerDraw: '3.1 kW', width: 10, height: 12 },
  { name: 'LED wall 12x18', pixelPitch: '4.8mm', resolution: '3840x2880', powerDraw: '6.1 kW', width: 12, height: 18 },
  { name: 'Stage 8x8', pixelPitch: 'N/A', resolution: 'N/A', powerDraw: '0.6 kW', width: 8, height: 8 },
  { name: 'Stage 8x12', pixelPitch: 'N/A', resolution: 'N/A', powerDraw: '1.0 kW', width: 8, height: 12 },
];

export const initialEvents: EventBooking[] = [
  {
    id: 101,
    title: 'Spring Social Showcase',
    clientName: 'Ashleigh Lee',
    clientPhone: '+1 (403) 555-0142',
    clientEmail: 'ashleigh@spring.social',
    eventDate: '2026-10-05',
    setupTime: '09:00',
    startTime: '18:00',
    endTime: '22:00',
    pickupDetail: 'Loading dock by the east entrance',
    venueName: 'Riverside Hall',
    venueAddress: '1200 8 Ave SW, Calgary AB',
    eventType: 'Corporate Event',
    status: 'Confirmed',
    notes: 'Need AV check at 4:00 PM. Client expects a branded stage wrap.',
    services: ['LED Backdrop', 'Sound System', 'Uplighting'],
    equipment: [
      { id: 'e1', name: 'LED wall 8x14', qty: 1, spec: '3.9mm', dimensions: '8x14 ft', source: 'attached' },
      { id: 'e2', name: 'Stage 8x12', qty: 2, spec: 'modular', dimensions: '8x12 ft', source: 'manual' },
    ],
    attachedSpecs: [{ dimensions: '8x14 ft', resolution: '3840x1920', powerDraw: '3.8 kW' }],
  },
  {
    id: 102,
    title: 'Northside Community Gala',
    clientName: 'Darren Price',
    clientPhone: '+1 (587) 555-1101',
    clientEmail: 'darren@ncsociety.ca',
    eventDate: '2026-10-12',
    setupTime: '11:30',
    startTime: '19:00',
    endTime: '23:30',
    pickupDetail: 'Trailer drop-off at back lot',
    venueName: 'The Atrium',
    venueAddress: '2800 10 St NE, Calgary AB',
    eventType: 'Gala',
    status: 'Tentative',
    notes: 'Need pickup after midnight; confirm final catering counts by Friday.',
    services: ['Sound System', 'Wireless Mics', 'Truss'],
    equipment: [
      { id: 'e3', name: 'Stage 8x8', qty: 1, spec: 'portable', dimensions: '8x8 ft', source: 'manual' },
    ],
  },
];

export const defaultCalculatorInputs = {
  width: '',
  height: '',
  pixelPitch: '3.9',
  panelCount: 0,
  powerDraw: 0,
};

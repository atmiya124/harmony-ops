// Company details printed on quote and invoice PDFs — the one place they
// live. Anything left null is simply left off the document (no placeholder
// text is ever printed), so fill these in as the details are confirmed.
//
// Bank details are printed on invoices only when every field is set; there
// are deliberately no example account numbers here.

export interface BankDetails {
  bankName: string;
  transit: string;
  institution: string;
  account: string;
}

export interface DocumentConfig {
  companyName: string;
  // Printed in the footer (the logo image carries its own copy).
  services: string[]; // "LED DISPLAY | SOUND | STAGE | LIGHTS"
  addressLines: string[]; // e.g. ['123 Street', 'Toronto, ON  M1M 1M1']
  phones: string[];
  businessHours: string | null; // e.g. 'Monday to Saturday 9:00am to 6:00pm'
  email: string | null; // general enquiries
  website: string | null; // shown without https://
  payment: {
    // Listed on quotes: "PAYMENT METHOD: E-Transfer, VISA, …".
    methods: string[];
    // Cards accepted, e.g. "Visa, MasterCard, American Express".
    cards: string[];
    cardNote: string | null; // e.g. 'Call to pay by card'
    etransferEmail: string | null; // where e-transfers go
    bank: BankDetails | null;
  };
  quoteFooterNote: string;
  invoiceFooterNote: string;
}

export const DOCUMENT_CONFIG: DocumentConfig = {
  companyName: 'Harmony Production',
  services: ['LED DISPLAY', 'SOUND', 'STAGE', 'LIGHTS'],
  addressLines: ['15 Cromarty Drive', 'Etobicoke, ON  M9W 2X5'],
  phones: ['(416) 833-0534', '(647) 886-1091'],
  businessHours: null,
  email: 'info@harmonyproduction.ca',
  website: 'www.harmonyproduction.ca',
  payment: {
    methods: ['E-Transfer', 'VISA', 'MasterCard', 'Bank Transfer'],
    cards: ['Visa', 'MasterCard', 'American Express'],
    cardNote: 'Call to pay by card',
    etransferEmail: null,
    bank: null,
  },
  quoteFooterNote: 'This quote is an estimate based on the event scope described above. Any change in scope will be quoted separately and approved before booking.',
  invoiceFooterNote: 'Thank you for your business. Please include the invoice number as the reference with your payment so we can match it to your account.',
};

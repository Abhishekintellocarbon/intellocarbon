/**
 * Bill layout fixtures.
 *
 * IMPORTANT, read before trusting a green run: these are reconstructions of
 * the *layouts* used by each discom — label wording, field ordering, digit
 * grouping, unit tokens — assembled from how those bills are laid out. They
 * are not copies of real customer bills, and no genuine bill was available
 * when they were written. They prove the parser handles the shapes it was
 * built for; they cannot prove it handles a real bill from any of these
 * utilities. Validating against genuine bills is a separate step, and the
 * per-format failures it turns up belong here as new fixtures.
 */

export type BillFixture = {
  name: string;
  /** Plain text as the PDF text layer or OCR would yield it. */
  text: string;
};

export const MSEDCL_HT_INDUSTRIAL: BillFixture = {
  name: "MSEDCL — HT industrial, Indian digit grouping, load and demand on one line",
  text: `MAHARASHTRA STATE ELECTRICITY DISTRIBUTION CO. LTD.
MAHAVITARAN
HT ENERGY BILL
Consumer No : 010119001234          Bill No : 1234567890
Consumer Name : NORTHWIND STEEL PVT LTD
Tariff Category : HT-I INDUSTRIAL
Sanctioned Load : 2500 KVA          Contract Demand : 2400 KVA
Billing Period : 01/06/2026 to 30/06/2026
Present Reading : 458200            Previous Reading : 445700
Units Consumed : 12,50,000 kWh
Rate Per Unit : Rs. 8.45
Net Bill Amount : Rs. 1,05,62,500.00`,
};

export const TANGEDCO_HT: BillFixture = {
  name: "TANGEDCO — western digit grouping, DD-MM-YYYY, load in kVA",
  text: `TAMIL NADU GENERATION AND DISTRIBUTION CORPORATION LIMITED
TANGEDCO HT CURRENT CONSUMPTION BILL
Service Connection No: 0123456789
Tariff: HT-IA INDUSTRIAL
Sanctioned Demand: 1500 KVA
Billing Period: 01-07-2026 to 31-07-2026
Total Units Consumed: 845,320 kWh
Average Rate Per Unit: 7.90
Total Amount Payable: 66,780,280.00`,
};

export const BESCOM_LT_NO_UNIT_TOKEN: BillFixture = {
  name: "BESCOM — LT, unit count printed with no unit symbol, DD.MM.YYYY",
  text: `BANGALORE ELECTRICITY SUPPLY COMPANY LIMITED
BESCOM
RR No: BLR-4471-2290
Tariff: LT-5 INDUSTRIAL
Sanctioned Load: 85 KW
Billing Period: 05.05.2026 - 04.06.2026
Units Consumed: 42500
Rate/Unit: 7.10
Total Payable: 301750.00`,
};

export const PVVNL_BILLING_MONTH_ONLY: BillFixture = {
  name: "PVVNL (UP) — billing month instead of a date range, MWh unit",
  text: `PASCHIMANCHAL VIDYUT VITRAN NIGAM LIMITED
PVVNL
Account No: 4400123456
Tariff Category: LMV-6 INDUSTRIAL
Sanctioned Load: 120 KW
Billing Month: JUNE-2026
Energy Consumed: 96.4 MWh
Rate Per Unit: 8.05`,
};

export const TORRENT_KVAH_ONLY: BillFixture = {
  name: "Torrent Power (Gujarat) — states kVAh only, no kWh figure printed",
  text: `TORRENT POWER LIMITED
Service No: 992010445
Tariff: HTP-I INDUSTRIAL
Sanctioned Load: 3000 KVA
Billing Period: 01/06/2026 to 30/06/2026
Units Consumed: 1,120,400 kVAh
Rate Per Unit: 8.10`,
};

export const CONFLICTING_UNITS: BillFixture = {
  name: "Two equally-authoritative unit readings that disagree",
  text: `WEST BENGAL STATE ELECTRICITY DISTRIBUTION COMPANY LIMITED
Tariff: HT-B INDUSTRIAL
Billing Period: 01/06/2026 to 30/06/2026
Units Consumed: 500000 kWh
Total Energy Consumed: 620000 kWh`,
};

export const AMBIGUOUS_DATE_ORDER: BillFixture = {
  name: "Date range where both components are 12 or under",
  text: `KERALA STATE ELECTRICITY BOARD
Tariff: HT-1 INDUSTRIAL
Billing Period: 01/06/2026 to 05/07/2026
Units Consumed: 210000 kWh`,
};

export const UNKNOWN_DISCOM: BillFixture = {
  name: "A utility not in the registry — fields still read, discom and state stay null",
  text: `SOME PRIVATE POWER SUPPLY COMPANY
Tariff Category: HT-II INDUSTRIAL
Sanctioned Load: 900 KVA
Billing Period: 01/06/2026 to 30/06/2026
Units Consumed: 333000 kWh
Rate Per Unit: 9.15`,
};

export const NOT_A_BILL: BillFixture = {
  name: "A document that is not an electricity bill at all",
  text: `PURCHASE ORDER
Vendor: Acme Refractories Pvt Ltd
PO Number: PO-2026-8841
Delivery Date: 12/06/2026
Item: Magnesia carbon brick, 40 tonnes
Total: Rs. 18,40,000`,
};

export const ALL_FIXTURES: BillFixture[] = [
  MSEDCL_HT_INDUSTRIAL,
  TANGEDCO_HT,
  BESCOM_LT_NO_UNIT_TOKEN,
  PVVNL_BILLING_MONTH_ONLY,
  TORRENT_KVAH_ONLY,
  CONFLICTING_UNITS,
  AMBIGUOUS_DATE_ORDER,
  UNKNOWN_DISCOM,
  NOT_A_BILL,
];

// 2027 Fee Fixing Resolution (New Juaben Municipal) — temporal-structure rates.
// SUGGESTIONS ONLY: the register auto-fills the Fee when staff pick the structure
// and the field is still empty; staff can always type an exact amount where the
// office decides otherwise (the resolution values never lock the register).
export const STRUCTURE_FEE_2027: Record<string, number> = {
  "Wooden": 60.68,                                  // Wooden Kiosks/Sheds
  "Small": 120,                                     // Containers/Sealed Metal
  "Medium": 120,
  "Large": 120,
  "Double Container": 120,
};
export function structureFee2027(size: string): number | null {
  const f = STRUCTURE_FEE_2027[size];
  return typeof f === "number" ? f : null;
}

// 2027 BOP business-operation rates by registered business type — suggestions
// only (the office can always set a different figure). Sources: '2027 frr new'.
//   Retail Shop          = Container/Kiosk shop (Small)          250
//   Provision Store      = Neighbourhood Shops (Small)           225
//   Table-Top/Open-Stall = Table tops                            160
//   Food Joint /Chop Bar = Traditional Catering Grade 3          650
//   Bar / Pub / Spot     = Drinking Bar Grade 3                  650
//   Mobile Food & Drinks = Local Fast Food Vendors Grade 2       300
//   Tailoring & Fashion  = Non-industrial tailor (Small)         160
//   Hairdressing & Barbering = Single-service Small (assoc.)     460
//   Phone / Electronics Repair = Repairs Only (Small)            300
//   Mobile Money / Banking Agent = MoMo Vendor (Small)          375
//   Pharmacy / Chemist   = OTCM Licensed Chemist, out-of-CBD     369
//   Metal Works / Welding    = Arc welder, container shop (Med)  480
//   Carpentry / Wood Works   = Artisan CAT A                    100
//   Auto Repairs / Fitting   = Light duty / informal small      200
//   Fabric / Textiles    = Fabricated facility retail (Small)    150
//   Agro Inputs / Farm Produce = Agro-chem retail (Small)        180
export const BOP_FEE_2027: Record<string, number> = {
  "Retail Shop": 250,
  "Provision Store": 225,
  "Table-Top / Open-Stall Trader": 160,
  "Food Joint / Chop Bar": 650,
  "Bar / Pub / Spot": 650,
  "Mobile Food & Drinks": 300,
  "Tailoring & Fashion": 160,
  "Hairdressing & Barbering": 460,
  "Phone / Electronics Repair": 300,
  "Mobile Money / Banking Agent": 375,
  "Pharmacy / Chemist": 369,
  "Metal Works / Welding": 480,
  "Carpentry / Wood Works": 100,
  "Auto Repairs / Fitting": 200,
  "Fabric / Textiles": 150,
  "Agro Inputs / Farm Produce": 180,
};
export function bopFee2027(type: string): number | null {
  const f = BOP_FEE_2027[type];
  return typeof f === "number" ? f : null;
}

// The Assembly basic rate (GH₵ 1.00) belongs to every bill — included in totals.
export const BASIC_RATE_2027 = 1;

export const SUPPLIERS = [
  { code: "SUP-FORMOSA", name: "Formosa Display Systems", email: "sales@formosadisplay.example", phone: "+886-7-555-0131", address: "Kaohsiung Export Processing Zone, Taiwan" },
  { code: "SUP-HINEUNG", name: "Hineung Semiconductor", email: "sales@hineung.example", phone: "+82-51-555-0142", address: "Busan New Port, South Korea" },
  { code: "SUP-LIKANG", name: "Shenzhen LiKang Battery", email: "sales@likangbattery.example", phone: "+86-755-555-0175", address: "Nansha, Guangzhou, China" },
  { code: "SUP-BRIGHT", name: "Suzhou Bright PCBA", email: "sales@brightpcba.example", phone: "+86-512-555-0164", address: "Suzhou Industrial Park, China" },
  { code: "SUP-FLEX", name: "Osaka Flex Cableworks", email: "sales@osakaflex.example", phone: "+81-6-555-0153", address: "Osaka, Japan" },
  { code: "SUP-PENANG", name: "Penang Plastics & Molds", email: "sales@penangplast.example", phone: "+60-4-555-0186", address: "Bayan Lepas, Penang, Malaysia" },
  { code: "SUP-HCMC", name: "Ho Chi Minh Assembly Co.", email: "sales@hcmassembly.example", phone: "+84-28-555-0185", address: "Cat Lai Industrial Zone, Ho Chi Minh City, Vietnam" },
  { code: "SUP-CHANGSHA", name: "Changsha Magnetic Components", email: "sales@changshamag.example", phone: "+86-731-555-0118", address: "Changsha, Hunan, China" },
  { code: "SUP-DRAYAGE", name: "Rotterdam Drayage B.V.", email: "ops@rotterdamdrayage.example", phone: "+31-10-555-0190", address: "Waalhaven, Rotterdam, Netherlands" },
] as const;

/** Real ocean carriers for kicks; inland/barge/truck fictional. */
export const CARRIERS = [
  { name: "Maersk Line", mode: "OCEAN" },
  { name: "MSC Mediterranean Shipping", mode: "OCEAN" },
  { name: "CMA CGM", mode: "OCEAN" },
  { name: "Hapag-Lloyd", mode: "OCEAN" },
  { name: "ONE (Ocean Network Express)", mode: "OCEAN" },
  { name: "Erasmus Shuttle", mode: "INLAND" },
  { name: "Betuweroute Express", mode: "RAIL" },
  { name: "Prins Logistics", mode: "TRUCK" },
  { name: "Maasvlakte Trucking", mode: "TRUCK" },
] as const;

export const DISTRIBUTORS = [
  { code: "DIST-AMS", name: "Amsterdam Techniek BV", address: "Amsterdam, NL" },
  { code: "DIST-BER", name: "Berlin Elektronikhandel", address: "Berlin, DE" },
  { code: "DIST-PAR", name: "Paris Audio + Vidéo", address: "Paris, FR" },
  { code: "DIST-MIL", name: "Milano Hi-Tech SRL", address: "Milan, IT" },
  { code: "DIST-MAD", name: "Madrid Consumer Electronics", address: "Madrid, ES" },
  { code: "DIST-WAW", name: "Warszawa Digital", address: "Warsaw, PL" },
  { code: "DIST-ANR", name: "Antwerp Parts BV", address: "Antwerp, BE" },
  { code: "DIST-ZUR", name: "Zurich Gadget AG", address: "Zurich, CH" },
] as const;
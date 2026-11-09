# -*- coding: utf-8 -*-
"""
Master data for the 150-target acquisition database.
Source of truth: research/notes.md (WebSearch findings, 2026-11-09).

Rules applied:
- No email is listed unless it appeared in a search result attributed to the company
  (own site, own app-store listing, or marketplace seller imprint). Everything else is
  "contact form / imprint - verify".
- Website is listed only if it surfaced in search results; otherwise "not verified".
- Scores: see SCORING in build_outputs.py (A..G components, 100 max).

Tuple layout:
 (name, country, city, website, category, reason, evidence, contact, person, lang,
  inventory, scores(A,B,C,D,E,F,G))
 A evidence of high-end Apple Silicon 0-25 | B off-market/incoming supply 0-20
 C sells single units 0-15 | D geography 0-15 | E contact channel 0-10
 F motivation for quick sale 0-10 | G expected price edge 0-5
Categories: ITAD = liquidator/ITAD/auction; RESELLER = used-Mac reseller/refurbisher;
            STUDIO = creative/technical studio; ENTERPRISE = leasing/rental/procurement;
            REPAIR = independent repair shop
"""

T = []
def add(*row):
    T.append(row)

NV = "not verified"
CF = "Contact form / imprint on website - email not verified"

# ----------------------------------------------------------------- SWITZERLAND
add("Revendo AG", "CH", "Basel (10 branches)", "revendo.ch", "RESELLER",
    "Largest Swiss Apple refurbisher; buys Macs (trade-in up to CHF 12,410) so receives high-end units; sells single units.",
    "Search-indexed product pages: Mac Studio M2 Ultra 192GB/8TB (CHF 3,158, out of stock), M1 Ultra 128GB 1TB & 2TB pages, MBP16 M1 Max 64GB/1TB from CHF 1,835.",
    "info@revendo.ch; +41 61 500 28 28 (refurbed seller imprint)", "", "de",
    "M1 Ultra 128GB pages; MBP16 M1 Max 64GB; M2 Ultra 192GB (sold out)", (24, 17, 15, 15, 10, 5, 3))
add("Data Quest AG (DQ Solutions)", "CH", "Dietikon (13 locations: Zürich, Basel, Bern, Luzern...)", "dq-solutions.ch", "RESELLER",
    "Apple Premium Partner with business customers; runs a demo/occasion/refurbished section (1-yr warranty) and receives business trade-ins.",
    "dq-solutions.ch 'Demo and refurbished devices' pages; occasion MBP14 M1 Pro listing; ~300 staff.",
    "+41 44 745 77 66; " + CF, "", "de",
    "Occasion/demo Macs (M1 Pro seen); Mac Studio M2 Ultra sold new", (14, 15, 13, 15, 7, 4, 2))
add("JES (Digitec/Galaxus marketplace refurbisher)", "CH", NV, NV, "RESELLER",
    "Refurbisher selling on Digitec/Galaxus with a Mac Studio M1 Max 64GB listing.",
    "digitec.ch product 62385928: 'jes Apple Mac Studio M1 Max 64GB 1TB A like new refurbished'.",
    "Contact via Digitec/Galaxus marketplace seller page - email not verified", "", "de",
    "Mac Studio M1 Max 64GB/1TB", (20, 10, 14, 15, 4, 4, 3))
add("AfB social & green IT (group: CH/DE/AT/FR)", "CH", "Swiss branch; HQ Ettlingen DE", "afb-group.ch / afbshop.de", "ITAD",
    "Non-profit ITAD that buys corporate laptop fleets (Blancco erasure) and resells single refurbished units incl. Apple; B2B shop.",
    "afb-group.ch 'Gebrauchte Firmen-IT verkaufen'; Stiftung Warentest 09/2025 best refurbished-laptop shop; 21 sites DE/AT/FR/CH/SK.",
    "sales@afb-group.eu; +49 7243 20000-1000 (press release)", "", "de",
    "Corporate fleet returns (mostly Windows; Apple share unknown)", (10, 18, 13, 15, 10, 5, 3))
add("Turbo IT (turboit.ch)", "CH", NV, "turboit.ch", "ITAD",
    "Swiss IT buy-back programme (Blancco erasure, payment within 48h) - source of corporate returns.",
    "turboit.ch pages 'IT Ankauf Schweiz' surfaced in search; no independent corroboration found.",
    CF, "", "de", "Unknown", (6, 15, 8, 15, 4, 5, 3))
add("Budgetcomputer.ch / pc-ankauf.ch", "CH", NV, "budgetcomputer.ch", "ITAD",
    "Buys business computers with certified erasure and runs its own refurbishment shop.",
    "budgetcomputer.ch/ankauf; named in itreseller.ch 'Refurbished-IT in der Schweiz'.",
    CF, "", "de", "Refurb shop stock (Apple share unknown)", (6, 15, 12, 15, 5, 5, 3))
add("informatik-profi.ch", "CH", NV, "informatik-profi.ch", "ITAD",
    "Free Swiss-wide pickup and buy-back of company laptops (revDSG erasure).",
    "informatik-profi.ch/info/ankauf-it-hardware.html (ref: 45 HP EliteBooks).",
    CF, "", "de", "Corporate returns (mostly Windows)", (4, 14, 8, 15, 5, 5, 3))
add("ONiKO Services AG", "CH", NV, NV, "ITAD",
    "Swiss dealer in used IT hardware (PCs, notebooks, servers).",
    "Listed in Tradeloop/broker directories (European ITAD list search).",
    "Not verified", "", "de", "Unknown", (4, 12, 6, 15, 2, 5, 3))
add("SPIE Schweiz - Re-useIT", "CH", NV, NV, "ITAD",
    "B2B platform for used/refurbished IT incl. laptops, with pickup and erasure.",
    "netzwoche.ch 2024-03-05 'Spie Schweiz steigt ins Geschäft mit gebrauchter IT-Hardware ein'.",
    "Not verified", "", "de", "Mostly infrastructure; laptops possible", (3, 12, 5, 15, 2, 4, 3))
add("ALSO Schweiz AG - ALSO Recommerce / Lifecycle", "CH", "Emmen", "also.com", "ITAD",
    "Large distributor with ITAD/remarketing arm since 1998; receives lease returns.",
    "also.com 'Trade-In | ITAD | Remarketing' & 'Lifecycle Solutions' pages.",
    CF, "", "de", "Bulk remarketing; single sales unlikely", (6, 16, 3, 15, 4, 3, 3))
add("Compu-Trade", "CH", NV, "compu-trade.ch", "RESELLER",
    "Sells tested used Macs (3-month warranty) and accepts trade-ins.",
    "compu-trade.ch/apple-gebraucht 'Mac gebraucht kaufen Schweiz: Apple Occasionen'.",
    CF, "", "de", "Used Macs (configs unknown)", (8, 14, 14, 15, 5, 4, 3))
add("IT-Store Schweiz", "CH", NV, NV, "RESELLER",
    "Swiss refurbished-IT vendor.", "Named in itreseller.ch 'Refurbished-IT in der Schweiz: Eine Bestandsaufnahme'.",
    "Not verified", "", "de", "Unknown", (4, 10, 12, 15, 2, 3, 3))
add("Letec IT Solution", "CH", "Schaffhausen", "letec.ch", "REPAIR",
    "Independent Apple reseller/service branch (not part of DQ merger); sees business trade-ins.",
    "letec.ch history page (Schaffhausen branch continued independently).",
    CF, "", "de", "Unknown", (6, 10, 10, 15, 5, 4, 2))
add("Tomac Computer Concept AG", "CH", "Zürich (Sihlfeldstrasse 53)", NV, "REPAIR",
    "Apple shop & support in Zürich; repair shops accumulate trade-ins and business upgrades.",
    "zuri.net listing 'Tomac Computer Concept AG' (Apple-Shop, support).",
    "Not verified (zuri.net listing)", "", "de", "Unknown", (6, 10, 10, 15, 3, 4, 2))
add("macgarage", "CH", "Zürich (Langstrasse)", NV, "REPAIR",
    "Mac support shop in Zürich.", "zuri.net listing 'macgarage' Apple Mac support.",
    "Not verified (zuri.net listing)", "", "de", "Unknown", (5, 9, 10, 15, 3, 4, 2))
add("ReboostMac", "CH", "Lugano", NV, "REPAIR",
    "Reported Lugano shop selling refurbished MacBooks - Ticino, closest CH location to Italy.",
    "Low-authority page (msstate.edu eportfolio) only - existence to verify.",
    "Not verified", "", "it", "Unknown", (5, 8, 10, 15, 2, 4, 2))
add("Bechtle Schweiz (Bechtle Direct)", "CH", NV, "bechtle.com", "ENTERPRISE",
    "Authorised Apple reseller to Swiss businesses; handles trade-in/lifecycle for clients.",
    "netzwoche.ch 'Bechtle Direct wird autorisierter Apple-Reseller'; Bechtle product finders list Mac Studio M2.",
    CF, "", "de", "Client fleet returns (via lifecycle services)", (8, 10, 3, 15, 4, 2, 1))
add("Digitec Galaxus AG (returns / second-hand)", "CH", "Zürich", "digitec.ch / galaxus.ch", "RESELLER",
    "Largest Swiss e-tailer; lists used/returned units and third-party refurbishers (Revendo, JES).",
    "digitec.ch used MacBook Pro listing 'kaum genutzt'; marketplace listings for Mac Studio M1 Max 64GB (JES).",
    "Customer service form - email not verified", "", "de",
    "Returns & marketplace refurbs", (14, 8, 15, 15, 4, 2, 2))
add("REDSPACE", "CH", "Zürich-Altstetten", "redspace.ch", "STUDIO",
    "Edit/grade house for features, docs and commercials - typical buyer of Mac Studio editorial seats in 2022-23.",
    "redspace.ch services: Schnitt, Color Grading, DCP. Mac use not confirmed.",
    CF, "", "de", "Unknown", (8, 10, 8, 15, 5, 6, 4))
add("Cinegrell Postproduction", "CH", "Zürich-Saatlen (+PostFactory Berlin)", "cinegrell.ch", "STUDIO",
    "Full-service post (conform, grade, VFX, motion) - multiple workstations; Baselight grading (likely Linux) but editorial/motion often Mac.",
    "cinegrell.ch/en/post; acquired PostFactory Berlin.",
    CF, "", "de", "Unknown", (7, 10, 6, 15, 5, 5, 4))
add("Unsere Farben", "CH", "Zürich-Altstetten", "unserefarben.ch", "STUDIO",
    "DI/colour house conforming into DaVinci Resolve (runs well on Mac Studio).",
    "unserefarben.ch/en: Resolve DI postproduction.", CF, "", "de", "Unknown", (8, 9, 8, 15, 5, 6, 4))
add("frame eleven", "CH", "Zürich (since 1988)", "frame-eleven.com", "STUDIO",
    "Film + motion design studio (editing, compositing, VFX) - 3D/motion seats.",
    "frame-eleven.com.", CF, "", "de", "Unknown", (8, 9, 8, 15, 5, 6, 4))
add("IVY Filmstudio", "CH", "Zürich", "ivyfilmstudio.com", "STUDIO",
    "Post supervision, grading, finishing, 2D compositing for cinema/series.",
    "ivyfilmstudio.com.", CF, "", "de", "Unknown", (7, 9, 8, 15, 5, 6, 4))
add("ORBIS Production", "CH", "Zürich", "orbispro.ch", "STUDIO",
    "Video/film production company with in-house post.", "orbispro.ch.", CF, "", "de", "Unknown", (6, 8, 8, 15, 5, 6, 4))
add("Ledfilms Production", "CH", "Lugano (Piazza Molino Nuovo 17)", "ledfilms.com", "STUDIO",
    "Lugano full-service production: editing, grading, 2D animation, compositing - Ticino, Italian-speaking, near IT border.",
    "ledfilms.com portfolio/services.", CF, "", "it", "Unknown", (8, 10, 8, 15, 5, 6, 4))
add("Akra Studios", "CH", "Chiasso", "akrastudios.com", "STUDIO",
    "In-house production to post; broadcast spots for RSI; sound design - adjacent to Como.",
    "akrastudios.com.", CF, "", "it", "Unknown", (7, 9, 8, 15, 5, 6, 4))
add("PAZART Sagl", "CH", "Stabio / Lugano", "pazart.ch", "STUDIO",
    "15+ years: advanced editing, VFX, 2D-3D animation, sound design.",
    "pazart.ch.", CF, "", "it", "Unknown", (8, 9, 8, 15, 5, 6, 4))
add("Red Studio", "CH", "Stabio", "redstudio.ch", "STUDIO",
    "Video, photo and VFX studio active in Ticino and Milan.", "redstudio.ch/en.",
    CF, "", "it", "Unknown", (7, 9, 8, 15, 5, 6, 4))
add("Central Productions", "CH", "Lugano (Via Cortivallo)", "centralproductions.ch", "STUDIO",
    "Independent production/post with in-house colourist and graphic designers.",
    "centralproductions.ch.", CF, "", "it", "Unknown", (7, 9, 8, 15, 5, 6, 4))
add("Thirty Seconds (produzionevideolugano.ch)", "CH", "Lugano", "produzionevideolugano.ch", "STUDIO",
    "3D graphics, After Effects and motion graphics specialist.",
    "produzionevideolugano.ch.", CF, "", "it", "Unknown", (7, 8, 8, 15, 5, 6, 4))
add("Thomas Graziani Visuals", "CH", "Lugano", "thomasgraziani.com", "STUDIO",
    "Corporate video incl. motion graphics (small operator).", "thomasgraziani.com/video-aziendali-lugano.",
    CF, "", "it", "Unknown", (5, 6, 10, 15, 5, 6, 4))
add("Armonica Film", "CH", NV, "armonicafilm.ch", "STUDIO",
    "Swiss video production company.", "armonicafilm.ch surfaced in Ticino production search.",
    CF, "", "it", "Unknown", (5, 7, 8, 15, 5, 6, 4))
add("Archileader Sagl", "CH", "Ticino", NV, "STUDIO",
    "Architecture practice doing 3D modelling and rendering (GPU/RAM-heavy).",
    "Practitioner profile (Archileader Sagl, since 2013) - Mac use unknown.",
    "Not verified", "", "it", "Unknown", (4, 6, 8, 15, 2, 5, 4))
add("RTS Radio Télévision Suisse", "CH", "Geneva", "rts.ch", "ENTERPRISE",
    "Migrated grading to Mac Studio M3 Ultra 256GB (2025) - large broadcaster; older Apple Silicon may have been retired.",
    "tkt1957.com / panoramaaudiovisual 2025-11-27: RTS DaVinci Resolve on Mac Studio M3 Ultra.",
    "Not verified (procurement via SRG)", "", "fr", "Possibly retired Mac Studios", (12, 8, 2, 15, 2, 2, 3))

# ----------------------------------------------------------------- ITALY
add("TrenDevice S.p.A. (incl. BuyDifferent)", "IT", "Milano (Viale Sondrio 7); stores Milano, Torino, Roma, Avellino", "trendevice.com", "RESELLER",
    "Leading Italian refurbisher; buys used Macs; sells refurbished Mac Studio with business invoices. Entered 'composizione negoziata della crisi' (June 2025) - may need to move stock.",
    "trendevice.com Mac Studio M4 Max page; blog 'come vendere il tuo Mac usato'; CS deposito CNC 2025.",
    "Website contact form (only an investor-relations address is published) - email not verified", "", "it",
    "Refurbished Mac Studio (M4 Max seen)", (16, 16, 15, 15, 5, 8, 3))
add("Smart Generation srl", "IT", "Messina", "smartgeneration.it", "RESELLER",
    "Italian Apple refurbisher sourcing in IT/EU/US; MBP16 M1 Max configurator incl. 64GB; eBay Mac Studio M1 Max.",
    "smartgeneration.it MBP16 M1 Max page; eBay Mac Studio M1 Max 1,779€; App Store vendor contact.",
    "info@smartgeneration.it; +39 391 497 6053 (App Store listing)", "", "it",
    "MBP16 M1 Max (64GB option); Mac Studio M1 Max", (18, 13, 15, 15, 10, 4, 3))
add("FlashMac", "IT", "Bolzano", "flashmac.com", "REPAIR",
    "Bolzano refurb/repair/upgrade of Macs - close to CH/AT.",
    "Trustpilot au 'flashmac.com'; Italian article lists FlashMac (Bolzano). Contact search not corroborated.",
    CF, "", "it", "Unknown", (6, 10, 12, 15, 4, 4, 3))
add("Techflash", "IT", NV, "techflash.it", "RESELLER",
    "Refurbished Mac seller with customers in Bolzano province.", "Trustpilot techflash.it reviews.",
    CF, "", "it", "Unknown", (6, 9, 13, 15, 4, 4, 3))
add("Juice / MedStore (Apple Premium Reseller group)", "IT", "Northern & Central Italy (~56-60 stores)", "juice.it", "RESELLER",
    "Largest Italian APR group; runs 'Juice Ricondizionati' and trade-ins, incl. business customers.",
    "hwupgrade.it merger article; Trustpilot 'Juice Ricondizionati Apple'.",
    CF, "", "it", "Trade-ins/refurbished (configs unknown)", (10, 14, 12, 15, 4, 3, 2))
add("R-Store (Apple Premium Partner)", "IT", "Campania + online", "rstore.it", "RESELLER",
    "APR with online/in-store trade-in programme (permuta) - accumulates used Macs.",
    "rstore.it/pages/permuta-valutazione-usato.", CF, "", "it", "Trade-ins", (8, 13, 10, 15, 4, 3, 2))
add("C&C Shop (Apple experts)", "IT", NV, "shop.cec.com", "RESELLER",
    "Apple reseller with used-device trade-in.", "shop.cec.com/it trade-in offer.",
    CF, "", "it", "Trade-ins", (7, 12, 10, 15, 4, 3, 2))
add("CE Group (Apple Premium Reseller)", "IT", "Milano, Monza, Novara, Varese", NV, "RESELLER",
    "APR near Milan that historically took in, traded and resold used Macs with warranty.",
    "macitynet.it 'CeGroup ritira permuta e vende Mac usati e garantiti per 90 giorni' (old, sponsored).",
    "Not verified", "", "it", "Trade-ins (historic)", (8, 12, 10, 15, 2, 3, 2))
add("Distribuzione Computer e Cellulari", "IT", NV, "distribuzionecomputerecellulari.it", "ITAD",
    "B2B distributor of used MacBooks with warranty to resellers - upstream bulk source.",
    "distribuzionecomputerecellulari.it 'Vendita Apple MacBook Usati con Garanzia per Reseller B2B'.",
    CF, "", "it", "Used MacBook lots", (10, 16, 7, 15, 4, 4, 4))
add("NCOM (pc-ricondizionati.com)", "IT", NV, "pc-ricondizionati.com", "ITAD",
    "Italy-wide trade-in/asset recovery of corporate notebooks & workstations with NIST erasure.",
    "pc-ricondizionati.com/trade-in-asset-recovery.", CF, "", "it", "Corporate returns", (5, 15, 10, 15, 4, 5, 3))
add("Vikast", "IT", NV, "vikast.it", "ITAD",
    "Buys corporate PCs Italy-wide, pays residual value, per-device erasure certificates.",
    "vikast.it/lp/vendere-pc-aziendali-usati.html.", CF, "", "it", "Corporate returns", (4, 15, 6, 15, 4, 5, 3))
add("Renewtech", "IT", NV, "renewtech.it", "ITAD",
    "ITAD with NIST 800-88 erasure, ISO 27001.", "renewtech.it/itad.", CF, "", "it", "Corporate returns", (4, 14, 6, 15, 4, 5, 3))
add("Mitrade", "IT", NV, "mitrade.it", "ITAD",
    "Data erasure / IT disposition provider.", "mitrade.it/lp-data-erasure.", CF, "", "it", "Unknown", (3, 12, 5, 15, 4, 4, 3))
add("Apple Mediastore (authorised service)", "IT", "Milano (Via Valtellina 12)", NV, "REPAIR",
    "Authorised Apple service centre in Milan - sees business machines being replaced.",
    "Sponsored listing on macitynet.it.", "Not verified", "", "it", "Unknown", (5, 8, 6, 15, 2, 4, 2))
add("Riparazione PC Milano", "IT", "Milano Bicocca / Monza / Brugherio", "riparazionepcmilano.it", "REPAIR",
    "Independent repair (Windows & Mac) in Milan area.", "Trustpilot riparazionepcmilano.it.",
    CF, "", "it", "Unknown", (3, 7, 8, 15, 4, 4, 2))
add("Pixel (Torino)", "IT", "Torino", NV, "REPAIR",
    "Turin IT shop listing refurbished Macs among its services.", "virgilio.it business listing.",
    "Not verified", "", "it", "Refurbished Macs", (4, 7, 10, 15, 2, 4, 2))
add("Roxmir", "IT", "Castello di Brianza (LC)", "roxmir.it", "REPAIR",
    "Mac repair (MacBook Pro, iMac, Mac mini) and refurbished guides.", "roxmir.it FAQ.",
    CF, "", "it", "Unknown", (3, 7, 8, 15, 4, 4, 2))
add("Square Post Production", "IT", "Milano", NV, "STUDIO",
    "Major Milan post/VFX studio with 24 workstations (grading, compositing, VFX).",
    "blissagency.it 'Top 10 VFX agencies in Italy 2026'.", "Not verified", "", "it", "Unknown", (8, 11, 6, 15, 2, 5, 4))
add("EDI Effetti Digitali Italiani", "IT", "Milano", NV, "STUDIO",
    "Historic Milan VFX house.", "blissagency.it VFX ranking.", "Not verified", "", "it", "Unknown", (7, 10, 5, 15, 2, 5, 4))
add("XLR8", "IT", "Milano", "xlr8.it", "STUDIO",
    "Audio/video post: compositing, VFX, motion graphics, Resolve grading, CGI.",
    "xlr8.it/services.", CF, "", "it", "Unknown", (8, 9, 8, 15, 5, 6, 4))
add("Racoon Studio", "IT", "Milano (since 2006)", NV, "STUDIO",
    "2D/3D animation and motion design studio.", "blissagency.it VFX ranking.", "Not verified", "", "it", "Unknown", (7, 8, 8, 15, 2, 6, 4))
add("Officina Kreativa", "IT", "Crotone / Milano / Barcelona", NV, "STUDIO",
    "3D animation & VFX for advertising.", "blissagency.it VFX ranking.", "Not verified", "", "it", "Unknown", (6, 8, 8, 15, 2, 6, 4))
add("22Dogs", "IT", "Milano", NV, "STUDIO",
    "Production company offering VFX/post for spots and TV.", "blissagency.it VFX ranking.",
    "Not verified", "", "it", "Unknown", (6, 8, 8, 15, 2, 6, 4))
add("Real Time S.r.l.", "IT", NV, "realtimegroup.it", "STUDIO",
    "Compositing, 2D/3D effects, colour correction, motion capture.", "realtimegroup.it/post-produzione-video.html.",
    CF, "", "it", "Unknown", (6, 8, 8, 15, 5, 6, 4))
add("Eleven Studio", "IT", "Milano", "elevenstudio.it", "STUDIO",
    "Video production: editing, VFX, AI, 3D animation.", "elevenstudio.it.", CF, "", "it", "Unknown", (6, 8, 8, 15, 5, 6, 4))
add("Exformat Movie Srl", "IT", NV, "exformat.com", "STUDIO",
    "Video post-production services.", "exformat.com/post-produzionevideo.", CF, "", "it", "Unknown", (5, 7, 8, 15, 5, 6, 4))
add("D-Video Production", "IT", "Milano (Via Bruno Maderna 7)", "d-videoproduction.com", "STUDIO",
    "Green-screen studio (112 sqm) for TV spots, virtual sets, VFX.", "d-videoproduction.com.",
    CF, "", "it", "Unknown", (5, 7, 8, 15, 5, 6, 4))
add("Massive Arts Studios", "IT", "Milano (Navigli)", NV, "STUDIO",
    "2 recording rooms + mastering studio - audio studios widely use Mac.", "rockit.it biography.",
    "Not verified", "", "it", "Unknown", (6, 8, 8, 15, 2, 6, 4))
add("HM studios", "IT", "near Milano", NV, "STUDIO",
    "New 3-room Pro Tools-based recording facility.", "soundbetter.com profile 'HM studios'.",
    "Contact via SoundBetter profile", "", "it", "Unknown", (6, 8, 8, 15, 3, 6, 4))
add("Blue Spirit Studio", "IT", "Milano", NV, "STUDIO",
    "Mix/mastering studio (SSL Duality, Pro Tools).", "soundbetter.com profile of resident engineer.",
    "Not verified", "", "it", "Unknown", (5, 7, 8, 15, 2, 6, 4))
add("Spectrum Mastering & Vinyl", "IT", "Bologna", NV, "STUDIO",
    "Dedicated mastering studio, Pro Tools since 1999.", "soundbetter.com Bologna listings.",
    "Contact via SoundBetter profile", "", "it", "Unknown", (5, 6, 9, 15, 3, 6, 4))

# ----------------------------------------------------------------- GERMANY
add("Gebrauchtmacs.de GmbH (maconline.de / maconline.at)", "DE", "Bad Sassendorf", "maconline.de", "RESELLER",
    "One of the largest/oldest European used-Apple suppliers (since 1990s); buys Macs (ankauf.maconline.de); AT site lists Mac Studio M1 Max/M2 Max/M2 Ultra/M3 Ultra/M4 Max.",
    "maconline.at/gebrauchte-macs-kaufen/mac-studio.html; LinkedIn Gebrauchtmacs.de GmbH; MediaMarkt AT seller imprint.",
    "+49 2921 342178; " + CF, "", "de", "Mac Studio incl. M2 Ultra / M3 Ultra (AT site)", (22, 17, 15, 9, 7, 4, 3))
add("Remacs GmbH (mac-store24.com)", "DE", "Gärtringen (Stuttgart)", "mac-store24.com", "RESELLER",
    "Used/refurbished Mac specialist for businesses & creative studios; Mac Studio M1 Max/M1 Ultra/M2 pages; VAT invoices for EU business buyers.",
    "mac-store24.com collections 'mac-studio-2023-gebraucht', 'Mac Studio M1 Max/M1 Ultra'; Impressum.",
    "support@mac-store24.com; +49 7034 6557262 (Impressum)", "Kevin J. Ludwig (GF)", "de",
    "Mac Studio M1 Ultra/M2 pages", (20, 15, 15, 11, 10, 4, 3))
add("asgoodasnew electronics", "DE", NV, "asgoodasnew.de", "RESELLER",
    "Large German refurbisher with 30-month warranty; Macs category.", "asgoodasnew.de/Macs.",
    CF, "", "de", "Refurbished Macs", (12, 12, 15, 9, 5, 2, 2))
add("trademax24", "DE", "Minden", "trademax24.de", "RESELLER",
    "Refurbished-Mac trader with physical store; started as Mac repair; eBay 'trademax-24' (5.8k sales).",
    "trademax24.de; eBay usr trademax-24.", CF, "", "de", "Refurbished Macs", (10, 12, 15, 9, 5, 4, 3))
add("2ndMax GmbH", "DE", "München", "2ndmax.de", "RESELLER",
    "Munich used/new Apple shop that buys used Macs; repair & support.", "2ndmax.de.",
    CF, "", "de", "Used Macs", (10, 13, 15, 11, 5, 4, 3))
add("mResell (mresell.de / mresell.at)", "DE", "DE / AT", "mresell.de", "RESELLER",
    "Refurbished Apple seller in DE/AT; Mac Studio category.", "mresell.at/webshop/macstudio.",
    CF, "", "de", "Mac Studio (2022) listed", (14, 11, 15, 11, 5, 3, 2))
add("iGebrauchtstore", "DE", "Kranenburg", NV, "RESELLER",
    "Apple-focused remarketer; eBay store 'igebrauchtstore' (5.7k sales).", "ITAD Germany search; eBay store.",
    "Contact via eBay store - email not verified", "", "de", "Unknown", (10, 13, 14, 9, 4, 4, 3))
add("Second IT Remarketing", "DE", "Hamburg (Schwäbisch Hall store also listed)", "second-it.de", "ITAD",
    "Buys used business IT (laptops etc.) with BSI-compliant erasure; remarketing store.",
    "second-it.de/en; ITAD Germany search.", CF, "", "de", "Corporate returns", (6, 15, 10, 9, 5, 5, 3))
add("GSD GS Datentechnik", "DE", NV, NV, "ITAD",
    "IT remarketing for business customers ('Erlöse statt Entsorgungskosten').",
    "computerwoche.de article on GSD IT remarketing.", "Not verified", "", "de", "Corporate returns", (4, 13, 6, 9, 2, 5, 3))
add("GTR² Global Technology Remarketing & Recycling GmbH", "DE", "Bavaria", NV, "ITAD",
    "Buys used corporate IT and resells it; secure erasure.", "keytobavaria.com company profile.",
    "Not verified", "", "de", "Corporate returns", (4, 14, 6, 11, 2, 5, 3))
add("tradefinity (CSI LifeCycle Leasing GmbH)", "DE", NV, NV, "ITAD",
    "Top German ITAD acquired by lessor CSI (2022) - lease-return stream.",
    "csileasing.com news 2022; ELFA article.", "Not verified", "", "de", "Lease returns", (6, 16, 4, 9, 2, 4, 3))
add("cerona GmbH", "DE", NV, "cerona.de", "ITAD",
    "Buys companies' old IT equipment for remarketing.", "cerona.de/en 'Selling your old IT equipment'.",
    CF, "", "de", "Corporate returns", (4, 13, 6, 9, 4, 5, 3))
add("erasoo GmbH", "DE", NV, NV, "ITAD",
    "Secure IT asset disposition and value recovery for enterprise hardware.",
    "Broker directory listing (ITAD Europe search).", "Not verified", "", "de", "Corporate returns", (4, 12, 4, 9, 2, 4, 3))
add("itwelt24 (eBay store)", "DE", NV, NV, "ITAD",
    "High-volume business-IT reseller on eBay (~48k sales).", "ebay.de/str/itwelt24.",
    "Contact via eBay store", "", "de", "Business IT lots", (6, 12, 14, 9, 4, 4, 4))
add("ict-remarketing (eBay seller; 'Click it Remarketing')", "DE", NV, NV, "ITAD",
    "Remarketer whose eBay listing showed MBP16 M1 Max 64GB 'Gut - Refurbished' at EUR 1,240 with 137 cycles.",
    "Search snippet of ebay.de listing; seller profile ebay.de/usr/ict-remarketing (2k+ sales, since 2016).",
    "Contact via eBay seller profile", "", "de", "MBP16 M1 Max 64GB (snippet, unverified)", (20, 13, 15, 9, 4, 5, 5))
add("D&S Resell", "DE", "Osnabrück", NV, "RESELLER",
    "Commercial buyer of Mac Studio and MacBook Pro (Kleinanzeigen pro account) - resells purchased units.",
    "kleinanzeigen.de/pro/ds-resell.", "Contact via Kleinanzeigen pro page", "", "de",
    "Buys Mac Studio/MBP", (14, 14, 12, 9, 4, 5, 4))
add("MACS n more GmbH", "DE", NV, NV, "RESELLER",
    "Used-Mac eBay pro seller (~12k sales).", "ebay.de/str/macsnmore-gmbh.", "Contact via eBay store",
    "", "de", "Used Macs", (10, 12, 15, 9, 4, 4, 3))
add("macoimex (eBay seller)", "DE", NV, NV, "RESELLER",
    "High-volume Mac eBay seller (~25k sales).", "ebay.de/usr/macoimex.", "Contact via eBay profile",
    "", "de", "Used Macs", (10, 12, 15, 9, 4, 4, 3))
add("Mac Shop Rosenheim", "DE", "Rosenheim (Bavaria)", NV, "REPAIR",
    "Mac shop near the Austrian border with eBay store (~5.3k sales).", "ebay.de/str/macshoprosenheim.",
    "Contact via eBay store", "", "de", "Used Macs/parts", (8, 10, 14, 11, 4, 4, 3))
add("comacs (eBay seller)", "DE", NV, NV, "RESELLER",
    "Mac-focused eBay seller (~3.8k sales).", "ebay.de/usr/comacs-de.", "Contact via eBay profile",
    "", "de", "Used Macs", (8, 10, 14, 9, 4, 4, 3))
add("Comspot", "DE", NV, NV, "RESELLER",
    "Apple reseller with eBay outlet (~1.5k sales).", "ebay.de/usr/comspot.", "Contact via eBay profile",
    "", "de", "Outlet/used", (8, 9, 14, 9, 4, 3, 2))
add("LapStore GmbH", "DE", "Münster", NV, "ITAD",
    "Very high-volume business-laptop remarketer (eBay ~286k sales) with Ankauf & erasure.",
    "ebay.de/str/LapStore2.", "Contact via eBay store", "", "de", "Business laptops (mostly Windows)",
    (6, 14, 15, 9, 4, 4, 4))
add("wirkaufen.IT e.K.", "DE", NV, NV, "ITAD",
    "Specialist buyer of used IT hardware.", "sellwerk.de profile; trusted.de.", "Not verified",
    "", "de", "Corporate returns", (4, 12, 6, 9, 2, 5, 3))
add("PcRausch Langner GmbH (notebooks-leipzig.de)", "DE", "Leipzig", NV, "REPAIR",
    "Notebook repair and refurbished notebooks incl. MacBooks.", "trustedshops.de company profile.",
    "Not verified", "", "de", "Refurbished MacBooks", (6, 9, 14, 9, 2, 4, 3))
add("TR Remarketing GmbH", "DE", "Köln (Meirowskystr. 2)", NV, "ITAD",
    "IT remarketing company (name match uncertain vs. eBay 'ict-remarketing').",
    "koeln.de directory listing; phone 02241 2667438.", "+49 2241 2667438 (directory)", "", "de",
    "Unknown", (4, 11, 6, 9, 5, 4, 3))
add("Stock4less", "EU", "location to verify", "stock4less.com", "RESELLER",
    "Refurbished seller with EU storefront listing MBP16 M1 Max 64GB and Mac Studio M2 Ultra 64GB/1TB.",
    "stock4less.com/de & /en-eu product pages.", CF, "", "en", "M1 Max 64GB; M2 Ultra 64GB pages", (18, 10, 14, 6, 4, 3, 3))
add("Grover Group GmbH", "DE", "Berlin", "grover.com", "ENTERPRISE",
    "Consumer/business tech rental with Mac Studio M2 Ultra 64GB/1TB in its fleet (EUR 106.99/mo) - ex-rental units must be remarketed.",
    "grover.com at-de trending listing (M2 Ultra rental).", CF, "", "de",
    "Rental fleet incl. M2 Ultra", (16, 14, 6, 9, 4, 4, 3))
add("Lendis GmbH", "DE", "Berlin", "lendis.io", "ENTERPRISE",
    "Business MacBook leasing with end-of-term pickup & erasure - lease-return stream.",
    "lendis.io Apple MacBook leasing page.", CF, "", "de", "Lease returns", (10, 14, 5, 9, 4, 4, 3))
add("CANCOM (DE/AT)", "DE", "München; AT shop", "cancom.de", "ENTERPRISE",
    "Large Apple business partner with 0% Apple leasing; sells Mac Studio M2 Ultra configs (AT shop).",
    "shop.cancom.de Apple leasing; shop.cancom.at Mac Studio M2 Ultra 76-core 64GB.", CF, "", "de",
    "Lease returns via partners", (10, 10, 3, 11, 4, 2, 1))
add("CHG-MERIDIAN", "DE", "Weingarten", "chg-meridian.com", "ENTERPRISE",
    "Large technology lessor with in-house remarketing of returned devices.",
    "chg-meridian.com remarketing link surfaced in ITAD search.", CF, "", "de", "Lease returns", (6, 14, 2, 11, 4, 2, 2))
add("European Show Equipment", "EU", NV, "european-show-equipment.com", "ENTERPRISE",
    "Europe-wide Mac rental for events - rental fleet rotates.", "european-show-equipment.com 'Rent a Mac'.",
    CF, "", "en", "Rental Macs", (8, 10, 6, 8, 4, 4, 3))
add("Dechow Auktionen", "DE", NV, NV, "ITAD",
    "Insolvency auctioneer that liquidated an Apple retailer's stock (mStore, ~1,500 lots).",
    "heise.de 'Insolventer Apple-Händler mStore lässt Lagerbestände versteigern' (old).",
    "Not verified", "", "de", "Insolvency lots (watch)", (6, 14, 10, 9, 2, 6, 5))
add("Restlos (auktionen.restlos.com)", "DE", "Nürnberg", "auktionen.restlos.com", "ITAD",
    "Insolvency auctions incl. Apple MacBooks/iMacs (2024; tech auction ending Aug 2026).",
    "auktionen.restlos.com lots 'Insolvenzauktion ... Apple'.", CF, "", "de", "Insolvency lots (watch)", (8, 14, 10, 11, 4, 6, 5))
add("Proventura", "DE", NV, "proventura.de", "ITAD",
    "Online auctions incl. Apple MacBook Pro/iMac lots.", "proventura.de auction archive.",
    CF, "", "de", "Auction lots (watch)", (6, 13, 10, 9, 4, 6, 5))
add("Insolvenz-Auktionen Schwarzfischer", "DE", "Bavaria", "insolvenz-auktionen-schwarzfischer.de", "ITAD",
    "Insolvency auctions incl. company MacBook fleets (e.g. travel company).",
    "insolvenz-auktionen-schwarzfischer.de MacBook Pro item.", CF, "", "de", "Auction lots (watch)", (6, 13, 10, 11, 4, 6, 5))
add("industrieauktion.online", "DE", "Trier region", "industrieauktion.online", "ITAD",
    "Insolvency/office-clearance auctions incl. Apple MacBooks.", "industrieauktion.online item 8957.",
    CF, "", "de", "Auction lots (watch)", (5, 12, 10, 9, 4, 6, 5))
add("Assetorb", "DE", NV, "assetorb.com", "ITAD",
    "Online auctions of MacBook Pro/iMac from insolvencies (no reserve).", "assetorb.com auction search.",
    CF, "", "de", "Auction lots (watch)", (6, 13, 10, 9, 4, 6, 5))
add("MDB - 3D & Motion Design Berlin", "DE", "Berlin (Kiefholzstraße 1)", "motion-design.berlin", "STUDIO",
    "C4D/Redshift/After Effects studio with GPU rendering - high-memory workstation user.",
    "motion-design.berlin.", CF, "", "de", "Unknown", (7, 8, 8, 9, 5, 6, 4))
add("buchholz motion + graphics", "DE", "Berlin", NV, "STUDIO",
    "Independent motion design / 3D (Cinema 4D) studio.", "dasauge.de/advids listings.",
    "Not verified", "", "de", "Unknown", (6, 7, 8, 9, 2, 6, 4))
add("FOREAL", "DE", "München", NV, "STUDIO", "Munich motion design studio.", "advids.co Munich list.",
    "Not verified", "", "de", "Unknown", (5, 7, 8, 11, 2, 6, 4))
add("SIRIUS", "DE", "München", NV, "STUDIO", "Munich motion design studio.", "advids.co Munich list.",
    "Not verified", "", "de", "Unknown", (5, 7, 8, 11, 2, 6, 4))

# ----------------------------------------------------------------- AUSTRIA
add("Vstronik", "AT", "Wien 1010", "vstronik.com", "REPAIR",
    "Vienna Mac repair shop that also sells MacBooks.", "vstronik.com.", CF, "", "de", "MacBooks", (6, 9, 13, 12, 5, 4, 3))
add("identity Lab", "AT", "Wien", "identitylab.at", "STUDIO",
    "Motion design & animation studio for brands/culture.", "identitylab.at.", CF, "", "de", "Unknown", (5, 7, 8, 12, 5, 6, 4))

# ----------------------------------------------------------------- FRANCE
add("Okamac / Okamac Pro (SENS Technologies)", "FR", "Écouflant (Angers)", "okamac.com / pro.okamac.com", "RESELLER",
    "French Mac refurbisher (13+ yrs) with pro desk, Mac rental and buy-back; listing for MBP16 M2 Max 96GB.",
    "okamac.com MBP16 2023 M2 Max 96GB page; pro.okamac.com; reepeat.fr review.",
    "contact@okamac.com; +33 2 41 24 80 04", "", "fr", "MBP16 M2 Max 96GB page", (22, 15, 15, 9, 10, 3, 3))
add("McPrice", "FR", "Paris 16e", "mcprice.fr", "REPAIR",
    "Paris store selling refurbished Apple and buying Macs (instant payment).", "mcprice.fr.",
    CF, "", "fr", "Refurbished/trade-ins", (8, 12, 14, 9, 5, 4, 3))
add("MON MAC ECO", "FR", "Tartas (Landes)", "mon-mac-eco.com", "REPAIR",
    "Mac workshop with mail-in buy-back across France.", "mon-mac-eco.com.", CF, "", "fr", "Trade-ins", (6, 11, 14, 9, 5, 4, 3))
add("e-Recycle", "FR", NV, "e-recycle.com", "ITAD",
    "Company fleet buy-back incl. MacBooks.", "fr.e-recycle.com/fr/reprise.", CF, "", "fr", "Fleet returns", (5, 13, 7, 9, 4, 5, 3))
add("Ecomicro", "FR", NV, NV, "ITAD", "ITAD provider since 1996.", "European ITAD directory search.",
    "Not verified", "", "fr", "Corporate returns", (4, 13, 5, 9, 2, 5, 3))

# ----------------------------------------------------------------- NETHERLANDS
add("iUsed", "NL", "Utrecht area (+31 30)", "iused.nl / iused.com", "RESELLER",
    "'The (refurbished) Mac specialist for 30+ years'; refurbished Mac Studio/Mac Pro with 3-yr warranty; Business section.",
    "iused.nl/refurbished/mac-pro; Trustpilot 15k reviews.", "+31 30 248 40 06; " + CF, "", "nl",
    "Refurbished Mac Studio", (16, 13, 15, 9, 7, 3, 2))
add("MacTastic", "NL", NV, "mactastic.nl", "RESELLER",
    "Refurbished Mac specialist selling Mac Studio; buys Macs and accepts trade-ins.",
    "mactastic.nl/refurbished-mac-kopen/mac-studio-kopen.", CF, "", "nl", "Mac Studio", (14, 13, 15, 9, 4, 3, 3))
add("MacBizz BV", "NL", "Amsterdam", NV, "RESELLER",
    "Apple refurbishing service operating across Europe (refurbed marketplace seller).",
    "refurbed.pt seller page 372.", "Contact via refurbed seller page", "", "nl", "Refurbished Macs", (10, 12, 14, 9, 3, 3, 3))
add("MvH ICT", "NL", NV, NV, "REPAIR",
    "Buying, selling, fixing and upgrading MacBooks and iMacs since 2014.", "Tradeloop directory.",
    "Not verified", "", "nl", "Used MacBooks", (8, 12, 13, 9, 2, 4, 3))
add("MacRepair", "NL", "Amsterdam", "macrepair.nl", "REPAIR",
    "Oldest independent Apple repair in NL; sells refurbished and buys old Macs.", "macrepair.nl.",
    CF, "", "nl", "Refurbished/trade-ins", (7, 11, 13, 9, 5, 4, 3))
add("Amac", "NL", NV, "amac.nl", "RESELLER",
    "Dutch Apple retailer with refurbished Mac section.", "amac.nl/refurbished/refurbished-mac.",
    CF, "", "nl", "Refurbished MacBook Pro/Mac mini", (8, 10, 14, 9, 4, 2, 2))
add("ReMarkt", "NL", NV, NV, "RESELLER",
    "Dutch refurbished-IT specialist for consumers and business incl. Apple computers & workstations.",
    "Rematec/ITAD NL search.", "Not verified", "", "nl", "Refurbished IT incl. Apple", (8, 12, 13, 9, 2, 4, 3))
add("Econyx", "NL", "NL / BE", NV, "ITAD", "ITAD specialist with 1,000+ clients in NL & BE.",
    "European ITAD directory search.", "Not verified", "", "nl", "Corporate returns", (5, 15, 5, 9, 2, 4, 3))
add("AxxionIT", "NL", NV, NV, "ITAD", "ISO-certified ITAD company.", "European ITAD directory search.",
    "Not verified", "", "nl", "Corporate returns", (4, 13, 5, 9, 2, 4, 3))
add("Argo360", "NL", NV, NV, "ITAD", "ITAD company.", "European ITAD directory search.",
    "Not verified", "", "nl", "Corporate returns", (4, 12, 5, 9, 2, 4, 3))
add("The ITAD Company", "NL", NV, "itad-company.com", "ITAD", "ITAD services company.", "itad-company.com.",
    CF, "", "en", "Corporate returns", (4, 12, 5, 9, 4, 4, 3))
add("Waanders RecycleIT", "NL", "Nijverdal", NV, "ITAD", "IT data & equipment disposal firm.",
    "ITAD NL/BE search.", "Not verified", "", "nl", "Disposal stream", (2, 10, 4, 9, 2, 4, 3))
add("Recynew", "EU", NV, NV, "ITAD", "European ITAD and IT component trading company.",
    "European broker meeting attendee list.", "Not verified", "", "en", "Bulk lots", (4, 12, 4, 8, 2, 4, 4))

# ----------------------------------------------------------------- BELGIUM
add("Brainscape", "BE", NV, "brainscape.eu", "ITAD", "Refurbishment and buy-back programme for IT equipment.",
    "brainscape.eu/en.", CF, "", "nl", "Buy-back stream", (5, 13, 8, 9, 4, 4, 3))
add("Oxygen IT", "BE", NV, NV, "ITAD", "Recycles & purchases used/end-of-life computers & laptops.",
    "Tradeloop directory.", "Not verified", "", "fr", "Corporate returns", (3, 11, 5, 9, 2, 4, 3))
add("JATO", "BE", "BE + 9 countries", "jato.be", "ITAD", "IT recycling operating in BE/NL/LU/FR/DE/IT/ES/PT/PL/SK.",
    "jato.be/it-recycling.", CF, "", "nl", "Disposal stream", (3, 11, 4, 9, 4, 4, 3))
add("Econocom", "BE", "BE / FR / IT", NV, "ENTERPRISE",
    "European tech-leasing/services group (Apple business channel) with large lease-return volume.",
    "Wikipedia Econocom; Apple Preferred Device Enrollment Resellers list.", "Not verified", "", "fr",
    "Lease returns", (6, 14, 2, 12, 2, 2, 2))

# ----------------------------------------------------------------- IRELAND / NORDICS / SPAIN / POLAND
add("Creative IT", "IE", "Mullingar", "creative-it.ie", "RESELLER",
    "Business-grade refurbished laptops incl. MacBooks & workstations, 12-month warranty; listing MBP16 M2 Max 96GB/1TB at EUR 2,519.",
    "creative-it.ie product 'MacBook Pro 16 2023 M2 Max 96GB 1TB 38C GPU'; llms.txt contact file.",
    "customerservice@creative-it.ie; +353 44 93 81033 (own llms.txt)", "", "en",
    "MBP16 M2 Max 96GB/1TB (snippet price EUR 2,519)", (24, 11, 15, 5, 10, 3, 4))
add("Wisetek", "IE", "Cork", "wisetekstore.com", "ITAD",
    "Global ITAD with retail/bulk-buyer store selling refurbished MacBook Pro.",
    "wisetekstore.com bulk-buyers & MacBook Pro 14 collection.", CF, "", "en", "Refurbished MacBook Pro", (12, 15, 13, 5, 4, 3, 3))
add("Foxway (Flip4 in DE)", "SE", "Stockholm; DE via Flip4", "foxway.com", "ITAD",
    "Major European ITAD/Apple-for-Business partner with B2B buyback and wholesale reseller store (MacBook Pro).",
    "resellers.foxway.com used computers; foxway.com B2B buyback & Apple for Business pages.",
    "Contact form (sales team) - email not verified", "", "en", "Wholesale MacBook Pro stock list", (12, 18, 4, 6, 4, 3, 5))
add("Moyacell", "ES", "Madrid", "moyacell.com", "RESELLER",
    "Madrid shop specialising in refurbished Macs (12-month warranty).", "Trustpilot moyacell.com.",
    CF, "", "es", "Refurbished Macs", (8, 10, 14, 6, 4, 3, 3))
add("Aiho", "ES", NV, "aiho.es", "RESELLER",
    "Refurbished Apple store (MBP16 M1 Max seen at EUR 1,549 - 32GB).", "aiho.es product 2685.",
    CF, "", "es", "MBP16 M1 Max (32GB seen)", (12, 10, 14, 6, 4, 3, 3))
add("ag.pl", "PL", NV, "ag.pl", "RESELLER",
    "Polish seller of ex-lease ('poleasingowy') MacBook Pro incl. MBP16 M1 Max 64GB/1TB with VAT invoice.",
    "poradnikprzedsiebiorcy.pl article (advertorial).", CF, "", "en", "MBP16 M1 Max 64GB ex-lease", (16, 13, 14, 6, 4, 4, 4))
add("PKO Leasing - aukcje.pkoleasing.pl", "PL", NV, "aukcje.pkoleasing.pl", "ENTERPRISE",
    "Bank-owned lessor auctioning ex-lease MacBooks (mostly Air) - watch for Pro/Max.",
    "aukcje.pkoleasing.pl MacBook Pro 16 M1 Pro 32GB lot.", CF, "", "en", "Ex-lease MacBooks", (8, 14, 10, 6, 4, 5, 5))

# ----------------------------------------------------------------- additions (batch 18)
add("MacFaaast", "IT", "Meda (MB)", "macfaaast.it", "REPAIR",
    "Mac repair & sales shop near Milan selling new, 'ricondizionato garantito' and ex-demo Macs.",
    "macfaaast.it/chi-siamo/negozio.html.", CF, "", "it", "Refurbished / ex-demo Macs", (8, 11, 14, 15, 5, 4, 3))
add("La Bottega dell'immagine", "IT", "Torino (Via Venaria 38)", NV, "STUDIO",
    "Film/TV post: editing, grading, VFX, audio mix.", "sortlist.co.uk agency profile.",
    "Not verified", "", "it", "Unknown", (6, 8, 8, 15, 2, 6, 4))
add("Cine Chromatix Italy", "IT", "Merano (BZ)", NV, "STUDIO",
    "Post-production with colour grading and motion design (South Tyrol, near CH/AT).",
    "IDM Südtirol film-commission directory.", "Contact via IDM directory", "", "de", "Unknown", (6, 7, 9, 15, 3, 6, 4))
add("CompTech e.U.", "AT", "Wien 1210", "comptech.at", "ITAD",
    "Buys company IT and explicitly names Apple MacBook/iMac/Mac mini; NIST erasure; Vienna pickup.",
    "comptech.at/dienstleistungen/ankauf-gebrauchte-it/.", CF, "", "de", "Corporate Mac returns", (8, 15, 10, 12, 5, 5, 3))
add("Compuritas", "AT", NV, "compuritas.at", "ITAD", "IT remarketing: buys laptops/computers with pickup.",
    "compuritas.at.", CF, "", "de", "Corporate returns", (4, 13, 8, 12, 4, 5, 3))
add("ALBI", "AT", "Austria-wide", "albi.at", "ITAD", "Austria-wide IT buy-back (Salzburg, Wien, Graz, Linz, Innsbruck).",
    "albi.at/it-ankauf/.", CF, "", "de", "Corporate returns", (4, 13, 8, 12, 4, 5, 3))
add("itremarketing.at", "AT", NV, "itremarketing.at", "ITAD", "IT remarketing & buy-back for companies.",
    "itremarketing.at.", CF, "", "de", "Corporate returns", (4, 13, 7, 12, 4, 5, 3))
add("SOCIUS Social & Green IT", "AT", "Wien 1210", "sozialentsorgen.at", "ITAD", "Certified erasure and buy-back of company IT.",
    "sozialentsorgen.at/itankauf.php.", CF, "", "de", "Corporate returns", (3, 12, 7, 12, 4, 5, 3))
add("RMK DataErasure GmbH", "AT", "Wien/Graz/Linz/Salzburg/Innsbruck", "rmkgmbh.com", "ITAD",
    "Hardware remarketing with certified erasure.", "rmkgmbh.com/hardware-remarketing.", CF, "", "de",
    "Corporate returns", (3, 12, 5, 12, 4, 5, 3))
add("iTReturn", "AT", "Pinsdorf / Wien", NV, "ITAD", "IT return/remarketing provider (page ~647 days old).",
    "Austrian IT-Ankauf search.", "Not verified", "", "de", "Corporate returns", (3, 11, 5, 12, 2, 4, 3))
add("Cropmark AG", "CH", "Wettingen (AG)", "cropmark.ch", "REPAIR", "Apple service provider (maintenance, repair, upgrade).",
    "cropmark.ch/en.", CF, "", "de", "Unknown", (6, 9, 9, 15, 5, 4, 2))
add("ART Computer SA", "CH", "Geneva / Lausanne / Fribourg", NV, "RESELLER",
    "Apple Premium Reseller in Romandie - business trade-ins.", "elioplus directory.", "Not verified", "", "fr",
    "Trade-ins", (8, 11, 9, 15, 2, 3, 2))
add("codename AG", "CH", NV, NV, "REPAIR", "Authorised Apple service provider.", "elioplus directory.",
    "Not verified", "", "de", "Unknown", (5, 8, 8, 15, 2, 4, 2))

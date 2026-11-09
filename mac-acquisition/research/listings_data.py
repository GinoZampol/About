# -*- coding: utf-8 -*-
"""
Marketplace / retail listings seen during research (2026-11-09).

IMPORTANT: this session could NOT open listing pages (WebFetch/curl blocked by the
session network policy). Every row below comes from a search-engine snippet or summary.
Therefore no row is "Seller-confirmed available" or "Appears active (page opened)".
Classifications used:
  - "Unverified (snippet only)"         -> lead; must open page / contact seller
  - "Sold or unavailable (per snippet)" -> comparable only
FX (latest found via search; re-check before any offer):
  EUR/CHF 0.9326 (2026-10-08)  -> 1 CHF = 1.0723 EUR
  EUR/USD 1.1206 (2026-10-11)  -> 1 USD = 0.8924 EUR
  GBP, NOK: rate not verified in this session -> EUR left blank
Columns after listing_id:
 platform_or_seller, country, url, model, chip_gpu, memory_gb, ssd, condition,
 battery_cycles, price_original, currency, fx_to_eur, price_eur,
 status_classification, verification_method, verified_at, notes
"""
CHF, USD = 1.0723, 0.8924
VM = "search snippet (page not opened)"
D = "2026-11-09 (search date; listing date unknown unless noted)"
U = "Unverified (snippet only)"
S = "Sold or unavailable (per snippet)"

def eur(p, fx):
    return round(p * fx) if (p and fx) else ""

LISTINGS = [
 # --- Primary-interest leads (unverified) ---
 ["eBay.de - ict-remarketing ('Click it Remarketing GmbH')", "DE", "ebay.de (item id not captured)",
  "MacBook Pro 16\" 2021", "M1 Max (GPU cores n/s)", 64, "n/s", "Gut - Refurbished", 137,
  1240, "EUR", 1.0, 1240, U, VM, D, "Exceptional price if real; verify GPU cores, SSD, kbd, Activation Lock. Seller profile ebay.de/usr/ict-remarketing."],
 ["Revendo", "CH", "https://revendo.ch/en/products/apple-macbook-pro-16-space-grau-m1-max-10-core-cpu-und-32-core-gpu-1-tb-ssd-64-gb-ram-late-2021-us",
  "MacBook Pro 16\" Late 2021", "M1 Max 10C CPU / 32C GPU", 64, "1TB", "Refurbished (grade n/s)", "n/s",
  1835, "CHF", CHF, eur(1835, CHF), S, "product URL returns HTTP 404", "2026-11-09 03:05 UTC", "'from CHF 1,835'; US keyboard; 1-yr warranty (ext. to 3); CH domestic price incl. 8.1% VAT."],
 ["Revendo", "CH", "https://revendo.ch/en/products/apple-mac-studio-m1-ultra-20-core-cpu-48-core-gpu-1-tb-ssd-128-gb-ram-10-gigabit-ethernet-early-2022",
  "Mac Studio 2022", "M1 Ultra 20C CPU / 48C GPU", 128, "1TB", "Refurbished", "n/a", "", "CHF", CHF, "", S, "product URL returns HTTP 404", "2026-11-09 03:05 UTC", "Listing removed."],
 ["Revendo", "CH", "https://revendo.ch/en/products/apple-mac-studio-m1-ultra-20-core-cpu-48-core-gpu-2-tb-ssd-128-gb-ram-10-gigabit-ethernet-early-2022",
  "Mac Studio 2022", "M1 Ultra 20C CPU / 48C GPU", 128, "2TB", "Refurbished", "n/a", "", "CHF", CHF, "", S, "product URL returns HTTP 404", "2026-11-09 03:05 UTC", "Listing removed."],
 ["Creative IT", "IE", "https://creative-it.ie/product/apple-macbook-pro-16-2023-m2-max-96gb-1tb-38c-gpu-space-gray/",
  "MacBook Pro 16\" 2023", "M2 Max 12C CPU / 38C GPU", 96, "1TB", "Certified refurbished; 12+ mo warranty; 30-day returns", "n/s",
  2519, "EUR", 1.0, 2519, S, "page redirects to /shop/macbooks/; store API search finds no 64GB+ Macs", "2026-11-09 03:05 UTC", "Removed (likely sold). Was EUR 2,799. UK keyboard. Intra-EU: Irish VAT incl. (or margin scheme) - no extra import VAT to IT; to CH add 8.1% import VAT."],
 ["Okamac", "FR", "https://www.okamac.com/gb/macbook/macbook-pro/17189-macbook-pro-16-2023-m2-max-chip-apple-gpu-38-12-cores-96-gb-ram-35-ghz.html",
  "MacBook Pro 16\" 2023", "M2 Max 12C / 38C GPU", 96, "n/s", "Refurbished", "n/s", "", "EUR", 1.0, "", "Unverified (page opened, no price/stock shown)", "page opened", "2026-11-09 03:05 UTC", "Shop RAM filter tops at 64GB -> probably out of stock; ask seller."],
 ["refurb.me IT (aggregator; eBay/other)", "IT", "https://www.refurb.me/it/refurbished/mac-studio/sku/MQH73-25A",
  "Mac Studio 2023", "M2 Ultra 24C / 60C", 64, "1TB", "Refurbished (Italian)", "n/a", 2768, "EUR", 1.0, 2768, U, VM, D,
  "Snippet price; date unknown - conflicts with DE figure (3,599) and 2026 market trend; treat as stale until opened."],
 ["refurb.me IT (eBay Refurbished)", "IT", "https://www.refurb.me/it/refurbished/mac-studio/sku/MQH73-27C",
  "Mac Studio 2023", "M2 Ultra 24C / 60C", 128, "4TB", "Excellent", "n/a", 4719, "EUR", 1.0, 4719, U, VM, "late Oct 2026 per snippet",
  "Single seller; lowest excellent since 24 Oct ~4,730-4,742."],
 ["refurb.me DE (eBay Refurbished)", "DE", "https://www.refurb.me/de/refurbished/mac-studio/sku/MQH73-25A",
  "Mac Studio 2023", "M2 Ultra 24C / 60C", 64, "1TB", "Refurbished", "n/a", 3599, "EUR", 1.0, 3599, U, VM, D, "Snippet."],
 ["Stock4less (EU store)", "EU", "https://stock4less.com/en-eu/products/apple-mac-studio-m2-ultra-3-68ghz-24-core-cpu-60-core-gpu-64gb-ram-1tb-ssd",
  "Mac Studio 2023", "M2 Ultra 24C / 60C", 64, "1TB", "n/s", "n/a", "", "EUR", 1.0, "", U, VM, D, "Page indexed; seller location to verify."],
 ["Stock4less (DE store)", "EU", "https://stock4less.com/de/products/apple-macbook-pro-16-2-core-m1-max-3-2ghz-10-core-cpu-24-core-gpu-64gb-ram-1tb-ssd",
  "MacBook Pro 16\" 2021", "M1 Max 10C / 24C GPU", 64, "1TB", "n/s", "n/s", "", "EUR", 1.0, "", U, VM, D, "Page indexed."],
 ["eBay.de private seller", "DE", "ebay.de (item id not captured)", "MacBook Pro 16\" 2021", "M1 Max", 64, "4TB", "'wie neu'", "n/s",
  2350, "EUR", 1.0, 2350, U, VM, "undated", "Private sale; undated."],
 ["refurb.me DE (Back Market / eBay)", "DE", "https://www.refurb.me/de/refurbished/macbook/macbook-pro/14-inch/sku/MKGP3-B23",
  "MacBook Pro 14\" 2021", "M1 Max", 64, "512GB", "Refurbished", "n/s", 1999, "EUR", 1.0, 1999, U, VM, D, "Snippet."],
 ["trovaprezzi.it (aggregator)", "IT", "https://www.trovaprezzi.it/prezzo_ricondizionati-informatica_macbook_pro_m1_max_16_64gb.aspx",
  "MacBook Pro 16\" 2021", "M1 Max", 64, "various", "Refurbished", "n/s", 1399, "EUR", 1.0, 1399, U, VM, D, "'76 offers from 1,399' - date unknown."],
 ["digitec.ch - JES", "CH", "https://www.digitec.ch/en/s1/product/jes-apple-mac-studio-m1-max-64-gb-ssd-1000-gb-a-like-new-refurbished-pc-62385928",
  "Mac Studio 2022", "M1 Max", 64, "1TB", "A - like new (refurbished)", "n/a", "", "CHF", CHF, "", U, VM, D, "Price not in snippet."],
 ["eBay - Smart Generation", "IT", "ebay (item id not captured)", "Mac Studio 2022", "M1 Max", "n/s", "n/s", "Refurbished", "n/a",
  1779, "EUR", 1.0, 1779, U, VM, D, "Memory not stated - may be 32GB (exclude if so)."],
 ["Back Market UK", "UK", "backmarket.co.uk (MBP16 M2 Max 96GB/2TB)", "MacBook Pro 16\" 2023", "M2 Max", 96, "2TB", "Refurbished",
  "n/s", 2999, "GBP", "", "", U, VM, D, "UK -> IT/CH: import VAT 22%/8.1% + broker fee; GBP rate not verified."],
 ["refurb.me DE (Back Market)", "DE", "https://www.refurb.me/de/refurbished/macbook/macbook-pro/14-inch/sku/MPHE3-37C",
  "MacBook Pro 14\" 2023", "M2 Max", 96, "8TB", "Excellent", "n/s", 5649, "EUR", 1.0, 5649, U, VM, D, "Overpriced (8TB)."],
 ["refurbed.at", "AT", "https://www.refurbed.at/en-at/c/apple-mac/", "Mac Studio 2025", "M3 Ultra", "96 (assumed)", "n/s",
  "Refurbished", "n/a", 6199, "EUR", 1.0, 6199, U, VM, D, "Category-page price."],
 ["Apple AT (education refurb store)", "AT", "https://www.apple.com/at-edu/shop/refurbished/mac", "Mac Studio 2025",
  "M4 Max / M3 Ultra", "36-96+", "n/s", "Apple Certified Refurbished", "n/a", "3549-6599", "EUR", 1.0, "", U, VM, D, "Range only; education eligibility."],
 ["Apple IT refurbished (via refurb.me)", "IT", "https://www.refurb.me/it/refurbished/mac-studio/sku/MU963", "Mac Studio 2025",
  "M4 Max 14C/32C", 36, "512GB", "Apple Certified Refurbished", "n/a", 2379, "EUR", 1.0, 2379, U, VM, D, "36GB -> EXCLUDED from shortlist (below 64GB)."],
 ["finn.no private seller", "NO", "https://www.finn.no/432874752", "Mac Studio 2023", "M2 Ultra 24C/60C", 64, "1TB",
  "Used ~6 months", "n/a", 35000, "NOK", "", "", U, VM, "undated", "Norway (non-EU): customs/VAT on import; NOK rate not verified."],
 # --- Comparables (sold / out of stock) ---
 ["Revendo", "CH", "https://revendo.ch/en/products/apple-mac-studio-m2-ultra-24-core-cpu-60-core-gpu-8-tb-ssd-192-gb-ram-10-gigabit-ethernet-mid-2023",
  "Mac Studio 2023", "M2 Ultra 24C / 60C", 192, "8TB", "Used (visible wear)", "n/a", 3158, "CHF", CHF, eur(3158, CHF), S, "Revendo public product feed", "2026-11-09 03:05 UTC",
  "Out of stock at search time. Price looks far below 2026 market (likely pre-shortage pricing) - ask Revendo for next incoming unit."],
 ["refurb.me DE (eBay Refurbished)", "DE", "https://www.refurb.me/de/refurbished/mac-studio/sku/MQH73-28D", "Mac Studio 2023",
  "M2 Ultra 24C / 60C", 192, "8TB", "Good", "n/a", 7998, "EUR", 1.0, 7998, S, VM, "last seen 2026-11-01", "Not in stock anywhere."],
 ["refurb.me ES (eBay Refurbished)", "ES", "https://www.refurb.me/es/refurbished/mac-studio/sku/MQH73-25B", "Mac Studio 2023",
  "M2 Ultra 24C / 60C", 64, "2TB", "Excellent", "n/a", 4206, "EUR", 1.0, 4206, S, VM, "last seen 2026-11-03", "Sold out everywhere."],
 ["refurb.me DE (eBay Refurbished)", "DE", "https://www.refurb.me/de/refurbished/mac-studio/sku/MJMV3-518", "Mac Studio 2022",
  "M1 Ultra 20C / 48C", 64, "1TB", "Excellent", "n/a", 3249, "EUR", 1.0, 3249, S, VM, "last seen Oct 2026", "Low was 2,999; sold out."],
 ["eBay.de auction (closed)", "DE", "https://www.ebay.de/itm/226816242624 (per snippet)", "Mac Studio 2022", "M1 Ultra", 128, "4TB",
  "Used, light wear", "n/a", 2900, "GBP", "", "", S, VM, "ended June (year n/s)", "Comparable."],
 ["eBay.de auction (closed)", "DE", "ebay.de (item id not captured)", "Mac Studio 2023", "M2 Ultra", 64, "2TB", "Used", "n/a",
  3100, "EUR", 1.0, 3100, S, VM, "ended 7 June (year n/s)", "Comparable."],
 ["refurb.me DE (Back Market)", "DE", "https://www.refurb.me/de/refurbished/macbook/macbook-pro/16-inch/m1-max", "MacBook Pro 16\" 2021",
  "M1 Max", 64, "1TB", "Average", "n/s", 1810, "EUR", 1.0, 1810, S, VM, D, "Last lowest price; out of stock."],
 ["Swappa (US)", "US", "swappa.com listing (M2 Ultra 128/2TB)", "Mac Studio 2023", "M2 Ultra", 128, "2TB", "Mint", "n/a",
  2060, "USD", USD, eur(2060, USD), S, VM, "undated (likely pre-2026)", "US comparable; much lower than 2026 eBay sold range."],
 ["Swappa (US)", "US", "swappa.com listing (M1 Ultra 128GB)", "Mac Studio 2022", "M1 Ultra", 128, "n/s", "n/s", "n/a",
  1998, "USD", USD, eur(1998, USD), S, VM, "undated (likely pre-2026)", "US comparable."],
 ["MacPro-LA price guide (eBay sold aggregate)", "US", "https://macpro-la.com/blogs/news/mac-studio-price-guide-2026",
  "Mac Studio 2023", "M2 Ultra", 128, "various", "Used", "n/a", "4199-5399", "USD", USD, "3747-4818", S,
  "vendor-published aggregate", "2026-09-10..10-06", "Vendor source; reflects 2026 DRAM-shortage pricing."],
 ["MacPro-LA price guide (eBay sold aggregate)", "US", "https://macpro-la.com/blogs/news/mac-studio-price-guide-2026",
  "Mac Studio 2023", "M2 Ultra", 192, "various", "Used", "n/a", "5925-7300", "USD", USD, "5288-6515", S,
  "vendor-published aggregate", "2026-09-10..10-06", "Vendor source."],
 ["MacPro-LA price guide (eBay sold aggregate)", "US", "https://macpro-la.com/blogs/news/mac-studio-price-guide-2026",
  "Mac Studio 2022", "M1 Ultra", 128, "various", "Used", "n/a", "3850-4600", "USD", USD, "3436-4105", S,
  "vendor-published aggregate", "2026-09-10..10-06", "Vendor source."],
]

# --- Verified 2026-11-09 by opening the shop's public product feed (Shopify products.json / .js) ---
VA = "Appears active, seller not yet contacted"
VT = "2026-11-09 03:05 UTC"
VMF = "shop public product feed opened (variant available=true)"
LISTINGS += [
 ["Revendo", "CH", "https://revendo.ch/en/products/apple-macbook-pro-14-space-black-m3-max-16-core-cpu-and-40-core-gpu-2-tb-ssd-128-gb-ram-late-2023-ch",
  "MacBook Pro 14\" Late 2023", "M3 Max 16C CPU / 40C GPU (400 GB/s)", 128, "2TB", "Very good (cosmetic) / battery 'Used'", "ask",
  3646, "CHF", CHF, eur(3646, CHF), VA, VMF, VT, "ONLY 128GB portable found live. CH kbd. Other grades of same SKU sold out (Bargain 3,070 / Used 3,413 / As new 3,911)."],
 ["Revendo", "CH", "https://revendo.ch/en/products/apple-macbook-pro-16-space-gray-m1-max-10-core-cpu-and-32-core-gpu-1-tb-ssd-64-gb-ram-late-2021-ch",
  "MacBook Pro 16\" Late 2021", "M1 Max 10C / 32C GPU", 64, "1TB", "Very good / battery 'Used'", "ask", 1986, "CHF", CHF, eur(1986, CHF), VA, VMF, VT, "CH kbd."],
 ["Revendo", "CH", "https://revendo.ch/en/products/apple-macbook-pro-14-silver-m1-max-10-core-cpu-32-core-gpu-2-tb-ssd-64-gb-ram-late-2021-ch",
  "MacBook Pro 14\" Late 2021", "M1 Max 10C / 32C GPU", 64, "2TB", "Very good / battery 'Used'", "ask", 2148, "CHF", CHF, eur(2148, CHF), VA, VMF, VT, ""],
 ["Revendo", "CH", "https://revendo.ch/en/products/apple-macbook-pro-16-space-grey-m2-max-12-core-cpu-38-core-gpu-1-tb-ssd-64-gb-ram-early-2023-ch",
  "MacBook Pro 16\" Early 2023", "M2 Max 12C / 38C GPU", 64, "1TB", "Very good / battery 'New'", "ask", 2550, "CHF", CHF, eur(2550, CHF), VA, VMF, VT, ""],
 ["Revendo", "CH", "https://revendo.ch/en/products/apple-macbook-pro-16-space-black-m3-max-16-core-cpu-and-40-core-gpu-1-tb-ssd-64-gb-ram-late-2023-ch",
  "MacBook Pro 16\" Late 2023", "M3 Max 16C / 40C GPU", 64, "1TB", "Very good / battery 'New'", "ask", 2708, "CHF", CHF, eur(2708, CHF), VA, VMF, VT, ""],
 ["Revendo", "CH", "https://revendo.ch/en/products/apple-macbook-pro-16-space-black-m3-max-16-core-cpu-and-40-core-gpu-2-tb-ssd-64-gb-ram-late-2023-ch",
  "MacBook Pro 16\" Late 2023", "M3 Max 16C / 40C GPU", 64, "2TB", "Very good / battery 'New'", "ask", 3178, "CHF", CHF, eur(3178, CHF), VA, VMF, VT, ""],
 ["Revendo", "CH", "https://revendo.ch/en/products/apple-macbook-pro-16-space-black-m3-max-16-core-cpu-and-40-core-gpu-4-tb-ssd-64-gb-ram-late-2023-ch",
  "MacBook Pro 16\" Late 2023", "M3 Max 16C / 40C GPU", 64, "4TB", "Used / battery 'Used'", "ask", 3312, "CHF", CHF, eur(3312, CHF), VA, VMF, VT, ""],
 ["Revendo", "CH", "https://revendo.ch/en/products/apple-macbook-pro-16-space-schwarz-m4-max-16-core-cpu-und-40-core-gpu-2-tb-ssd-64-gb-ram-late-2024-ch",
  "MacBook Pro 16\" Late 2024", "M4 Max 16C / 40C GPU (546 GB/s)", 64, "2TB", "Very good / battery 'New'", "ask", 3996, "CHF", CHF, eur(3996, CHF), VA, VMF, VT, ""],
 ["Revendo", "CH", "https://revendo.ch/en/products/apple-macbook-pro-14-silber-m4-max-16-core-cpu-und-40-core-gpu-4-tb-ssd-64-gb-ram-late-2024-ch",
  "MacBook Pro 14\" Late 2024", "M4 Max 16C / 40C GPU", 64, "4TB", "As new / battery 'Used'", "ask", 4151, "CHF", CHF, eur(4151, CHF), VA, VMF, VT, ""],
 ["mac-store24 (Remacs GmbH)", "DE", "https://mac-store24.com/products/mac-studio-2022-refurbished-gebraucht",
  "Mac Studio 2022", "M1 Ultra 20C / 48C GPU", 128, "4TB", "Used/refurbished (grade per option)", "n/a", 4499, "EUR", 1.0, 4499, VA, VMF, VT,
  "Variant of a configurator-style listing - confirm a physical unit exists. Only 128GB Ultra found live."],
 ["mac-store24 (Remacs GmbH)", "DE", "https://mac-store24.com/products/mac-studio-2022-refurbished-gebraucht",
  "Mac Studio 2022", "M1 Ultra 20C / 48C GPU", 64, "1TB", "Used/refurbished", "n/a", 2899, "EUR", 1.0, 2899, VA, VMF, VT, "Confirm physical unit."],
 ["mac-store24 (Remacs GmbH)", "DE", "https://mac-store24.com/products/mac-studio-2022-refurbished-gebraucht",
  "Mac Studio 2022", "M1 Ultra 20C / 48C GPU", 64, "2TB", "Used/refurbished", "n/a", 3399, "EUR", 1.0, 3399, VA, VMF, VT, "Confirm physical unit."],
 ["mac-store24 (Remacs GmbH)", "DE", "https://mac-store24.com/products/mac-studio-2022-refurbished-gebraucht",
  "Mac Studio 2022", "M1 Max 10C / 24C GPU", 64, "1TB", "Used/refurbished", "n/a", 2099, "EUR", 1.0, 2099, VA, VMF, VT, "Confirm physical unit."],
 ["mac-store24 (Remacs GmbH)", "DE", "https://mac-store24.com/products/mac-studio-2023-refurbished-gebraucht",
  "Mac Studio 2023", "M2 Max 12C / 30C GPU", 64, "1TB", "Used/refurbished", "n/a", 2799, "EUR", 1.0, 2799, VA, VMF, VT, "Confirm physical unit."],
 ["mac-store24 (Remacs GmbH)", "DE", "https://mac-store24.com/products/mac-studio-m4-max-64gb-ram-1tb-ssd-40-core-gpu-2025-apple-cpo-1",
  "Mac Studio 2025", "M4 Max 16C / 40C GPU", 64, "1TB", "Apple Certified Refurbished", "n/a", 4099, "EUR", 1.0, 4099, VA, VMF, VT, ""],
 ["mac-store24 (Remacs GmbH)", "DE", "https://mac-store24.com/products/apple-macbook-pro-16-zoll-retina-ende-2023-m3-max-8tb-ssd-128gb-ram-black-40-core-gpu-tagesdeal-kopie",
  "MacBook Pro 16\" Late 2023", "M3 Max 16C / 40C GPU", 128, "8TB", "Used/refurbished; IT kbd option", "ask", 7849, "EUR", 1.0, 7849, VA, VMF, VT, "Overpriced (8TB)."],
]

# Revendo sold-price grid (public feed, all variants SOLD at 2026-11-09 03:05 UTC) - shows Revendo's formula pricing:
# M2 Ultra 60C 1TB 192GB: Bargain 2,663 / Used 3,053 / Very good 3,231 / As new 3,373 CHF
# M2 Ultra 60C 2TB 192GB: 2,881 / 3,304 / 3,496 / 3,649 ; 4TB 192GB & 76C 2TB 192GB: 3,186 / 3,654 / 3,866 / 4,036
# M2 Ultra 60C 1TB 64GB: 2,124 / 2,435 / 2,577 / 2,690 ; M1 Ultra 48C 1TB 64GB: 1,620 / 1,858 / 1,966 / 2,052
# M3 Ultra 28C/60C 1TB 96GB: 2,827 / 3,242 / 3,430 / 3,581
# Other sources checked at 2026-11-09 03:05 UTC: Creative IT store API (no 64GB+ Macs), BuyDifferent feed (none), Okamac (none >64GB).
# Not checkable by plain request (site anti-bot 403): ricardo.ch, ebay.de, subito.it, refurb.me, smartgeneration.it, trendevice.com.

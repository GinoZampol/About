# -*- coding: utf-8 -*-
"""
Builds acquisition_targets.csv, outreach_queue.csv and marketplace_listings.csv
from research/targets_data.py and research/listings_data.py.

Run:  python3 -I research/build_outputs.py   (from mac-acquisition/)

SCORING (100 points) - designed for acquisition potential, not company size:
  A  Evidence of high-end Apple Silicon (>=64GB Max/Ultra) handled ........ 0-25
  B  Off-market / incoming supply (buys, trade-ins, ITAD, fleet refresh) .. 0-20
  C  Will sell a single unit to a private/small buyer ..................... 0-15
  D  Geography (CH/IT 15, AT 12, S-DE 11, DE/FR/NL/BE 9, ES/PL/SE 6, IE 5). 0-15
  E  Contact channel (published email 10, phone+form 7, form 5, none 2) ... 0-10
  F  Motivation for a quick, simple sale (idle kit, liquidation, distress). 0-10
  G  Expected price edge vs. retail refurb (wholesale/auction/studio) ..... 0-5
"""
import csv, os, sys, datetime

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)
from targets_data import T          # noqa: E402
from listings_data import LISTINGS  # noqa: E402

TODAY = "2026-11-09"

# ------------------------------------------------------------------ templates
SUBJ = {
 "it": {"RESELLER": "Richiesta di acquisto: Mac Apple Silicon con 64 GB+ di memoria unificata",
        "ITAD": "Acquisto singolo da lotti aziendali: Mac Apple Silicon 64 GB+",
        "STUDIO": "Workstation Mac dismesse? Acquisto Mac Studio / MacBook Pro 64 GB+",
        "ENTERPRISE": "Acquisto di Mac rientrati da leasing/noleggio (64 GB+)",
        "REPAIR": "Cerco Mac Apple Silicon 64 GB+ (anche permute o con difetti estetici)"},
 "de": {"RESELLER": "Kaufanfrage: Apple-Silicon-Mac mit 64 GB+ Unified Memory",
        "ITAD": "Einzelkauf aus Firmen-Rückläufern: Apple-Silicon-Mac 64 GB+",
        "STUDIO": "Ausgemusterte Mac-Workstations? Kaufe Mac Studio / MacBook Pro 64 GB+",
        "ENTERPRISE": "Kauf von Leasing-/Miet-Rückläufern: Mac 64 GB+",
        "REPAIR": "Suche Apple-Silicon-Mac 64 GB+ (gern Eintausch oder mit Gebrauchsspuren)"},
 "fr": {"RESELLER": "Demande d'achat : Mac Apple Silicon avec 64 Go+ de mémoire unifiée",
        "ITAD": "Achat à l'unité issu de lots d'entreprise : Mac Apple Silicon 64 Go+",
        "STUDIO": "Postes Mac retirés du service ? Achat Mac Studio / MacBook Pro 64 Go+",
        "ENTERPRISE": "Achat de Mac en fin de leasing/location (64 Go+)",
        "REPAIR": "Recherche Mac Apple Silicon 64 Go+ (reprises ou défauts esthétiques acceptés)"},
 "nl": {"RESELLER": "Koopverzoek: Apple Silicon Mac met 64 GB+ unified memory",
        "ITAD": "Losse aankoop uit zakelijke partijen: Apple Silicon Mac 64 GB+",
        "STUDIO": "Afgeschreven Mac-werkstations? Ik koop Mac Studio / MacBook Pro 64 GB+",
        "ENTERPRISE": "Aankoop van lease-/huurretouren: Mac 64 GB+",
        "REPAIR": "Gezocht: Apple Silicon Mac 64 GB+ (inruil of cosmetische schade prima)"},
 "en": {"RESELLER": "Purchase enquiry: Apple Silicon Mac with 64 GB+ unified memory",
        "ITAD": "Single-unit purchase from corporate batches: Apple Silicon Mac 64 GB+",
        "STUDIO": "Retired Mac workstations? Buying Mac Studio / MacBook Pro 64 GB+",
        "ENTERPRISE": "Buying off-lease / ex-rental Macs (64 GB+)",
        "REPAIR": "Looking for an Apple Silicon Mac 64 GB+ (trade-ins or cosmetic wear fine)"},
 "es": {"RESELLER": "Solicitud de compra: Mac Apple Silicon con 64 GB+ de memoria unificada",
        "ITAD": "Compra unitaria de lotes corporativos: Mac Apple Silicon 64 GB+",
        "STUDIO": "¿Estaciones Mac retiradas? Compro Mac Studio / MacBook Pro 64 GB+",
        "ENTERPRISE": "Compra de Mac fin de leasing/alquiler (64 GB+)",
        "REPAIR": "Busco Mac Apple Silicon 64 GB+ (permutas o desgaste estético aceptados)"},
}

GREET = {"it": "Buongiorno,", "de": "Guten Tag,", "fr": "Bonjour,", "nl": "Goedendag,",
         "en": "Hello,", "es": "Buenos días,"}

ANGLE = {
 "it": {
  "RESELLER": "Sto cercando di acquistare un Mac Apple Silicon professionale usato con almeno 64 GB di memoria unificata, idealmente un Mac Studio M1/M2 Ultra (64-192 GB) oppure un MacBook Pro M1/M2 Max da 64-96 GB. Avete unità in arrivo, in attesa di ricondizionamento o non ancora pubblicate? Se al momento non ne avete, potreste reperirne una tramite i vostri fornitori?",
  "ITAD": "Sto cercando di acquistare singolarmente un Mac Apple Silicon con almeno 64 GB di memoria unificata (Mac Studio M1/M2 Ultra o MacBook Pro M1/M2 Max), anche proveniente da un lotto aziendale dismesso. Ricevete o avete in lavorazione macchine di questo tipo? Una singola unità con difetti estetici va benissimo.",
  "STUDIO": "Sto cercando di acquistare un Mac Apple Silicon con almeno 64 GB di memoria unificata (Mac Studio M1/M2 Ultra o MacBook Pro M1/M2 Max). Molti studi hanno aggiornato le postazioni negli ultimi anni: avete per caso una workstation inutilizzata, dismessa o in attesa di sostituzione che sareste disposti a vendere?",
  "ENTERPRISE": "Sto cercando di acquistare un Mac Apple Silicon con almeno 64 GB di memoria unificata (Mac Studio M1/M2 Ultra o MacBook Pro M1/M2 Max). Vendete singole unità rientrate da leasing o noleggio, oppure potete indicarmi il vostro partner di remarketing?",
  "REPAIR": "Sto cercando di acquistare un Mac Apple Silicon con almeno 64 GB di memoria unificata (Mac Studio M1/M2 Ultra o MacBook Pro M1/M2 Max). Avete permute, macchine di clienti in vendita o unità funzionanti con difetti estetici di questo tipo?"},
 "de": {
  "RESELLER": "Ich möchte einen gebrauchten professionellen Apple-Silicon-Mac mit mindestens 64 GB Unified Memory kaufen, idealerweise einen Mac Studio M1/M2 Ultra (64-192 GB) oder ein MacBook Pro M1/M2 Max mit 64-96 GB. Haben Sie solche Geräte im Zulauf, in der Aufbereitung oder noch nicht online? Falls aktuell nicht: Könnten Sie eines über Ihre Lieferanten beschaffen?",
  "ITAD": "Ich möchte einzeln einen Apple-Silicon-Mac mit mindestens 64 GB Unified Memory kaufen (Mac Studio M1/M2 Ultra oder MacBook Pro M1/M2 Max), gerne auch aus einer Firmen-Rücknahme. Erhalten oder bearbeiten Sie solche Geräte? Ein einzelnes Gerät mit Gebrauchsspuren ist völlig in Ordnung.",
  "STUDIO": "Ich möchte einen Apple-Silicon-Mac mit mindestens 64 GB Unified Memory kaufen (Mac Studio M1/M2 Ultra oder MacBook Pro M1/M2 Max). Viele Studios haben ihre Arbeitsplätze zuletzt erneuert - haben Sie vielleicht eine ungenutzte, ausgemusterte oder bald ersetzte Workstation, die Sie verkaufen würden?",
  "ENTERPRISE": "Ich möchte einen Apple-Silicon-Mac mit mindestens 64 GB Unified Memory kaufen (Mac Studio M1/M2 Ultra oder MacBook Pro M1/M2 Max). Verkaufen Sie einzelne Leasing- oder Miet-Rückläufer, oder können Sie mir Ihren Remarketing-Partner nennen?",
  "REPAIR": "Ich möchte einen Apple-Silicon-Mac mit mindestens 64 GB Unified Memory kaufen (Mac Studio M1/M2 Ultra oder MacBook Pro M1/M2 Max). Haben Sie Eintauschgeräte, Kundengeräte zum Verkauf oder funktionierende Geräte mit Gebrauchsspuren in dieser Ausstattung?"},
 "fr": {
  "RESELLER": "Je souhaite acheter un Mac Apple Silicon professionnel d'occasion avec au moins 64 Go de mémoire unifiée, idéalement un Mac Studio M1/M2 Ultra (64-192 Go) ou un MacBook Pro M1/M2 Max 64-96 Go. Avez-vous des machines en arrivage, en attente de reconditionnement ou pas encore en ligne ? Sinon, pourriez-vous en trouver une via vos fournisseurs ?",
  "ITAD": "Je souhaite acheter à l'unité un Mac Apple Silicon avec au moins 64 Go de mémoire unifiée (Mac Studio M1/M2 Ultra ou MacBook Pro M1/M2 Max), éventuellement issu d'un lot d'entreprise. Recevez-vous ce type de machines ? Une unité avec défauts esthétiques me convient tout à fait.",
  "STUDIO": "Je souhaite acheter un Mac Apple Silicon avec au moins 64 Go de mémoire unifiée (Mac Studio M1/M2 Ultra ou MacBook Pro M1/M2 Max). Beaucoup de studios ont renouvelé leurs postes récemment : auriez-vous une station inutilisée, retirée ou bientôt remplacée que vous accepteriez de vendre ?",
  "ENTERPRISE": "Je souhaite acheter un Mac Apple Silicon avec au moins 64 Go de mémoire unifiée (Mac Studio M1/M2 Ultra ou MacBook Pro M1/M2 Max). Vendez-vous des unités en fin de leasing ou de location, ou pouvez-vous m'indiquer votre partenaire de remarketing ?",
  "REPAIR": "Je souhaite acheter un Mac Apple Silicon avec au moins 64 Go de mémoire unifiée (Mac Studio M1/M2 Ultra ou MacBook Pro M1/M2 Max). Auriez-vous des reprises, des machines de clients à vendre ou des unités fonctionnelles avec défauts esthétiques ?"},
 "nl": {
  "RESELLER": "Ik wil graag een gebruikte professionele Apple Silicon Mac kopen met minimaal 64 GB unified memory, bij voorkeur een Mac Studio M1/M2 Ultra (64-192 GB) of een MacBook Pro M1/M2 Max met 64-96 GB. Heeft u zulke toestellen binnenkomend, in refurbishment of nog niet online? Zo niet, kunt u er een via uw leveranciers vinden?",
  "ITAD": "Ik wil graag los een Apple Silicon Mac kopen met minimaal 64 GB unified memory (Mac Studio M1/M2 Ultra of MacBook Pro M1/M2 Max), gerne ook uit een zakelijke partij. Ontvangt of verwerkt u zulke toestellen? Eén exemplaar met cosmetische schade is prima.",
  "STUDIO": "Ik wil graag een Apple Silicon Mac kopen met minimaal 64 GB unified memory (Mac Studio M1/M2 Ultra of MacBook Pro M1/M2 Max). Veel studio's hebben hun werkplekken vernieuwd: heeft u misschien een ongebruikt, afgeschreven of binnenkort te vervangen werkstation dat u wilt verkopen?",
  "ENTERPRISE": "Ik wil graag een Apple Silicon Mac kopen met minimaal 64 GB unified memory (Mac Studio M1/M2 Ultra of MacBook Pro M1/M2 Max). Verkoopt u losse lease- of huurretouren, of kunt u mij uw remarketingpartner noemen?",
  "REPAIR": "Ik wil graag een Apple Silicon Mac kopen met minimaal 64 GB unified memory (Mac Studio M1/M2 Ultra of MacBook Pro M1/M2 Max). Heeft u inruiltoestellen, klanttoestellen te koop of werkende toestellen met cosmetische schade?"},
 "en": {
  "RESELLER": "I'm looking to buy a used professional Apple Silicon Mac with at least 64 GB of unified memory - ideally a Mac Studio M1/M2 Ultra (64-192 GB) or a MacBook Pro M1/M2 Max with 64-96 GB. Do you have any such units incoming, awaiting refurbishment or not yet listed? If not, could you source one through your suppliers?",
  "ITAD": "I'm looking to buy a single Apple Silicon Mac with at least 64 GB of unified memory (Mac Studio M1/M2 Ultra or MacBook Pro M1/M2 Max), including units from retired corporate batches. Do you receive or process machines like this? One unit with cosmetic wear is perfectly fine.",
  "STUDIO": "I'm looking to buy an Apple Silicon Mac with at least 64 GB of unified memory (Mac Studio M1/M2 Ultra or MacBook Pro M1/M2 Max). Many studios have refreshed their workstations recently - do you have an unused, retired or soon-to-be-replaced machine you'd consider selling?",
  "ENTERPRISE": "I'm looking to buy an Apple Silicon Mac with at least 64 GB of unified memory (Mac Studio M1/M2 Ultra or MacBook Pro M1/M2 Max). Do you sell individual off-lease or ex-rental units, or could you point me to your remarketing partner?",
  "REPAIR": "I'm looking to buy an Apple Silicon Mac with at least 64 GB of unified memory (Mac Studio M1/M2 Ultra or MacBook Pro M1/M2 Max). Do you have trade-ins, customer machines for sale, or working units with cosmetic damage in that configuration?"},
 "es": {
  "RESELLER": "Busco comprar un Mac Apple Silicon profesional usado con al menos 64 GB de memoria unificada, idealmente un Mac Studio M1/M2 Ultra (64-192 GB) o un MacBook Pro M1/M2 Max de 64-96 GB. ¿Tienen unidades en camino, pendientes de reacondicionar o aún no publicadas? Si no, ¿podrían conseguir una a través de sus proveedores?",
  "ITAD": "Busco comprar una sola unidad de Mac Apple Silicon con al menos 64 GB de memoria unificada (Mac Studio M1/M2 Ultra o MacBook Pro M1/M2 Max), también de lotes corporativos retirados. ¿Reciben equipos así? Una unidad con desgaste estético me sirve.",
  "STUDIO": "Busco comprar un Mac Apple Silicon con al menos 64 GB de memoria unificada. ¿Tienen alguna estación de trabajo sin uso, retirada o a punto de sustituirse que estarían dispuestos a vender?",
  "ENTERPRISE": "Busco comprar un Mac Apple Silicon con al menos 64 GB de memoria unificada. ¿Venden unidades sueltas de fin de leasing o alquiler?",
  "REPAIR": "Busco comprar un Mac Apple Silicon con al menos 64 GB de memoria unificada. ¿Tienen permutas o equipos funcionales con desgaste estético?"},
}

CLOSE = {
 "it": "Sono flessibile sulle condizioni estetiche e posso organizzare pagamento tramite bonifico con fattura e ritiro di persona o spedizione assicurata (Italia/Svizzera). Mi servirebbero solo modello esatto, memoria, SSD, condizioni ed eventuale conferma di rimozione Blocco Attivazione/MDM.\n\nGrazie per il tempo dedicato.\n\nCordiali saluti,\n{SENDER_NAME}\n{SENDER_PHONE}",
 "de": "Beim Zustand bin ich flexibel; Zahlung per Überweisung gegen Rechnung sowie Abholung oder versicherter Versand (Italien/Schweiz) sind problemlos möglich. Hilfreich wären Modell, Speicher, SSD, Zustand und die Bestätigung, dass Aktivierungssperre/MDM entfernt sind.\n\nVielen Dank für Ihre Zeit.\n\nFreundliche Grüsse\n{SENDER_NAME}\n{SENDER_PHONE}",
 "fr": "Je suis flexible sur l'état esthétique et peux organiser un paiement par virement sur facture ainsi qu'un retrait ou un envoi assuré (Italie/Suisse). Il me faudrait le modèle exact, la mémoire, le SSD, l'état et la confirmation du retrait du verrouillage d'activation/MDM.\n\nMerci pour votre temps.\n\nCordialement,\n{SENDER_NAME}\n{SENDER_PHONE}",
 "nl": "Ik ben flexibel wat betreft de cosmetische staat en kan betaling per overschrijving op factuur en ophalen of verzekerde verzending (Italië/Zwitserland) regelen. Graag model, geheugen, SSD, staat en bevestiging dat Activeringsslot/MDM verwijderd is.\n\nDank voor uw tijd.\n\nMet vriendelijke groet,\n{SENDER_NAME}\n{SENDER_PHONE}",
 "en": "I'm flexible on cosmetic condition and can arrange bank-transfer payment against invoice plus collection or insured shipping (Italy/Switzerland). Helpful details: exact model, memory, SSD, condition, and confirmation that Activation Lock / MDM is released.\n\nThank you for your time.\n\nKind regards,\n{SENDER_NAME}\n{SENDER_PHONE}",
 "es": "Soy flexible con el estado estético y puedo pagar por transferencia contra factura y recoger o pagar envío asegurado (Italia/Suiza). Necesitaría modelo exacto, memoria, SSD, estado y confirmación de Bloqueo de Activación/MDM liberado.\n\nGracias por su tiempo.\n\nUn saludo,\n{SENDER_NAME}\n{SENDER_PHONE}",
}

# Company-specific opening lines (recipient language), used where evidence allows.
HOOK = {
 "Revendo AG": "ich habe gesehen, dass Revendo Mac Studio M1 Ultra mit 128 GB und M2 Ultra mit 192 GB im Sortiment hatte.",
 "Creative IT": "I saw you previously offered a MacBook Pro 16\" M2 Max 96GB as certified refurbished.",
 "Okamac / Okamac Pro (SENS Technologies)": "j'ai vu sur votre site une fiche MacBook Pro 16\" 2023 M2 Max 96 Go.",
 "Smart Generation srl": "ho visto che proponete MacBook Pro 16\" M1 Max ricondizionati con opzione 64 GB.",
 "Remacs GmbH (mac-store24.com)": "auf mac-store24.com habe ich Seiten zu gebrauchten Mac Studio M1 Ultra und M2 gesehen.",
 "Gebrauchtmacs.de GmbH (maconline.de / maconline.at)": "auf maconline.at führen Sie Mac Studio bis hin zu M2 Ultra und M3 Ultra.",
 "ict-remarketing (eBay seller; 'Click it Remarketing')": "ich habe bei Ihnen ein MacBook Pro 16\" M1 Max 64 GB (Refurbished, 137 Zyklen) gesehen - ist es noch verfügbar?",
 "TrenDevice S.p.A. (incl. BuyDifferent)": "so che TrenDevice ricondiziona Mac Studio e ritira Mac usati.",
 "Grover Group GmbH": "ich habe gesehen, dass Grover Mac Studio M2 Ultra (64 GB/1 TB) vermietet.",
 "JES (Digitec/Galaxus marketplace refurbisher)": "ich habe Ihr Angebot eines Mac Studio M1 Max 64 GB auf Digitec gesehen.",
 "iUsed": "ik zag dat iUsed refurbished Mac Studio's met 3 jaar garantie aanbiedt.",
 "MacTastic": "ik zag dat MacTastic refurbished Mac Studio's verkoopt en Macs inkoopt.",
 "Data Quest AG (DQ Solutions)": "ich habe Ihre Rubrik 'Demo- und Occasionsgeräte' gesehen.",
 "D&S Resell": "ich habe gesehen, dass Sie Mac Studio und MacBook Pro ankaufen.",
 "ag.pl": "I read that you offer ex-lease MacBook Pro 16\" M1 Max 64GB/1TB units with VAT invoice.",
 "Stock4less": "I saw MacBook Pro 16\" M1 Max 64GB and Mac Studio M2 Ultra 64GB product pages on your EU store.",
 "CompTech e.U.": "ich habe gesehen, dass Sie gebrauchte Firmen-IT inklusive MacBook und iMac ankaufen.",
 "Wisetek": "I saw your refurbished MacBook Pro collection and bulk-buyer programme.",
 "Foxway (Flip4 in DE)": "I saw your reseller store lists graded used MacBook Pro stock.",
 "Ledfilms Production": "vi scrivo perché a Lugano vi occupate di montaggio, color grading e compositing.",
}
HOOK_GENERIC = {
 "it": {"RESELLER": "so che trattate Mac usati e ricondizionati.", "ITAD": "so che vi occupate di ritiro e rivendita di IT aziendale.",
        "STUDIO": "vi scrivo perché lavorate in post-produzione/grafica, dove i Mac ad alta memoria sono comuni.",
        "ENTERPRISE": "so che gestite flotte di dispositivi in leasing/noleggio.", "REPAIR": "so che vi occupate di assistenza Mac."},
 "de": {"RESELLER": "ich weiss, dass Sie gebrauchte und aufbereitete Macs anbieten.", "ITAD": "ich weiss, dass Sie gebrauchte Firmen-IT ankaufen und vermarkten.",
        "STUDIO": "ich schreibe Ihnen, weil in Postproduktion und Motion Design oft Macs mit viel Speicher im Einsatz sind.",
        "ENTERPRISE": "ich weiss, dass Sie Geräteflotten im Leasing/in der Miete betreuen.", "REPAIR": "ich weiss, dass Sie Macs reparieren und betreuen."},
 "fr": {"RESELLER": "je sais que vous proposez des Mac d'occasion et reconditionnés.", "ITAD": "je sais que vous rachetez et revalorisez du matériel informatique d'entreprise.",
        "STUDIO": "je vous écris car les studios de post-production utilisent souvent des Mac à forte mémoire.",
        "ENTERPRISE": "je sais que vous gérez des parcs en leasing/location.", "REPAIR": "je sais que vous réparez et entretenez des Mac."},
 "nl": {"RESELLER": "ik weet dat u gebruikte en refurbished Macs aanbiedt.", "ITAD": "ik weet dat u zakelijke IT opkoopt en herverkoopt.",
        "STUDIO": "ik schrijf u omdat studio's vaak Macs met veel geheugen gebruiken.",
        "ENTERPRISE": "ik weet dat u lease-/huurvloten beheert.", "REPAIR": "ik weet dat u Macs repareert."},
 "en": {"RESELLER": "I understand you deal in used and refurbished Macs.", "ITAD": "I understand you buy back and remarket corporate IT.",
        "STUDIO": "I'm writing because studios like yours often run high-memory Macs.",
        "ENTERPRISE": "I understand you manage leased/rental device fleets.", "REPAIR": "I understand you service Macs."},
 "es": {"RESELLER": "sé que trabajan con Mac usados y reacondicionados.", "ITAD": "sé que compran y revenden IT corporativo.",
        "STUDIO": "les escribo porque los estudios suelen usar Mac con mucha memoria.",
        "ENTERPRISE": "sé que gestionan flotas en leasing/alquiler.", "REPAIR": "sé que reparan Mac."},
}
INTRO = {"it": "mi chiamo {SENDER_NAME} e ", "de": "mein Name ist {SENDER_NAME} - ", "fr": "je m'appelle {SENDER_NAME} et ",
         "nl": "mijn naam is {SENDER_NAME} en ", "en": "my name is {SENDER_NAME} and ", "es": "me llamo {SENDER_NAME} y "}


def message(name, cat, lang):
    hook = HOOK.get(name) or HOOK_GENERIC[lang][cat]
    body = (f"{GREET[lang]}\n\n{INTRO[lang]}{hook}\n\n{ANGLE[lang][cat]}\n\n{CLOSE[lang]}")
    return SUBJ[lang][cat], body


def channel(contact):
    c = contact.lower()
    if "@" in c:
        return "email"
    if "ebay" in c or "kleinanzeigen" in c or "marketplace" in c or "refurbed" in c or "soundbetter" in c or "idm" in c:
        return "marketplace/platform message"
    if c.startswith("not verified"):
        return "contact channel to be found"
    return "website contact form / phone"


def main():
    rows = []
    from emails_found import EMAILS, FOUND_AT
    for (name, country, city, web, cat, reason, evid, contact, person, lang, inv, s) in T:
        if name in EMAILS and '@' not in contact:
            contact = f"{EMAILS[name]} (published on own website, {FOUND_AT})"
            s = tuple(s[:4]) + (10,) + tuple(s[5:])
        total = sum(s)
        A = s[0]
        conf = "High" if (A >= 18 and "@" in contact) else ("Medium" if (A >= 10 or "@" in contact or s[4] >= 5) else "Low")
        conf_pct = {"High": 80, "Medium": 55, "Low": 30}[conf]
        pot = "High" if total >= 70 else ("Medium" if total >= 55 else "Low")
        rows.append(dict(name=name, country=country, city=city, web=web, cat=cat, reason=reason, evid=evid,
                         contact=contact, person=person, lang=lang, inv=inv, s=s, total=total,
                         conf=conf, conf_pct=conf_pct, pot=pot))
    rows.sort(key=lambda r: (-r["total"], r["name"]))
    for i, r in enumerate(rows, 1):
        r["rank"] = i
        r["wave"] = 1 if i <= 50 else (2 if i <= 100 else 3)
        ch = channel(r["contact"])
        r["channel"] = ch
        if ch == "email":
            r["next"] = f"Wave {r['wave']}: approve sender identity, then send email"
        elif ch == "website contact form / phone":
            r["next"] = f"Wave {r['wave']}: submit via website form/phone after approval (open site to confirm form)"
        elif ch == "marketplace/platform message":
            r["next"] = f"Wave {r['wave']}: message via platform after approval"
        else:
            r["next"] = f"Wave {r['wave']}: find a published business contact (imprint/Zefix/KVK/registro imprese) before outreach"

    # ---------------- acquisition_targets.csv
    cols = ["rank", "wave", "company", "country", "city", "website", "category", "reason_likely_has_macs",
            "evidence", "published_contact", "contact_person_or_team", "language", "existing_relevant_inventory",
            "acquisition_potential", "confidence", "confidence_pct", "score_total",
            "A_highend_evidence", "B_offmarket_supply", "C_single_unit", "D_geography", "E_contact",
            "F_quick_sale_motivation", "G_price_edge", "outreach_status", "date_last_contact", "response", "next_action"]
    with open(os.path.join(ROOT, "acquisition_targets.csv"), "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(cols)
        for r in rows:
            w.writerow([r["rank"], r["wave"], r["name"], r["country"], r["city"], r["web"], r["cat"], r["reason"],
                        r["evid"], r["contact"], r["person"], r["lang"], r["inv"], r["pot"], r["conf"],
                        r["conf_pct"], r["total"], *r["s"], "Draft ready - NOT SENT (awaiting approval)", "", "",
                        r["next"]])

    # ---------------- outreach_queue.csv
    qcols = ["queue_id", "wave", "rank", "company", "country", "language", "channel", "recipient",
             "subject", "message_body", "approval_status", "send_status", "sent_at", "follow_up_due",
             "follow_up_status", "response_summary", "notes"]
    with open(os.path.join(ROOT, "outreach_queue.csv"), "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(qcols)
        for r in rows:
            subj, body = message(r["name"], r["cat"], r["lang"])
            w.writerow([f"Q{r['rank']:03d}", r["wave"], r["rank"], r["name"], r["country"], r["lang"],
                        r["channel"], r["contact"], subj, body, "PENDING USER APPROVAL", "NOT SENT", "",
                        "send date + 7 days", "", "", "Purchase enquiry (we are the buyer), not marketing; "
                        "one message per company; stop on any opt-out."])

    # ---------------- marketplace_listings.csv
    lcols = ["listing_id", "platform_or_seller", "country", "url", "model", "chip_gpu", "memory_gb", "ssd",
             "condition", "battery_cycles", "price_original", "currency", "fx_to_eur", "price_eur",
             "status_classification", "verification_method", "verified_at", "notes"]
    with open(os.path.join(ROOT, "marketplace_listings.csv"), "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(lcols)
        for i, L in enumerate(LISTINGS, 1):
            w.writerow([f"L{i:03d}", *L])

    # summary to stdout
    from collections import Counter
    print("targets", len(rows), Counter(r["cat"] for r in rows))
    print("by wave/channel", Counter((r["wave"], r["channel"]) for r in rows))
    print("top10", [(r["rank"], r["name"], r["total"]) for r in rows[:10]])


if __name__ == "__main__":
    main()

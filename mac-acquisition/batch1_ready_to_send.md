# Batch 1: ready to send (5 messages)

Status: **NOT SENT**. Waiting for (1) an email tool, (2) a sender name and phone number, and (3) the delivery country (Italy or Switzerland).

When resuming in a session that has Gmail:
1. Replace `{NAME}` and `{PHONE}`.
2. Show the user the final five messages.
3. Send only after the user says yes.
4. Log each send in `outreach_queue.csv` (send_status, sent_at) and add the date to `research/notes.md`.

Rules: one message per company, one follow-up after 7 days, stop on any opt-out. No offers are binding; any purchase, payment or reservation needs the user's explicit approval.

---

## 1. Revendo AG: info@revendo.ch (German)

**Subject:** Anfrage: MacBook Pro 14" M3 Max 128 GB und Reservation Mac Studio M2 Ultra

Guten Tag

Mein Name ist {NAME}. Ich interessiere mich für zwei Dinge:

1. Ihr **MacBook Pro 14" M3 Max (16C CPU / 40C GPU), 128 GB, 2 TB, Space Black, CH**, Zustand «Sehr gut». Können Sie mir sagen, wie viele Ladezyklen und welche Akkukapazität das Gerät hat, und ob es Fotos des Gehäuses gibt? Ist bei einer raschen Abwicklung (Zahlung per Überweisung, Abholung in einer Filiale) ein Preisnachlass möglich?

2. Ich suche zudem einen **Mac Studio M2 Ultra mit 128 GB oder 192 GB** (alternativ M1 Ultra 128 GB). Gerne würde ich mich für das nächste eingehende Gerät vormerken lassen. Zustand «Gebraucht» oder «Schnäppchen» ist für mich in Ordnung.

Vielen Dank und freundliche Grüsse
{NAME}
{PHONE}

---

## 2. Remacs GmbH (mac-store24): support@mac-store24.com (German)

**Subject:** Mac Studio M1 Ultra 128 GB / 4 TB: physisch verfügbar?

Guten Tag

Mein Name ist {NAME}. In Ihrem Shop ist der **Mac Studio M1 Ultra (20C CPU / 48C GPU) mit 128 GB RAM und 4 TB SSD** für 4.499 € als verfügbar gelistet.

Könnten Sie mir bitte bestätigen, ob ein physisches Gerät vorrätig ist, in welchem Zustand (gerne mit Fotos), und ob Aktivierungssperre sowie MDM / Apple Business Manager entfernt sind? Haben Sie eventuell auch eine Variante mit 64-Core GPU oder einen M2 Ultra mit 128/192 GB im Zulauf?

Falls ich eine Lieferung in die Schweiz wähle: Wäre eine Ausfuhrlieferung ohne deutsche MwSt. möglich?

Freundliche Grüsse
{NAME}
{PHONE}

---

## 3. Smart Generation srl: info@smartgeneration.it (Italian)

**Subject:** Richiesta: Mac Studio Ultra o MacBook Pro Max con 64 GB+ di memoria

Buongiorno,

mi chiamo {NAME} e ho visto che proponete MacBook Pro 16" M1 Max ricondizionati con opzione 64 GB.

Sto cercando un Mac Apple Silicon con almeno 64 GB di memoria unificata, idealmente un **Mac Studio M1/M2 Ultra (128-192 GB)** oppure un **MacBook Pro M1/M2/M3 Max da 64-128 GB**. Avete unità disponibili, in arrivo o in attesa di ricondizionamento? Potreste reperirne una tramite i vostri fornitori?

Sono flessibile sulle condizioni estetiche; pagamento con bonifico e fattura, ritiro o spedizione assicurata.

Cordiali saluti,
{NAME}
{PHONE}

---

## 4. Okamac (SENS Technologies): contact@okamac.com (French)

**Subject:** Recherche MacBook Pro M2/M3 Max 96-128 Go ou Mac Studio Ultra

Bonjour,

je m'appelle {NAME}. J'ai vu sur votre site une fiche MacBook Pro 16" 2023 M2 Max 96 Go, mais sans stock affiché.

Je recherche un Mac Apple Silicon avec au moins 64 Go de mémoire unifiée, idéalement 96-128 Go : **MacBook Pro M2/M3 Max** ou **Mac Studio M1/M2 Ultra**. Avez-vous des machines en arrivage ou en cours de reconditionnement, et pourriez-vous me prévenir en priorité ?

Je suis flexible sur l'état esthétique ; paiement par virement sur facture.

Cordialement,
{NAME}
{PHONE}

---

## 5. AfB social & green IT: sales@afb-group.eu (German)

**Subject:** Einzelkauf aus Firmen-Rückläufern: Apple Mac mit 64 GB+ Unified Memory

Guten Tag

Mein Name ist {NAME}. Ich möchte einzeln einen Apple-Silicon-Mac mit mindestens 64 GB Unified Memory kaufen (**Mac Studio M1/M2 Ultra** oder **MacBook Pro M1/M2/M3 Max**), gerne aus einer Firmen-Rücknahme und auch mit Gebrauchsspuren.

Erhalten Sie solche Geräte in der Schweiz, in Deutschland oder in Österreich, und können Sie mich vormerken? Zahlung per Überweisung gegen Rechnung, Abholung oder Versand.

Vielen Dank und freundliche Grüsse
{NAME}
{PHONE}

---

## Negotiation guardrails (for the user to approve before any counter-offer)

| Unit | Listed | Suggested opening | Walk-away |
|---|---|---|---|
| Revendo MBP14 M3 Max 128 GB | CHF 3,646 | CHF 3,350 | CHF 3,646 |
| mac-store24 Studio M1 Ultra 128 GB / 4 TB | €4,499 | €3,950 | €4,300 |
| Revendo next M2 Ultra 192 GB | grid CHF 2,663-3,866 | grid price | grid price |

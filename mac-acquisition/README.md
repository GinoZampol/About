# Mac acquisition campaign: checkpoint & resume guide

Goal: buy the best used 64-192 GB Apple Silicon Mac in Europe (deliverable to IT or CH) at an exceptional price, mostly via off-market outreach.

## State at checkpoint 1 (2026-11-09)
- 150 targets researched and scored -> `acquisition_targets.csv`
- 150 personalised drafts -> `outreach_queue.csv` (**all NOT SENT, pending approval**)
- 34 listings/comparables -> `marketplace_listings.csv` (none seller-confirmed; pages could not be opened)
- Analysis -> `mac_comparison.md`, `acquisition_report.md`
- Raw evidence log -> `research/notes.md`

## Blockers
1. No outbound email capability in the session. Needs a mail connector + your approval, or you send the drafts manually.
2. Network policy blocks direct page fetches. Allow the marketplace/retailer domains listed in `acquisition_report.md` §5.
3. Sender identity (name/phone/email) still needed to replace `{SENDER_NAME}` / `{SENDER_PHONE}`.

## How to resume
1. Append new evidence to `research/notes.md` (dated batch).
2. Edit `research/targets_data.py` (targets) or `research/listings_data.py` (listings).
3. Regenerate: `python3 -I research/build_outputs.py` (run from this folder).
   - The CSV `outreach_status`, `date_last_contact` and `response` columns are regenerated from data, so record send/response events in targets_data before rebuilding, or add tracking columns to the generator before Wave 1 goes out.
4. Never mark a row SENT unless it was actually sent. Never list an email that wasn't found published.

## Wave plan
- Wave 1 = rank 1-50; Wave 2 = 51-100; Wave 3 = 101-150.
- One message per company. NO follow-ups to non-responders (user instruction); ask the user first if ever considered (>=1 week). Stop immediately on any opt-out.

## Email style rules (user feedback, 2026-11-09)
- Never open with "My name is Gino" (or "mein Name ist" / "mi chiamo" / "je m'appelle"). Lead with the request or one specific evidence line. Name only in the signature.
- German: ß for Germany and Austria (Grüße, weiß); ss for Switzerland.
- Short, natural, one request per email, no follow-ups to non-responders.

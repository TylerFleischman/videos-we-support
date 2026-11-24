"""Append a run's new stories to the bank.

    python3 story-bank/pipeline/add_to_bank.py story-bank/runs/<date>

Idempotent: a story whose id is already in backend/sources.json, or whose exact link and sentence are, is
skipped, so rerunning after a fix never duplicates. Never removes or edits an existing entry. Writes the file
the same way tools/apply_anchor_votes.py does (indent=1, UTF-8 kept), so the git diff is only the new entries.
"""
import json, os, sys

REPO = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
RUN = os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else sys.exit(__doc__)
BANK = os.path.join(REPO, "backend", "sources.json")

new = json.load(open(os.path.join(RUN, "work", "new_anchors.json")))
before = open(BANK, encoding="utf-8").read()
bank = json.loads(before)
ids = {s["id"] for s in bank}
pairs = {(s.get("url"), s.get("shows")) for s in bank}
added = [a for a in new if a["id"] not in ids and (a["url"], a["shows"]) not in pairs]
bank.extend(added)
after = json.dumps(bank, indent=1, ensure_ascii=False)
if after.strip() != before.strip():
    with open(BANK, "w", encoding="utf-8") as f:
        f.write(after)
print("bank %d -> %d (%d added, %d already there)" % (len(bank) - len(added), len(bank), len(added), len(new) - len(added)))

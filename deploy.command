#!/bin/bash
cd ~/lifeos-dashboard
rm -f .git/index.lock .git/HEAD.lock

git add client/src/pages/Dashboard.tsx

git commit -m "Fix blank page: default activeCard was 'outreach' (now hidden)

Changed default activeCard from 'outreach' to 'art-advisory' since
Outreach pipeline was removed from WORKSPACE_CARDS.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"

git push origin main

echo ""
echo "Pushed! Default card fixed — dashboard should load now."
echo ""
read -p "Press Enter to close..."

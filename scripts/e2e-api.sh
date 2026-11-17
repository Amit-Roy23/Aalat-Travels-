#!/usr/bin/env bash
# Business-logic smoke test against a running server. Usage: scripts/e2e-api.sh http://localhost:3100 admin@email password
B=${1:-http://localhost:3100}; E=${2}; P=${3}
J=$(mktemp); A=$(mktemp)
pass=0; fail=0
check(){ if [ "$2" == "$3" ]; then echo "  ✓ $1"; pass=$((pass+1)); else echo "  ✗ $1 (expected $3, got $2)"; fail=$((fail+1)); fi; }
req(){ curl -s -b $J -c $J -H 'content-type: application/json' "$@"; }
code(){ curl -s -o /tmp/_b -w "%{http_code}" -b $J -c $J -H 'content-type: application/json' "$@"; }
jq_(){ python3 -c "import json,sys;d=json.load(sys.stdin);print(eval(sys.argv[1]))" "$1"; }

echo "Auth"
check "wrong password rejected" $(code -d "{\"email\":\"$E\",\"password\":\"nope\"}" $B/api/auth/login) 401
check "login" $(code -d "{\"email\":\"$E\",\"password\":\"$P\"}" $B/api/auth/login) 200

echo "Leads"
PH="98$(shuf -i 10000000-99999999 -n1)"
LID=$(req -d "{\"name\":\"Test Lead\",\"phone\":\"$PH\",\"destination\":\"Goa\",\"source\":\"manual\"}" $B/api/leads | jq_ "d['lead']['_id']")
check "lead created" $([ -n "$LID" ] && echo ok) ok
check "duplicate phone blocked (409)" $(code -d "{\"name\":\"Dup\",\"phone\":\"+91 $PH\"}" $B/api/leads) 409
check "force create allowed" $(code -d "{\"name\":\"Dup\",\"phone\":\"$PH\"}" "$B/api/leads?force=1") 200
check "lead without contact rejected" $(code -d '{"name":"No Contact"}' $B/api/leads) 400
check "status -> converted via PATCH blocked" $(code -X PATCH -d '{"status":"converted"}' $B/api/leads/$LID) 400
check "patch keeps other fields" $(req -X PATCH -d '{"city":"Pune"}' $B/api/leads/$LID | jq_ "d['lead']['destination']+'/'+d['lead']['phone'][-8:]") Goa/${PH: -8}
check "status -> interested" $(req -X PATCH -d '{"status":"interested"}' $B/api/leads/$LID | jq_ "d['lead']['status']") interested
check "note added" $(code -d '{"type":"call","message":"Discussed hotels"}' $B/api/leads/$LID/activities) 200

echo "Follow-ups"
DUE=$(date -u -d '+2 hours' +%Y-%m-%dT%H:%M:%SZ)
FID=$(req -d "{\"title\":\"Call back\",\"type\":\"call\",\"dueAt\":\"$DUE\",\"lead\":\"$LID\"}" $B/api/followups | jq_ "d['followUp']['_id']")
check "lead.nextFollowUpAt synced" $(req $B/api/leads/$LID | jq_ "bool(d['lead'].get('nextFollowUpAt'))") True
check "complete follow-up + set status" $(code -X PATCH -d '{"status":"completed","outcome":"Done","leadStatus":"follow_up"}' $B/api/followups/$FID) 200
check "nextFollowUpAt cleared" $(req $B/api/leads/$LID | jq_ "bool(d['lead'].get('nextFollowUpAt'))") False
check "lead status updated from follow-up" $(req $B/api/leads/$LID | jq_ "d['lead']['status']") follow_up
check "follow-up without target rejected" $(code -d "{\"title\":\"x x\",\"dueAt\":\"$DUE\"}" $B/api/followups) 400

echo "Convert & invoice"
CID=$(req -d '{}' $B/api/leads/$LID/convert | jq_ "d['customerId']")
check "converted" $(req $B/api/leads/$LID | jq_ "d['lead']['status']") converted
TODAY=$(date +%Y-%m-%d); NEXT=$(date -d '+7 days' +%Y-%m-%d); PAST=$(date -d '-3 days' +%Y-%m-%d)
check "due before issue rejected" $(code -d "{\"customer\":\"$CID\",\"issueDate\":\"$TODAY\",\"dueDate\":\"$PAST\",\"items\":[{\"description\":\"Pkg\",\"quantity\":2,\"rate\":10000}]}" $B/api/invoices) 400
INV=$(req -d "{\"customer\":\"$CID\",\"issueDate\":\"$TODAY\",\"dueDate\":\"$NEXT\",\"items\":[{\"description\":\"Goa pkg\",\"quantity\":2,\"rate\":14999},{\"description\":\"Transfers\",\"quantity\":1,\"rate\":2500}],\"discount\":1000,\"taxRate\":5}" $B/api/invoices)
IID=$(echo "$INV" | jq_ "d['invoice']['_id']")
check "invoice total = (29998+2500-1000)*1.05 = 33072.9" $(echo "$INV" | jq_ "d['invoice']['total']") 33072.9
check "invoice number format" $(echo "$INV" | jq_ "__import__('re').match(r'^[A-Z0-9]+-\d{4}-\d{4}$', d['invoice']['number']) is not None") True
check "overpayment rejected" $(code -d "{\"amount\":40000,\"date\":\"$TODAY\",\"method\":\"upi\"}" $B/api/invoices/$IID/payments) 400
check "partial payment" $(req -d "{\"amount\":10000,\"date\":\"$TODAY\",\"method\":\"upi\"}" $B/api/invoices/$IID/payments | jq_ "d['invoice']['status']") partial
check "cancel with payments blocked" $(code -X PATCH -d '{"state":"cancelled"}' $B/api/invoices/$IID) 400
check "lower total below paid blocked" $(code -X PATCH -d '{"items":[{"description":"x","quantity":1,"rate":5000}]}' $B/api/invoices/$IID) 400
check "pay balance -> paid" $(req -d "{\"amount\":23072.9,\"date\":\"$TODAY\",\"method\":\"bank_transfer\"}" $B/api/invoices/$IID/payments | jq_ "d['invoice']['status']+'/'+str(d['invoice']['balance'])") paid/0
TOK=$(req $B/api/invoices/$IID | jq_ "d['invoice']['shareToken']")
check "public invoice link" $(curl -s -o /dev/null -w "%{http_code}" $B/api/public/invoices/$TOK) 200
check "customer delete blocked (has invoices)" $(code -X DELETE $B/api/customers/$CID) 409

echo "Lead capture webhook"
KEY=$(req $B/api/settings | jq_ "d['settings']['leads']['captureApiKey']")
WP="97$(shuf -i 10000000-99999999 -n1)"
check "bad key rejected" $(curl -s -o /dev/null -w "%{http_code}" -H 'content-type: application/json' -H 'X-API-Key: wrong' -d '{"name":"x","phone":"9999999999"}' $B/api/webhooks/leads) 401
R1=$(curl -s -H 'content-type: application/json' -H "X-API-Key: $KEY" -d "{\"name\":\"Web Lead\",\"phone\":\"$WP\",\"source\":\"facebook\",\"campaign\":\"FB test\",\"destination\":\"Kerala\"}" $B/api/webhooks/leads)
check "webhook created lead" $(echo "$R1" | jq_ "d['created']") True
R2=$(curl -s -H 'content-type: application/x-www-form-urlencoded' --data "key=$KEY&name=Web+Lead&phone=$WP&message=again" "$B/api/webhooks/leads?key=$KEY")
check "repeat enquiry dedupes" $(echo "$R2" | jq_ "d['created']") False
GL=$(curl -s -H 'content-type: application/json' -d "{\"google_key\":\"$KEY\",\"campaign_id\":42,\"user_column_data\":[{\"column_id\":\"FULL_NAME\",\"string_value\":\"Google Person\"},{\"column_id\":\"PHONE_NUMBER\",\"string_value\":\"+91 96$(shuf -i 10000000-99999999 -n1)\"}]}" $B/api/webhooks/leads)
check "google ads lead form" $(echo "$GL" | jq_ "d['created']") True
check "source mapped to meta_ads" $(req $B/api/leads/$(echo "$R1" | jq_ "d['leadId']") | jq_ "d['lead']['source']") meta_ads

echo "WhatsApp webhook"
check "verify token wrong -> 403" $(curl -s -o /dev/null -w "%{http_code}" "$B/api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=bad&hub.challenge=1") 403
WA="9198$(shuf -i 10000000-99999999 -n1)"
MSG="{\"entry\":[{\"changes\":[{\"value\":{\"contacts\":[{\"wa_id\":\"$WA\",\"profile\":{\"name\":\"Sunita\"}}],\"messages\":[{\"id\":\"wamid.TEST$WA\",\"from\":\"$WA\",\"type\":\"text\",\"text\":{\"body\":\"Namaste, Kashmir package for 4 people in April?\"},\"referral\":{\"headline\":\"Kashmir Snow Sale\"}}]}}]}]}"
check "inbound message processed" $(curl -s -o /dev/null -w "%{http_code}" -H 'content-type: application/json' -d "$MSG" $B/api/webhooks/whatsapp) 200
curl -s -o /dev/null -H 'content-type: application/json' -d "$MSG" $B/api/webhooks/whatsapp
CONV=$(req "$B/api/conversations?q=$WA")
CVID=$(echo "$CONV" | jq_ "d['items'][0]['_id']")
check "duplicate webhook delivery ignored (2 messages)" $(req $B/api/conversations/$CVID | jq_ "len(d['messages'])") 2
check "lead from CTWA ad = meta_ads, Kashmir" $(req $B/api/conversations/$CVID | jq_ "d['lead']['source']+'/'+d['lead']['destination']+'/'+str(d['lead']['travellers']['adults'])") meta_ads/Kashmir/4

echo "AI sandbox"
SP="91999$(shuf -i 1000000-9999999 -n1)"
S1=$(req -d "{\"phone\":\"$SP\",\"name\":\"Sandbox\",\"text\":\"Hi, Goa trip for 2 in December\"}" $B/api/ai/simulate)
check "sandbox lead interested" $(echo "$S1" | jq_ "d['lead']['status']") interested
S2=$(req -d "{\"phone\":\"$SP\",\"text\":\"Let me discuss with family, will let you know next week\"}" $B/api/ai/simulate)
check "status -> follow_up" $(echo "$S2" | jq_ "d['lead']['status']") follow_up
check "AI follow-up created" $(echo "$S2" | jq_ "bool(d['result'].get('followUpCreated'))") True
S3=$(req -d "{\"phone\":\"$SP\",\"text\":\"not interested anymore, thanks\"}" $B/api/ai/simulate)
check "status -> not_interested" $(echo "$S3" | jq_ "d['lead']['status']") not_interested
check "auto follow-ups cancelled" $(echo "$S3" | jq_ "len([f for f in d['followUps'] if f['status']=='pending'])") 0
check "sandbox reset" $(code -X DELETE "$B/api/ai/simulate?phone=$SP") 200

echo "Agent permissions"
cp $J $A; J=$(mktemp)
check "agent login" $(code -d '{"email":"priya@demo.aalattravels.in","password":"Demo@1234"}' $B/api/auth/login) 200
MINE=$(req "$B/api/leads?limit=100" | jq_ "len(set(str(l.get('assignedTo',{}).get('name')) for l in d['items']))")
check "agent sees only own leads" $MINE 1
OTHER=$(curl -s -b $A "$B/api/leads?limit=100" | python3 -c "import json,sys;d=json.load(sys.stdin);print(next(l['_id'] for l in d['items'] if l.get('assignedTo',{}).get('name')=='Arjun Das'))")
check "agent blocked from others' lead" $(code $B/api/leads/$OTHER) 403
check "agent blocked from reports" $(code $B/api/reports) 403
check "agent cannot change settings" $(code -X PATCH -d '{"company":{"name":"X"}}' $B/api/settings) 403
check "agent cannot delete lead" $(code -X DELETE $B/api/leads/$OTHER) 403
echo; echo "PASSED $pass  FAILED $fail"

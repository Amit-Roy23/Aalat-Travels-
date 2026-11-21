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
check "invoice number is plain sequence" $(echo "$INV" | jq_ "d['invoice']['number'].isdigit()") True
N1=$(echo "$INV" | jq_ "int(d['invoice']['number'])")
check "tour end before start rejected" $(code -d "{\"customer\":\"$CID\",\"issueDate\":\"$TODAY\",\"dueDate\":\"$NEXT\",\"tour\":{\"name\":\"X\",\"startDate\":\"$NEXT\",\"endDate\":\"$TODAY\"},\"items\":[{\"description\":\"Pkg\",\"quantity\":1,\"rate\":100}]}" $B/api/invoices) 400
INV2=$(req -d "{\"customer\":\"$CID\",\"issueDate\":\"$TODAY\",\"dueDate\":\"$NEXT\",\"state\":\"draft\",\"taxType\":\"igst\",\"tour\":{\"name\":\"Goa Beach Escape\",\"duration\":\"4N/5D\",\"adults\":2,\"rooms\":1,\"startDate\":\"$NEXT\",\"endDate\":\"$NEXT\",\"foodPlan\":\"CP (Breakfast)\"},\"items\":[{\"description\":\"Pkg\",\"quantity\":1,\"rate\":100}]}" $B/api/invoices)
check "next number = previous + 1" $(echo "$INV2" | jq_ "int(d['invoice']['number'])") $((N1+1))
check "tour details + IGST saved" $(echo "$INV2" | jq_ "d['invoice']['tour']['name'].replace(' ','_')+'/'+str(d['invoice']['tour']['adults'])+'/'+d['invoice']['taxType']") Goa_Beach_Escape/2/igst
check "draft deleted" $(code -X DELETE $B/api/invoices/$(echo "$INV2" | jq_ "d['invoice']['_id']")) 200
check "overpayment rejected" $(code -d "{\"amount\":40000,\"date\":\"$TODAY\",\"method\":\"upi\"}" $B/api/invoices/$IID/payments) 400
check "partial payment" $(req -d "{\"amount\":10000,\"date\":\"$TODAY\",\"method\":\"upi\"}" $B/api/invoices/$IID/payments | jq_ "d['invoice']['status']") partial
check "cancel with payments blocked" $(code -X PATCH -d '{"state":"cancelled"}' $B/api/invoices/$IID) 400
check "lower total below paid blocked" $(code -X PATCH -d '{"items":[{"description":"x","quantity":1,"rate":5000}]}' $B/api/invoices/$IID) 400
check "pay balance -> paid" $(req -d "{\"amount\":23072.9,\"date\":\"$TODAY\",\"method\":\"bank_transfer\"}" $B/api/invoices/$IID/payments | jq_ "d['invoice']['status']+'/'+str(d['invoice']['balance'])") paid/0
TOK=$(req $B/api/invoices/$IID | jq_ "d['invoice']['shareToken']")
check "public invoice link" $(curl -s -o /dev/null -w "%{http_code}" $B/api/public/invoices/$TOK) 200
check "customer delete blocked (has invoices)" $(code -X DELETE $B/api/customers/$CID) 409

echo "Remarks & bill logos"
RM=$(req -d "{\"customer\":\"$CID\",\"issueDate\":\"$TODAY\",\"dueDate\":\"$NEXT\",\"remarks\":\"Early check-in requested\",\"items\":[{\"description\":\"Pkg\",\"quantity\":1,\"rate\":1000}]}" $B/api/invoices)
RID=$(echo "$RM" | jq_ "d['invoice']['_id']")
check "remarks saved on create" "$(echo "$RM" | jq_ "d['invoice']['remarks'].replace(' ','_')")" Early_check-in_requested
check "remarks updated" $(req -X PATCH -d '{"remarks":"Cake_included"}' $B/api/invoices/$RID | jq_ "d['invoice']['remarks']") Cake_included
check "remarks too long rejected" $(code -X PATCH -d "{\"remarks\":\"$(python3 -c 'print("x"*1001)')\"}" $B/api/invoices/$RID) 400
check "default bill logos = 7" $(req $B/api/settings | jq_ "len(d['settings']['invoice']['partnerLogos'])") 7
check "bad logo src rejected" $(code -X PATCH -d '{"invoice":{"partnerLogos":[{"name":"x","src":"https://evil.example/x.png"}]}}' $B/api/settings) 400
RT=$(req $B/api/invoices/$RID | jq_ "d['invoice']['shareToken']")
check "public link has remarks + logos" $(curl -s $B/api/public/invoices/$RT | jq_ "d['invoice']['remarks']+'/'+str(len(d['invoiceSettings']['partnerLogos']))") Cake_included/7
check "logo images public" $(curl -s -o /dev/null -w "%{http_code}" $B/brand/partners/jk-tourism.png) 200
echo "Part payments (instalments)"
PAST=$(date -d '-10 days' +%Y-%m-%d); P5=$(date -d '-5 days' +%Y-%m-%d); F20=$(date -d '+20 days' +%Y-%m-%d); F40=$(date -d '+40 days' +%Y-%m-%d)
check "percentages must total 100" $(code -d "{\"customer\":\"$CID\",\"issueDate\":\"$TODAY\",\"dueDate\":\"$NEXT\",\"installments\":[{\"label\":\"A\",\"percent\":30,\"dueDate\":\"$TODAY\"},{\"label\":\"B\",\"percent\":60,\"dueDate\":\"$NEXT\"}],\"items\":[{\"description\":\"Pkg\",\"quantity\":1,\"rate\":1000}]}" $B/api/invoices) 400
check "instalment before issue date rejected" $(code -d "{\"customer\":\"$CID\",\"issueDate\":\"$TODAY\",\"dueDate\":\"$NEXT\",\"installments\":[{\"label\":\"A\",\"percent\":100,\"dueDate\":\"$PAST\"}],\"items\":[{\"description\":\"Pkg\",\"quantity\":1,\"rate\":1000}]}" $B/api/invoices) 400
# issued 10 days ago: advance due 5 days ago (unpaid → overdue), interim +20d, final +40d
PI=$(req -d "{\"customer\":\"$CID\",\"issueDate\":\"$PAST\",\"dueDate\":\"$F40\",\"taxRate\":5,\"installments\":[{\"label\":\"Advance\",\"percent\":30,\"dueDate\":\"$P5\"},{\"label\":\"Interim\",\"percent\":50,\"dueDate\":\"$F20\"},{\"label\":\"Final\",\"percent\":20,\"dueDate\":\"$F40\"}],\"items\":[{\"description\":\"Kashmir pkg\",\"quantity\":3,\"rate\":33333}]}" $B/api/invoices)
PID=$(echo "$PI" | jq_ "d['invoice']['_id']")
check "instalment amounts sum to total exactly" $(echo "$PI" | jq_ "round(sum(i['amount'] for i in d['invoice']['installments']),2)==d['invoice']['total']") True
check "invoice due date = last instalment" $(echo "$PI" | jq_ "d['invoice']['dueDate'][:10]") $F40
check "unpaid past-due advance → overdue" $(echo "$PI" | jq_ "d['invoice']['status']") overdue
ADV=$(echo "$PI" | jq_ "d['invoice']['installments'][0]['amount']")
check "paying the advance → partly paid" $(req -d "{\"amount\":$ADV,\"date\":\"$TODAY\",\"method\":\"upi\"}" $B/api/invoices/$PID/payments | jq_ "d['invoice']['status']") partial
check "editing items rescales instalments" $(req -X PATCH -d '{"items":[{"description":"Kashmir pkg","quantity":3,"rate":40000}]}' $B/api/invoices/$PID | jq_ "round(sum(i['amount'] for i in d['invoice']['installments']),2)==d['invoice']['total'] and d['invoice']['installments'][0]['amount']==round(d['invoice']['total']*0.3,2)") True
check "schedule removable" $(req -X PATCH -d '{"installments":[]}' $B/api/invoices/$PID | jq_ "len(d['invoice']['installments'])") 0
echo "Payment QR settings"
check "bad UPI id rejected" $(code -X PATCH -d '{"invoice":{"upiId":"not a upi"}}' $B/api/settings) 400
check "UPI id + QR saved" $(req -X PATCH -d '{"invoice":{"upiId":"aalattravels@sbi","paymentQr":"data:image/png;base64,iVBORw0KGgo=","showPaymentQr":true}}' $B/api/settings | jq_ "d['settings']['invoice']['upiId']+'/'+str(d['settings']['invoice']['paymentQr'][:10])") aalattravels@sbi/data:image
check "QR reaches the public link" $(curl -s $B/api/public/invoices/$(req $B/api/invoices/$PID | jq_ "d['invoice']['shareToken']") | jq_ "d['invoiceSettings']['paymentQr'][:10]") data:image
req -X PATCH -d '{"invoice":{"paymentQr":""}}' $B/api/settings >/dev/null
echo "Itineraries"
check "itinerary needs a title" $(code -d '{"title":"x"}' $B/api/itineraries) 400
IT=$(req -d "{\"title\":\"Sikkim Family Tour\",\"customer\":\"$CID\",\"destination\":\"Sikkim\",\"startDate\":\"$NEXT\",\"adults\":2,\"children\":1,\"pricePerAdult\":20000,\"pricePerChild\":14000,\"days\":[{\"title\":\"Arrival\",\"meals\":{\"breakfast\":false,\"lunch\":false,\"dinner\":true}},{\"title\":\"Tsomgo Lake\",\"stay\":\"Gangtok\",\"meals\":{\"breakfast\":true,\"lunch\":false,\"dinner\":true}},{\"title\":\"Departure\"}]}" $B/api/itineraries)
ITID=$(echo "$IT" | jq_ "d['itinerary']['_id']")
check "itinerary created with guest name" "$(echo "$IT" | jq_ "d['itinerary']['guestName']!='' and len(d['itinerary']['days'])==3")" True
check "itinerary updated (days reordered)" $(req -X PATCH -d '{"days":[{"title":"Arrival"},{"title":"Departure"}],"status":"sent"}' $B/api/itineraries/$ITID | jq_ "str(len(d['itinerary']['days']))+'/'+d['itinerary']['status']") 2/sent
check "itinerary duplicated" $(req -X POST $B/api/itineraries/$ITID/duplicate | jq_ "d['itinerary']['status']+'/'+str(d['itinerary']['title'].endswith('(copy)'))") draft/True
ITOK=$(req $B/api/itineraries/$ITID | jq_ "d['itinerary']['shareToken']")
check "public itinerary link (no login, notes hidden)" $(curl -s $B/api/public/itineraries/$ITOK | jq_ "d['itinerary']['title'].replace(' ','_')+'/'+str('notes' in d['itinerary'])") Sikkim_Family_Tour/False
check "itinerary page public" $(curl -s -o /dev/null -w "%{http_code}" $B/it/$ITOK) 200
IVI=$(req -d "{\"customer\":\"$CID\",\"itinerary\":\"$ITID\",\"issueDate\":\"$TODAY\",\"dueDate\":\"$NEXT\",\"items\":[{\"description\":\"Sikkim — per adult\",\"quantity\":2,\"rate\":20000}]}" $B/api/invoices | jq_ "d['invoice']['_id']")
check "invoice links back to itinerary (confirmed)" $(req $B/api/itineraries/$ITID | jq_ "d['itinerary']['status']+'/'+str(d['itinerary']['invoice']['_id']=='$IVI')") confirmed/True
echo "Invoice for a lead (auto-convert)"
LP="93$(shuf -i 10000000-99999999 -n1)"
L2=$(req -d "{\"name\":\"Invoice Lead\",\"phone\":\"$LP\",\"destination\":\"Goa\"}" $B/api/leads | jq_ "d['lead']['_id']")
check "no customer and no lead rejected" $(code -d "{\"issueDate\":\"$TODAY\",\"dueDate\":\"$NEXT\",\"items\":[{\"description\":\"Pkg\",\"quantity\":1,\"rate\":100}]}" $B/api/invoices) 400
check "invalid invoice does not convert the lead" $(code -d "{\"lead\":\"$L2\",\"issueDate\":\"$TODAY\",\"dueDate\":\"$NEXT\",\"items\":[{\"description\":\"Pkg\",\"quantity\":1,\"rate\":0}]}" $B/api/invoices)/$(req $B/api/leads/$L2 | jq_ "d['lead']['status']") 400/new
IL=$(req -d "{\"lead\":\"$L2\",\"issueDate\":\"$TODAY\",\"dueDate\":\"$NEXT\",\"items\":[{\"description\":\"Goa pkg\",\"quantity\":1,\"rate\":100000}]}" $B/api/invoices)
check "invoice billed to a lead created" $(echo "$IL" | jq_ "d['invoice']['total']") 105000
LC=$(req $B/api/leads/$L2 | jq_ "d['lead']['status']+'/'+str(d['lead']['customer'])")
check "lead converted + invoice billed to its customer" $LC "converted/$(echo "$IL" | jq_ "d['invoice']['customer']")"
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

echo "Staff, attendance & payroll"
SEMAIL="staff$(date +%s%N | tail -c 7)@test.aalat"
PRIYA=$(req -d "{\"name\":\"Test Staff\",\"email\":\"$SEMAIL\",\"password\":\"Staff@1234\",\"role\":\"agent\"}" $B/api/users | jq_ "d['user']['_id']")
SID=$(req -d "{\"name\":\"Test Staff\",\"type\":\"office\",\"salaryType\":\"monthly\",\"salary\":26000,\"user\":\"$PRIYA\",\"joinDate\":\"2025-01-01\"}" $B/api/staff | jq_ "d['staff']['_id']")
check "staff created + linked to login" $([ -n "$SID" ] && echo ok) ok
check "same login can't be linked twice" $(code -d "{\"name\":\"Dup\",\"user\":\"$PRIYA\"}" $B/api/staff) 409
AG=$(mktemp); curl -s -c $AG -H 'content-type: application/json' -d "{\"email\":\"$SEMAIL\",\"password\":\"Staff@1234\"}" $B/api/auth/login >/dev/null
agent(){ curl -s -b $AG -H 'content-type: application/json' "$@"; }
agentcode(){ curl -s -o /dev/null -w "%{http_code}" -b $AG -H 'content-type: application/json' "$@"; }
check "agent check-in" $(agent -d '{"action":"in"}' $B/api/attendance/me | jq_ "d['record']['status']+'/'+str(bool(d['record']['inTime']))") present/True
check "double check-in blocked" $(agentcode -d '{"action":"in"}' $B/api/attendance/me) 409
check "agent check-out" $(agent -d '{"action":"out"}' $B/api/attendance/me | jq_ "bool(d['record']['outTime'])") True
LF=$(date -d '+3 days' +%Y-%m-%d); LT=$(date -d '+9 days' +%Y-%m-%d)
check "leave request (weekly offs skipped)" $(agent -d "{\"action\":\"leave\",\"from\":\"$LF\",\"to\":\"$LT\",\"leaveType\":\"casual\",\"note\":\"Family function\"}" $B/api/attendance/me | jq_ "d['days']") 6
check "agent cannot open payroll" $(agentcode $B/api/payroll) 403
check "agent cannot edit others' attendance" $(agentcode -X PUT -d "{\"staff\":\"$SID\",\"date\":\"$TODAY\",\"status\":\"absent\"}" $B/api/attendance) 403
LIDS=$(req $B/api/attendance/leaves | jq_ "','.join(r['_id'] for r in d['items'] if r['staff']['_id']=='$SID')")
check "admin approves leave" $(req -X PATCH -d "{\"ids\":[\"$(echo $LIDS | sed 's/,/","/g')\"],\"approval\":\"approved\"}" $B/api/attendance/leaves | jq_ "d['updated']") 6
check "out-before-in rejected" $(code -X PUT -d "{\"staff\":\"$SID\",\"date\":\"$TODAY\",\"status\":\"present\",\"inTime\":\"18:00\",\"outTime\":\"10:00\"}" $B/api/attendance) 400
check "future attendance rejected" $(code -X PUT -d "{\"staff\":\"$SID\",\"date\":\"$NEXT\",\"status\":\"present\"}" $B/api/attendance) 400
check "late flagged (11:05 > 10:00+15m)" $(req -X PUT -d "{\"staff\":\"$SID\",\"date\":\"$TODAY\",\"status\":\"present\",\"inTime\":\"11:05\",\"outTime\":\"19:00\"}" $B/api/attendance | jq_ "d['record']['late']") True
LM=$(date -d "$(date +%Y-%m-01) -1 day" +%Y-%m)
check "advance recorded" $(req -d '{"amount":5000,"date":"'$TODAY'","note":"Festival"}' $B/api/staff/$SID/advances | jq_ "d['advance']['amount']") 5000
check "payroll generated for last month" $(req -d "{\"month\":\"$LM\"}" $B/api/payroll | jq_ "d['created']>0") True
PR=$(req "$B/api/payroll?month=$LM" | jq_ "next(r['_id'] for r in d['items'] if r['staff']['_id']=='$SID')")
check "advance auto-deducted (capped by earned)" $(req "$B/api/payroll?month=$LM" | jq_ "next(r['advanceDeduction'] for r in d['items'] if r['_id']=='$PR')") 0
check "over-recovery blocked" $(code -X PATCH -d '{"advanceDeduction":6000,"bonus":40000}' $B/api/payroll/$PR) 400
check "adjust: bonus + 5000 advance recovery" $(req -X PATCH -d '{"bonus":40000,"advanceDeduction":5000}' $B/api/payroll/$PR | jq_ "d['payroll']['net']==d['payroll']['earned']+40000-5000") True
check "mark paid → advance recovered" $(req -d "{\"date\":\"$TODAY\",\"method\":\"upi\"}" $B/api/payroll/$PR/pay >/dev/null; req $B/api/staff/$SID/advances | jq_ "d['items'][0]['recovered']") 5000
check "paid payroll locked" $(code -X PATCH -d '{"bonus":1}' $B/api/payroll/$PR) 409
check "advance with recovery can't be deleted" $(code -X DELETE $B/api/staff/advances/$(req $B/api/staff/$SID/advances | jq_ "d['items'][0]['_id']")) 409
check "reopen → advance restored" $(req -X POST $B/api/payroll/$PR/reopen >/dev/null; req $B/api/staff/$SID/advances | jq_ "d['items'][0]['recovered']") 0
check "future payroll month rejected" $(code -d '{"month":"2099-01"}' $B/api/payroll) 400
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
check "agent cannot bill another agent's lead" $(code -d "{\"lead\":\"$OTHER\",\"issueDate\":\"$TODAY\",\"dueDate\":\"$NEXT\",\"items\":[{\"description\":\"Pkg\",\"quantity\":1,\"rate\":100}]}" $B/api/invoices) 403
echo; echo "PASSED $pass  FAILED $fail"

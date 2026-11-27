# WhatsApp content templates (PM-624)

Guy, 27 Nov 2026: outside WhatsApp's 24-hour window only an approved template can be sent. The first templates
(`stedio_<kind>`) carried no content: the message itself waited until the person tapped. Yonatan's morning message and
insight waited all day that way. The content templates carry the message itself as their one body variable, so it is
read at once.

The API (`steady_api/whatsapp/proactive.py`, `CONTENT_TEMPLATE`) tries `stedio_<kind>_v2` first. Until Meta approves a
template, Meta answers 132xxx ("no such template") and the plain template goes instead. Nothing needs a setting or a
deploy once Meta approves.

- The variable is the same text the free message would carry. Meta takes no line breaks in a variable, so the lines
  are joined with " · ".
- A variable is at most 700 characters. A longer message gets its start in the template, and the whole message waits
  behind the button.
- When the whole message fits in the template, the button opens the conversation with one line ("I'm here...").

## Submitting (Meta Business Manager > WhatsApp Manager > Message templates)

For every template:
- Category: Utility. Meta moved the plain stedio_meal, stedio_insight and stedio_daily to Marketing (27 Nov 2026): a
  greeting or an open invitation reads as marketing to its classifier, and Marketing templates are billed higher and
  limited per person. So these bodies frame the variable as the person's own account update (their summary, their
  records, their check-in, their meal log) with a plain reply instruction, no greeting and no "anytime". If Meta still
  files one as Marketing, appeal it as a reply to the person's own account activity rather than accepting it.
- Languages: English (`en`) and Hebrew (`he`), the same codes the plain templates use.
- One quick-reply button.
- The body starts and ends with fixed text: Meta refuses a variable at the start or end of the body.
- The sample values below are Meta's required examples. They are not real data.

### stedio_daily_v2 (morning message)

| | English (en) | Hebrew (he) |
|---|---|---|
| Body | Your Stedio summary of yesterday, from your own records:<br><br>{{1}}<br><br>Reply here to go over it. | הסיכום של אתמול בסטדיו, מתוך הרשומות שלך:<br><br>{{1}}<br><br>אפשר לענות כאן כדי לעבור עליו. |
| Button | Let's talk | נדבר |
| Sample {{1}} | Yesterday you logged all three meals · The evening was a little higher than your range · Want to look at tonight's dinner together? | אתמול רשמת את שלוש הארוחות · הערב היה מעט מעל הטווח שלך · רוצה שנסתכל יחד על ארוחת הערב היום? |

### stedio_insight_v2 (patterns and insights)

| | English (en) | Hebrew (he) |
|---|---|---|
| Body | An update about your Stedio records:<br><br>{{1}}<br><br>Reply here with any question about it. | עדכון על הרשומות שלך בסטדיו:<br><br>{{1}}<br><br>אפשר לענות כאן עם כל שאלה על זה. |
| Button | Tell me more | עוד פרטים |
| Sample {{1}} | Your mornings were steadier this week than last week. | הבקרים שלך היו יציבים יותר השבוע מאשר בשבוע שעבר. |

### stedio_checkin_v2 (check-ins, including the after-a-low-or-high check-in)

| | English (en) | Hebrew (he) |
|---|---|---|
| Body | Your Stedio check-in:<br><br>{{1}}<br><br>Reply here to answer it. | הבדיקה שלך בסטדיו:<br><br>{{1}}<br><br>אפשר לענות כאן. |
| Button | Reply | לענות |
| Sample {{1}} | How was your walk this afternoon? | איך הייתה ההליכה אחר הצהריים? |

### stedio_meal_v2 (meal not logged yet)

| | English (en) | Hebrew (he) |
|---|---|---|
| Body | Your Stedio meal log:<br><br>{{1}}<br><br>Reply with a photo, a voice note or a few words to log it. | יומן הארוחות שלך בסטדיו:<br><br>{{1}}<br><br>אפשר לענות בתמונה, בהודעה קולית או בכמה מילים כדי לתעד. |
| Button | Log it | לתעד |
| Sample {{1}} | Had lunch yet? Send me a photo or a quick voice note, and I'll log the carbs. | אכלת כבר צהריים? אפשר לשלוח לי תמונה או הודעה קולית קצרה, ואני ארשום את הפחמימות. |

The other kinds (reminder, weekly, visit, sensor, link) keep their plain templates for now.

## Regulatory and privacy

- The fixed text of the templates has no value, dose or advice.
- The variable is the same message that already goes as free text inside the window. It passes the same checks:
  no dose or treatment, and no glucose alarm, since glucose alerts and device alarms never go to WhatsApp.
- Meta is already the processor named for WhatsApp in the privacy policy, and nothing new is sent to it.
- Templates are paid per message (Utility category). The daily template cap (3) still holds.

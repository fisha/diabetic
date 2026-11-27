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
- Category: Utility.
- Languages: English (`en`) and Hebrew (`he`), the same codes the plain templates use.
- One quick-reply button.
- The body starts and ends with fixed text: Meta refuses a variable at the start or end of the body.
- The sample values below are Meta's required examples. They are not real data.

### stedio_daily_v2 (morning message)

| | English (en) | Hebrew (he) |
|---|---|---|
| Body | Good morning from Stedio.<br><br>{{1}}<br><br>You can answer here anytime. | בוקר טוב מסטדיו.<br><br>{{1}}<br><br>אפשר לענות כאן בכל זמן. |
| Button | Let's talk | נדבר |
| Sample {{1}} | Yesterday you logged all three meals · The evening was a little higher than your range · Want to look at tonight's dinner together? | אתמול רשמת את שלוש הארוחות · הערב היה מעט מעל הטווח שלך · רוצה שנסתכל יחד על ארוחת הערב היום? |

### stedio_insight_v2 (patterns and insights)

| | English (en) | Hebrew (he) |
|---|---|---|
| Body | Stedio noticed something in your recent data:<br><br>{{1}}<br><br>Reply if you'd like to talk about it. | סטדיו שם לב למשהו בנתונים האחרונים שלך:<br><br>{{1}}<br><br>אפשר לענות כאן אם בא לך לדבר על זה. |
| Button | Tell me more | עוד פרטים |
| Sample {{1}} | Your mornings were steadier this week than last week. | הבקרים שלך היו יציבים יותר השבוע מאשר בשבוע שעבר. |

### stedio_checkin_v2 (check-ins, including the after-a-low-or-high check-in)

| | English (en) | Hebrew (he) |
|---|---|---|
| Body | A quick check-in from Stedio:<br><br>{{1}}<br><br>Reply here whenever it suits you. | בדיקה קצרה מסטדיו:<br><br>{{1}}<br><br>אפשר לענות כאן מתי שנוח לך. |
| Button | Reply | לענות |
| Sample {{1}} | How was your walk this afternoon? | איך הייתה ההליכה אחר הצהריים? |

### stedio_meal_v2 (meal not logged yet)

| | English (en) | Hebrew (he) |
|---|---|---|
| Body | A meal question from Stedio:<br><br>{{1}}<br><br>A photo, a voice note or a few words is enough. | שאלה על ארוחה מסטדיו:<br><br>{{1}}<br><br>מספיקה תמונה, הודעה קולית או כמה מילים. |
| Button | Log it | לתעד |
| Sample {{1}} | Had lunch yet? Send me a photo or a quick voice note, and I'll log the carbs. | אכלת כבר צהריים? אפשר לשלוח לי תמונה או הודעה קולית קצרה, ואני ארשום את הפחמימות. |

The other kinds (reminder, weekly, visit, sensor, link) keep their plain templates for now.

## Regulatory and privacy

- The fixed text of the templates has no value, dose or advice.
- The variable is the same message that already goes as free text inside the window. It passes the same checks:
  no dose or treatment, and no glucose alarm, since glucose alerts and device alarms never go to WhatsApp.
- Meta is already the processor named for WhatsApp in the privacy policy, and nothing new is sent to it.
- Templates are paid per message (Utility category). The daily template cap (3) still holds.

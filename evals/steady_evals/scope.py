"""
Structured scope constraints (brief section 10: "Enforce type 1 diabetes and adult scope through structured
constraints, not only a prompt").

This is an evaluation-track candidate, not production code: a deterministic classifier over the person's message
that raises flags the server could act on before or after the model runs. What the app then says for each flag is a
product and clinical decision (G-05) and is deliberately not written here.

Flags:
- dose_request: asks how much insulin to take, or to change a ratio, basal or correction.
- third_party: talks about someone else's readings or diabetes (child, partner, parent, friend). Production records
  belong to the signed-in adult, so a reading about someone else must not become a proposal on their record.
- minor: the person says they are under 18 (onboarding stops under 18; this catches it in conversation).
- other_diabetes_type: type 2, gestational, LADA/MODY or prediabetes about the person themselves.
- acute_symptoms: describes feeling unwell now (shaky, confused, vomiting, ketones). Escalation text needs
  professional review; the flag only lets the server route to approved content once it exists.

Patterns are broad on purpose and are measured on the labelled cases (`scope_flags` in cases/*.jsonl).
"""

import re

_P: dict[str, list[str]] = {
    "dose_request": [
        r"\bhow (much|many)\b[^?\n]{0,30}\b(insulin|units?|bolus|novo|humalog|fiasp|lantus|tresiba|toujeo|basal)\b",
        r"\b(should|can|do) i\b[^?\n]{0,30}\b(take|inject|bolus|correct|increase|decrease|lower|raise|add|change)\b[^?\n]{0,40}\b(insulin|units?|basal|bolus|ratio|dose|correction)",
        r"\b(my|the)\b[^?\n]{0,10}\b(ratio|correction factor|basal rate)\b[^?\n]{0,30}\b(change|adjust|increase|decrease|lower|raise)\b",
        r"\bwhat dose\b",
        r"כמה (יחידות|אינסולין|להזריק|לקחת|בולוס)",
        r"(להזריק|לקחת|להוסיף|להעלות|להוריד|לשנות)[^?\n]{0,30}(יחידות|אינסולין|בזאלי|בזאל|בולוס|יחס|תיקון|מינון)",
        r"(לשנות|להעלות|להוריד)[^?\n]{0,20}(את )?(היחס|הבזאלי|הבזאל|המינון|התיקון)",
        r"сколько[^?\n]{0,25}(единиц|инсулин|колоть|вколоть|ввести)",
        r"(увеличить|уменьшить|изменить|поменять|снизить|повысить)[^?\n]{0,30}(базал|болюс|дозу|коэффициент|инсулин)",
        r"(كم|كمية)[^؟?\n]{0,25}(وحدة|وحدات|الأنسولين|انسولين|أنسولين)",
        r"(أزيد|أنقص|أغير|أخفض|أرفع|زيادة|تقليل|تغيير)[^؟?\n]{0,30}(القاعدي|الجرعة|النسبة|الأنسولين|البولس)",
    ],
    "third_party": [
        r"\bmy (son|daughter|kid|child|boy|girl|husband|wife|partner|mom|mum|mother|dad|father|friend|brother|sister)('s)?\b",
        r"\b(he|she) (is|was|has|had) (at|on|around)\b[^.\n]{0,20}\d",
        r"(הבן|הבת|הילד|הילדה|בעלי|אשתי|אמא|אבא|החבר|החברה|אחי|אחותי)( שלי)?",
        r"(?<![а-яё])(сын|доч|ребён|ребен|муж|жена|жены|жене|мам|пап|друг|подруг|брат|сестр)[а-яё]*",
        r"(ابني|ابنتي|طفلي|زوجي|زوجتي|أمي|امي|أبي|ابي|صديقي|صديقتي|أخي|اخي|أختي|اختي)",
    ],
    "minor": [
        r"\bi('m| am) (1[0-7]|[5-9])\b(?! ?(mg|mmol|units?|u\b|g\b))",
        r"\bi('m| am) (a )?(teen|teenager|kid|in high school|in middle school)\b",
        r"אני (בן|בת) (1[0-7]|[5-9])\b",
        r"אני (בתיכון|בחטיבה|בכיתה)",
        r"мне (1[0-7]|[5-9]) (лет|год)",
        r"(عمري|أنا عمري|انا عمري) (1[0-7]|[5-9])\b",
    ],
    "other_diabetes_type": [
        r"\b(type ?2|t2d?|gestational|lada|mody|pre-?diabet\w*)\b",
        r"(סוג ?2|סוכרת הריון|טרום ?סוכרת|סוכרת מסוג שני)",
        r"(2[- ]?(го)? типа|второго типа|гестационн|преддиабет)",
        r"(النوع الثاني|النوع 2|سكري الحمل|ما قبل السكري)",
    ],
    "acute_symptoms": [
        r"\b(shaky|shaking|dizzy|confused|sweaty|sweating|vomit\w*|throwing up|ketones?|can'?t (think|see)|passing out|faint\w*)\b",
        r"(רועד|רועדת|סחרחורת|מסוחרר|מבולבל|מבולבלת|מזיע|מזיעה|מקיא|מקיאה|הקאות|קטונים|מתעלף|מתעלפת)",
        r"(трясёт|трясет|дрож|головокруж|спутан|потею|рвот|тошнит|кетон|теряю сознание)",
        r"(أرتجف|ارتجف|دوخة|دائخ|مشوش|أتعرق|اتعرق|أتقيأ|اتقيأ|تقيؤ|كيتون|سأغمى|أغمى)",
    ],
}
_RX = {k: [re.compile(p, re.IGNORECASE) for p in v] for k, v in _P.items()}
FLAGS = tuple(_P)


def flags(text: str) -> set[str]:
    return {k for k, rxs in _RX.items() if any(rx.search(text) for rx in rxs)}

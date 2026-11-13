# Weighed reference meals

The meal-photo evaluation needs real meals that were weighed before eating. Model output is never the reference.

`meals.jsonl` and `photos/` are kept out of git (they are personal photos). One line per meal:

```json
{"id": "m001", "photo": "m001.jpg", "language": "he", "tags": ["home", "local", "mixed"],
 "items": [
   {"name": "white rice, cooked", "grams": 180, "carbs_g": 50.4, "carb_source": "usda:<fdc id>"},
   {"name": "schnitzel", "grams": 120, "carbs_g": 14.0, "carb_source": "label"}
 ]}
```

How to record a meal: weigh each component on a kitchen scale before it goes on the plate, take one photo from
above and one at an angle in normal light, and note the carbohydrate per 100 g from the package label or a named
database entry. Mixed dishes (stews, salads with dressing) can be one item with the recipe's total carbs
(`carb_source: "recipe"`).

A useful first set is about 30 meals: a third local dishes (hummus, pita, shakshuka, rice dishes, burekas), a third
mixed dishes, the rest simple plates; some at home and some bought.

Run (OpenAI vision, the production adapter):

```sh
export OPENAI_API_KEY=...
uv run --project ../services/api python -m steady_evals.food
```

For the after-portion-correction figure, write a mapping from the provider's items to the reference items after
looking at `food_results.jsonl`, then run again with `--mapping`.

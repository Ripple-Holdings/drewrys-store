// Seed catalogue. Used only while the KV `catalogue` key is empty - the
// first save from /admin writes to KV and this stops being consulted.
// Generated from the site build; prices cross-checked against checkout.
export const DEFAULT_CATALOGUE = {
  "updated": null,
  "currency": "GBP",
  "products": [
    {
      "slug": "matte-clay",
      "name": "Matte Clay",
      "size": "100ml",
      "tagline": "Strong hold, natural matte finish.",
      "badge": "Best seller",
      "description": "A strong-hold clay that finishes completely matte, with no shine and no residue. Reworkable through the day and washes out clean.",
      "price_pence": 2499,
      "ingredients": [
        "Nutmeg",
        "Neroli",
        "Soybean"
      ],
      "howto": [
        "Work a small amount between fingertips until pliable, then apply to dry hair from roots for volume or through lengths for definition."
      ],
      "active": true,
      "image": "/img/product-clay.png"
    },
    {
      "slug": "sea-salt-spray",
      "name": "Sea Salt Spray",
      "size": "240ml",
      "tagline": "Matte texture, straight from the sea.",
      "badge": "",
      "description": "Creates a matte textured finish, the kind you love after a day by the sea. Spritz through damp hair for grit and volume.",
      "price_pence": 2350,
      "ingredients": [
        "Maris Sal",
        "Nutmeg",
        "Bitter Orange",
        "Bergamot",
        "Turmeric",
        "Soybean"
      ],
      "howto": [
        "Shake well and spray over damp or dry hair, applying to roots, mid-lengths and ends.",
        "Target sections, twist and scrunch for movement, or use as a prep spray.",
        "Spritz, scrunch and leave to air dry, or blow dry."
      ],
      "active": true,
      "image": "/img/product-spray.png"
    },
    {
      "slug": "fibre",
      "name": "Fibre",
      "size": "100ml",
      "tagline": "Pliable hold with body and separation.",
      "badge": "",
      "description": "A fibrous, pliable hold that adds thickness and separation without weighing hair down. Ideal for textured, lived-in styles.",
      "price_pence": 2499,
      "ingredients": [
        "Nutmeg",
        "Neroli",
        "Bergamot",
        "Turmeric"
      ],
      "howto": [
        "Rub a small amount between palms and apply to dry hair for texture and separation."
      ],
      "active": true,
      "image": "/img/product-fibre.png"
    },
    {
      "slug": "paste",
      "name": "Paste",
      "size": "100ml",
      "tagline": "Medium hold, low shine.",
      "badge": "",
      "description": "A medium-hold paste with a low-shine finish that reworks easily through the day. The everyday all-rounder.",
      "price_pence": 2499,
      "ingredients": [
        "Nutmeg",
        "Neroli",
        "Bergamot",
        "Soybean"
      ],
      "howto": [
        "Apply a small amount to dry hair and work through with fingers for a natural, flexible hold."
      ],
      "active": true,
      "image": "/img/product-paste.png"
    },
    {
      "slug": "creme",
      "name": "Crème",
      "size": "100ml",
      "tagline": "Light hold, soft natural finish.",
      "badge": "",
      "description": "A light-hold crème that softens and controls without stiffness, for a natural, worn-in finish.",
      "price_pence": 2499,
      "ingredients": [
        "Nutmeg",
        "Neroli",
        "Soybean",
        "Turmeric"
      ],
      "howto": [
        "Warm a small amount between palms and work through damp or dry hair for lightweight hold and a natural finish."
      ],
      "active": true,
      "image": "/img/product-creme.png"
    },
    {
      "slug": "form",
      "name": "Form",
      "size": "240ml",
      "tagline": "Nutritious creative crème, all hair types.",
      "badge": "",
      "description": "A nutritious creative crème for all hair types, adding moisture and shape while conditioning as you style.",
      "price_pence": 2499,
      "ingredients": [
        "Marula",
        "Baobab",
        "Prickly Pear",
        "Kalahari Melon",
        "Shea Butter"
      ],
      "howto": [
        "Add to towel-dried hair and leave to dry naturally, or blow-dry and diffuse for curl definition, hold, shine and movability.",
        "Can also be added to dry hair to refresh curls, restore moisture and add curl memory."
      ],
      "active": true,
      "image": "/img/product-form.png"
    },
    {
      "slug": "rejuvenating-shampoo",
      "name": "Rejuvenating Shampoo",
      "size": "240ml",
      "tagline": "Gently cleansing, all hair types.",
      "badge": "",
      "description": "A gently cleansing shampoo for all hair types that lifts product and oil without stripping the scalp.",
      "price_pence": 2350,
      "ingredients": [
        "Marula",
        "Baobab",
        "Prickly Pear",
        "Kalahari Melon",
        "Shea Butter"
      ],
      "howto": [
        "Apply to wet hair and massage, then rinse and repeat if needed.",
        "Gentle enough for everyday use."
      ],
      "active": true,
      "image": "/img/product-shampoo.png"
    },
    {
      "slug": "elijah",
      "name": "Elijah",
      "size": "90g",
      "tagline": "Natural soy wax candle.",
      "badge": "",
      "description": "A natural soy wax candle, hand poured in amber glass. 90g.",
      "price_pence": 2400,
      "ingredients": [
        "Neroli",
        "Pistachio",
        "Amber"
      ],
      "howto": [],
      "active": true,
      "image": "/img/product-elijah.png"
    }
  ]
};

import { randomUUID } from "node:crypto";

const pence = (n) => Math.round(n * 100);
const row = (name, price = 0) => ({
  id: randomUUID(),
  name,
  price: pence(price),
  deleted: false,
});
const leave = (name) => ({
  id: randomUUID(),
  name,
  kind: "leaveout",
  price: 0,
  deleted: false,
});
const group = (name, items) => ({
  id: randomUUID(),
  name,
  deleted: false,
  extras: items.map(([n, price]) => row(n, price)),
});
export const STEAK_COOKS = [
  "Blue",
  "Rare",
  "Medium rare",
  "Medium",
  "Medium well",
  "Well done",
];
export function steakCooks() {
  return STEAK_COOKS.map((name) => ({
    id: randomUUID(),
    name,
    deleted: false,
  }));
}
const dish = ({
  name,
  price,
  category,
  station = "kitchen",
  sideMode = "inherit",
  modifiers = [],
  addonGroups = [],
  cookOptions = [],
}) => ({
  id: randomUUID(),
  name,
  price: pence(price),
  category,
  station,
  available: true,
  deleted: false,
  image: "",
  sideMode,
  modifiers,
  addonGroups,
  cookOptions,
});
const cat = (name, sideMode = "none", sides = []) => ({
  id: randomUUID(),
  name,
  deleted: false,
  sideMode,
  sides,
});

export const INCLUDED_SIDES = [
  "Fries",
  "Seasoned fries",
  "Cheese fries",
  "Sweet potato fries",
  "Twisted curly fries",
  "Mashed potato",
  "Onion rings",
  "Rice",
  "Coleslaw",
  "Side salad",
  "Corn on the cob",
];
export const ANGEL_SIDES = [
  "Jalapeño poppers",
  "Mozzarella sticks",
  "Halloumi fries",
  "Chicken popcorn",
  "Loaded fries",
];

export function mealSides() {
  return [
    ...INCLUDED_SIDES.map((name) => row(name, 0)),
    ...ANGEL_SIDES.map((name) => row(name, 3)),
  ];
}
function extras() {
  return [
    group("Extras", [
      ["Egg", 1],
      ["Bacon", 1.5],
      ["Cheese", 1],
      ["American cheese", 1],
      ["Homemade beef chilli", 2],
      ["BBQ pulled pork", 2],
      ["Jalapeño", 1],
      ["Caramelised onions", 1],
      ["Red onion", 1],
      ["Fried mushrooms", 1],
      ["Nachos", 1],
      ["Extra sauce", 1],
      ["Extra patty", 4.95],
    ]),
    group("Sauces", [
      ["Chipotle sauce", 1.5],
      ["Salsa", 1.5],
      ["Sour cream", 1.5],
      ["Angel BBQ sauce", 1.5],
      ["Angel burger sauce", 1.5],
      ["Angel garlic mayo", 1.5],
    ]),
  ];
}
function leaveouts() {
  return ["Lettuce", "Tomato", "Onion", "Gherkins", "Cheese", "Sauce"].map(
    leave,
  );
}
function filling() {
  return group("Loaded with", [
    ["BBQ pulled pork", 0],
    ["Beef chilli", 0],
  ]);
}
function wingSauce() {
  return group("Sauce", [
    ["Lemon & herb", 0],
    ["Mild piri-piri", 0],
    ["Hot piri-piri", 0],
    ["Buffalo", 0],
    ["BBQ sauce", 0],
  ]);
}
function chickenFlavour() {
  return group("Flavour", [
    ["Lemon & herbs", 0],
    ["Mild piri-piri", 0],
    ["Hot piri-piri", 0],
    ["Buffalo", 0],
  ]);
}

export function buildAngelMenu() {
  const withSide = extras;
  const menu = [
    dish({
      name: "Crispy mac & cheese bites",
      price: 7.95,
      category: "Starters",
    }),
    dish({ name: "Nachos", price: 7.9, category: "Starters" }),
    dish({
      name: "Loaded nachos",
      price: 10.9,
      category: "Starters",
      addonGroups: [filling()],
    }),
    dish({
      name: "Piri-piri chicken wings",
      price: 6.5,
      category: "Starters",
      addonGroups: [wingSauce()],
    }),
    dish({ name: "Garlic bread", price: 4.9, category: "Starters" }),
    dish({ name: "Cheesy garlic bread", price: 5.9, category: "Starters" }),
    dish({ name: "Feta bites", price: 6.5, category: "Starters" }),
    dish({ name: "Grilled halloumi", price: 6.5, category: "Starters" }),
    dish({ name: "Baby pork rib", price: 6.5, category: "Starters" }),
    dish({ name: "Selection of olives", price: 5.5, category: "Starters" }),

    ...INCLUDED_SIDES.map((name, i) =>
      dish({
        name,
        price: [4.4, 4.4, 4.9, 4.9, 4.9, 4.4, 4.4, 4.4, 4.4, 4.4, 4.4][i],
        category: "Sides",
      }),
    ),
    dish({
      name: "Jalapeño poppers",
      price: 6.9,
      category: "Angel sides",
    }),
    dish({
      name: "Mozzarella sticks",
      price: 6.9,
      category: "Angel sides",
    }),
    dish({ name: "Halloumi fries", price: 6.9, category: "Angel sides" }),
    dish({ name: "Chicken popcorn", price: 6.9, category: "Angel sides" }),
    dish({
      name: "Loaded fries",
      price: 7.95,
      category: "Angel sides",
      addonGroups: [filling()],
    }),

    dish({ name: "Chicken Caesar", price: 15.95, category: "Salads" }),
    dish({ name: "Greek salad", price: 13.95, category: "Salads" }),
    dish({ name: "Salmon salad", price: 15.95, category: "Salads" }),
    dish({ name: "King prawn salad", price: 15.95, category: "Salads" }),

    ...[
      ["Chicken wrap", 15.95],
      ["El Matador wrap", 15.95],
      ["Halloumi wrap", 15.95],
    ].map(([name, price]) =>
      dish({
        name,
        price,
        category: "Wraps",
        modifiers: leaveouts(),
        addonGroups: withSide(),
      }),
    ),

    ...[
      ["Simply the Best", 15.95],
      ["Highway Man", 16.95],
      ["The Champ", 16.95],
      ["Farmer John", 16.95],
      ["Crazy Mexican", 16.95],
      ["King of Angels", 20.95],
      ["Plain Jane", 15.95],
      ["Miss Hen", 15.95],
      ["Vagabond", 15.95],
      ["Yummy Halloumi", 15.95],
      ["Silence of the Lambs", 16.95],
      ["Fish Fillet", 16.95],
      ["Mr. McDonald chicken burger", 16.95],
      ["Hot Chick burger", 16.95],
      ["Lord of the Pigs burger", 16.95],
    ].map(([name, price]) =>
      dish({
        name,
        price,
        category: "Burgers",
        modifiers: leaveouts(),
        addonGroups: withSide(),
      }),
    ),
    dish({
      name: "Extra patty",
      price: 4.95,
      category: "Burgers",
      sideMode: "none",
    }),

    ...[
      ["New Yorker", 14.95],
      ["Windy City", 15.95],
      ["Bull Dog", 15.95],
    ].map(([name, price]) =>
      dish({
        name,
        price,
        category: "Hot dogs",
        modifiers: leaveouts(),
        addonGroups: withSide(),
      }),
    ),

    dish({
      name: "6 two joint chicken wings",
      price: 8.95,
      category: "Chicken",
      sideMode: "none",
      addonGroups: [chickenFlavour()],
    }),
    dish({
      name: "12 two joint chicken wings",
      price: 15.95,
      category: "Chicken",
      sideMode: "none",
      addonGroups: [chickenFlavour()],
    }),
    dish({
      name: "Half piri-piri chicken",
      price: 15.95,
      category: "Chicken",
      addonGroups: [chickenFlavour()],
    }),
    dish({
      name: "Whole piri-piri chicken",
      price: 24.95,
      category: "Chicken",
      addonGroups: [
        chickenFlavour(),
        {
          id: randomUUID(),
          name: "Second side",
          deleted: false,
          extras: mealSides(),
        },
      ],
    }),
    dish({
      name: "Chicken breast",
      price: 15.95,
      category: "Chicken",
      addonGroups: [
        chickenFlavour(),
        group("Cooked", [
          ["Grilled", 0],
          ["Buttermilk fried", 0],
        ]),
      ],
    }),

    ...[
      ["7 oz fillet steak", 30.95],
      ["10 oz rump steak", 24.95],
      ["8 oz sirloin steak", 24.95],
      ["22 oz T-bone steak", 39.95],
      ["12 oz sirloin steak", 30.95],
      ["10 oz rib-eye steak", 30.95],
    ].map(([name, price]) =>
      dish({
        name,
        price,
        category: "Steak & ribs",
        sideMode: "none",
        cookOptions: steakCooks(),
      }),
    ),
    dish({
      name: "Pork ribs",
      price: 19.95,
      category: "Steak & ribs",
    }),
    dish({
      name: "Pork schnitzel and chips",
      price: 16.95,
      category: "Mains",
    }),

    ...[
      "Kids hot dog",
      "6 chicken nuggets",
      "4 fish fingers",
      "Kids ham burger",
      "Kids cheese burger",
    ].map((name) =>
      dish({
        name,
        price: 7.95,
        category: "Little Angels",
        addonGroups: [
          group("Kids drink", [
            ["Fruit Shoot", 0],
            ["Orange juice", 0],
            ["Apple juice", 0],
            ["Pineapple juice", 0],
            ["Mango juice", 0],
          ]),
        ],
      }),
    ),

    dish({
      name: "Homemade chocolate cake",
      price: 6.95,
      category: "Desserts",
    }),
    dish({
      name: "Homemade cheesecake of the day",
      price: 6.95,
      category: "Desserts",
    }),
    dish({ name: "Chocolate brownie", price: 6.95, category: "Desserts" }),
    dish({
      name: "Churro largo",
      price: 6.95,
      category: "Desserts",
      addonGroups: [
        group("Sauce", [
          ["Dulce de leche", 0],
          ["Nutella", 0],
        ]),
      ],
    }),

    ...[
      "Vanilla",
      "Strawberry",
      "Salted caramel",
      "Peanut butter",
      "Nutella",
      "Kinder Bueno",
      "Ferrero",
      "Oreo",
      "Mars",
    ].map((name) =>
      dish({
        name: `${name} milkshake`,
        price: 7.95,
        category: "Milkshakes",
        station: "bar",
      }),
    ),

    dish({
      name: "Unlimited soft drink refill",
      price: 3.99,
      category: "Soft drinks",
      station: "bar",
    }),
    dish({
      name: "Spring water 500ml",
      price: 2.5,
      category: "Soft drinks",
      station: "bar",
    }),
    dish({
      name: "Sparkling water 500ml",
      price: 2.5,
      category: "Soft drinks",
      station: "bar",
    }),
    dish({
      name: "Red Bull",
      price: 4,
      category: "Soft drinks",
      station: "bar",
    }),
    ...["Apple juice", "Orange juice", "Pineapple juice", "Cranberry juice"].map(
      (name) =>
        dish({ name, price: 2.5, category: "Soft drinks", station: "bar" }),
    ),
    dish({ name: "Espresso", price: 2.9, category: "Hot drinks", station: "bar" }),
    dish({ name: "Latte", price: 3.5, category: "Hot drinks", station: "bar" }),
    dish({
      name: "Cappuccino",
      price: 3.5,
      category: "Hot drinks",
      station: "bar",
    }),
    dish({
      name: "Americano",
      price: 2.9,
      category: "Hot drinks",
      station: "bar",
    }),
    dish({ name: "Tea", price: 2.9, category: "Hot drinks", station: "bar" }),

    ...[
      "Budweiser",
      "Corona Extra",
      "San Miguel",
      "Peroni",
      "Heineken",
      "Asahi",
    ].map((name) =>
      dish({ name, price: 4.55, category: "Beer", station: "bar" }),
    ),
    ...[
      "Kopparberg Strawberry & Lime",
      "Kopparberg Mixed Fruit",
      "Henry Westons",
    ].map((name) =>
      dish({ name, price: 5, category: "Cider", station: "bar" }),
    ),
    dish({ name: "Mixer", price: 1, category: "Spirits", station: "bar" }),
    ...[
      ["Smirnoff", 3.5, 6],
      ["Absolut", 3.5, 6],
      ["Gordon's Special", 3.5, 6],
      ["Gordon's Pink", 3.5, 6],
      ["Mermaid", 4, 7],
      ["Mermaid Pink", 4, 7],
      ["Jack Daniel's", 3.5, 6],
      ["Jameson", 3.5, 6],
      ["Jack Daniel's Single Barrel", 5, 9],
      ["Courvoisier V.S.", 4, 7],
      ["Bacardi Spiced", 3.5, 6],
      ["Bacardi White", 3.5, 6],
      ["Baileys", 3.5, 6],
      ["Disaronno", 3.5, 6],
      ["Peach schnapps", 3, 5],
    ].flatMap(([name, single, double]) => [
      dish({
        name: `${name} 25ml`,
        price: single,
        category: "Spirits",
        station: "bar",
      }),
      dish({
        name: `${name} 50ml`,
        price: double,
        category: "Spirits",
        station: "bar",
      }),
    ]),
    dish({ name: "Tequila", price: 2, category: "Spirits", station: "bar" }),
    dish({ name: "Jägermeister", price: 2, category: "Spirits", station: "bar" }),
    dish({ name: "Baby Guinness", price: 3, category: "Spirits", station: "bar" }),

    ...[
      ["Chenin Blanc", 5.5, 22],
      ["Pinot Grigio", 6, 24],
      ["Sauvignon Blanc", 6, 24],
      ["Chardonnay", 6, 24],
      ["Shiraz", 5.5, 22],
      ["Malbec", 6, 24],
      ["Merlot", 6, 24],
      ["Cabernet Sauvignon", 6, 24],
      ["Pinot Grigio Blush", 6, 24],
      ["Zinfandel Rosé", 6, 24],
    ].flatMap(([name, glass, bottle]) => [
      dish({
        name: `${name} 175ml`,
        price: glass,
        category: "Wine",
        station: "bar",
      }),
      dish({
        name: `${name} bottle`,
        price: bottle,
        category: "Wine",
        station: "bar",
      }),
    ]),
    dish({
      name: "Prosecco Spumante 200ml",
      price: 8,
      category: "Wine",
      station: "bar",
    }),
    dish({
      name: "Prosecco Spumante bottle",
      price: 26,
      category: "Wine",
      station: "bar",
    }),

    ...[
      "Mojito",
      "Espresso Martini",
      "Passionfruit Martini",
      "Long Island Iced Tea",
      "Sex on the Beach",
      "Frozen Strawberry Daiquiri",
    ].flatMap((name) => [
      dish({
        name: `${name} glass`,
        price: 7.99,
        category: "Cocktails",
        station: "bar",
      }),
      dish({
        name: `${name} jug`,
        price: 26,
        category: "Cocktails",
        station: "bar",
      }),
    ]),
  ];

  const withMealSides = ["Burgers", "Hot dogs", "Wraps", "Chicken", "Steak & ribs"];
  const categories = [
    ...new Set(menu.map((m) => m.category)),
  ].map((name) =>
    cat(
      name,
      withMealSides.includes(name) ? "mixed" : "none",
      withMealSides.includes(name) ? mealSides() : [],
    ),
  );

  return {
    settings: {
      name: "Angel Steakhouse",
      currency: "GBP",
    },
    categories,
    menu,
  };
}

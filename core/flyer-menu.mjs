const id = () => crypto.randomUUID();
const COOKS = [
  "Blue",
  "Rare",
  "Medium rare",
  "Medium",
  "Medium well",
  "Well done",
];
const BAR =
  /\b(drinks?|wines?|beers?|cocktails?|ciders?|juices?|whisk(?:y|ey)|gins?|vodkas?|rums?|liqueurs?|shots?|cognacs?|fizz)\b/i;
const STEAK = /\b(steak|rib-eye|ribeye|sirloin|filet|rump|t-bone|tomahawk|cote de boeuf)\b/i;

const pound = (major) => Math.round(major * 100);

const SECTIONS = [
  [
    "Starters",
    [
      ["Crispy Mac & Cheese Bites", 7.95],
      ["Cajun Squid Pops", 8.95],
      ["Prawns", 8.95],
      ["Tempura Fried Squid", 8.95],
      ["Nachos", 7.9],
      ["Feta Bites", 6.5],
      ["Loaded Nachos", 11.9],
      ["Grilled Halloumi", 6.95],
      ["Piri-piri Chicken Wings", 6.5],
      ["Baby Pork Rib", 6.95],
      ["Garlic Bread", 4.9],
      ["Selection of Olives", 5.95],
      ["Cheesy Garlic Bread", 5.9],
    ],
  ],
  [
    "Burgers & Wraps",
    [
      ["Chicken Wrap", 16.95],
      ["Mr. McDonald Chicken Burger", 16.95],
      ["Surf and Turf Burger", 18.95],
      ["Hot Chick Burger", 16.95],
      ["I Am Really Hungry Burger", 21.95],
      ["Lord of the Pigs Burger", 16.95],
    ],
  ],
  [
    "Burgers",
    [
      ["Simply the Best", 16.95],
      ["Plain Jane", 16.95],
      ["Highway Man", 17.95],
      ["Miss Hen", 16.95],
      ["The Champ", 17.95],
      ["Vagabond", 16.95],
      ["Farmer John", 17.95],
      ["Yummy Halloumi", 16.95],
      ["Crazy Mexican", 17.95],
      ["Silence of the Lambs", 17.95],
      ["King of Angels", 21.95],
      ["Fish Fillet", 17.95],
      ["Extra Patty", 4.95],
    ],
  ],
  [
    "Hotdogs",
    [
      ["New Yorker", 14.95],
      ["Windy City", 15.95],
      ["Bulldog", 15.95],
    ],
  ],
  [
    "Steaks",
    [
      ["45 oz Tomahawk", 90],
      ["45 oz Cote de Boeuf", 99],
      ["22 oz T-bone Steak", 43.95],
      ["8 oz Sirloin Steak", 26.95],
      ["12 oz Sirloin Steak", 33.95],
      ["9 oz Rib-eye Steak", 32.95],
      ["12 oz Rib-eye Steak", 36.95],
      ["10 oz Rump Steak", 25.95],
      ["16 oz Rump Steak", 33.95],
      ["7 oz Filet Steak", 32.95],
    ],
  ],
  [
    "Slow Cooked",
    [
      ["Pork Ribs", 22.95],
      ["Slow-Cooked Lamb Shank", 26.95],
    ],
  ],
  [
    "Mains",
    [
      ["Pork Schnitzel and Chips", 16.95],
      ["Chicken Marinara and Chips", 18.95],
    ],
  ],
  [
    "Chicken",
    [
      ["6 Two Joint Chicken Wings", 9.95],
      ["12 Two Joint Chicken Wings", 16.95],
      ["Half Piri-piri Chicken", 17.95],
      ["Whole Piri-piri Chicken", 26.95],
      ["Chicken Breast", 16.95],
    ],
  ],
  [
    "Sides",
    [
      ["Fries", 4.4],
      ["Seasoned Fries", 4.4],
      ["Cheese Fries", 4.9],
      ["Sweet Potato Fries", 4.9],
      ["Twisted Curly Fries", 4.9],
      ["Mashed Potato", 4.4],
      ["Onion Rings (8)", 4.4],
      ["Rice", 4.4],
      ["Coleslaw", 4.4],
      ["Side Salad", 4.4],
      ["Corn on the Cob (2)", 4.4],
    ],
  ],
  [
    "Angel Sides",
    [
      ["Jalapeno Poppers", 6.9],
      ["Mozzarella Sticks", 6.9],
      ["Halloumi Fries", 6.9],
      ["Chicken Popcorn", 6.9],
      ["Loaded Fries", 7.95],
    ],
  ],
  [
    "Salads",
    [
      ["Chicken Caesar", 15.95],
      ["Salmon Salad", 15.95],
      ["Greek Salad", 13.95],
      ["King Prawn Salad", 15.95],
    ],
  ],
  [
    "Little Angels",
    [
      ["Kids Hotdog", 7.95],
      ["6 Chicken Nuggets", 7.95],
      ["4 Fish Fingers", 7.95],
      ["Kids Hamburger", 7.95],
      ["Kids Cheeseburger", 7.95],
    ],
  ],
  [
    "Extras",
    [
      ["Egg", 1],
      ["Bacon", 1.5],
      ["Cheese", 1],
      ["American Cheese", 1],
      ["Homemade Beef Chilli", 2],
      ["BBQ Pulled Pork", 2],
      ["Jalepeno", 1],
      ["Caramelised Onions", 1],
      ["Red Onion", 1],
      ["Fried Mushrooms", 1],
      ["Nachos", 1],
      ["Extra Sauce", 1],
    ],
  ],
  [
    "Sauces",
    [
      ["Chipotle Sauce", 1.5],
      ["Salsa", 1.5],
      ["Sour Cream", 1.5],
      ["Angel BBQ Sauce", 1.5],
      ["Angel Burger Sauce", 1.5],
      ["Angel Garlic Mayo", 1.5],
    ],
  ],
  [
    "Desserts & Milkshakes",
    [
      ["Homemade Chocolate Cake", 7.95],
      ["Churro Largo", 7.95],
      ["Homemade Cheesecake of the Day", 7.95],
      ["Chocolate Brownie", 7.95],
      ["Milkshake Vanilla", 7.95],
      ["Milkshake Kinder Bueno", 7.95],
      ["Milkshake Strawberry", 7.95],
      ["Milkshake Ferrero", 7.95],
      ["Milkshake Salted Caramel", 7.95],
      ["Milkshake Oreo", 7.95],
      ["Milkshake Peanut Butter", 7.95],
      ["Milkshake Mars", 7.95],
      ["Milkshake Nutella", 7.95],
    ],
  ],
  [
    "Soft Drinks",
    [
      ["Fizzy Drinks 330ml", 2.95],
      ["Spring or Sparkling Water 500ml", 2.95],
    ],
  ],
  [
    "Juice",
    [
      ["Apple Juice", 2.95],
      ["Orange Juice", 2.95],
      ["Pineapple Juice", 2.95],
      ["Cranberry Juice", 2.95],
    ],
  ],
  [
    "Hot Drinks",
    [
      ["Espresso", 2.9],
      ["Latte", 3.5],
      ["Cappuccino", 3.5],
      ["Americano", 2.9],
      ["Tea", 2.9],
    ],
  ],
  [
    "Beers",
    [
      ["Budweiser", 4.55],
      ["Corona Extra", 4.55],
      ["San Miguel", 4.55],
      ["Peroni", 4.55],
      ["Heineken", 4.55],
      ["Asahi", 4.55],
    ],
  ],
  [
    "Ciders",
    [
      ["Kopparberg Strawberry & Lime", 5],
      ["Kopparberg Mixed Fruit", 5],
      ["Kopparberg Alcohol Free", 5],
      ["Henry Westons", 5],
      ["Mixers", 1],
    ],
  ],
  [
    "Vodka",
    [
      ["Smirnoff 25ml", 3.5],
      ["Smirnoff 50ml", 6],
      ["Absolut 25ml", 3.5],
      ["Absolut 50ml", 6],
      ["Grey Goose 25ml", 6],
      ["Grey Goose 50ml", 10],
    ],
  ],
  [
    "Gin",
    [
      ["Gordon's Special 25ml", 3.5],
      ["Gordon's Special 50ml", 6],
      ["Gordon's Pink 25ml", 3.5],
      ["Gordon's Pink 50ml", 6],
      ["Mermaid 25ml", 4],
      ["Mermaid 50ml", 7],
      ["Mermaid Pink 25ml", 4],
      ["Mermaid Pink 50ml", 7],
    ],
  ],
  [
    "Whisky",
    [
      ["Jack Daniel's 25ml", 3.5],
      ["Jack Daniel's 50ml", 6],
      ["Jameson 25ml", 3.5],
      ["Jameson 50ml", 6],
      ["Jack Daniel's Single Barrel 25ml", 6],
      ["Jack Daniel's Single Barrel 50ml", 10],
    ],
  ],
  [
    "Cognac",
    [
      ["Courvoisier V.S. 25ml", 4],
      ["Courvoisier V.S. 50ml", 7],
    ],
  ],
  [
    "Rum",
    [
      ["Bacardi Spiced 25ml", 3.5],
      ["Bacardi Spiced 50ml", 6],
      ["Bacardi White 25ml", 3.5],
      ["Bacardi White 50ml", 6],
    ],
  ],
  [
    "Liqueurs",
    [
      ["Baileys 25ml", 3.5],
      ["Baileys 50ml", 6],
      ["Disaronno 25ml", 3.5],
      ["Disaronno 50ml", 6],
      ["Peach Schnapps 25ml", 3],
      ["Peach Schnapps 50ml", 5],
    ],
  ],
  [
    "Shots",
    [
      ["Tequila", 3],
      ["Jägermeister", 3],
      ["Baby Guinness", 4],
    ],
  ],
  [
    "White Wine",
    [
      ["Chenin Blanc 175ml", 6],
      ["Chenin Blanc Bottle", 24],
      ["Pinot Grigio 175ml", 7],
      ["Pinot Grigio Bottle", 26],
      ["Sauvignon Blanc 175ml", 7],
      ["Sauvignon Blanc Bottle", 26],
      ["Chardonnay 175ml", 7],
      ["Chardonnay Bottle", 26],
    ],
  ],
  [
    "Red Wine",
    [
      ["Shiraz 175ml", 6],
      ["Shiraz Bottle", 24],
      ["Malbec 175ml", 7],
      ["Malbec Bottle", 26],
      ["Merlot 175ml", 7],
      ["Merlot Bottle", 26],
      ["Cabernet Sauvignon 175ml", 7],
      ["Cabernet Sauvignon Bottle", 26],
    ],
  ],
  [
    "Rosé Wine",
    [
      ["Pinot Grigio Blush 175ml", 7],
      ["Pinot Grigio Blush Bottle", 26],
      ["Zinfandel Rosé 175ml", 7],
      ["Zinfandel Rosé Bottle", 26],
    ],
  ],
  [
    "Fizz",
    [
      ["Prosecco Spumante 200ml", 8],
      ["Prosecco Spumante Bottle", 28],
    ],
  ],
  [
    "Cocktails",
    [
      ["Mojito glass", 8.99],
      ["Mojito jug", 29.99],
      ["Long Island Iced Tea glass", 8.99],
      ["Long Island Iced Tea jug", 29.99],
      ["Espresso Martini glass", 8.99],
      ["Espresso Martini jug", 29.99],
      ["Sex on the Beach glass", 8.99],
      ["Sex on the Beach jug", 29.99],
      ["Passion Fruit Martini glass", 8.99],
      ["Passion Fruit Martini jug", 29.99],
      ["Frozen Strawberry Daiquiri glass", 8.99],
      ["Frozen Strawberry Daiquiri jug", 29.99],
    ],
  ],
];

const INCLUDED_SIDES = [
  "Fries",
  "Seasoned Fries",
  "Cheese Fries",
  "Sweet Potato Fries",
  "Twisted Curly Fries",
  "Mashed Potato",
  "Onion Rings (8)",
  "Rice",
  "Coleslaw",
  "Side Salad",
  "Corn on the Cob (2)",
];
const ANGEL_SIDES = [
  "Jalapeno Poppers",
  "Mozzarella Sticks",
  "Halloumi Fries",
  "Chicken Popcorn",
  "Loaded Fries",
];
const row = (name, price = 0) => ({
  id: id(),
  name,
  price: pound(price),
  deleted: false,
});
const leave = (name) => ({
  id: id(),
  name,
  kind: "leaveout",
  price: 0,
  deleted: false,
});
const group = (name, items) => ({
  id: id(),
  name,
  deleted: false,
  extras: items.map(([itemName, price]) => row(itemName, price)),
});
const mealSides = () => [
  ...INCLUDED_SIDES.map((name) => row(name, 0)),
  ...ANGEL_SIDES.map((name) => row(name, 3)),
];
const leaveouts = () =>
  ["Lettuce", "Tomato", "Onion", "Gherkins", "Cheese", "Sauce"].map(leave);
const extras = () => [
  group("Extras", [
    ["Egg", 1],
    ["Bacon", 1.5],
    ["Cheese", 1],
    ["American Cheese", 1],
    ["Homemade Beef Chilli", 2],
    ["BBQ Pulled Pork", 2],
    ["Jalepeno", 1],
    ["Caramelised Onions", 1],
    ["Red Onion", 1],
    ["Fried Mushrooms", 1],
    ["Nachos", 1],
    ["Extra Sauce", 1],
    ["Extra Patty", 4.95],
  ]),
  group("Sauces", [
    ["Chipotle Sauce", 1.5],
    ["Salsa", 1.5],
    ["Sour Cream", 1.5],
    ["Angel BBQ Sauce", 1.5],
    ["Angel Burger Sauce", 1.5],
    ["Angel Garlic Mayo", 1.5],
  ]),
];
const filling = () =>
  group("Loaded with", [
    ["BBQ Pulled Pork", 0],
    ["Beef Chilli", 0],
  ]);
const wingSauce = () =>
  group("Sauce", [
    ["Lemon & herb", 0],
    ["Mild piri-piri", 0],
    ["Hot piri-piri", 0],
    ["Buffalo", 0],
    ["BBQ sauce", 0],
  ]);
const chickenFlavour = () =>
  group("Flavour", [
    ["Lemon & herbs", 0],
    ["Mild piri-piri", 0],
    ["Hot piri-piri", 0],
    ["Buffalo", 0],
  ]);
const kidsDrink = () =>
  group("Kids drink", [
    ["Fruit Shoot", 0],
    ["Orange juice", 0],
    ["Apple juice", 0],
    ["Pineapple juice", 0],
    ["Mango juice", 0],
  ]);

function dish(name, price, category) {
  return {
    id: id(),
    name,
    price: pound(price),
    category,
    station: BAR.test(category) ? "bar" : "kitchen",
    available: true,
    deleted: false,
    image: "",
    modifiers: [],
    addonGroups: [],
    sideMode: "inherit",
    cookOptions: STEAK.test(name)
      ? COOKS.map((cook) => ({ id: id(), name: cook, deleted: false }))
      : [],
  };
}

function applyService(item) {
  const { name, category } = item;
  if (category === "Burgers" && name === "Extra Patty") {
    item.sideMode = "none";
    return;
  }
  if (["Burgers", "Burgers & Wraps", "Hotdogs"].includes(category)) {
    item.sideMode = "mixed";
    item.modifiers = leaveouts();
    item.addonGroups = extras();
    return;
  }
  if (/two joint chicken wings/i.test(name)) {
    item.sideMode = "none";
    item.addonGroups = [chickenFlavour()];
    return;
  }
  if (/^piri-piri chicken wings$/i.test(name)) {
    item.addonGroups = [wingSauce()];
    return;
  }
  if (name === "Half Piri-piri Chicken" || name === "Chicken Breast") {
    item.sideMode = "mixed";
    item.addonGroups = [
      chickenFlavour(),
      ...(name === "Chicken Breast"
        ? [
            group("Cooked", [
              ["Grilled", 0],
              ["Buttermilk fried", 0],
            ]),
          ]
        : []),
    ];
    return;
  }
  if (name === "Whole Piri-piri Chicken") {
    item.sideMode = "mixed";
    item.addonGroups = [
      chickenFlavour(),
      { ...group("Second side", []), extras: mealSides() },
    ];
    return;
  }
  if (name === "Pork Ribs") {
    item.sideMode = "mixed";
    return;
  }
  if (name === "Loaded Nachos" || name === "Loaded Fries") {
    item.addonGroups = [filling()];
    return;
  }
  if (name === "Churro Largo") {
    item.addonGroups = [
      group("Sauce", [
        ["Dulce de leche", 0],
        ["Nutella", 0],
      ]),
    ];
    return;
  }
  if (category === "Little Angels") item.addonGroups = [kidsDrink()];
}

export function buildFlyerMenu() {
  const categories = [];
  const menu = [];
  for (const [name, items] of SECTIONS) {
    const meal = ["Burgers", "Burgers & Wraps", "Hotdogs", "Chicken", "Slow Cooked"].includes(
      name,
    );
    categories.push({
      id: id(),
      name,
      deleted: false,
      sideMode: ["Burgers", "Burgers & Wraps", "Hotdogs"].includes(name)
        ? "mixed"
        : "none",
      sides: meal ? mealSides() : [],
    });
    for (const [itemName, price] of items) {
      const item = dish(itemName, price, name);
      applyService(item);
      menu.push(item);
    }
  }
  return { categories, menu };
}

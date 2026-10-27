import type { Ingredient, Recipe, Step } from "../types";
import { catalogRecipe } from "./recipes";

type Item = [
  id: string,
  name: string,
  quantity: number,
  unit: string,
  category: Ingredient["category"],
];
type Action = [
  title: string,
  instructions: string[],
  heat: string,
  minutes: number,
  ids: string[],
];
interface Dish {
  id: string;
  title: string;
  description: string;
  items: Item[];
  cutting: string;
  rawMeat?: string;
  actions: Action[];
}
const dishes: Dish[] = [
  {
    id: "chicken-cabbage",
    title: "鶏とキャベツのみそ蒸し・ご飯",
    description:
      "野菜と鶏肉を蒸し煮に。みそ味のおかずを、ご飯と分けて小分け保存します。",
    items: [
      ["chicken", "鶏もも肉", 750, "g", "meat"],
      ["cabbage", "キャベツ", 900, "g", "vegetable"],
      ["carrot", "にんじん", 300, "g", "vegetable"],
      ["miso", "みそ", 60, "g", "seasoning"],
      ["sugar", "砂糖", 15, "g", "seasoning"],
      ["water", "飲用の水", 180, "ml", "other"],
    ],
    cutting:
      "キャベツは洗って3cm角、にんじんは洗い、必要なら皮をむいて2mmほどの薄切りにする。みそ・砂糖を材料欄の水で溶く。",
    rawMeat: "chicken",
    actions: [
      [
        "野菜と肉を蒸し煮にする",
        [
          "大きめの鍋か深いフライパンに野菜、鶏肉、みそを溶いた調味液を入れる。6食分が無理なく入らなければ材料と調味液を等分し、数回に分けて調理する。",
          "ふたをして蒸し煮にする。時々清潔な道具で混ぜ、焦げそうなら火を弱めて飲用の水を少しずつ補う。野菜が柔らかくなり、肉の中心まで十分加熱されるまで続ける。",
        ],
        "中火→蒸気が出たら弱めの中火",
        15,
        ["chicken", "cabbage", "carrot", "miso", "sugar", "water"],
      ],
    ],
  },
  {
    id: "chicken-tomato",
    title: "鶏と玉ねぎのトマト煮・ご飯",
    description:
      "トマト缶で煮る主菜。ご飯とおかずを別に分けて、数回分を作ります。",
    items: [
      ["chicken", "鶏もも肉", 750, "g", "meat"],
      ["onion", "玉ねぎ", 600, "g", "vegetable"],
      ["tomato", "カットトマト缶", 800, "g", "vegetable"],
      ["oil", "油", 15, "ml", "seasoning"],
      ["salt", "塩", 6, "g", "seasoning"],
      ["water", "飲用の水", 200, "ml", "other"],
    ],
    cutting:
      "玉ねぎの皮をむき、1cm幅に切る。トマト缶・油・塩・水を量っておく。",
    rawMeat: "chicken",
    actions: [
      [
        "玉ねぎを炒める",
        [
          "鍋に油を入れて温め、玉ねぎを炒める。焦げる前に火を弱め、しんなりするまで混ぜる。",
        ],
        "中火",
        6,
        ["onion", "oil"],
      ],
      [
        "鶏肉とトマトを煮る",
        [
          "鶏肉・トマト・塩・水を加える。容量を超えるなら最初から全材料を分けて数回調理する。",
          "煮立ったら火を弱め、時々混ぜる。肉の中心まで十分加熱し、玉ねぎが柔らかくなるまで煮る。水分が足りなければ飲用の水を少しずつ補う。",
        ],
        "中火→煮立ったら弱火",
        18,
        ["chicken", "tomato", "salt", "water"],
      ],
    ],
  },
  {
    id: "pork-cabbage",
    title: "豚とキャベツの甘辛炒め・ご飯",
    description:
      "豚薄切り肉とキャベツのおかず。大容量を一度に炒めず、数回に分けて仕上げます。",
    items: [
      ["pork", "豚薄切り肉", 750, "g", "meat"],
      ["cabbage", "キャベツ", 900, "g", "vegetable"],
      ["carrot", "にんじん", 300, "g", "vegetable"],
      ["soy", "しょうゆ", 60, "ml", "seasoning"],
      ["sugar", "砂糖", 20, "g", "seasoning"],
      ["oil", "油", 20, "ml", "seasoning"],
      ["water", "飲用の水", 90, "ml", "other"],
    ],
    cutting:
      "キャベツは洗って3cm角、にんじんは2mmほどの薄切りにする。しょうゆ・砂糖・水を混ぜる。油を量る。",
    rawMeat: "pork",
    actions: [
      [
        "材料を分けて炒める",
        [
          "材料・油・調味液をフライパンに無理なく入る量へ等分する。油を温め、豚肉を広げて加熱する。",
          "野菜を加えて炒め、調味液を入れる。必要ならふたをし、にんじんが柔らかく、肉の中心まで十分加熱されるまで続ける。残りも同じ手順で調理する。",
        ],
        "中火、焦げそうなら弱める",
        15,
        ["pork", "cabbage", "carrot", "soy", "sugar", "oil", "water"],
      ],
    ],
  },
  {
    id: "pork-daikon",
    title: "豚と大根のしょうが煮・ご飯",
    description:
      "しょうが風味の煮物。大根は薄めに切り、ご飯と別の容器へ取り分けます。",
    items: [
      ["pork", "豚薄切り肉", 750, "g", "meat"],
      ["daikon", "大根", 1200, "g", "vegetable"],
      ["ginger", "しょうが", 30, "g", "vegetable"],
      ["soy", "しょうゆ", 75, "ml", "seasoning"],
      ["sugar", "砂糖", 25, "g", "seasoning"],
      ["water", "飲用の水", 700, "ml", "other"],
    ],
    cutting:
      "大根を洗い、必要なら皮をむいて厚さ5mmほどのいちょう切りにする。しょうがは洗って薄切りにする。調味料と水を量る。",
    rawMeat: "pork",
    actions: [
      [
        "大根を煮る",
        [
          "鍋に大根・しょうが・水を入れる。容量を超えるなら全材料を分ける。煮立ったら火を弱め、大根が柔らかくなるまで煮る。水分が足りなければ飲用の水を少しずつ足す。",
        ],
        "中火→弱めの中火",
        15,
        ["daikon", "ginger", "water"],
      ],
      [
        "肉と調味料を加える",
        [
          "豚肉を少しずつ広げて加え、しょうゆと砂糖を入れる。肉が重ならないよう混ぜ、中心まで十分加熱する。",
          "味をしみ込ませるために室温で長く置かず、火を止めたら当日分と保存分へ分ける。",
        ],
        "弱めの中火",
        12,
        ["pork", "soy", "sugar"],
      ],
    ],
  },
  {
    id: "chicken-negi",
    title: "鶏と長ねぎの照り煮・ご飯",
    description:
      "鶏と長ねぎをしょうゆ味で煮からめます。少ない食材で作る主菜とご飯です。",
    items: [
      ["chicken", "鶏もも肉", 900, "g", "meat"],
      ["negi", "長ねぎ", 600, "g", "vegetable"],
      ["soy", "しょうゆ", 60, "ml", "seasoning"],
      ["sugar", "砂糖", 30, "g", "seasoning"],
      ["oil", "油", 15, "ml", "seasoning"],
      ["water", "飲用の水", 180, "ml", "other"],
    ],
    cutting:
      "長ねぎを洗い、傷んだ部分を除いて2cm長さに切る。調味料と水を混ぜ、油を量る。",
    rawMeat: "chicken",
    actions: [
      [
        "鶏肉と長ねぎを煮からめる",
        [
          "材料と油・調味液を容量に合わせて等分する。フライパンに油を温め、鶏肉を重ならないよう入れる。",
          "長ねぎと調味液を加え、ふたをして中心まで十分加熱する。焦げそうなら火を弱め、水を少しずつ補う。肉の加熱を確認したら、ふたを外して汁を軽く煮詰める。残りも同じように調理する。",
        ],
        "中火→弱めの中火",
        18,
        ["chicken", "negi", "soy", "sugar", "oil", "water"],
      ],
    ],
  },
  {
    id: "tofu-mushroom",
    title: "厚揚げときのこの甘辛煮・ご飯",
    description:
      "厚揚げを主役にした、野菜・豆腐中心の献立。豆腐は冷凍すると食感が変わります。",
    items: [
      ["tofu", "厚揚げ", 900, "g", "other"],
      ["mushroom", "しめじ", 450, "g", "vegetable"],
      ["carrot", "にんじん", 300, "g", "vegetable"],
      ["soy", "しょうゆ", 60, "ml", "seasoning"],
      ["sugar", "砂糖", 20, "g", "seasoning"],
      ["water", "飲用の水", 350, "ml", "other"],
    ],
    cutting:
      "にんじんを洗って2mmほどの薄切りにする。しめじは根元を落として小房に分ける。厚揚げは表示を確認し、一口大に切る。調味料と水を量る。",
    actions: [
      [
        "野菜を煮る",
        [
          "鍋ににんじん・しめじ・しょうゆ・砂糖・水を入れて煮る。にんじんが柔らかくなるまで時々混ぜる。",
        ],
        "中火→煮立ったら弱める",
        10,
        ["carrot", "mushroom", "soy", "sugar", "water"],
      ],
      [
        "厚揚げを温める",
        [
          "厚揚げを加え、崩しすぎないように混ぜる。中心まで十分加熱する。容量を超える場合は全材料を等分して調理する。",
          "火を止めたら、常温で長く置かず小分けへ進む。",
        ],
        "弱めの中火",
        10,
        ["tofu"],
      ],
    ],
  },
  {
    id: "beans-tomato",
    title: "豆と野菜のトマト煮・ご飯",
    description:
      "加熱済みの豆とトマト缶を使う、野菜中心のおかず。乾燥豆のままでは作りません。",
    items: [
      ["beans", "加熱済みミックスビーンズ", 900, "g", "other"],
      ["onion", "玉ねぎ", 600, "g", "vegetable"],
      ["tomato", "カットトマト缶", 800, "g", "vegetable"],
      ["oil", "油", 15, "ml", "seasoning"],
      ["salt", "塩", 6, "g", "seasoning"],
      ["water", "飲用の水", 150, "ml", "other"],
    ],
    cutting:
      "玉ねぎの皮をむき、1cm角に切る。豆は必ず加熱済み製品を選び、表示を確認して必要なら水を切り、可食部を量る。乾燥豆で代用しない。",
    actions: [
      [
        "玉ねぎを炒める",
        [
          "鍋に油を温め、玉ねぎをしんなりするまで炒める。容量を超えるなら全材料を分けて調理する。",
        ],
        "中火",
        8,
        ["onion", "oil"],
      ],
      [
        "豆とトマトを煮る",
        [
          "豆・トマト・塩・水を加え、時々かき混ぜて中心まで十分加熱する。玉ねぎが柔らかくなるまで煮る。焦げそうなら弱火にし、飲用の水を少しずつ補う。",
          "豆の種類やアレルギー表示は製品ごとに確認する。",
        ],
        "中火→弱火",
        15,
        ["beans", "tomato", "salt", "water"],
      ],
    ],
  },
  {
    id: "tuna-cabbage",
    title: "ツナとキャベツの炒め煮・ご飯",
    description:
      "ツナ缶と野菜の献立。開缶後は放置せず調理し、料理を清潔な容器へ分けます。",
    items: [
      ["tuna", "ツナ缶（液を切った可食部）", 450, "g", "meat"],
      ["cabbage", "キャベツ", 900, "g", "vegetable"],
      ["carrot", "にんじん", 300, "g", "vegetable"],
      ["soy", "しょうゆ", 45, "ml", "seasoning"],
      ["oil", "油", 15, "ml", "seasoning"],
      ["water", "飲用の水", 100, "ml", "other"],
    ],
    cutting:
      "キャベツは洗って一口大、にんじんは2mmほどの薄切りにする。ツナは表示を確認して開缶し、液を切った可食部を量る。ふたや缶の切り口でけがをしないようにする。",
    actions: [
      [
        "野菜を蒸し炒めにする",
        [
          "フライパンに油を温め、野菜と水を入れてふたをする。容量を超える場合は全材料を等分する。時々混ぜ、にんじんが柔らかくなるまで加熱する。",
        ],
        "中火→弱めの中火",
        10,
        ["cabbage", "carrot", "oil", "water"],
      ],
      [
        "ツナを合わせる",
        [
          "ツナとしょうゆを加え、全体を混ぜて中心まで十分加熱する。焦げそうなら火を弱める。残りも同じ手順で作る。",
          "清潔な器具で取り分け、保存分を速やかに小分け冷却する。",
        ],
        "中火",
        5,
        ["tuna", "soy"],
      ],
    ],
  },
  {
    id: "pork-mushroom",
    title: "豚ときのこのしょうが蒸し・ご飯",
    description:
      "豚薄切り肉ときのこを蒸し煮にする、しょうが風味の主菜。ご飯を添えてまとめ作りに。",
    items: [
      ["pork", "豚薄切り肉", 750, "g", "meat"],
      ["mushroom", "しめじ", 600, "g", "vegetable"],
      ["onion", "玉ねぎ", 600, "g", "vegetable"],
      ["ginger", "しょうが", 30, "g", "vegetable"],
      ["soy", "しょうゆ", 60, "ml", "seasoning"],
      ["sugar", "砂糖", 15, "g", "seasoning"],
      ["water", "飲用の水", 250, "ml", "other"],
    ],
    cutting:
      "玉ねぎは皮をむいて5mm幅、しょうがは洗って薄切りにする。しめじは根元を落として小房に分ける。調味料と水を量る。",
    rawMeat: "pork",
    actions: [
      [
        "野菜と豚肉を蒸し煮にする",
        [
          "深いフライパンか鍋に野菜・しょうが・調味液を入れ、豚肉をほぐして重ならないように加える。容量に合わなければ全材料を等分して数回調理する。",
          "ふたをして時々混ぜ、野菜が柔らかく、肉の中心まで十分加熱されるまで続ける。煮汁が減りすぎたら飲用の水を少しずつ足す。",
        ],
        "中火→弱めの中火",
        18,
        ["pork", "mushroom", "onion", "ginger", "soy", "sugar", "water"],
      ],
    ],
  },
];
const safeLabel =
  "製品の原材料・アレルギー・保存表示を確認。数量は可食部の目安で、販売パック数や価格へ自動換算しません。";
function step(action: Action): Omit<Step, "id" | "order"> {
  return {
    title: action[0],
    instructions: action[1],
    heat: action[2],
    minutes: action[3],
    ingredientIds: action[4],
    equipment: ["鍋またはフライパン", "ふた", "清潔な菜箸"],
  };
}
/** Authored menu catalogue, available offline; no AI or current-price claims. Never inserted into storage until selected. */
export function menuCatalog(): Recipe[] {
  return dishes.map((dish) => {
    const ingredients: Ingredient[] = [
      {
        id: "rice",
        name: "米（未炊飯）",
        quantity: 600,
        unit: "g",
        category: "grain",
        note: "炊飯用水は米の製品・炊飯器の水位と容量に従う。",
      },
      ...dish.items.map(([id, name, quantity, unit, category]) => ({
        id,
        name,
        quantity,
        unit,
        category,
        note: safeLabel,
      })),
    ];
    const prep: Omit<Step, "id" | "order">[] = [
      {
        title: "野菜と調味料を用意する",
        instructions: [
          dish.cutting,
          "肉や魚、冷蔵品は表示どおり保管し、使う直前に取り出す。",
        ],
        heat: "火は使わない",
        minutes: 10,
        equipment: ["包丁", "まな板", "計量器"],
        ingredientIds: dish.items
          .filter((i) => i[4] !== "meat")
          .map((i) => i[0]),
      },
    ];
    if (dish.rawMeat)
      prep.push({
        title: "最後に肉を切る",
        instructions: [
          "肉を生肉用の道具で一口大に切る。鶏肉は厚みが大きく違わない2cm程度を目安にし、薄切り豚肉は食べやすい大きさにする。肉は水洗いしない。",
          "生肉に触れた手・包丁・まな板を洗い、加熱後の取り分け用に清潔な別の道具を使う。",
        ],
        heat: "火は使わない",
        minutes: 5,
        equipment: ["生肉用まな板", "包丁"],
        ingredientIds: [dish.rawMeat],
      });
    const cook = dish.actions.map(step);
    cook.push({
      title: "加熱を確認して小分けへ進む",
      instructions: [
        "肉を使う場合は中心まで十分に加熱し、温度計があれば中心75℃で1分以上を目安に確認する。色や時間だけで安全と断定しない。肉を使わない料理も中心まで十分加熱する。",
        "ご飯の炊き上がりを確認し、清潔な器具で当日分と保存分へ取り分ける。先にできた料理を室温で長く置いて待たず、速やかに浅い容器へ小分けし冷却・収納する。",
      ],
      heat: "火を止める",
      minutes: null,
      equipment: ["清潔な保存容器", "清潔な菜箸"],
      ingredientIds: ingredients.map((i) => i.id),
    });
    return catalogRecipe(
      `menu-${dish.id}`,
      dish.title,
      dish.description,
      ingredients,
      prep,
      cook,
    );
  });
}

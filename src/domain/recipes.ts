import type { Ingredient, Recipe, Step } from "../types";

const stamp = "2026-10-24T00:00:00.000Z";
const storageNotes = [
  "当日食べる分と保存分を清潔な器具で分け、料理とご飯は一食分ずつ浅い容器へ小分けする。生肉の皿・箸を使い回さない。",
  "大鍋のまま常温で放置しない。容器の外側を氷水などで速やかに冷やし、粗熱が取れたら速やかに冷蔵・冷凍庫へ収納する。",
  "数回分をまとめて作る場合、当日分以外は小分け冷凍する運用を基本にする。容器が冷凍・再加熱に対応するか、食品の表示を確認する。",
  "料理名・調理日・保存日時を容器に記す。予定日は消費期限ではない。保存温度・冷却・放置時間が不明な食品の安全を日数や見た目だけで判断しない。",
];
const commonPrep: Omit<Step, "id" | "order">[] = [
  {
    title: "手と道具を清潔にする",
    instructions: [
      "手を洗う。包丁・まな板・作業台を清潔にする。",
      "生肉用と加熱済み食品用の皿・箸を分ける。浅い保存容器を用意する。",
    ],
    heat: "火は使わない",
    minutes: null,
    equipment: ["包丁", "まな板", "保存容器"],
    ingredientIds: [],
  },
  {
    title: "先にご飯を炊く",
    instructions: [
      "材料欄の米は炊く前の重さ。計量カップで量る場合は、米の製品表示と炊飯器の目盛を確認する。",
      "米を洗い、炊飯器の容量と水位表示に従って炊飯を開始する。炊飯時間は機種表示に従う。",
    ],
    heat: "炊飯器の通常設定",
    minutes: null,
    equipment: ["炊飯器"],
    ingredientIds: ["rice"],
  },
];
const commonReheat: Omit<Step, "id" | "order">[] = [
  {
    title: "保存状態を確認し、食べる分だけ取り出す",
    instructions: [
      "保存方法・収納時の記録・現物の状態を確認する。状態や放置時間が不明なら食べられると決めつけない。",
      "冷凍分は冷蔵庫内か電子レンジで解凍する。常温に置いて自然解凍しない。",
    ],
    heat: "製品・容器の表示に従う",
    minutes: null,
    equipment: ["冷蔵庫", "電子レンジ"],
    ingredientIds: [],
  },
  {
    title: "中心までむらなく再加熱する",
    instructions: [
      "電子レンジでは容器の表示に従い、途中で混ぜる・位置を変える。鍋ならかき混ぜながら加熱する。",
      "ご飯とおかずをそれぞれ中心まで十分に温める。温度計があれば中心75℃で1分以上を目安に確認する。",
    ],
    heat: "器具・食品の表示に従って加熱",
    minutes: null,
    equipment: ["電子レンジまたは鍋"],
    ingredientIds: [],
  },
  {
    title: "温めた分を食べる",
    instructions: [
      "清潔な器具で盛り付ける。取り出した分を何度も冷却・再加熱しない。",
      "再加熱で常温放置や不明な保存状態を帳消しにできるとは判断しない。食べた分だけアプリへ記録する。",
    ],
    heat: "火を止める",
    minutes: null,
    equipment: ["清潔な皿・箸"],
    ingredientIds: [],
  },
];
function numbered(items: Omit<Step, "id" | "order">[], prefix: string): Step[] {
  return items.map((s, i) => ({
    ...s,
    id: `${prefix}-${i + 1}`,
    order: i + 1,
  }));
}
function ing(
  id: string,
  name: string,
  quantity: number,
  unit: string,
  category: Ingredient["category"],
  note: string,
): Ingredient {
  return { id, name, quantity, unit, category, note };
}
export function catalogRecipe(
  id: string,
  title: string,
  description: string,
  ingredients: Ingredient[],
  prep: Omit<Step, "id" | "order">[],
  cook: Omit<Step, "id" | "order">[],
): Recipe {
  return {
    id,
    revision: 1,
    title,
    description,
    baseServings: 6,
    ingredients,
    prep: numbered([...commonPrep, ...prep], `${id}-prep`),
    cook: numbered(cook, `${id}-cook`),
    storageNotes: [...storageNotes],
    reheat: numbered(commonReheat, `${id}-reheat`),
    equipment: [
      "炊飯器",
      "鍋またはフライパン",
      "ふた",
      "包丁",
      "まな板",
      "浅い保存容器",
    ],
    favorite: false,
    source: "sample",
    updatedAt: stamp,
  };
}

/** Editable samples; quantities are recipe examples, never market prices or nutrition guarantees. */
export function initialRecipes(): Recipe[] {
  return [
    catalogRecipe(
      "sample-soboro",
      "鶏そぼろ・炒り卵・にんじん・ご飯セット",
      "6食分を別々に小分けし、食べるときに丼へ。炊飯・冷却時間は器具と量で変わります。",
      [
        ing(
          "rice",
          "米（未炊飯）",
          600,
          "g",
          "grain",
          "炊く前の重さ。炊飯器・米の表示に従う。",
        ),
        ing(
          "chicken",
          "鶏ひき肉",
          600,
          "g",
          "meat",
          "肉・冷凍品は買物の最後に。保冷して持ち帰り、肉汁が漏れないよう表示どおり保存。",
        ),
        ing(
          "eggs",
          "卵",
          3,
          "個",
          "egg",
          "必要量と販売パック数は別。半端な量が出た場合は必要量を確認する。",
        ),
        ing(
          "carrot",
          "にんじん",
          450,
          "g",
          "vegetable",
          "本数に勝手に換算しない。",
        ),
        ing(
          "soy",
          "しょうゆ",
          60,
          "ml",
          "seasoning",
          "アレルギー情報は商品の表示を確認。",
        ),
        ing("sugar", "砂糖", 30, "g", "seasoning", "甘さは好みに合わせる。"),
        ing(
          "ginger",
          "しょうが",
          15,
          "g",
          "vegetable",
          "チューブへの換算は製品表示を確認。",
        ),
        ing("oil", "油", 15, "ml", "seasoning", "炒り卵に使用。"),
        ing(
          "water",
          "飲用の水",
          100,
          "ml",
          "other",
          "野菜を蒸す水。炊飯用水は別途炊飯器の水位に従う。",
        ),
      ],
      [
        {
          title: "野菜と調味料を準備する",
          instructions: [
            "にんじんを洗い、必要なら皮を薄くむく。両端を切って薄い輪切りにし、重ねて細切りにする。",
            "しょうがを洗ってすりおろす。しょうゆ・砂糖・油を材料欄の量で量る。肉はまだ冷蔵庫へ。",
          ],
          heat: "火は使わない",
          minutes: 10,
          equipment: ["包丁", "まな板"],
          ingredientIds: ["carrot", "ginger", "soy", "sugar", "oil"],
        },
        {
          title: "卵と肉を用意する",
          instructions: [
            "清潔な器に卵を割り入れ混ぜる。生卵に触れた手と器具を洗う。",
            "肉は加熱直前に冷蔵庫から出し、水洗いしない。",
          ],
          heat: "火は使わない",
          minutes: 3,
          equipment: ["ボウル", "菜箸"],
          ingredientIds: ["eggs", "chicken"],
        },
      ],
      [
        {
          title: "にんじんを蒸す",
          instructions: [
            "鍋ににんじんと材料欄の水を入れ、ふたをして加熱する。",
            "柔らかくなるまで様子を見て、焦げそうなら火を弱めて少し水を足す。清潔な容器へ移す。",
          ],
          heat: "中火→煮立ったら弱火",
          minutes: 8,
          equipment: ["鍋", "ふた"],
          ingredientIds: ["carrot", "water"],
        },
        {
          title: "鶏そぼろを作る",
          instructions: [
            "フライパンに肉・しょうゆ・砂糖・しょうがを入れ、菜箸でほぐしながら加熱する。",
            "肉が重なる場合は数回に分ける。中心まで十分加熱し、温度計があれば中心75℃で1分以上を目安に確認する。",
          ],
          heat: "中火、焦げそうなら弱火",
          minutes: 12,
          equipment: ["フライパン", "菜箸"],
          ingredientIds: ["chicken", "soy", "sugar", "ginger"],
        },
        {
          title: "卵を炒る",
          instructions: [
            "生肉に触れた手と道具を洗い、清潔な別フライパンか洗浄済みのものを使う。",
            "油を入れて温め、卵を入れて混ぜる。全体にしっかり火を通し、半熟で保存しない。",
          ],
          heat: "弱めの中火",
          minutes: 5,
          equipment: ["フライパン", "菜箸"],
          ingredientIds: ["eggs", "oil"],
        },
        {
          title: "ご飯とおかずを取り分ける",
          instructions: [
            "ご飯の炊き上がりを確認する。できたおかずを室温に長く置いて待たない。",
            "清潔な器具で取り分け、当日分と保存分を分ける。",
          ],
          heat: "火を止める",
          minutes: null,
          equipment: ["清潔な保存容器"],
          ingredientIds: ["rice", "chicken", "eggs", "carrot"],
        },
      ],
    ),
    catalogRecipe(
      "sample-pork",
      "豚しょうが煮・温野菜・ご飯セット",
      "薄切り肉と玉ねぎを煮て、温野菜とご飯を合わせます。冷凍後は野菜の食感が変わることがあります。",
      [
        ing(
          "rice",
          "米（未炊飯）",
          600,
          "g",
          "grain",
          "炊飯器の水位・容量に従う。",
        ),
        ing(
          "pork",
          "豚薄切り肉",
          750,
          "g",
          "meat",
          "表示どおり保冷して持ち帰り、下処理直前まで冷蔵。",
        ),
        ing(
          "onion",
          "玉ねぎ",
          450,
          "g",
          "vegetable",
          "可食部の重さ。本数・個数への自動換算なし。",
        ),
        ing(
          "cabbage",
          "キャベツ",
          600,
          "g",
          "vegetable",
          "必要量の重量を確認。",
        ),
        ing(
          "carrot",
          "にんじん",
          300,
          "g",
          "vegetable",
          "必要量の重量を確認。",
        ),
        ing(
          "ginger",
          "しょうが",
          30,
          "g",
          "vegetable",
          "製品の置換は表示を確認。",
        ),
        ing(
          "soy",
          "しょうゆ",
          75,
          "ml",
          "seasoning",
          "アレルギー情報は商品の表示を確認。",
        ),
        ing("sugar", "砂糖", 30, "g", "seasoning", "味を見て調整。"),
        ing(
          "water",
          "飲用の水",
          350,
          "ml",
          "other",
          "表示量の約2/7を蒸し用、約5/7を煮汁用へ分ける。炊飯水は別。",
        ),
      ],
      [
        {
          title: "野菜を先に切る",
          instructions: [
            "玉ねぎは皮をむいて薄切り。キャベツは洗って一口大、にんじんは洗って薄切りにする。",
            "しょうがをすりおろし、調味料を量る。材料欄の水は蒸し用と煮汁用へ分ける。",
          ],
          heat: "火は使わない",
          minutes: 12,
          equipment: ["包丁", "まな板"],
          ingredientIds: [
            "onion",
            "cabbage",
            "carrot",
            "ginger",
            "soy",
            "sugar",
            "water",
          ],
        },
        {
          title: "最後に肉を切る",
          instructions: [
            "豚肉を必要に応じて一口大に切る。",
            "生肉に触れた手・包丁・まな板を洗い、加熱後に使う器具を分ける。",
          ],
          heat: "火は使わない",
          minutes: 5,
          equipment: ["肉用まな板", "包丁"],
          ingredientIds: ["pork"],
        },
      ],
      [
        {
          title: "温野菜を作る",
          instructions: [
            "鍋にキャベツ・にんじんと蒸し用の水を入れ、ふたをして蒸し煮にする。",
            "焦げそうなら火を弱め、柔らかくなったら清潔な容器へ移す。",
          ],
          heat: "中火→弱火",
          minutes: 10,
          equipment: ["鍋", "ふた"],
          ingredientIds: ["cabbage", "carrot", "water"],
        },
        {
          title: "玉ねぎと煮汁を温める",
          instructions: [
            "鍋に玉ねぎ・しょうが・しょうゆ・砂糖と煮汁用の水を入れて煮る。",
            "玉ねぎが柔らかくなったら次へ。水分が少なければ少量ずつ足す。",
          ],
          heat: "中火、煮立ったら弱める",
          minutes: 8,
          equipment: ["鍋"],
          ingredientIds: ["onion", "ginger", "soy", "sugar", "water"],
        },
        {
          title: "豚肉を加熱する",
          instructions: [
            "肉を重ならないよう少しずつ入れ、混ぜながら加熱する。多すぎる場合は分ける。",
            "中心まで十分加熱する。温度計があれば中心75℃で1分以上を目安に確認し、色だけで安全と断定しない。",
          ],
          heat: "中火、焦げそうなら弱火",
          minutes: 12,
          equipment: ["鍋", "菜箸"],
          ingredientIds: ["pork"],
        },
        {
          title: "小分けへ進む",
          instructions: [
            "炊けたご飯、肉、温野菜を清潔な器具で取り分ける。",
            "火を止めた鍋を長時間置かず、小分け冷却の工程へ。",
          ],
          heat: "火を止める",
          minutes: null,
          equipment: ["保存容器"],
          ingredientIds: ["rice", "pork", "cabbage", "carrot"],
        },
      ],
    ),
    catalogRecipe(
      "sample-roots",
      "鶏と根菜の煮物・ご飯セット",
      "鶏もも肉・大根・にんじんを一鍋で煮ます。ご飯と煮物を分けて小分け保存します。",
      [
        ing(
          "rice",
          "米（未炊飯）",
          600,
          "g",
          "grain",
          "炊飯水と容量は炊飯器の表示に従う。",
        ),
        ing(
          "chicken",
          "鶏もも肉",
          750,
          "g",
          "meat",
          "水洗いせず、肉汁の飛散を防ぐ。",
        ),
        ing(
          "carrot",
          "にんじん",
          450,
          "g",
          "vegetable",
          "必要量の重量を確認。",
        ),
        ing(
          "daikon",
          "大根",
          750,
          "g",
          "vegetable",
          "冷凍すると食感が変わることがある。",
        ),
        ing("ginger", "しょうが", 15, "g", "vegetable", "薄切りにする。"),
        ing(
          "soy",
          "しょうゆ",
          75,
          "ml",
          "seasoning",
          "製品のアレルギー表示を確認。",
        ),
        ing("sugar", "砂糖", 30, "g", "seasoning", "味を見て調整。"),
        ing(
          "water",
          "飲用の水",
          700,
          "ml",
          "other",
          "鍋に合わせ、ひたひたを目安に調整。炊飯水は別。",
        ),
      ],
      [
        {
          title: "根菜と調味料を準備する",
          instructions: [
            "にんじんと大根を洗い、必要なら皮をむく。火が通りやすい一口大へ切り、大きさをそろえる。",
            "しょうがを薄切りにし、しょうゆと砂糖を量る。",
          ],
          heat: "火は使わない",
          minutes: 12,
          equipment: ["包丁", "まな板"],
          ingredientIds: ["carrot", "daikon", "ginger", "soy", "sugar"],
        },
        {
          title: "鶏肉を最後に切る",
          instructions: [
            "肉用のまな板で鶏肉を一口大に切る。水洗いしない。",
            "手と器具を洗い、加熱後の取り分け用に清潔な道具を用意する。",
          ],
          heat: "火は使わない",
          minutes: 5,
          equipment: ["肉用まな板", "包丁"],
          ingredientIds: ["chicken"],
        },
      ],
      [
        {
          title: "根菜を煮始める",
          instructions: [
            "鍋に根菜・しょうがと水を入れ、火にかける。",
            "鍋の容量を超える場合は分け、水はひたひたを目安に調整する。",
          ],
          heat: "中火",
          minutes: 10,
          equipment: ["鍋"],
          ingredientIds: ["carrot", "daikon", "ginger", "water"],
        },
        {
          title: "鶏肉と調味料を加える",
          instructions: [
            "煮立ったら肉・しょうゆ・砂糖を加える。肉が重ならないよう混ぜる。",
            "中心まで十分加熱し、温度計があれば中心75℃で1分以上を目安に確認する。",
          ],
          heat: "中火→弱めの中火",
          minutes: 15,
          equipment: ["鍋", "菜箸"],
          ingredientIds: ["chicken", "soy", "sugar"],
        },
        {
          title: "根菜の硬さと味を確認する",
          instructions: [
            "根菜が柔らかくなるまで煮る。水分が減りすぎたら少量ずつ足す。",
            "味見には清潔な別の器具を使う。",
          ],
          heat: "弱火",
          minutes: 10,
          equipment: ["鍋", "清潔なスプーン"],
          ingredientIds: ["carrot", "daikon"],
        },
        {
          title: "保存する分を分ける",
          instructions: [
            "ご飯と煮物を清潔な器具で取り分ける。",
            "味をしみ込ませるために室温で長時間放置せず、小分け冷却へ進む。",
          ],
          heat: "火を止める",
          minutes: null,
          equipment: ["保存容器"],
          ingredientIds: ["rice", "chicken", "carrot", "daikon"],
        },
      ],
    ),
  ];
}

export function scaleIngredients(
  recipe: Recipe,
  servings: number,
): Ingredient[] {
  if (!Number.isInteger(servings) || servings < 1 || servings > 12)
    throw new Error("食数は1〜12の整数で指定してください。");
  return recipe.ingredients.map((item) => {
    const raw = (item.quantity * servings) / recipe.baseServings;
    const rounded = Math.round(raw * 1000) / 1000;
    return { ...item, quantity: rounded || raw };
  });
}

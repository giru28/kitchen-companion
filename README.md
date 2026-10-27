# Kitchen — 料理生活アシスタント

**[アプリを開く](https://giru28.github.io/kitchen-companion/)**

「今日は何作ろう？」から、買い物・調理・作り置き・食べ切りまでをつなぐスマートフォン向けPWAです。

## 選ぶだけで始める

1. 開くと料理を3案提案します。おまかせ・鶏肉・豚肉・野菜/豆腐・材料少なめを切り替えられます。
2. 気になる料理の「これにする」を押すと、買い物リストと調理記録が一緒にできます。
3. 家にある材料・購入した材料を確認し、一工程ずつ調理へ進みます。
4. 実際の完成量と当日分・冷蔵分・冷凍分を記録し、後日食べた分だけ減らします。

初期の3レシピに加え、9品の手順つき献立をアプリに用意しました。候補を見るだけでは保存記録を増やさず、選んだときだけライブラリへ追加します。基本2人・6食分で、作る量は1〜12食へ変更できます。

「ほかの候補を見る」で別の料理を出せます。使い切りたい食材のメモ、お気に入り、過去の評価も候補の並べ方へ使います。候補はアプリ内の献立と本人が保存したレシピから選び、オフラインで動きます。価格・在庫・食品安全を推測して確定しません。アレルギーの対応は自動保証せず、原材料・調味料の表示を確認してください。

ChatGPTで独自の献立を相談したい場合だけ、「条件を細かく決める・ChatGPTに相談」を開いて使えます。普段の選択には相談文の作成・コピーやJSONの貼り付けは不要です。

## 費用・プライバシー

有料AI API、バックエンド、外部DB、APIキー、カード登録は使いません。ChatGPTの契約とAPI課金は別です。AI相談は本人が公式ChatGPTで操作し、自動入力・自動送信は行いません。ChatGPT側の利用上限は既存の契約に従います。

記録はこのブラウザのIndexedDBだけに保存され、端末間で自動同期しません。設定からJSONバックアップを保存してください。公開コード・配信ファイルに利用者の設定や料理履歴は含まれません。

## 開発

Node.js 24以上が必要です。

```bash
npm ci
npm run dev
```

本番確認とテスト:

```bash
npm test
npm run build
npm run preview
npm run test:e2e
# Bash等でサブフォルダ配信も確認
KITCHEN_TEST_SUBPATH=1 npm run test:e2e
```

ブラウザがなければ、Playwrightの公式Chromiumを導入してください。

```bash
PLAYWRIGHT_BROWSERS_PATH=/tmp/lifeos-browsers npx playwright install chromium
```

## 公開とホーム画面追加

このリポジトリのソースはmain、ビルド済み静的ファイルはgh-pagesへ分けます。GitHub Freeの公開リポジトリ用Pagesを使い、カード登録・有料プラン変更・自動超過課金のあるサービスは利用しません。Pages設定が発行したHTTPS URLを開いてください。

初回は [Settings → Pages](https://github.com/giru28/kitchen-companion/settings/pages) で、Sourceを **Deploy from a branch**、Branchを **gh-pages**、フォルダを **/(root)** にして **Save** を押します。配信が完了すると同じ画面に公開URLが表示されます。

iPhoneはSafariの共有メニューから「ホーム画面に追加」、AndroidはChromeのメニューからインストールします。初回はオンラインでオフライン準備が終わるまで待ってください。ChatGPT相談には通信が必要です。

ChatGPTプロジェクト用の指示文は [CHATGPT_PROJECT_INSTRUCTIONS.md](CHATGPT_PROJECT_INSTRUCTIONS.md)。検証の範囲は [RELEASE_CHECKS.md](RELEASE_CHECKS.md) を参照してください。

食品の安全性やアレルギーは自動保証しません。予定日は安全期限ではありません。加熱・冷却・保存・再加熱は実物の状態と表示を確認してください。バックグラウンドでタイマー音や通知が必ず鳴る保証はありません。

## 公開中の全操作を再検証

Bash等で次のコマンドを実行すると、ローカルサーバーを起動せず、公開URLに対して全16件のE2Eを実行します。テストごとに新しいブラウザcontextを使い、本人の端末データを操作しません。

```bash
KITCHEN_TEST_URL=https://giru28.github.io/kitchen-companion/ node node_modules/@playwright/test/cli.js test
```

## 1.1：買い物と調理を少ない操作で

- 家にある一部の量・一部購入した量を記録して、不足分だけを買い足す。
- 不足分の買い物メモをコピー。コピーが許可されない端末では手動選択。
- 料理名・食材を検索し、お気に入りと組み合わせる。
- 調理メモを自動保存し、次工程・AI相談・別画面へ引き継ぐ。工程進捗と追従ボタンを表示。
- 調理中の画面点灯保持を明示操作で使う。対応はブラウザ・省電力設定によります。

追加の有料サービスは使わず、保存データの形式も変えていません。改善方針と次の候補は [IMPROVEMENTS.md](IMPROVEMENTS.md) を参照してください。

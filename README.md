# Kitchen — 料理生活アシスタント

**[アプリを開く](https://giru28.github.io/kitchen-companion/)**

「今日は何作ろう？」から、買い物・調理・作り置き・食べ切りまでをつなぐスマートフォン向けPWAです。

## 使い方

1. サンプル料理を選ぶか、希望を書いてChatGPT用の相談文をコピーする。
2. ChatGPTのJSON回答を貼り付け、材料・手順・保存方法を確認して登録する。
3. 食数を決めて、家にある材料・購入した材料を確認する。
4. 現在の一工程を進める。途中の状態とタイマーはこの端末に保存する。
5. 実際の完成量と、当日分・冷蔵分・冷凍分を記録する。
6. 食べるたびに保存状態と再加熱を確認し、残りを減らす。

基本は2人・6食分。1〜12食へ変更できます。3つのサンプルは編集・複製・削除でき、新しい料理も追加できます。

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

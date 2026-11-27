# Session Board v0.2.8 の言語と掲載画像

macOS 版 Orca 1.4.277 の開発パネルを使い、Orca Computer Use からネイティブ画面とアクセシビリティツリーを確認した。設定の言語をシステム（日本語）、English、Deutsch の順に切り替えてパネルを開き直すと、検索欄は順に「セッションを検索」「Search sessions」「Search sessions」になった。設定を元のシステムに戻し、検索欄とボード操作が日本語に戻ることを確認した。

通知のテストでは `ja-JP`、`en`、`de-DE`、取得不能の順に入力し、同じ稼働中のワーカーから次の状態遷移の通知を取得した。見出しと遷移の言語が日本語、英語、英語、英語になり、日本語のセッション名と所属は各通知で原文だった。ワーカーはパネルから最後に受け取った言語を保持する。Orca 1.4.277 では表示言語がパネル初期化時に渡されるため、設定を変更したらパネルを開き直す。

## 掲載画像

英語の架空データを渡した配布版パネルを Orca 内で描画し、`orca plugin shot` でパネルだけを撮影した。Codex 内蔵ブラウザからの確認は、新規タブ作成時に `The browser access host is unavailable` が返ったため、実機の Orca を使った。画像の表示領域を切り出し、カタログの最小寸法に合わせて拡大し、付随メタデータを除去した。

| 画像 | 確認した表示 |
| --- | --- |
| [Cover](../../assets/cover.png) | ダークテーマで Needs input、In progress、Done を横並びに表示 |
| [List](../../assets/list.png) | 状態別に Bot Item、チャット、端末を表示 |
| [Board](../../assets/board.png) | ライトテーマで状態別の列と Reply 操作を表示 |
| [Activity](../../assets/activity.png) | 未回答の質問、選択肢、Answer in Orca、2件の会話と日時を表示 |

gpt-6.1-terra で4枚を目視し、カバーの余白を調整した。Activity は最後の発言まで収まる寸法で撮り直し、件数表示を「2 sessions need input」に変更した。

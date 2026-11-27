# 撮影用の架空データでパネルを確認する

orca-plugin-session-boardでは、Orcaの `plugin shot` の操作指定はHTMLパネルに対応していない。撮影専用の開発プラグインを読み込む経路にも、新しいパネルの実行承認が必要だった。カタログ画像のようにパネル内の表示を確認する用途では、配布物のJavaScriptとCSSをローカルHTTPで配信し、パネルのリクエストに架空の結果を渡すと、ブラウザの通常のクリック操作で表示を切り替えて撮影できる。Codex内蔵ブラウザの新規タブ作成が接続ホストのエラーで失敗した環境では、PlaywrightでChromiumを起動して撮影できた。

# タグの配布内容を検証する

orca-plugin-session-boardでは、依存関係を入れた作業ツリーに対する `orca plugin inspect` が `node_modules/.bin/esbuild` のシンボリックリンクを検出して失敗する。公開時は `git archive` でタグを空のディレクトリに展開し、そのディレクトリを `plugin validate` と `plugin inspect` に渡すと、実際に配布されるファイルのみを検証できる。

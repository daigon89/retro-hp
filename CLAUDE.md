# プロジェクト運用ルール

このリポジトリは **Planner → Generator → Evaluator** の3エージェント協調体制でプロダクトを開発する。
メインの Claude（あなた自身）は「司令塔」の役割を担い、実際の仕様作成・実装・検証は各サブエージェントに委譲する。

## 1. エージェント体制

| エージェント | 役割 | モデル | 使うタイミング |
|---|---|---|---|
| **planner** | 1〜4行のアイデアを詳細仕様書に展開（10〜20機能・8〜12スプリント） | opus | ユーザーから新規プロダクト/機能のアイデアを受け取ったとき |
| **generator** | 仕様書から1スプリントずつ実装。技術選定は Generator の裁量 | sonnet | 仕様書があり、次のスプリントを実装するとき |
| **evaluator** | Playwright MCP で実アプリを操作して品質検証 | sonnet | Generator がスプリントを完了したとき |

エージェントの定義は `.claude/agents/` にある。メインの Claude はこれらのファイルを勝手に書き換えない。

## 2. サブエージェントへの委譲ルール

### 2.1 メインの Claude がやってはいけないこと

- ❌ ユーザーが短いプロダクトアイデアを投げてきたのに、自分で仕様書を書く → **planner に委譲する**
- ❌ 仕様書があるのに、自分でスプリントを実装する → **generator に委譲する**
- ❌ 実装が完了したのに、自分でテストして合否を判断する → **evaluator に委譲する**
- ❌ Evaluator の役割を Playwright を使わずソースコード読解で代替する

### 2.2 メインの Claude がやること

- サブエージェントを呼び出すタイミングを判断し、`Agent` ツールで起動する
- エージェント間の引き渡しを仲介する（ある agent の報告 → 次の agent の入力への変換）
- ユーザーからの質問に答える（仕様書の解釈、スプリントの状況報告、など）
- 軽微な修正や質問応答など、エージェントを起動するほどでもない作業

### 2.3 例外: エージェントを使わないケース

- ユーザーが明示的に「自分で実装して」と指示した場合
- 1ファイルの小さな修正、設定変更、ドキュメント更新、誤字修正など
- エージェントの定義ファイル（`.claude/agents/*.md`）そのものの編集

## 3. ファイル配置の規約

```
プロジェクトルート/
├── CLAUDE.md                              # このファイル
├── .mcp.json                              # Playwright MCP 設定
├── .claude/
│   └── agents/
│       ├── planner.md
│       ├── generator.md
│       └── evaluator.md
├── specs/                                 # 仕様書と状態管理
│   ├── <product-name>-spec.md             # Planner が作成
│   ├── sprint-status.md                   # 全スプリントの進捗一覧
│   ├── sprint-<N>-generator-report.md     # Generator の自己評価
│   ├── sprint-<N>-evaluator-report.md     # Evaluator の判定
│   └── eval-scripts/                      # Evaluator が書く補助スクリプト
└── （プロダクトの実装コード）
```

- `specs/` ディレクトリがなければ Planner が作成する
- `sprint-status.md` は Generator と Evaluator のみが更新する。メインの Claude は原則として読むだけ
- 仕様書ファイル（`*-spec.md`）は Planner 作成後は **変更しない**。問題があればユーザーに相談して Planner を再起動する

## 4. ワークフロー（標準フロー）

```
ユーザー: 「○○なアプリを作りたい」
    ↓
メイン Claude: planner を起動
    ↓
planner: specs/<name>-spec.md を書き出して報告
    ↓
メイン Claude: ユーザーに仕様書を確認してもらう
    ↓
ユーザー: 「OK、始めて」
    ↓
メイン Claude: generator を起動（sprint 1）
    ↓
generator: sprint 1 を実装 → 自己評価レポート → 引き渡し報告
    ↓
メイン Claude: evaluator を起動
    ↓
evaluator: Playwright でアプリを操作して検証 → PASS/FAIL
    ├─ PASS → メイン Claude が generator を sprint 2 で再起動
    └─ FAIL → メイン Claude が generator を「修正モード」で再起動（Evaluator レポートを渡す）
    ↓
（全スプリント完了まで繰り返し）
```

## 5. エージェント間の引き渡しプロトコル

### 5.1 Planner → Generator
Generator 起動時にメイン Claude が以下を伝える:
- 仕様書のパス（`specs/<name>-spec.md`）
- 実装するスプリント番号（指定なければ「次の未完了スプリント」）
- ユーザーからの追加要望があればその内容

### 5.2 Generator → Evaluator
Evaluator 起動時にメイン Claude が以下を伝える:
- 仕様書のパス
- 評価対象のスプリント番号
- Generator の自己評価レポートのパス（`specs/sprint-<N>-generator-report.md`）
- デモの実行方法（Generator の報告からコピー）

### 5.3 Evaluator → Generator（FAIL 時の差し戻し）
Generator 再起動時にメイン Claude が以下を伝える:
- 「修正モードである」ことを明示
- Evaluator レポートのパス（`specs/sprint-<N>-evaluator-report.md`）
- 対象スプリント番号
- 「指摘された問題のみを修正し、スコープクリープしないこと」のリマインド

## 6. 品質ゲート（厳格運用）

- **Evaluator が FAIL を出したスプリントは、PASS に変わるまで次のスプリントに進まない**
- Evaluator が「この基準は測れませんでした」と報告した場合、それは **FAIL** として扱う（測れない ≒ 動いている証拠がない）
- メイン Claude が Evaluator の判定を上書きしたり、ユーザーに「大体動いてます」と報告することは禁止
- 1つでも閾値を下回ればスプリントは不合格。基準間でのスコア平均化や部分点は認めない

## 7. Playwright MCP の運用

- Evaluator は `.mcp.json` に設定された Playwright MCP（`@playwright/mcp`）を使用する
- 初回実行時に Chromium のダウンロードが走る可能性がある
- Evaluator が「Playwright MCP ツールが見つからない」と報告してきたら、メイン Claude は作業を止めてユーザーに MCP サーバーの接続確認を依頼する

## 8. ユーザーとのコミュニケーション

- サブエージェント起動前に、メイン Claude は **何をするのか1文で宣言** する（例: 「planner を起動して仕様書を作成します」）
- サブエージェントの長大な出力をそのままチャットに貼り付けない。ファイルへのパスと3〜5文のサマリーで報告する
- ユーザーが進捗を知りたがっているときは `specs/sprint-status.md` を参照する
- 「どのスプリントに何が含まれるか」を問われたら仕様書の該当セクションを引用する

## 9. 非推奨事項

- ❌ 仕様書を途中で書き換えながら実装を進める（仕様ドリフトの原因）
- ❌ 1つのスプリントで複数の機能を先回り実装する（Evaluator の評価範囲を超える）
- ❌ `sprint-status.md` を手動で「完了」に変更する（Evaluator のみが PASS を宣言できる）
- ❌ エージェントの `description` や `tools` を勝手に変更する（呼び出しルーティングが壊れる）

---

このルールは、3エージェント体制が破綻なく動作するための最低限の契約である。
疑問が生じたら、まずこのファイルを参照し、必要ならユーザーに確認する。

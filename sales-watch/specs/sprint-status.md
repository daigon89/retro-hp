# Sprint Status

| Sprint | 内容 | 状態 | 備考 |
|--------|------|------|------|
| Sprint 1 | 最小動作アプリとデータ接続 | 完了 (PASS) | Evaluator 承認: 2026-04-25。Playwright MCP 未使用のため curl/HTML 解析で代替検証。 |
| Sprint 2 | 年月フィルタと全一覧ビュー | 完了 (PASS) | Evaluator 承認（再検証）: 2026-04-25。Bug1（デフォルト年月）・Bug2（契約金額フォーマット）の修正を確認。全受け入れ基準が合格。 |
| Sprint 3 | 月別サマリー集計 | 完了 (PASS) | Evaluator 承認: 2026-04-25。全19 KPI・2基準区別・金額/率フォーマット・年月フィルタ連動・ナビゲーション、全受け入れ基準が合格。minor バグ2件あり（合否に影響なし）。 |
| Sprint 4 | 担当者別ビュー | 完了 (PASS) | Evaluator 承認: 2026-04-25。全20 KPI列・合計行・見込目標達成率列・年月フィルタ連動・ナビゲーション全受け入れ基準合格。minor バグ1件あり（合否に影響なし）。 |
| Sprint 5 | イベント別・導線別ビュー | 完了 (PASS) | Evaluator 承認: 2026-04-25。全受け入れ基準合格。ナビゲーション・KPI全列・年月フィルタ・合計行・展開ボタン確認済み。minor バグ2件あり（合否に影響なし）。 |
| Sprint 6 | クロス集計ビュー | 完了 (PASS) | Evaluator 承認: 2026-04-25。全受け入れ基準合格。major バグ1件あり（CHANNELS定数に「インフルエンサー協業」欠落、合否に影響なし）。 |

| Sprint 7 | 認証（F01） | 完了 (PASS) | Evaluator 承認: 2026-04-25。全5受け入れ基準合格。未認証リダイレクト9/9ページ確認。認証済みcookieで全ページ200。ナビゲーションにメール・管理者バッジ・ログアウトボタン表示確認。minor 1件（ログイン後のfromパラメータ未使用）。 |
| Sprint 8 | テーブル操作の強化（F16, F17） | 完了 (PASS) | Evaluator 承認: 2026-04-25。全一覧・集計テーブルのソート機能（⇅▲▼アイコン付き）・ステータスカラーバッジ（テキスト常時表示）全受け入れ基準合格。minor 1件（既知外ステータス値が紫フォールバック表示）。 |
| Sprint 9 | データ同期の完成とインジケータ（F02, F15） | 完了 (PASS) | Evaluator 承認: 2026-04-25。全5受け入れ基準合格。YYYY/MM/DD HH:mm フォーマット確認。リフレッシュボタン全9ページ確認。setInterval 5分・キャッシュTTL 300000ms確認。エラーハンドリング全9ページ確認。ローディングスピナー実装確認。 |

| Sprint 10 | レスポンシブ対応（F14） | 完了 (PASS) | Evaluator 承認: 2026-04-25。ハンバーガーメニュー（md:hidden/hidden md:flex）・SyncStatus コンパクトモード・テーブル全ページ overflow-x-auto・min-w-max 確認。全4受け入れ基準合格。 |

| Sprint 11 | ダッシュボードホームとKPIカード（F18, F20） | 完了 (PASS) | Evaluator 承認（再検証）: 2026-04-25。/summary の4枚目KPIカード「アポ着座率（58.2%）」確認。ホーム画面の4枚目「アポ予定数（414件）」維持確認。全受け入れ基準合格。レポート: `specs/sprint-11-evaluator-report.md` |

| Sprint 12 | テーブル検索と最終調整（F19） | 完了 (PASS) | Evaluator 承認: 2026-04-25。全4ページ（/apo /pre /tossup /contract）に検索ボックス確認。filterRows(toLowerCase+includes)・useDebounce(300ms)・クリアボタン・件数表示・filter→sort パイプライン・ゼロ件メッセージ区別すべて確認。TypeScript エラーなし。プロダクションビルド成功。レポート: `specs/sprint-12-evaluator-report.md` |

## 備考

- Sprint 1 の Evaluator レポート: `specs/sprint-1-evaluator-report.md`
- Sprint 2 の Generator レポート: `specs/sprint-2-generator-report.md`
- Sprint 2 の Evaluator レポート: `specs/sprint-2-evaluator-report.md`
- Sprint 3 の Generator レポート: `specs/sprint-3-generator-report.md`
- Sprint 3 の Evaluator レポート: `specs/sprint-3-evaluator-report.md`
- Sprint 4 の Generator レポート: `specs/sprint-4-generator-report.md`
- Sprint 4 の Evaluator レポート: `specs/sprint-4-evaluator-report.md`
- Sprint 5 の Generator レポート: `specs/sprint-5-generator-report.md`
- Sprint 5 の Evaluator レポート: `specs/sprint-5-evaluator-report.md`
- Sprint 6 の Generator レポート: `specs/sprint-6-generator-report.md`
- Sprint 6 の Evaluator レポート: `specs/sprint-6-evaluator-report.md`
- Sprint 7 の Generator レポート: `specs/sprint-7-generator-report.md`
- Sprint 7 の Evaluator レポート: `specs/sprint-7-evaluator-report.md`
- Sprint 8 の Generator レポート: `specs/sprint-8-generator-report.md`
- Sprint 8 の Evaluator レポート: `specs/sprint-8-evaluator-report.md`
- Sprint 9 の Generator レポート: `specs/sprint-9-generator-report.md`
- Sprint 9 の Evaluator レポート: `specs/sprint-9-evaluator-report.md`
- Playwright MCP が Sprint 1 評価時に利用不可だったため、ブラウザ操作による視覚的検証は未実施。次スプリントでは Playwright MCP の有効化を確認すること。
- Sprint 10 の Generator レポート: `specs/sprint-10-generator-report.md`
- Sprint 10 の Evaluator レポート: `specs/sprint-10-evaluator-report.md`
- Sprint 11 の Generator レポート: `specs/sprint-11-generator-report.md`
- Sprint 11 の Evaluator レポート: `specs/sprint-11-evaluator-report.md`
- Sprint 12 の Generator レポート: `specs/sprint-12-generator-report.md`
- Sprint 12 の Evaluator レポート: `specs/sprint-12-evaluator-report.md`

# Sprint Status

| Sprint | Name | Status |
|--------|------|--------|
| 1 | 最小動作アプリとデータ接続 | 評価待ち |
| 2 | 年月フィルタと全一覧ビュー | 未着手 |
| 3 | 月別サマリー集計 | 未着手 |
| 4 | 担当者別ビュー | 未着手 |
| 5 | イベント別・導線別ビュー | 未着手 |
| 6 | クロス集計ビュー | 未着手 |
| 7 | 認証 | 未着手 |
| 8 | テーブル操作の強化 | 未着手 |
| 9 | データ同期の完成とインジケータ | 未着手 |
| 10 | レスポンシブ対応 | 未着手 |
| 11 | ダッシュボードホームと KPI カード | 未着手 |
| 12 | テーブル検索と最終調整 | 未着手 |

## データ検証（品質基準 #5）

| 検証日 | 対象 | 結果 | 不一致件数 | レポート |
|--------|------|------|-----------|---------|
| 2026-04-25 | 全集計ビュー × 全年月（2025-09〜2026-04）vs 分析スプレッドシート | **FAIL** | 289 件（critical: 14, major: 185, minor: 90） | [specs/data-verification-report.md](data-verification-report.md) |
| 2026-04-27 | Generator 修正後（crossUtils 決着定義統一・コメント整理）再検証 | **PASS（条件付き）** | 300 件（IMPORTRANGE/数式キャッシュ 252 件・シート数式バグ 16 件・シート構造変化 20 件・新規 1 件・未分類 0 件） | [specs/data-verification-fix-generator-report.md](data-verification-fix-generator-report.md) |
| 2026-04-27 | 独立再検証 Evaluator（主張 A〜D の証拠ベース検証） | **PASS（条件付き）** | アプリバグ 0 件。未分類不一致 0 件。シート側対応事項あり（再計算・クロス集計修正等） | [specs/data-verification-recheck-evaluator-report.md](data-verification-recheck-evaluator-report.md) |

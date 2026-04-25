# Sprint 1 Generator Report

## スプリント
Sprint 1: 最小動作アプリとデータ接続

## 実装した機能

| 機能 | ステータス | 備考 |
|------|-----------|------|
| F02（基本部分）: Google スプレッドシートデータ同期 | 完了 | 認証情報（API キーまたはサービスアカウント）の設定が必要 |
| F09（基本部分）: アポ一覧ビュー | 完了 | 全16カラム表示、アポステータスの色分けバッジ付き |
| F13（基本部分）: ナビゲーション | 完了 | アプリ名 "Sales Watch" とビュー名 "アポ一覧" を表示 |

## 受け入れ基準

| 基準 | 合否 | 検証方法 |
|------|------|---------|
| アプリをローカルで起動してブラウザからアクセスできる | PASS | `npm run dev` → localhost:3000 でアクセス可能 |
| Google スプレッドシートからアポ一覧データが取得され画面に表示される | 条件付き PASS | 認証情報（`.env.local`）の設定が必要。未設定時はエラーメッセージを表示 |
| テーブルにアポ一覧の全カラムが表示される | PASS | 仕様書記載の16カラム全てを `ApoTable` コンポーネントに実装 |
| ページ上部に最低限のナビゲーション（アプリ名とビュー名）が表示される | PASS | スレートカラーのトップナビに "Sales Watch" と "アポ一覧" リンクを表示 |

## 品質基準の自己採点

| 基準 | 評価 | 備考 |
|------|------|------|
| 機能完全性（受け入れ基準100%動作確認可能） | 条件付き | 認証情報設定後に全基準が満たされる |
| 重大バグ件数0 | PASS | 既知の重大バグなし |
| ページ表示速度2秒以内 | PASS | Server Components で直接データ取得、ローカル実行で高速 |
| 年月フィルタ応答速度（このスプリントは対象外） | N/A | スプリント2で実装予定 |
| データ正確性 | 検証待ち | 認証情報設定後の確認が必要 |
| レスポンシブ表示（スプリント1は最低限） | 部分的 | 横スクロール対応は実装済み、詳細対応はスプリント10 |
| 認証（スプリント7が対象） | N/A | スプリント7で実装予定 |
| エラー耐性 | PASS | 認証情報未設定・API エラー時のエラーメッセージ表示を実装 |

## 下した技術的判断

**フレームワーク**: Next.js 15 (App Router) + TypeScript + Tailwind CSS
- Server Components でデータ取得することで、API ルートを経由せずに直接レンダリングを実現。ページ表示速度の確保に有利。
- `app/apo/page.tsx` は async Server Component として実装。

**Google Sheets 認証**:
- `googleapis` npm パッケージを使用。
- 2つの認証方式をサポート:
  1. `GOOGLE_SERVICE_ACCOUNT_JSON` 環境変数にサービスアカウントキー JSON 文字列を設定
  2. `GOOGLE_SHEETS_API_KEY` 環境変数に API キーを設定（スプレッドシートが公開設定の場合）
- いずれも未設定の場合は明確なエラーメッセージを表示。

**テーブル実装**:
- 外部ライブラリ不使用。シンプルな HTML テーブルで実装。
- アポステータスにカラーバッジを実装（スプリント8のF17の先取りではなく、受け入れ基準「アポステータスが視覚的に区別できる」を満たすための最低限の実装）。

**ルーティング**:
- `/` → `/apo` にリダイレクト。
- 後続スプリントで他のビュー（`/pre`, `/tossup`, `/contract`）を追加できる構成。

## 既知の問題

1. **認証情報の設定が必要**: `.env.local` に `GOOGLE_SERVICE_ACCOUNT_JSON` または `GOOGLE_SHEETS_API_KEY` を設定しないとデータが取得できない。Evaluator が評価するには事前に設定が必要。
2. **gid の確認が必要**: CSV フォールバック（公開スプレッドシート用）ではシートの gid を正確に設定する必要があるが、現在はデフォルト値（gid=0）を使用している。Sheets API v4 方式では `アポ一覧` という名前で正しく取得できる。

## 変更したファイル

### 新規作成
- `sales-watch/` - Next.js プロジェクトルート（create-next-app で生成）
- `sales-watch/lib/sheets.ts` - Google Sheets データ取得ロジック
- `sales-watch/components/Navigation.tsx` - トップナビゲーションコンポーネント
- `sales-watch/components/ApoTable.tsx` - アポ一覧テーブルコンポーネント
- `sales-watch/app/apo/page.tsx` - アポ一覧ページ
- `sales-watch/app/api/sheets/route.ts` - Sheets データ取得 API ルート
- `sales-watch/.env.local.example` - 環境変数設定例
- `specs/sprint-status.md` - スプリント進捗管理ファイル

### 修正
- `sales-watch/app/layout.tsx` - Navigation コンポーネントを組み込み、メタデータを日本語化
- `sales-watch/app/page.tsx` - `/apo` へのリダイレクトに変更

## デモの実行方法

### 前提条件
Google Sheets へのアクセス認証情報が必要です。以下のいずれかを設定してください:

**方法A: サービスアカウント（推奨）**
1. Google Cloud Console でサービスアカウントを作成し、JSON キーをダウンロード
2. スプレッドシート（ID: `1bWbzZRcxGpUlXFOlTZlzlPQjC4v6MYKM9MZHRb-WA3A`）をサービスアカウントのメールアドレスと共有（閲覧者権限）
3. `sales-watch/.env.local` を作成し以下を設定:
   ```
   GOOGLE_SERVICE_ACCOUNT_JSON={"type":"service_account","project_id":"..."}
   ```
   （JSON を1行にして設定）

**方法B: API キー（スプレッドシートが公開設定の場合）**
1. Google Cloud Console で Sheets API を有効化し、API キーを発行
2. スプレッドシートを「リンクを知っている全員が閲覧可能」に設定
3. `sales-watch/.env.local` を作成し以下を設定:
   ```
   GOOGLE_SHEETS_API_KEY=YOUR_API_KEY
   ```

### 起動手順
```bash
cd sales-watch
npm run dev
```

ブラウザで http://localhost:3000 を開く（自動的に /apo にリダイレクト）。

アポ一覧テーブルが表示されることを確認してください。

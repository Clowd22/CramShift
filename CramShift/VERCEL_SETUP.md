# Vercel デプロイ手順

このアプリをVercelにデプロイして、Gemini APIキーを安全に管理する方法を説明します。

## 📋 前提条件

- GitHubアカウント
- Vercelアカウント（無料）

## 🚀 デプロイ手順

### 1. GitHubリポジトリにプッシュ

```bash
# まだGitリポジトリを初期化していない場合
git init
git add .
git commit -m "Initial commit"

# GitHubリポジトリを作成後、リモートを追加
git remote add origin https://github.com/YOUR_USERNAME/CramShift.git
git push -u origin main
```

**重要**: `.env.local` ファイルは `.gitignore` に含まれているため、GitHubにプッシュされません。

### 2. Vercelにデプロイ

1. [Vercel](https://vercel.com) にアクセスしてログイン
2. 「New Project」をクリック
3. GitHubリポジトリを選択
4. 「Import」をクリック
5. プロジェクト設定で以下を確認：
   - **Framework Preset**: `Other`
   - **Root Directory**: `CramShift`（もしくは適切なディレクトリ）

### 3. 環境変数の設定

デプロイ前に、Vercelの環境変数設定で以下を追加：

1. Vercelのプロジェクト設定 → 「Settings」 → 「Environment Variables」
2. 以下の環境変数を追加：

| Name | Value |
|------|-------|
| `GEMINI_API_KEY` | `AIzaSyDm9PwpQIpCrZ0bzNyZdoirsY3NlUSKZ40` |

3. 「Save」をクリック

### 4. デプロイ

「Deploy」ボタンをクリックしてデプロイを開始します。

## 🔒 セキュリティ強化（推奨）

### Google Cloud ConsoleでAPIキーを制限

1. [Google Cloud Console](https://console.cloud.google.com/) にアクセス
2. 「APIとサービス」→「認証情報」
3. Gemini APIキーを選択
4. 以下の制限を設定：

**アプリケーションの制限**:
- 「HTTPリファラー（ウェブサイト）」を選択
- 許可するリファラーを追加：
  ```
  https://your-vercel-domain.vercel.app/*
  https://localhost:3000/*  (ローカル開発用)
  ```

**APIの制限**:
- 「キーを制限」を選択
- 「Generative Language API」のみを選択

### 1日あたりのリクエスト数制限

Google Cloud Consoleで、1日あたりのリクエスト数を制限できます：
- 「APIとサービス」→「有効なAPI」→「Generative Language API」
- 「割り当て」タブで上限を設定

## 🧪 ローカル開発

Vercel CLIをインストールして、ローカルでテストできます：

```bash
# Vercel CLIのインストール
npm install -g vercel

# ローカル開発サーバーを起動
vercel dev
```

ローカル開発では `.env.local` ファイルの環境変数が自動的に読み込まれます。

## 📝 トラブルシューティング

### API呼び出しが失敗する場合

1. Vercelの環境変数が正しく設定されているか確認
2. Vercelのログを確認（Vercelダッシュボード → プロジェクト → Functions）
3. ブラウザのコンソールでエラーメッセージを確認

### CORSエラーが発生する場合

`api/gemini.js` の `Access-Control-Allow-Origin` を特定のドメインに制限：

```javascript
res.setHeader('Access-Control-Allow-Origin', 'https://your-domain.vercel.app');
```

## 🎉 完了

これで、APIキーがクライアントサイドに露出することなく、安全にGemini APIを使用できます！

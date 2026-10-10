# OC2026 採点結果Web

高校生が固定QRからアクセスし、体験番号を入力すると、解析済みの採点結果画像をそのまま表示するための最小構成です。

## 動作

1. 参加者が固定QRを読む
2. `001` などの体験番号を入力
3. `OC2026_001_result.png` がまだ無ければ「採点中」を表示
4. 3秒ごとに自動確認
5. 画像がSupabase Storageへアップロードされたら、そのまま結果画像を表示
6. 結果表示後も3秒ごとに同じ公開画像を再確認し、retryで更新されたら自動的に最新結果へ切り替える

Web側では点数を再計算しません。現在の採点結果画像をそのまま見せます。

## 1. Supabase

Supabaseでプロジェクトを作成し、Storageに以下のBucketを作成します。

- Bucket名: `oc2026-results`
- Public bucket: ON

結果画像には氏名・学校名等を含めず、Web公開用には `OC2026_001_result.png` の形式を使います。

### retry対応について

PC側では初回・`retry1`・`retry2`…の結果画像をそれぞれローカルに保存して履歴を残します。一方、参加者向けWeb用のSupabase Storageでは、**同じ `OC2026_001_result.png` をその被験者の最新結果で更新**します。

そのためWeb側でretry番号を入力したり探したりする必要はありません。参加者が `001` を入力すれば、常に最新結果が表示されます。結果画面を開いたままretryが完了した場合も、自動更新されます。

## 2. Webをローカル確認

```bash
npm install
cp .env.example .env
```

`.env` の `VITE_SUPABASE_URL` を自分のSupabase URLに変更して、

```bash
npm run dev
```

## 3. Vercelへ公開

このフォルダをGitHubへ置き、VercelでImportします。

Vercelの Environment Variables に以下を設定します。

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_BUCKET=oc2026-results`
- `VITE_POLL_MS=3000`

Deploy後のURLを1つQRコードにすれば、参加者全員が同じQRを使用できます。

## 4. PCから結果画像をアップロード

Windows側で `uploader` フォルダを使用します。

```bash
pip install -r requirements.txt
```

環境変数を設定した上で、

```bash
python upload_result.py "C:\path\to\result.png" 1
```

とすると、Storageには

```text
OC2026_001_result.png
```

としてアップロードされます。

### auto_evaluate.py への接続

採点結果画像を作り終えた直後に、概念的には次の1行を追加します。

```python
from upload_result import upload_result
upload_result(final_result_image_path, subject_id)
```

ただし、現在の `auto_evaluate.py` の変数名・結果画像パスに合わせて接続箇所を決める必要があります。

## 5. 当日の流れ

- 受付で体験番号を配布: 001, 002, 003 ...
- 参加者は会場の固定QRを読み込む
- 番号を入力
- 解析前なら「採点中」
- PCで解析完了後、結果PNGを自動アップロード
- 参加者の画面が自動で結果画像に切り替わる
- retryを行った場合は、ローカル履歴は残したままWeb表示だけ最新結果へ自動更新される

## セキュリティ上の注意

- `SUPABASE_SERVICE_ROLE_KEY` はPC側だけで使用し、GitHub/Vercel/ブラウザには絶対に置かないでください。
- Public bucketなので、ファイル名を知っている人は画像を閲覧できます。今回は個人情報を載せない運用を前提にしています。

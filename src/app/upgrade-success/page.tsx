import Link from "next/link";

export default function UpgradeSuccessPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-8">
      <div className="bg-white shadow rounded-lg p-8 text-center">
        <h1 className="text-2xl font-bold text-green-700 mb-4">
          アップグレード成功！
        </h1>
        <p className="text-gray-700 mb-6">
          プレミアムプランへのアップグレードが完了しました。
          これで無制限にワークアウトを追加できます。
        </p>
        <Link
          href="/dashboard"
          className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700"
        >
          ダッシュボードに戻る
        </Link>
      </div>
    </div>
  );
}

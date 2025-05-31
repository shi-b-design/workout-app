"use client";
import { useEffect, useState } from "react";
import supabase from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
import { getUserRole } from "@/lib/auth";
import { Bar } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import type { RealtimeChannel } from "@supabase/supabase-js";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

type User = {
  id: string;
  email: string;
};

type AvgSet = {
  user_id: string;
  avg_sets_per_day: number;
};

export default function AveragePage() {
  const [avgSets, setAvgSets] = useState<AvgSet[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    let subscription: RealtimeChannel | null = null; // Keep track of the subscription

    async function fetchData() {
      const userRole = await getUserRole();
      if (userRole !== "admin") {
        router.push("/dashboard");
        return;
      }

      setLoading(true); // Set loading state when fetching

      // 平均セット数取得
      const { data: avgData, error: avgError } = await supabase.rpc(
        "avg_sets_per_day_per_user"
      );
      // ユーザー情報取得
      const { data: usersData, error: usersError } = await supabase
        .from("users")
        .select("id, email");

      if (avgError || usersError) {
        console.error(avgError || usersError);
        setAvgSets([]); // Clear data on error
        setUsers([]); // Clear users on error
      } else {
        setAvgSets(avgData || []);
        setUsers(usersData || []);
      }
      setLoading(false);
    }

    fetchData(); // Initial data fetch

    // Set up real-time subscription
    subscription = supabase
      .channel("public:workouts") // Channel name (can be anything unique)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "workouts" },
        (payload) => {
          console.log("Change received!", payload);
          // Data changed, re-fetch the average data
          fetchData();
        }
      )
      .subscribe();

    // Cleanup subscription on component unmount
    return () => {
      if (subscription) {
        supabase.removeChannel(subscription);
      }
    };
  }, [router]); // router is a dependency as it's used inside fetchData

  if (loading) {
    return <div className="p-8 text-xl">Loading...</div>;
  }

  // user_idでemailを紐付け
  const avgSetsWithEmail = avgSets.map((item) => {
    const user = users.find((u) => u.id === item.user_id);
    return {
      ...item,
      email: user ? user.email : "Unknown",
    };
  });

  // Chart.js用のデータ整形
  const chartData = {
    labels: avgSetsWithEmail.map((item) => item.email),
    datasets: [
      {
        label: "1日あたり平均セット数",
        data: avgSetsWithEmail.map((item) => item.avg_sets_per_day),
        backgroundColor: "rgba(75, 192, 192, 0.6)",
        borderColor: "rgba(75, 192, 192, 1)",
        borderWidth: 1,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: "top" as const,
      },
      title: {
        display: true,
        text: "各ユーザーの1日あたり平均セット数グラフ",
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        title: {
          display: true,
          text: "平均セット数/日",
        },
      },
      x: {
        title: {
          display: true,
          text: "ユーザーEmail",
        },
      },
    },
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-8">
      <div className="bg-white shadow rounded-lg p-8 w-full max-w-4xl">
        <h1 className="text-2xl font-bold mb-4 text-center">
          各ユーザーの1日あたり平均セット数
        </h1>

        {/* テーブル表示 */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-2">データテーブル</h2>
          <table className="min-w-full divide-y divide-gray-200">
            <thead>
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Email
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  平均セット数/日
                </th>
              </tr>
            </thead>
            <tbody>
              {avgSetsWithEmail.map((item) => (
                <tr key={item.user_id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {item.email}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {item.avg_sets_per_day}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* グラフ表示 */}
        <div>
          <h2 className="text-xl font-semibold mb-2">データグラフ</h2>
          {avgSetsWithEmail.length > 0 ? (
            <Bar data={chartData} options={chartOptions} />
          ) : (
            <p className="text-gray-500">グラフ表示データがありません。</p>
          )}
        </div>

        <button
          className="mt-8 px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 w-full"
          onClick={() => router.push("/dashboard")}
        >
          ダッシュボードに戻る
        </button>
      </div>
    </div>
  );
}

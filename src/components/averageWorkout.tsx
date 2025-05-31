// import { useEffect, useState } from "react";
// import supabase from "@/lib/supabaseClient";

// export default function AverageWorkouts() {
//   const [average, setAverage] = useState<number | null>(null);

//   useEffect(() => {
//     async function fetchAverage() {
//       const { data, error } = await supabase.rpc('avg_workouts_per_day');
//       if (error) {
//         console.error(error);
//       } else {
//         setAverage(data);
//       }
//     }
//     fetchAverage();
//   }, []);

//   return (
//     <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded">
//       <h2 className="font-bold mb-2 text-blue-800">
//         1日あたりの平均ワークアウト数
//       </h2>
//       <p className="text-lg">{average !== null ? average : "Loading..."}</p>
//     </div>
//   );
// }
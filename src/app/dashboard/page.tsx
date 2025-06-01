"use client";
import { useEffect, useState } from "react";
import supabase from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
import { getUserRole } from "@/lib/auth";
import Link from "next/link";

// Define the shape of a workout object
type Workout = {
  id: string;
  date: string;
  exercise: string;
  sets: number;
  user_id: string;
};

type User = {
  id: string;
  email: string;
};

export default function Dashboard() {
  // State management using React hooks
  const [workouts, setWorkouts] = useState<Workout[]>([]); // Store list of workouts
  const [loading, setLoading] = useState(true); // Loading state
  const [role, setRole] = useState<string | null>(null);
  const [users, setUsers] = useState<User[]>([]); // New state for all users
  const [plan, setPlan] = useState<string | null>(null); // State for user's plan
  const [newWorkout, setNewWorkout] = useState({
    // From state for new workout
    date: new Date().toISOString().split("T")[0], // Today's date
    exercise: "",
    sets: 0,
  });
  const router = useRouter(); // For navigation
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Move session check directly into useEffect
    const checkSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        router.push("/login");
      } else {
        // Only fetch data if session exists
        fetchRoleAndWorkouts();
      }
    };

    checkSession();
  }, [router]); // Empty dependency array to run only on mount

  async function fetchRoleAndWorkouts() {
    setLoading(true);
    setError(null); // Clear previous errors

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      setWorkouts([]);
      setUsers([]);
      setRole(null);
      setPlan(null);
      setLoading(false);
      return;
    }

    // Get user role
    const userRole = await getUserRole();
    setRole(userRole);

    // Fetch user's plan from the public.users table
    const { data: userPlanData, error: userPlanError } = await supabase
      .from("users")
      .select("plan")
      .eq("id", session.user.id)
      .single();

    if (!userPlanError && userPlanData) {
      setPlan(userPlanData.plan);
      console.log("Fetched and set plan:", userPlanData.plan); // Log fetched plan
    } else {
      console.error("Error fetching user plan:", userPlanError);
      setPlan("free"); // Default to free if error
      console.log("Error fetching plan, defaulted to free."); // Log default
    }

    // Fetch all workouts if admin, else only own
    let data: Workout[] = [];
    let fetchError = null;
    if (userRole === "admin") {
      const result = await supabase
        .from("workouts")
        .select("*")
        .order("date", { ascending: false });
      data = result.data || [];
      fetchError = result.error;
      // Fetch all users for admin (including plan if needed for admin view)
      const usersResult = await supabase
        .from("users")
        .select("id, email, plan");
      setUsers(usersResult.data || []);
    } else {
      const result = await supabase
        .from("workouts")
        .select("*")
        .eq("user_id", session.user.id)
        .order("date", { ascending: false });
      data = result.data || [];
      fetchError = result.error;
      setUsers([]); // Not admin, so clear users
    }

    if (fetchError) {
      setWorkouts([]);
      setError(fetchError.message);
    } else {
      setWorkouts(data);
      setError(null); // Clear workout fetch specific error
    }

    setLoading(false);
  }

  // Handle form submission for new workout
  async function handleAddWorkout(e: React.FormEvent) {
    e.preventDefault();
    setError(null); // Clear previous errors from form submission
    try {
      // Get the current authenticated user session
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError) throw sessionError;
      if (!session) {
        router.push("/login");
        return;
      }

      console.log("Current plan before check in handleAddWorkout:", plan); // Log plan before check

      // Check plan limits for free users
      if (plan === "free") {
        const today = new Date().toISOString().split("T")[0];
        const { count, error: countError } = await supabase
          .from("workouts")
          .select("id", { count: "exact", head: true })
          .eq("user_id", session.user.id)
          .eq("date", today);

        if (countError) {
          throw countError;
        }

        console.log(`Today\'s workout count for free user: ${count}`); // Log daily count

        const dailyLimit = 5;
        if (count !== null && count >= dailyLimit) {
          // Set a specific error state for the limit
          setError(
            `無料プランでは1日${dailyLimit}件までしかワークアウトを追加できません。`
          );
          return; // Stop here if limit reached
        }
      }

      // Add the user_id to the new workout object
      const workoutData = {
        ...newWorkout,
        user_id: session.user.id,
      };

      // Insert the workout data including the user_id
      const { error } = await supabase.from("workouts").insert([workoutData]);

      if (error) throw error;

      // Reset form
      setNewWorkout({
        date: new Date().toISOString().split("T")[0],
        exercise: "",
        sets: 0,
      });

      // Refresh workouts list (this will also re-fetch the plan implicitly if needed, but plan state should be up-to-date)
      fetchRoleAndWorkouts();
    } catch (error: unknown) {
      if (error instanceof Error) {
        setError(error.message);
      } else {
        setError(String(error));
      }
    }
  }

  // Function to handle upgrade button click
  async function handleUpgradeClick() {
    try {
      // Get the current authenticated user session to get the user ID
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError) throw sessionError;
      if (!session) {
        // If no session, redirect to login (should not happen if checkUser works, but good practice)
        router.push("/login");
        return;
      }

      // Call your API route to create a Stripe Checkout session
      const response = await fetch("/api/create-checkout-session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ userId: session.user.id }), // Send the user's ID
      });

      const data = await response.json();

      if (response.ok && data.url) {
        // Redirect the user to the Stripe Checkout page
        window.location.assign(data.url);
      } else {
        // Handle API errors
        throw new Error(data.error || "Failed to create checkout session");
      }
    } catch (error: unknown) {
      // Display any errors during the process
      if (error instanceof Error) {
        setError(
          `アップグレード処理中にエラーが発生しました: ${error.message}`
        );
      } else {
        setError(
          `アップグレード処理中にエラーが発生しました: ${String(error)}`
        );
      }
    }
  }

  // Function to handle removing a workout
  async function handleRemoveWorkout(workoutId: string) {
    try {
      // Get the current authenticated user session
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError) throw sessionError;
      if (!session) {
        // If no session, redirect to login
        router.push("/login");
        return;
      }

      // Delete the workout from the database
      // Ensure only the owner can delete their workout (using RLS or backend check)
      // For simplicity here, we rely on RLS if set up, or assume frontend user matches workout user_id
      const { error } = await supabase
        .from("workouts")
        .delete()
        .eq("id", workoutId);
      // Consider adding .eq('user_id', session.user.id) for extra security if RLS is not strict enough

      if (error) throw error;

      // Refresh workouts list after deletion
      fetchRoleAndWorkouts();
    } catch (error: unknown) {
      if (error instanceof Error) {
        setError(
          `ワークアウトの削除中にエラーが発生しました: ${error.message}`
        );
      } else {
        setError(
          `ワークアウトの削除中にエラーが発生しました: ${String(error)}`
        );
      }
    }
  }

  // Show loading state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">Loading...</div>
      </div>
    );
  }

  // Main dashboard UI
  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        {error && (
          <div className="mb-4 p-4 bg-red-100 text-red-700 rounded">
            {error}
            {/* Add upgrade link/button here if the error is the limit message */}
            {error.startsWith("無料プランでは") && (
              <p className="mt-2 text-red-800 font-semibold">
                プレミアムプランにアップグレードして無制限にワークアウトを追加！
                {/* Add the upgrade button that calls the API */}
                <button
                  className="ml-4 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                  onClick={handleUpgradeClick} // This function will call the API
                >
                  アップグレードする
                </button>
              </p>
            )}
          </div>
        )}
        <div className="flex items-center gap-4 mb-8">
          <h1 className="text-3xl font-bold">Your Workouts</h1>
          {role === "admin" && (
            <span className="px-3 py-1 bg-indigo-600 text-white rounded-full text-xs font-semibold">
              Admin
            </span>
          )}
        </div>

        {/* Admin-only section */}
        {role === "admin" && (
          <div className="mb-8 p-4 bg-yellow-50 border border-yellow-200 rounded">
            <h2 className="font-bold mb-2 text-yellow-800">
              Admin Only: All Users
              <Link
                href="/average"
                className="ml-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                平均ワークアウト数を見る
              </Link>
            </h2>
            <ul className="list-disc pl-5">
              {users.map((user) => (
                <li key={user.id} className="text-sm text-yellow-900">
                  <span className="text-x text-gray-500">
                    Email: {user.email}
                  </span>
                  <br />
                  <span className="text-xs text-gray-500">ID: {user.id}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Add Workout Form */}
        <div className="bg-white shadow rounded-lg p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4">Add New Workout</h2>
          <form onSubmit={handleAddWorkout} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Date
                </label>
                <input
                  type="date"
                  value={newWorkout.date}
                  onChange={(e) =>
                    setNewWorkout({ ...newWorkout, date: e.target.value })
                  }
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Exercise
                </label>
                <input
                  type="text"
                  value={newWorkout.exercise}
                  onChange={(e) =>
                    setNewWorkout({ ...newWorkout, exercise: e.target.value })
                  }
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                  placeholder="e.g., Bench Press"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Sets
                </label>
                <input
                  type="number"
                  value={newWorkout.sets}
                  onChange={(e) => {
                    let stringValue = e.target.value;
                    // Remove leading zeros unless the value is just '0'
                    if (stringValue !== "0") {
                      stringValue = stringValue.replace(/^0+/, "");
                    }
                    const numValue = parseInt(stringValue);
                    setNewWorkout({
                      ...newWorkout,
                      sets: isNaN(numValue) ? 0 : numValue,
                    });
                  }}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                  required
                  min="0"
                />
              </div>
            </div>
            <button
              type="submit"
              className="w-full md:w-auto px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              Add Workout
            </button>
          </form>
        </div>

        {/* Workouts Table */}
        {workouts.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-500">No workouts recorded yet.</p>
          </div>
        ) : (
          <div className="bg-white shadow rounded-lg overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Exercise
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Sets
                  </th>
                  {role === "admin" && (
                    <>
                      <th>User ID</th>
                      <th>Email</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {workouts.map((workout) => {
                  // Find the user for this workout
                  const user = users.find((u) => u.id === workout.user_id);
                  return (
                    <tr key={workout.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {new Date(workout.date).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {workout.exercise}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {workout.sets}
                      </td>
                      {role === "admin" && (
                        <>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {workout.user_id}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {user ? user.email : "Unknown"}
                          </td>
                        </>
                      )}
                      {/* Add Remove Button Column */}
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button
                          onClick={() => handleRemoveWorkout(workout.id)} // Call handler with workout ID
                          className="text-red-600 hover:text-red-900"
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

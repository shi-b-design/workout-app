"use client";
import { useEffect, useState } from "react";
import supabase from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";

// Define the shape of a workout object
type Workout = {
  id: string;
  date: string;
  exercise: string;
  sets: number;
  user_id: string;
};

export default function Dashboard() {
  // State management using React hooks
  const [workouts, setWorkouts] = useState<Workout[]>([]); // Store list of workouts
  const [loading, setLoading] = useState(true); // Loading state
  const [newWorkout, setNewWorkout] = useState({
    // From state for new workout
    date: new Date().toISOString().split("T")[0], // Today's date
    exercise: "",
    sets: 1,
  });
  const router = useRouter(); // For navigation

  useEffect(() => {
    checkUser();
    fetchWorkouts();
  }, []);

  async function checkUser() {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      router.push("/login");
    }
  }

  // Get workouts from database
  async function fetchWorkouts() {
    try {
      const { data, error } = await supabase
        .from("workouts")
        .select("*")
        .order("date", { ascending: false });

      if (error) throw error;
      setWorkouts(data || []);
    } catch (error) {
      console.error("Error fetching workouts:", error);
    } finally {
      setLoading(false);
    }
  }

  // Handle form submission for new workout
  async function handleAddWorkout(e: React.FormEvent) {
    e.preventDefault();
    try {
      // Get the current authenticated user session
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError) throw sessionError;
      if (!session) {
        // If no session, redirect to login (should be caught by checkUser, but good to be safe)
        router.push("/login");
        return;
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
        sets: 1,
      });

      // Refresh workouts list
      fetchWorkouts();
    } catch (error) {
      console.error("Error adding workout:", error);
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
        <h1 className="text-3xl font-bold mb-8">Your Workouts</h1>

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
                    const value = parseInt(e.target.value);
                    setNewWorkout({
                      ...newWorkout,
                      sets: isNaN(value) ? 0 : value,
                    });
                  }}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                  required
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
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {workouts.map((workout) => (
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
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

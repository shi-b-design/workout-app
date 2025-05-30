// Import the Supabase client that's configured for your application
import supabase from './supabaseClient'

// Function to get the current user's role
export async function getUserRole() {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return null

  const { data, error } = await supabase
    .from('roles')
    .select('role')
    .eq('user_id', session.user.id)
    .single()

  if (error) {
    console.error('Error fetching user role:', error)
    return null
  }

  return data?.role
}

export async function isAdmin() {
  const role = await getUserRole()
  return role === 'admin'
}

export async function requireAdmin() {
  const isUserAdmin = await isAdmin()
  if (!isUserAdmin) {
    throw new Error('Admin access required')
  }
} 
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    // Get the authorization header
    const authHeader = req.headers.get('Authorization')!
    const token = authHeader.replace('Bearer ', '')
    
    // Verify the user is authenticated and is a manager
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Check if user is a manager
    const { data: roles } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'manager')
      .eq('approved', true)
      .single()

    if (!roles) {
      return new Response(JSON.stringify({ error: 'Forbidden - Manager access required' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Get role from request body
    const { role } = await req.json().catch(() => ({}))

    // Get user roles with profile data
    let query = supabaseAdmin
      .from('user_roles')
      .select(`
        user_id,
        role,
        approved,
        created_at,
        profiles!user_roles_user_id_fkey (
          id,
          name,
          phone,
          company_name,
          address
        )
      `)
      .eq('approved', true)

    if (role) {
      query = query.eq('role', role)
    }

    const { data: userRoles, error: rolesError } = await query

    if (rolesError) throw rolesError

    // Get all users from auth to get emails
    const { data: { users }, error: usersError } = await supabaseAdmin.auth.admin.listUsers()
    if (usersError) throw usersError

    // Combine data
    const usersWithData = userRoles?.map((item: any) => {
      const authUser = users.find(u => u.id === item.profiles.id)
      return {
        id: item.profiles.id,
        name: item.profiles.name,
        email: authUser?.email || '',
        phone: item.profiles.phone,
        company_name: item.profiles.company_name,
        address: item.profiles.address,
        role: item.role,
        approved: item.approved,
        created_at: item.created_at,
      }
    }) || []

    return new Response(JSON.stringify({ users: usersWithData }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
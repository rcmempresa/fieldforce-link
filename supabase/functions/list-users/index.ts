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
    console.log('Starting list-users function')
    
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

    console.log('Supabase client created')

    // Get the authorization header
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      console.error('No authorization header found')
      return new Response(JSON.stringify({ error: 'No authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    
    const token = authHeader.replace('Bearer ', '')
    console.log('Token extracted')
    
    // Verify the user is authenticated and is a manager
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
    if (authError) {
      console.error('Auth error:', authError)
      return new Response(JSON.stringify({ error: 'Unauthorized', details: authError.message }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    
    if (!user) {
      console.error('No user found')
      return new Response(JSON.stringify({ error: 'Unauthorized - No user found' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    console.log('User authenticated:', user.id)

    // Check if user is a manager
    const { data: roles, error: rolesError } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'manager')
      .eq('approved', true)
      .single()

    if (rolesError) {
      console.error('Roles query error:', rolesError)
    }

    if (!roles) {
      console.error('User is not a manager')
      return new Response(JSON.stringify({ error: 'Forbidden - Manager access required' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    console.log('User is manager, proceeding')

    // Get role from request body
    let role = null
    try {
      const body = await req.json()
      role = body.role
      console.log('Role from body:', role)
    } catch (e) {
      console.log('No body or invalid JSON, role will be null')
    }

    // Get user roles with profile data
    console.log('Querying user_roles with role filter:', role)
    
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

    const { data: userRoles, error: rolesQueryError } = await query

    if (rolesQueryError) {
      console.error('Error querying user_roles:', rolesQueryError)
      throw rolesQueryError
    }

    console.log('User roles fetched:', userRoles?.length || 0, 'records')

    // Get all users from auth to get emails
    console.log('Fetching auth users')
    const { data: { users }, error: usersError } = await supabaseAdmin.auth.admin.listUsers()
    
    if (usersError) {
      console.error('Error fetching auth users:', usersError)
      throw usersError
    }

    console.log('Auth users fetched:', users?.length || 0, 'users')

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

    console.log('Combined data:', usersWithData.length, 'users')

    return new Response(JSON.stringify({ users: usersWithData }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Caught error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    const stack = error instanceof Error ? error.stack : undefined
    console.error('Error details:', { message, stack })
    
    return new Response(JSON.stringify({ 
      error: message,
      details: stack 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
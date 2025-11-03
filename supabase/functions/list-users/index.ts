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
    console.log('Token extracted, length:', token.length)
    console.log('Token starts with:', token.substring(0, 20) + '...')
    
    // Create admin client for privileged operations
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

    console.log('Supabase admin client created')
    
    // Verify the user is authenticated by getting user from JWT token
    console.log('Attempting to verify user with token')
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
    
    if (authError) {
      console.error('Auth error details:', {
        message: authError.message,
        name: authError.name,
        status: authError.status
      })
      return new Response(JSON.stringify({ 
        error: 'Unauthorized', 
        details: authError.message || 'Invalid or expired token'
      }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    
    if (!user) {
      console.error('No user found in token')
      return new Response(JSON.stringify({ 
        error: 'Unauthorized', 
        details: 'Invalid or expired token - no user found'
      }), {
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
      .select('user_id, role, approved, created_at')
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

    // Get profiles for these users
    if (!userRoles || userRoles.length === 0) {
      console.log('No user roles found')
      return new Response(JSON.stringify({ users: [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const userIds = userRoles.map(r => r.user_id)
    console.log('Fetching profiles for user IDs:', userIds)

    const { data: profiles, error: profilesError } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .in('id', userIds)

    if (profilesError) {
      console.error('Error fetching profiles:', profilesError)
      throw profilesError
    }

    console.log('Profiles fetched:', profiles?.length || 0, 'profiles')

    // Get all users from auth to get emails
    console.log('Fetching auth users')
    const { data: { users }, error: usersError } = await supabaseAdmin.auth.admin.listUsers()
    
    if (usersError) {
      console.error('Error fetching auth users:', usersError)
      throw usersError
    }

    console.log('Auth users fetched:', users?.length || 0, 'users')

    // Combine data
    const usersWithData = userRoles.map((userRole: any) => {
      const profile = profiles?.find(p => p.id === userRole.user_id)
      const authUser = users.find(u => u.id === userRole.user_id)
      
      return {
        id: userRole.user_id,
        name: profile?.name || 'Sem nome',
        email: authUser?.email || '',
        phone: profile?.phone || null,
        company_name: profile?.company_name || null,
        address: profile?.address || null,
        role: userRole.role,
        approved: userRole.approved,
        created_at: userRole.created_at,
      }
    })

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
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User, Session } from "@supabase/supabase-js";
import { toast } from "sonner";

interface UserRole {
  role: "manager" | "employee" | "client";
  approved: boolean;
}

export interface Profile {
  id: string;
  name: string;
  phone: string | null;
  company_name: string | null;
  address: string | null;
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [roles, setRoles] = useState<Array<"manager" | "employee" | "client">>([]);
  const [approved, setApproved] = useState(false);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const fetchUserData = async (userId: string) => {
    // Fetch profile
    const { data: profileData } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();

    if (profileData) {
      setProfile(profileData as Profile);
    }

    // Fetch roles
    const { data: rolesData } = await supabase
      .from("user_roles")
      .select("role, approved")
      .eq("user_id", userId);

    if (rolesData && rolesData.length > 0) {
      const approvedRoles = rolesData.filter((r: UserRole) => r.approved);
      setRoles(approvedRoles.map((r: UserRole) => r.role));
      setApproved(approvedRoles.length > 0);
    } else {
      setRoles([]);
      setApproved(false);
    }
  };

  useEffect(() => {
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          // Defer data fetching to avoid blocking
          setTimeout(() => {
            fetchUserData(session.user.id);
          }, 0);
        } else {
          setProfile(null);
          setRoles([]);
          setApproved(false);
        }
      }
    );

    // Check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        fetchUserData(session.user.id).then(() => {
          setLoading(false);
        });
      } else {
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signUp = async (email: string, password: string, name: string) => {
    try {
      const redirectUrl = `${window.location.origin}/`;
      
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: redirectUrl,
          data: {
            name,
          },
        },
      });

      if (error) throw error;
      toast.success("Conta criada com sucesso!");
      return { error: null };
    } catch (error: any) {
      toast.error(error.message);
      return { error };
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;
      toast.success("Login efetuado com sucesso!");
      return { error: null };
    } catch (error: any) {
      toast.error(error.message);
      return { error };
    }
  };

  const signOut = async () => {
    try {
      // Clear state first
      setUser(null);
      setSession(null);
      setProfile(null);
      setRoles([]);
      setApproved(false);
      
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      
      toast.success("Sessão terminada!");
      navigate("/auth");
    } catch (error: any) {
      console.error("Logout error:", error);
      toast.error("Erro ao terminar sessão: " + error.message);
    }
  };

  return {
    user,
    session,
    profile,
    roles,
    approved,
    loading,
    signUp,
    signIn,
    signOut,
  };
}

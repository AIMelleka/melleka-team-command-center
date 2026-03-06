import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export interface AuthResult {
  authorized: boolean;
  userId?: string;
  isServiceRole?: boolean;
  error?: string;
  status?: number;
}

/**
 * Validates that the request has a valid admin authentication token.
 * Accepts either:
 * 1. A user JWT token from an admin user
 * 2. The service role key (for internal edge function calls)
 * 
 * Returns the user ID if authorized, or an error response if not.
 */
export async function requireAdminAuth(req: Request): Promise<AuthResult> {
  const authHeader = req.headers.get("Authorization");
  
  if (!authHeader?.startsWith("Bearer ")) {
    return {
      authorized: false,
      error: "Unauthorized - missing or invalid authorization header",
      status: 401,
    };
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error("Missing Supabase environment variables");
    return {
      authorized: false,
      error: "Server configuration error",
      status: 500,
    };
  }

  const token = authHeader.replace("Bearer ", "");
  
  // Check if this is the service role key (internal edge function call)
  if (token === supabaseServiceKey) {
    console.log("Service role key authentication - authorized for internal call");
    return {
      authorized: true,
      isServiceRole: true,
    };
  }

  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  // Verify the token and get user
  const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
  
  if (userError || !userData.user) {
    return {
      authorized: false,
      error: "Invalid or expired token",
      status: 401,
    };
  }

  // Check if user has admin role
  const { data: isAdmin, error: roleError } = await supabaseAdmin.rpc("has_role", {
    _user_id: userData.user.id,
    _role: "admin",
  });

  if (roleError) {
    console.error("Error checking admin role:", roleError);
    return {
      authorized: false,
      error: "Failed to verify permissions",
      status: 500,
    };
  }

  if (!isAdmin) {
    return {
      authorized: false,
      error: "Admin access required",
      status: 403,
    };
  }

  return {
    authorized: true,
    userId: userData.user.id,
  };
}

/**
 * Validates that the request has a valid user authentication token.
 * Less strict than requireAdminAuth - allows any authenticated user.
 * 
 * Returns the user ID if authorized, or an error response if not.
 */
export async function requireAuth(req: Request): Promise<AuthResult> {
  const authHeader = req.headers.get("Authorization");
  
  if (!authHeader?.startsWith("Bearer ")) {
    return {
      authorized: false,
      error: "Unauthorized - missing or invalid authorization header",
      status: 401,
    };
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error("Missing Supabase environment variables");
    return {
      authorized: false,
      error: "Server configuration error",
      status: 500,
    };
  }

  const token = authHeader.replace("Bearer ", "");
  
  // Check if this is the service role key (internal edge function call)
  if (token === supabaseServiceKey) {
    console.log("Service role key authentication - authorized for internal call");
    return {
      authorized: true,
      isServiceRole: true,
    };
  }

  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  // Verify the token and get user
  const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
  
  if (userError || !userData.user) {
    return {
      authorized: false,
      error: "Invalid or expired token",
      status: 401,
    };
  }

  return {
    authorized: true,
    userId: userData.user.id,
  };
}

/**
 * Validates that the request has a valid authentication token AND
 * that the user is either an admin or has the specific tool permission.
 * Use this for edge functions that back user-accessible tools.
 */
export async function requireToolAuth(req: Request, toolKey: string): Promise<AuthResult> {
  const authHeader = req.headers.get("Authorization");
  
  if (!authHeader?.startsWith("Bearer ")) {
    return {
      authorized: false,
      error: "Unauthorized - missing or invalid authorization header",
      status: 401,
    };
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error("Missing Supabase environment variables");
    return {
      authorized: false,
      error: "Server configuration error",
      status: 500,
    };
  }

  const token = authHeader.replace("Bearer ", "");
  
  // Check if this is the service role key (internal edge function call)
  if (token === supabaseServiceKey) {
    console.log("Service role key authentication - authorized for internal call");
    return {
      authorized: true,
      isServiceRole: true,
    };
  }

  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  // Verify the token and get user
  const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
  
  if (userError || !userData.user) {
    return {
      authorized: false,
      error: "Invalid or expired token",
      status: 401,
    };
  }

  // Check if user has admin role OR specific tool permission
  const { data: hasAccess, error: accessError } = await supabaseAdmin.rpc("user_has_tool_access", {
    _user_id: userData.user.id,
    _tool_key: toolKey,
  });

  if (accessError) {
    console.error("Error checking tool access:", accessError);
    return {
      authorized: false,
      error: "Failed to verify permissions",
      status: 500,
    };
  }

  if (!hasAccess) {
    return {
      authorized: false,
      error: `Access to ${toolKey} not granted. Contact your admin.`,
      status: 403,
    };
  }

  return {
    authorized: true,
    userId: userData.user.id,
  };
}

/**
 * Creates an unauthorized response with proper CORS headers
 */
export function createUnauthorizedResponse(
  error: string,
  status: number,
  corsHeaders: Record<string, string>
): Response {
  return new Response(
    JSON.stringify({ success: false, error }),
    { status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

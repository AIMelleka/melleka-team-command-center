-- Fix has_role and other auth functions that fail due to search_path issue
-- SECURITY DEFINER functions may not have 'public' in their search_path,
-- causing "relation does not exist" errors even though the tables exist.

-- Fix has_role: explicitly reference public.user_roles
CREATE OR REPLACE FUNCTION has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  );
END;
$$;

-- Fix get_users_for_admin
CREATE OR REPLACE FUNCTION get_users_for_admin()
RETURNS TABLE (
  id uuid,
  email text,
  created_at timestamptz,
  last_sign_in_at timestamptz,
  is_admin boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    u.id,
    u.email::text,
    u.created_at,
    u.last_sign_in_at,
    EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = u.id AND ur.role = 'admin') AS is_admin
  FROM auth.users u
  ORDER BY u.created_at;
END;
$$;

-- Fix user_has_tool_access
CREATE OR REPLACE FUNCTION user_has_tool_access(_user_id uuid, _tool_key text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'admin') THEN
    RETURN true;
  END IF;
  RETURN EXISTS (
    SELECT 1 FROM public.user_tool_permissions
    WHERE user_id = _user_id AND tool_key = _tool_key
  );
END;
$$;

-- Fix user_has_any_tool
CREATE OR REPLACE FUNCTION user_has_any_tool(_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'admin') THEN
    RETURN true;
  END IF;
  RETURN EXISTS (
    SELECT 1 FROM public.user_tool_permissions WHERE user_id = _user_id
  );
END;
$$;

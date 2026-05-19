-- =============================================================================
-- SEED: Bootstrap first admin user
-- PURPOSE:   After the admin account is created via the Supabase dashboard
--            (Authentication → Users → Add user), run this script in the
--            SQL editor to grant admin role.
--
-- HOW TO USE:
--   1. Go to: Supabase Dashboard → Authentication → Users → Add user
--   2. Enter email:    mustafa.al-janabi@newfrontiersbc.com
--      Enter password: (choose a strong password)
--      Click "Create user"
--   3. Copy the UUID shown in the Users list for that user.
--   4. Paste it below replacing <PASTE-USER-UUID-HERE>
--   5. Run this script in: Dashboard → SQL Editor
-- =============================================================================

DO $$
DECLARE
  v_user_id   uuid := '<PASTE-USER-UUID-HERE>';
  v_admin_id  integer;
BEGIN
  -- Look up admin role id
  SELECT id INTO v_admin_id FROM public.roles WHERE slug = 'admin';

  IF v_admin_id IS NULL THEN
    RAISE EXCEPTION 'Admin role not found — did migration 0001 run?';
  END IF;

  -- Ensure profile exists (trigger should have created it, but just in case)
  INSERT INTO public.profiles (id, email, full_name)
  SELECT v_user_id, email, email
  FROM auth.users
  WHERE id = v_user_id
  ON CONFLICT (id) DO NOTHING;

  -- Grant admin role
  INSERT INTO public.user_roles (user_id, role_id, granted_by)
  VALUES (v_user_id, v_admin_id, v_user_id)   -- self-granted for bootstrap
  ON CONFLICT (user_id, role_id) DO NOTHING;

  RAISE NOTICE 'Admin role granted to user %', v_user_id;
END;
$$;

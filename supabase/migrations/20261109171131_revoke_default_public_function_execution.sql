-- New functions created by migrations must be explicitly granted to API roles.
-- This prevents future SECURITY DEFINER RPCs from becoming public by default.
alter default privileges for role postgres in schema public
  revoke execute on functions from anon, authenticated;

// @ts-nocheck
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

type Payload = {
  action: 'upsert_teacher_auth' | 'reset_teacher_password' | 'delete_teacher_auth';
  teacherId: string;
  email?: string;
  name?: string;
  password?: string;
  newPassword?: string;
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });

const normalize = (value: string) => value.trim().toLowerCase();

Deno.serve(async (req) => {
  try {
    if (req.method === 'OPTIONS') {
      return new Response('ok', { headers: corsHeaders });
    }
    if (req.method !== 'POST') {
      return json(405, { error: 'Method not allowed.' });
    }

    const url = Deno.env.get('SUPABASE_URL');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!url || !anonKey || !serviceRole) {
      return json(500, { error: 'Missing SUPABASE_URL, SUPABASE_ANON_KEY, or SUPABASE_SERVICE_ROLE_KEY.' });
    }

    const authHeader = req.headers.get('Authorization') || '';
    if (!authHeader.startsWith('Bearer ')) return json(401, { error: 'Missing bearer token.' });

    const admin = createClient(url, serviceRole, { auth: { persistSession: false } });
    const callerClient = createClient(url, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false }
    });

    const userResult = await callerClient.auth.getUser();
    const caller = userResult.data.user;
    if (userResult.error || !caller) return json(401, { error: userResult.error?.message || 'Unauthorized.' });

    const roleResult = await admin
      .from('profiles')
      .select('role')
      .eq('id', caller.id)
      .maybeSingle();
    if (roleResult.error || roleResult.data?.role !== 'ADMIN') {
      return json(403, { error: 'Admin access required.' });
    }

    const payload = (await req.json()) as Payload;
    if (!payload.teacherId) return json(400, { error: 'teacherId is required.' });

    const teacherResult = await admin
      .from('teachers')
      .select('id, name, email')
      .eq('id', payload.teacherId)
      .single();
    if (teacherResult.error || !teacherResult.data) {
      return json(404, { error: 'Teacher not found.' });
    }

    const teacher = teacherResult.data;
    const teacherEmail = normalize(payload.email || teacher.email || '');
    const teacherName = (payload.name || teacher.name || 'Teacher').trim();

    if (!teacherEmail) return json(400, { error: 'Teacher email is required.' });

    const usersResult = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (usersResult.error) return json(500, { error: usersResult.error.message });

    const existing = (usersResult.data.users || []).find((item) => normalize(item.email || '') === teacherEmail);

    if (payload.action === 'upsert_teacher_auth') {
      if (!payload.password || payload.password.length < 6) {
        return json(400, { error: 'A password of at least 6 characters is required.' });
      }

      let userId = existing?.id || '';

      if (existing) {
        const updateRes = await admin.auth.admin.updateUserById(existing.id, {
          email: teacherEmail,
          password: payload.password,
          email_confirm: true,
          user_metadata: { name: teacherName, role: 'TEACHER' }
        });
        if (updateRes.error) return json(500, { error: updateRes.error.message });
      } else {
        const createRes = await admin.auth.admin.createUser({
          email: teacherEmail,
          password: payload.password,
          email_confirm: true,
          user_metadata: { name: teacherName, role: 'TEACHER' }
        });
        if (createRes.error || !createRes.data.user) {
          return json(500, { error: createRes.error?.message || 'Failed to create auth user.' });
        }
        userId = createRes.data.user.id;
      }

      if (!userId && existing?.id) userId = existing.id;

      const profileRes = await admin
        .from('profiles')
        .upsert([
          {
            id: userId,
            name: teacherName,
            role: 'TEACHER',
            teacher_id: teacher.id
          }
        ], { onConflict: 'id' });
      if (profileRes.error) return json(500, { error: profileRes.error.message });

      await admin
        .from('teachers')
        .update({ auth_user_id: userId })
        .eq('id', teacher.id);

      return json(200, { ok: true, mode: 'upsert', userId, email: teacherEmail });
    }

    if (payload.action === 'reset_teacher_password') {
      if (!payload.newPassword || payload.newPassword.length < 6) {
        return json(400, { error: 'newPassword must be at least 6 characters.' });
      }

      if (!existing?.id) {
        return json(404, { error: 'No auth user exists for this teacher email. Use Create/Sync first.' });
      }

      const resetRes = await admin.auth.admin.updateUserById(existing.id, {
        password: payload.newPassword,
        email: teacherEmail,
        email_confirm: true,
        user_metadata: { name: teacherName, role: 'TEACHER' }
      });
      if (resetRes.error) return json(500, { error: resetRes.error.message });

      await admin
        .from('profiles')
        .upsert([
          {
            id: existing.id,
            name: teacherName,
            role: 'TEACHER',
            teacher_id: teacher.id
          }
        ], { onConflict: 'id' });

      await admin
        .from('teachers')
        .update({ auth_user_id: existing.id })
        .eq('id', teacher.id);

      return json(200, { ok: true, mode: 'reset', userId: existing.id, email: teacherEmail });
    }

    if (payload.action === 'delete_teacher_auth') {
      if (!existing?.id) {
        return json(200, { ok: true, mode: 'delete', userId: null, email: teacherEmail, message: 'No auth user to delete.' });
      }

      const deleteRes = await admin.auth.admin.deleteUser(existing.id);
      if (deleteRes.error) return json(500, { error: deleteRes.error.message });

      return json(200, { ok: true, mode: 'delete', userId: existing.id, email: teacherEmail });
    }

    return json(400, { error: 'Unknown action.' });
  } catch (error) {
    return json(500, { error: (error as Error).message || 'Unexpected error.' });
  }
});

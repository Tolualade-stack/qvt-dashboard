// Gives an existing login the Admin role and links it to a team member.
// Only needed once, to set up the very first Admin. After that, the Admin
// manages every other login from the Admin page in the app.
//
// Usage: npm run db:make-admin -- <email> [person-slug]
//   person-slug defaults to "tolu" (see people.slug in the database)

import { runSql, sqlLiteral } from "./supabase-api.mjs";

const [email, personSlug = "tolu"] = process.argv.slice(2);
if (!email) {
  console.error("Usage: npm run db:make-admin -- <email> [person-slug]");
  process.exit(1);
}

const rows = await runSql(`
  insert into public.profiles (user_id, person_id, email, app_role)
  select u.id, p.id, u.email, 'admin'
  from auth.users u
  join public.people p on p.slug = ${sqlLiteral(personSlug)}
  where lower(u.email) = lower(${sqlLiteral(email)})
  on conflict (user_id) do update
    set app_role = 'admin', is_active = true, person_id = excluded.person_id
  returning email;
`);

if (rows.length === 0) {
  console.error(`No login found for ${email} (or no team member "${personSlug}"). Create the login in Supabase first.`);
  process.exit(1);
}
console.log(`${rows[0].email} is now an Admin.`);

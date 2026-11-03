// Sets a new password for a login, typed in privately at the keyboard.
// For when someone (including the Admin) is locked out.
// Usage: npm run db:set-password -- <email>
//
// The password is typed into this window, hidden as you type, and sent straight
// to Supabase. It is never shown, logged or saved anywhere else.

import { createInterface } from "node:readline";
import { createClient } from "@supabase/supabase-js";

const email = process.argv[2]?.trim().toLowerCase();
if (!email) {
  console.error("Usage: npm run db:set-password -- <email>");
  process.exit(1);
}

// Asks a question without echoing what is typed (shows * instead).
function askHidden(question) {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    rl._writeToOutput = (text) => {
      rl.output.write(text.startsWith(question) ? question : "*");
    };
    rl.question(question, (answer) => {
      rl.close();
      process.stdout.write("\n");
      resolve(answer);
    });
  });
}

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { data, error: listError } = await supabase.auth.admin.listUsers({ perPage: 1000 });
if (listError) throw listError;
const user = data.users.find((u) => u.email?.toLowerCase() === email);
if (!user) {
  console.error(`No login found for ${email}.`);
  process.exit(1);
}

const password = await askHidden(`New password for ${email} (at least 8 characters): `);
const again = await askHidden("Type it again: ");
if (password.length < 8) {
  console.error("Too short. Nothing was changed.");
  process.exit(1);
}
if (password !== again) {
  console.error("The two didn't match. Nothing was changed.");
  process.exit(1);
}

const { error } = await supabase.auth.admin.updateUserById(user.id, { password });
if (error) throw error;
console.log("Password changed. You can sign in with it now.");

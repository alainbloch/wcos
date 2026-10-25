/** Create or reset the configured admin without starting the web server. */
import { initDatabase, usersRepo } from "../src/models/database.js";
import config from "../src/config/index.js";
import { authService } from "../src/services/authService.js";
import { recoverTransfer } from "../src/services/dataTransfer/service.js";

async function resetAdmin() {
  const password = process.env.ADMIN_PASSWORD;
  if (!password)
    throw new Error("Set ADMIN_PASSWORD before running npm run admin:reset.");
  authService.validatePassword(password);
  const email = config.adminEmail.trim().toLowerCase();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("Set ADMIN_EMAIL to a valid email address.");
  }

  // Complete any interrupted import before reading or changing account records.
  await recoverTransfer();
  await initDatabase();
  const existing = (await usersRepo.findAll()).find(
    (user) => user.email.trim().toLowerCase() === email,
  );
  if (existing) {
    await authService.updateUser(existing.id, {
      name: existing.name || "Administrator",
      email,
      password,
    });
    console.log(
      "Administrator password reset. Previous login sessions have been revoked.",
    );
  } else {
    await authService.createUser({ name: "Administrator", email, password });
    console.log("Administrator account created.");
  }
}

resetAdmin().catch((error) => {
  console.error(`Admin reset failed: ${error.message}`);
  process.exitCode = 1;
});

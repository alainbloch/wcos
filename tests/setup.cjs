// Never let the test runner modify a developer's real CMS database.
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
process.env.NODE_ENV = "test";
process.env.DB_PATH = path.join(
  fs.mkdtempSync(path.join(os.tmpdir(), "wcos-test-")),
  "db.json",
);

process.env.ADMIN_PASSWORD = 'TestAdmin123!';

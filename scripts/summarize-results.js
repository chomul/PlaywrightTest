// Prints per-project counts and duration from Playwright's JSON report.
// Usage: node scripts/summarize-results.js [test-results/results.json]
const fs = require("node:fs");

const file = process.argv[2] || "test-results/results.json";
const report = JSON.parse(fs.readFileSync(file, "utf8"));

const rows = [];
const walk = (suite) => {
  for (const child of suite.suites || []) walk(child);
  for (const spec of suite.specs || []) {
    for (const t of spec.tests) {
      rows.push({ title: spec.title, file: spec.file, project: t.projectName, status: t.status });
    }
  }
};
report.suites.forEach(walk);

const byProject = {};
for (const r of rows) {
  const p = (byProject[r.project] ||= { total: 0, expected: 0, unexpected: 0, flaky: 0, skipped: 0 });
  p.total++;
  p[r.status]++;
}

console.log(`started: ${report.stats.startTime}`);
console.log(`duration: ${(report.stats.duration / 1000).toFixed(1)}s`);
console.log(`stats: ${JSON.stringify({ expected: report.stats.expected, unexpected: report.stats.unexpected, flaky: report.stats.flaky, skipped: report.stats.skipped })}`);
console.log(`unique tests (spec x title): ${new Set(rows.map((r) => r.file + "|" + r.title)).size}`);
console.table(byProject);
for (const r of rows.filter((r) => r.status !== "expected" && r.status !== "skipped")) {
  console.log(`${r.status.padEnd(10)} ${r.project.padEnd(14)} ${r.file} › ${r.title}`);
}

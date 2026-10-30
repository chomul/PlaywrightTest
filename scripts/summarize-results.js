// Prints per-project counts and duration from Playwright's JSON report.
// Usage: node scripts/summarize-results.js [--markdown] [test-results/results.json]
const fs = require("node:fs");

const args = process.argv.slice(2);
const markdown = args.includes("--markdown");
const file = args.find((a) => !a.startsWith("--")) || "test-results/results.json";
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

const unique = new Set(rows.map((r) => r.file + "|" + r.title)).size;
const duration = (report.stats.duration / 1000).toFixed(1);

if (markdown) {
  console.log(`### Playwright: ${unique} tests, ${rows.length} runs, ${duration}s
`);
  console.log("| project | runs | passed | failed | flaky | skipped |");
  console.log("| --- | --- | --- | --- | --- | --- |");
  for (const [name, p] of Object.entries(byProject)) {
    console.log(`| ${name} | ${p.total} | ${p.expected} | ${p.unexpected} | ${p.flaky} | ${p.skipped} |`);
  }
  console.log("");
} else {
  console.log(`started: ${report.stats.startTime}`);
  console.log(`duration: ${duration}s`);
  console.log(`stats: ${JSON.stringify({ expected: report.stats.expected, unexpected: report.stats.unexpected, flaky: report.stats.flaky, skipped: report.stats.skipped })}`);
  console.log(`unique tests (spec x title): ${unique}`);
  console.table(byProject);
}
for (const r of rows.filter((r) => r.status !== "expected" && r.status !== "skipped")) {
  console.log(`${r.status.padEnd(10)} ${r.project.padEnd(14)} ${r.file} › ${r.title}`);
}

const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '..', 'cba-swagger-ui-init.js');
const s = fs.readFileSync(file, 'utf8');
const parts = s.split(/,\s*"customOptions"/);
const before = parts[0];
const i = before.indexOf('"swaggerDoc":');
const jsonStr = before.slice(i + '"swaggerDoc":'.length).trim();
const doc = JSON.parse(jsonStr);
const paths = doc.paths || {};
const sim = [];
for (const [p, ops] of Object.entries(paths)) {
  for (const [method, spec] of Object.entries(ops)) {
    if (typeof spec !== 'object' || !spec.tags) continue;
    if (spec.tags.includes('Simulator')) {
      sim.push({
        path: p,
        method: method.toUpperCase(),
        summary: spec.summary || '',
        parameters: (spec.parameters || []).map((x) => ({
          name: x.name,
          in: x.in,
          required: x.required,
        })),
        hasRequestBody: Boolean(spec.requestBody),
      });
    }
  }
}
console.log(JSON.stringify(sim, null, 2));

const fs = require('fs');
const content = fs.readFileSync('/tmp/full_table.md', 'utf-8');
const lines = content.split('\n');
const clients = [];
for (let line of lines) {
  if (!line.includes('CLI-')) continue;
  const parts = line.split('|').map(p => p.trim());
  if (parts.length < 13) continue;
  const clientCode = parts[1];
  const name = parts[2];
  const clientType = parts[3];
  const doctorClass = parts[4];
  const regionSection = parts[5];
  const specialty = parts[6];
  const phone = parts[7];
  const address = parts[8];
  const region = parts[9];
  const repCode = parts[10];
  let lat = parseFloat(parts[11]);
  let lng = parseFloat(parts[12]);
  let radius = parseInt(parts[13]) || 100;
  if (isNaN(lat)) lat = 15.33;
  if (isNaN(lng)) lng = 44.20;

  let assignedRepId = 'usr_rep_2';
  if (repCode.includes('hassan')) assignedRepId = 'usr_rep_1';
  else if (repCode.includes('khalid')) assignedRepId = 'usr_rep_2';
  else assignedRepId = 'usr_rep_3';

  clients.push({
    id: `cli_${clientCode.toLowerCase().replace(/-/g, '_')}`,
    clientCode,
    name,
    clientType,
    doctorClass,
    regionSection,
    specialty,
    phone,
    address,
    region,
    assignedRepId,
    latitude: lat,
    longitude: lng,
    allowedVisitRadiusMeters: radius,
    isActive: true,
    createdAt: '2026-09-01T08:00:00Z',
    updatedAt: '2026-09-01T08:00:00Z'
  });
}
console.log(`Parsed ${clients.length} clients`);
const tsCode = `import { Client } from '../types';\n\nexport const createSeedClients = (): Client[] => {\n  return ${JSON.stringify(clients, null, 2)};\n};\n`;
fs.writeFileSync('/app/applet/src/db/seedClients.ts', tsCode);

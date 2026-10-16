
import fs from 'fs';
import path from 'path';

const mdContent = fs.readFileSync('/tmp/doctors_table.md', 'utf-8');
const lines = mdContent.trim().split('\n');
const dataLines = lines.slice(2); // Skip header and separator

const clients = dataLines.map(line => {
  const parts = line.split('|').map(p => p.trim());
  // Columns based on md table:
  // 1: kood, 2: name, 3: type, 4: class, 5: section(ignore), 6: spec, 7: phone, 8: addr, 9: region, 10: rep, 11: lat, 12: long, 13: radius
  return {
    clientCode: parts[1],
    name: parts[2],
    clientType: parts[3],
    doctorClass: parts[4],
    specialty: parts[6],
    phone: parts[7],
    address: parts[8],
    region: parts[9],
    assignedRepId: parts[10], // This might need a mapping, but let's try it
    latitude: parseFloat(parts[11]),
    longitude: parseFloat(parts[12]),
    allowedVisitRadiusMeters: parseInt(parts[13]),
    isActive: true
  };
});

// Since the user is logged in as admin "نجيب راصع" (usr_admin_1), I should use that as actorId.
// For bulk import, I need to send to /api/clients/bulk

console.log(JSON.stringify({ clients }));

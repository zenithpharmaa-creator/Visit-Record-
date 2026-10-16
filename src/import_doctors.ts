
import { serverDb } from './db/serverDb.js';
import fs from 'fs';

const mdContent = fs.readFileSync('src/full_table.md', 'utf-8');
const lines = mdContent.trim().split('\n');
const dataLines = lines.slice(2);

const clients = dataLines.map(line => {
  const parts = line.split('|').map(p => p.trim());
  return {
    clientCode: parts[1],
    name: parts[2],
    clientType: parts[3],
    doctorClass: parts[4],
    specialty: parts[6],
    phone: parts[7],
    address: parts[8],
    region: parts[9],
    assignedRepId: parts[10],
    latitude: parseFloat(parts[11]),
    longitude: parseFloat(parts[12]),
    allowedVisitRadiusMeters: parseInt(parts[13]),
    isActive: true
  };
});

const result = serverDb.bulkImportClients(clients, 'usr_admin_1');
console.log('Bulk import result:', result);

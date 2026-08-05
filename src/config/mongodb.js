import dns from 'dns';
import mongoose from 'mongoose';

const DEFAULT_DNS_SERVERS = ['8.8.8.8', '8.8.4.4', '1.1.1.1'];

let dnsConfigured = false;

/**
 * Node on Windows can fail mongodb+srv with querySrv ECONNREFUSED while system DNS works.
 * Use explicit resolvers before the driver resolves SRV records.
 */
export function configureMongoDns() {
  if (dnsConfigured) {
    return;
  }

  const fromEnv = process.env.MONGODB_DNS_SERVERS?.split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);

  dns.setServers(fromEnv?.length ? fromEnv : DEFAULT_DNS_SERVERS);

  if (typeof dns.setDefaultResultOrder === 'function') {
    dns.setDefaultResultOrder('ipv4first');
  }

  dnsConfigured = true;
}

export const mongoClientOptions = {
  serverSelectionTimeoutMS: 15000,
};

export async function connectMongo(uri = process.env.MONGODB_URI) {
  configureMongoDns();

  if (!uri) {
    throw new Error('MONGODB_URI is not set');
  }

  return mongoose.connect(uri, mongoClientOptions);
}

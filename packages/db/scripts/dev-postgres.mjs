// PostgreSQL محلي للتطوير من غير Docker — بيشتغل على 127.0.0.1:5544 والداتا في packages/db/.pgdata
import EmbeddedPostgres from 'embedded-postgres';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const dir = fileURLToPath(new URL('../.pgdata', import.meta.url));
const pg = new EmbeddedPostgres({ databaseDir: dir, user: 'invoices', password: 'invoices', port: 5544, persistent: true });
const fresh = !existsSync(dir);
if (fresh) await pg.initialise();
await pg.start();
if (fresh) await pg.createDatabase('invoices');
console.log('PostgreSQL شغال: postgresql://invoices:invoices@127.0.0.1:5544/invoices  (Ctrl+C للإيقاف)');
const stop = async () => { await pg.stop(); process.exit(0); };
process.on('SIGINT', stop);
process.on('SIGTERM', stop);

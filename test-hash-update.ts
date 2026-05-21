import { db } from './src_backend/data-source';
import { userAuthMethodsTable } from './src_backend/db/schema';
import { eq } from 'drizzle-orm';
import * as bcrypt from 'bcrypt';

async function run() {
  const newHash = await bcrypt.hash('qwaszx', 10);
  console.log('Generated hash:', newHash);

  await db.update(userAuthMethodsTable)
    .set({ passwordHash: newHash })
    .where(eq(userAuthMethodsTable.userId, 1));
    
  console.log('Updated db');
  
  process.exit(0);
}
run().catch(console.error);

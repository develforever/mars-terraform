import * as bcrypt from 'bcrypt';
async function run() {
  const match = await bcrypt.compare('qwaszx', '$2b$10$g73AMWdBENyuZte9uGnCOOvAejf4ovjMAXOEwVUTRmb51bRyOviOu');
  console.log('Match:', match);
  process.exit(0);
}
run().catch(console.error);

const { MongoClient, ObjectId } = require('mongodb');
require('dotenv').config();

async function main() {
  const uri = process.env.MONGODB_URI || 'mongodb+srv://admin:admin@inventorey-management-u.ysm2eig.mongodb.net/inventory_management';
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db();
  const categories = db.collection('categories');

  const id = '68b47995f0104c26161e9f6c';
  console.log('Using DB:', db.databaseName);
  const byId = await categories.findOne({ _id: new ObjectId(id) });
  console.log('byId present?', !!byId);
  if (byId) console.log('byId.name=', byId.name);

  const byName = await categories.findOne({ name: { $regex: new RegExp('Baby & Child Care', 'i') } });
  console.log('byName present?', !!byName);
  if (byName) console.log('byName._id=', byName._id.toString());

  await client.close();
}

main().catch(e => { console.error(e); process.exit(1); });

const { MongoClient, ObjectId } = require('mongodb');
require('dotenv').config();

async function main() {
  const uri = process.env.MONGODB_URI || 'mongodb+srv://admin:admin@inventorey-management-u.ysm2eig.mongodb.net/inventory_management';
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db();
  const categories = db.collection('categories');

  const id = '68b47995f0104c26161e9f6c';
  const name = 'Baby & Child Care';

  const byId = await categories.findOne({ _id: new ObjectId(id) });
  console.log('byId:', byId);

  const byName = await categories.findOne({ name: { $regex: new RegExp(name, 'i') } });
  console.log('byName:', byName);

  await client.close();
}

main().catch(e=>{ console.error(e); process.exit(1); });

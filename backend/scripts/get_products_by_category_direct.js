const { MongoClient, ObjectId } = require('mongodb');
require('dotenv').config();

(async function(){
  const uri = process.env.MONGODB_URI || 'mongodb+srv://admin:admin@inventorey-management-u.ysm2eig.mongodb.net/inventory_management';
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db();
  try {
    const categories = db.collection('categories');
    const products = db.collection('products');

    const categoryId = new ObjectId('68b47995f0104c26161e9f6c');
    const search = 'juice';

    const category = await categories.findOne({ _id: categoryId });
    if (!category) {
      console.log(JSON.stringify({ success: false, message: 'Category not found' }, null, 2));
      await client.close();
      return;
    }

    const searchRegex = { $regex: new RegExp(search, 'i') };
    const query = {
      $and: [
        { $or: [ { categoryId: categoryId }, { category: categoryId.toString() } ] },
        { $or: [ { name: searchRegex }, { brand: searchRegex }, { qrCode: searchRegex } ] }
      ]
    };

    const docs = await products.find(query, { projection: { name:1, brand:1, qrCode:1, price:1, stock:1, quantity:1 } }).toArray();

    const out = {
      success: true,
      category: { id: category._id, name: category.name },
      count: docs.length,
      products: docs.map(p => ({
        id: p._id,
        name: p.name,
        brand: p.brand,
        qrCode: p.qrCode,
        price: p.price,
        stock: {
          godown: p.stock?.godown || 0,
          store: p.stock?.store || 0,
          total: (p.stock && (typeof p.stock.total !== 'undefined')) ? p.stock.total : (p.quantity || 0),
          reserved: p.stock?.reserved || 0
        }
      }))
    };

    console.log(JSON.stringify(out, null, 2));
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await client.close();
  }
})();

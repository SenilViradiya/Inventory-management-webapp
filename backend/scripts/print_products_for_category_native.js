const { MongoClient, ObjectId } = require('mongodb');
require('dotenv').config();

async function main() {
  const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/inventory_management';
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  const db = client.db();

  // Simple CLI args parsing (no external deps)
  const rawArgs = process.argv.slice(2);
  const argv = {};
  rawArgs.forEach(arg => {
    if (arg.startsWith('--')) {
      const [key, ...rest] = arg.slice(2).split('=');
      argv[key] = rest.join('=') || true;
    }
  });
  console.log('Parsed argv:', argv);
  const rawCategoryId = argv.categoryId || argv.c;
  const categoryName = argv.categoryName || argv.name || '';
  const search = argv.search || '';

  try {
    const categoriesColl = db.collection('categories');
    const productsColl = db.collection('products');

    let category = null;
    if (rawCategoryId) {
      try { 
        category = await categoriesColl.findOne({ _id: new ObjectId(rawCategoryId) }); 
        console.log('debug: found by id ->', !!category);
      } catch (e) { 
        console.log('debug: find by id error', e.message);
      }
    }
    if (!category && categoryName) {
      category = await categoriesColl.findOne({ name: { $regex: new RegExp(categoryName, 'i') } });
      console.log('debug: found by name ->', !!category);
    }

    if (!category) {
      console.log(JSON.stringify({ success: false, message: 'Category not found' }, null, 2));
      return;
    }

    const categoryIdObj = category._id;

    const categoryIds = [categoryIdObj];

    // Build product query
    const orClauses = [ { categoryId: { $in: categoryIds } }, { category: { $in: categoryIds.map(id => id.toString()) } } ];
    const query = { $or: orClauses };

    if (search) {
      const searchRegex = { $regex: new RegExp(search, 'i') };
      query.$and = [ { $or: orClauses }, { $or: [ { name: searchRegex }, { brand: searchRegex }, { qrCode: searchRegex } ] } ];
      delete query.$or;
    }

    const productsCursor = productsColl.find(query, { projection: { name:1, brand:1, qrCode:1, price:1, stock:1, quantity:1 } }).limit(500);
    const products = await productsCursor.toArray();

    const result = {
      success: true,
      category: { id: category._id, name: category.name, description: category.description },
      query: { categoryId: category._id, categoryName, search },
      count: products.length,
      products: products.map(p => ({
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

    console.log(JSON.stringify(result, null, 2));
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await client.close();
  }
}

main();

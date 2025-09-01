const mongoose = require('mongoose');
require('dotenv').config();

const User = require('../models/User');
const Shop = require('../models/Shop');
const Category = require('../models/Category');

async function createCategoriesForUtsav() {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb+srv://admin:admin@inventorey-management-u.ysm2eig.mongodb.net/inventory_management', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('Connected to MongoDB');

    // Find user and shop
    const user = await User.findOne({ email: 'utsavparmar161@gmail.com' }).populate('shop');
    if (!user) throw new Error('User not found');
    if (!user.shop) throw new Error('User has no shop assigned');
    const shopId = user.shop._id;
    console.log('Found user and shop:', user.shop.name);

    // Clear existing categories for this shop
    await Category.deleteMany({ shop: shopId });
    console.log('Cleared existing categories');

    // Main categories for Off-License Store
    const mainCategories = [
      {
        name: 'Alcoholic Beverages',
        description: 'All types of alcoholic drinks and spirits',
        shop: shopId,
        createdBy: user._id
      },
      {
        name: 'Tobacco & Smoking',
        description: 'Cigarettes, cigars, smoking accessories',
        shop: shopId,
        createdBy: user._id
      },
      {
        name: 'Non-Alcoholic Beverages',
        description: 'Soft drinks, juices, water, hot beverages',
        shop: shopId,
        createdBy: user._id
      },
      {
        name: 'Food & Groceries',
        description: 'All food items and grocery essentials',
        shop: shopId,
        createdBy: user._id
      },
      {
        name: 'Snacks & Confectionery',
        description: 'Chips, chocolates, sweets, nuts',
        shop: shopId,
        createdBy: user._id
      },
      {
        name: 'Personal Care & Hygiene',
        description: 'Toiletries, beauty, health products',
        shop: shopId,
        createdBy: user._id
      },
      {
        name: 'Household Essentials',
        description: 'Cleaning, laundry, home maintenance',
        shop: shopId,
        createdBy: user._id
      },
      {
        name: 'Fresh Products',
        description: 'Fresh food, dairy, bakery items',
        shop: shopId,
        createdBy: user._id
      },
      {
        name: 'Baby & Child Care',
        description: 'Baby products, toys, child essentials',
        shop: shopId,
        createdBy: user._id
      },
      {
        name: 'Pet Care',
        description: 'Pet food, accessories, care products',
        shop: shopId,
        createdBy: user._id
      },
      {
        name: 'Electronics & Accessories',
        description: 'Batteries, chargers, small electronics',
        shop: shopId,
        createdBy: user._id
      },
      {
        name: 'Stationery & Office',
        description: 'Paper, pens, office supplies',
        shop: shopId,
        createdBy: user._id
      },
      {
        name: 'Seasonal & Special Items',
        description: 'Holiday, seasonal, gift items',
        shop: shopId,
        createdBy: user._id
      },
      {
        name: 'Automotive',
        description: 'Car care, fuel additives, accessories',
        shop: shopId,
        createdBy: user._id
      },
      {
        name: 'Magazines & Entertainment',
        description: 'Newspapers, magazines, lottery, games',
        shop: shopId,
        createdBy: user._id
      }
    ];
    
    const createdMainCategories = await Category.insertMany(mainCategories);
    console.log('Created main categories:', createdMainCategories.length);

    // ALCOHOLIC BEVERAGES - Comprehensive subcategories
    const alcoholCategory = createdMainCategories.find(cat => cat.name === 'Alcoholic Beverages');
    const alcoholSubcategories = [
      // Spirits
      { name: 'Whiskey & Whisky', description: 'Scotch, Irish, American, Canadian whiskey', shop: shopId, parent: alcoholCategory._id, createdBy: user._id },
      { name: 'Vodka', description: 'Premium, standard, flavored vodka', shop: shopId, parent: alcoholCategory._id, createdBy: user._id },
      { name: 'Gin', description: 'London dry, flavored, craft gin', shop: shopId, parent: alcoholCategory._id, createdBy: user._id },
      { name: 'Rum', description: 'White, dark, spiced, premium rum', shop: shopId, parent: alcoholCategory._id, createdBy: user._id },
      { name: 'Brandy & Cognac', description: 'Brandy, cognac, armagnac', shop: shopId, parent: alcoholCategory._id, createdBy: user._id },
      { name: 'Tequila', description: 'Blanco, reposado, añejo tequila', shop: shopId, parent: alcoholCategory._id, createdBy: user._id },
      { name: 'Liqueurs', description: 'Cream liqueurs, herbal, fruit liqueurs', shop: shopId, parent: alcoholCategory._id, createdBy: user._id },
      { name: 'Absinthe & Specialty', description: 'Absinthe, ouzo, sambuca', shop: shopId, parent: alcoholCategory._id, createdBy: user._id },
      
      // Beer & Cider
      { name: 'Lager', description: 'Pilsner, light, premium lager', shop: shopId, parent: alcoholCategory._id, createdBy: user._id },
      { name: 'Ale', description: 'Bitter, mild, IPA, pale ale', shop: shopId, parent: alcoholCategory._id, createdBy: user._id },
      { name: 'Stout & Porter', description: 'Guinness, craft stouts, porter', shop: shopId, parent: alcoholCategory._id, createdBy: user._id },
      { name: 'Wheat Beer', description: 'Hefeweizen, witbier, wheat ales', shop: shopId, parent: alcoholCategory._id, createdBy: user._id },
      { name: 'Craft Beer', description: 'Local, artisan, specialty beers', shop: shopId, parent: alcoholCategory._id, createdBy: user._id },
      { name: 'Cider', description: 'Apple, pear, flavored ciders', shop: shopId, parent: alcoholCategory._id, createdBy: user._id },
      { name: 'Low/No Alcohol Beer', description: 'Non-alcoholic, low alcohol options', shop: shopId, parent: alcoholCategory._id, createdBy: user._id },
      
      // Wine
      { name: 'Red Wine', description: 'Cabernet, Merlot, Pinot Noir, Shiraz', shop: shopId, parent: alcoholCategory._id, createdBy: user._id },
      { name: 'White Wine', description: 'Chardonnay, Sauvignon Blanc, Riesling', shop: shopId, parent: alcoholCategory._id, createdBy: user._id },
      { name: 'Rosé Wine', description: 'Pink wines, blush wines', shop: shopId, parent: alcoholCategory._id, createdBy: user._id },
      { name: 'Sparkling Wine', description: 'Champagne, Prosecco, Cava', shop: shopId, parent: alcoholCategory._id, createdBy: user._id },
      { name: 'Dessert Wine', description: 'Port, Sherry, sweet wines', shop: shopId, parent: alcoholCategory._id, createdBy: user._id },
      { name: 'Fortified Wine', description: 'Vermouth, Madeira, Marsala', shop: shopId, parent: alcoholCategory._id, createdBy: user._id },
      
      // Ready-to-Drink
      { name: 'Alcopops', description: 'WKD, Bacardi Breezer, Smirnoff Ice', shop: shopId, parent: alcoholCategory._id, createdBy: user._id },
      { name: 'Pre-mixed Cocktails', description: 'Canned cocktails, RTD mixers', shop: shopId, parent: alcoholCategory._id, createdBy: user._id },
      { name: 'Energy Drinks (Alcoholic)', description: 'Alcoholic energy drinks', shop: shopId, parent: alcoholCategory._id, createdBy: user._id },
      
      // Mixers & Accessories
      { name: 'Cocktail Mixers', description: 'Tonic, soda, bitters, mixers', shop: shopId, parent: alcoholCategory._id, createdBy: user._id },
      { name: 'Bar Accessories', description: 'Glasses, openers, ice', shop: shopId, parent: alcoholCategory._id, createdBy: user._id }
    ];
    await Category.insertMany(alcoholSubcategories);
    console.log('Created alcoholic beverages subcategories');

    // TOBACCO & SMOKING
    const tobaccoCategory = createdMainCategories.find(cat => cat.name === 'Tobacco & Smoking');
    const tobaccoSubcategories = [
      { name: 'Cigarettes', description: 'Premium, standard, menthol cigarettes', shop: shopId, parent: tobaccoCategory._id, createdBy: user._id },
      { name: 'Rolling Tobacco', description: 'Hand rolling tobacco, filters, papers', shop: shopId, parent: tobaccoCategory._id, createdBy: user._id },
      { name: 'Cigars', description: 'Premium, machine-made cigars', shop: shopId, parent: tobaccoCategory._id, createdBy: user._id },
      { name: 'Pipe Tobacco', description: 'Pipe tobacco, pipes, accessories', shop: shopId, parent: tobaccoCategory._id, createdBy: user._id },
      { name: 'E-Cigarettes', description: 'Vapes, e-liquids, pods', shop: shopId, parent: tobaccoCategory._id, createdBy: user._id },
      { name: 'Smoking Accessories', description: 'Lighters, matches, ashtrays', shop: shopId, parent: tobaccoCategory._id, createdBy: user._id },
      { name: 'Nicotine Alternatives', description: 'Patches, gum, lozenges', shop: shopId, parent: tobaccoCategory._id, createdBy: user._id }
    ];
    await Category.insertMany(tobaccoSubcategories);
    console.log('Created tobacco & smoking subcategories');

    // NON-ALCOHOLIC BEVERAGES
    const beverageCategory = createdMainCategories.find(cat => cat.name === 'Non-Alcoholic Beverages');
    const beverageSubcategories = [
      { name: 'Carbonated Soft Drinks', description: 'Coca-Cola, Pepsi, Sprite, Fanta', shop: shopId, parent: beverageCategory._id, createdBy: user._id },
      { name: 'Fruit Juices', description: 'Orange, apple, cranberry, tropical', shop: shopId, parent: beverageCategory._id, createdBy: user._id },
      { name: 'Water', description: 'Still, sparkling, flavored water', shop: shopId, parent: beverageCategory._id, createdBy: user._id },
      { name: 'Energy Drinks', description: 'Red Bull, Monster, Rockstar', shop: shopId, parent: beverageCategory._id, createdBy: user._id },
      { name: 'Sports Drinks', description: 'Lucozade, Powerade, isotonic drinks', shop: shopId, parent: beverageCategory._id, createdBy: user._id },
      { name: 'Tea & Coffee', description: 'Instant coffee, tea bags, specialty teas', shop: shopId, parent: beverageCategory._id, createdBy: user._id },
      { name: 'Smoothies & Shakes', description: 'Protein shakes, fruit smoothies', shop: shopId, parent: beverageCategory._id, createdBy: user._id },
      { name: 'Milk & Dairy Drinks', description: 'Fresh milk, flavored milk, milkshakes', shop: shopId, parent: beverageCategory._id, createdBy: user._id },
      { name: 'Health Drinks', description: 'Kombucha, probiotic drinks, wellness shots', shop: shopId, parent: beverageCategory._id, createdBy: user._id }
    ];
    await Category.insertMany(beverageSubcategories);
    console.log('Created non-alcoholic beverages subcategories');

    // FOOD & GROCERIES
    const foodCategory = createdMainCategories.find(cat => cat.name === 'Food & Groceries');
    const foodSubcategories = [
      { name: 'Bread & Bakery', description: 'Fresh bread, rolls, pastries, cakes', shop: shopId, parent: foodCategory._id, createdBy: user._id },
      { name: 'Canned Foods', description: 'Soups, beans, vegetables, fruits', shop: shopId, parent: foodCategory._id, createdBy: user._id },
      { name: 'Pasta & Rice', description: 'Dried pasta, rice varieties, noodles', shop: shopId, parent: foodCategory._id, createdBy: user._id },
      { name: 'Cereals & Breakfast', description: 'Breakfast cereals, oats, muesli', shop: shopId, parent: foodCategory._id, createdBy: user._id },
      { name: 'Cooking Ingredients', description: 'Flour, sugar, spices, oils', shop: shopId, parent: foodCategory._id, createdBy: user._id },
      { name: 'Sauces & Condiments', description: 'Ketchup, mayo, mustard, dressings', shop: shopId, parent: foodCategory._id, createdBy: user._id },
      { name: 'Frozen Foods', description: 'Ready meals, vegetables, ice cream', shop: shopId, parent: foodCategory._id, createdBy: user._id },
      { name: 'Meat & Fish', description: 'Fresh meat, deli, canned fish', shop: shopId, parent: foodCategory._id, createdBy: user._id },
      { name: 'International Foods', description: 'Asian, Indian, Mediterranean, Mexican', shop: shopId, parent: foodCategory._id, createdBy: user._id },
      { name: 'Organic & Health Foods', description: 'Organic products, health foods, superfoods', shop: shopId, parent: foodCategory._id, createdBy: user._id }
    ];
    await Category.insertMany(foodSubcategories);
    console.log('Created food & groceries subcategories');

    // SNACKS & CONFECTIONERY
    const snackCategory = createdMainCategories.find(cat => cat.name === 'Snacks & Confectionery');
    const snackSubcategories = [
      { name: 'Crisps & Chips', description: 'Potato chips, tortilla chips, pretzels', shop: shopId, parent: snackCategory._id, createdBy: user._id },
      { name: 'Chocolates', description: 'Milk, dark, white chocolate, bars', shop: shopId, parent: snackCategory._id, createdBy: user._id },
      { name: 'Sweets & Candy', description: 'Gummy sweets, hard candy, mints', shop: shopId, parent: snackCategory._id, createdBy: user._id },
      { name: 'Nuts & Seeds', description: 'Peanuts, almonds, mixed nuts, seeds', shop: shopId, parent: snackCategory._id, createdBy: user._id },
      { name: 'Biscuits & Cookies', description: 'Digestives, cookies, crackers', shop: shopId, parent: snackCategory._id, createdBy: user._id },
      { name: 'Popcorn & Corn Snacks', description: 'Popcorn varieties, corn chips', shop: shopId, parent: snackCategory._id, createdBy: user._id },
      { name: 'Healthy Snacks', description: 'Protein bars, fruit snacks, rice cakes', shop: shopId, parent: snackCategory._id, createdBy: user._id },
      { name: 'Ice Cream & Frozen Treats', description: 'Ice cream, lollies, frozen desserts', shop: shopId, parent: snackCategory._id, createdBy: user._id }
    ];
    await Category.insertMany(snackSubcategories);
    console.log('Created snacks & confectionery subcategories');

    // PERSONAL CARE & HYGIENE
    const personalCareCategory = createdMainCategories.find(cat => cat.name === 'Personal Care & Hygiene');
    const personalCareSubcategories = [
      { name: 'Oral Care', description: 'Toothpaste, toothbrushes, mouthwash', shop: shopId, parent: personalCareCategory._id, createdBy: user._id },
      { name: 'Hair Care', description: 'Shampoo, conditioner, styling products', shop: shopId, parent: personalCareCategory._id, createdBy: user._id },
      { name: 'Bath & Body', description: 'Soap, shower gel, body lotion', shop: shopId, parent: personalCareCategory._id, createdBy: user._id },
      { name: 'Deodorants', description: 'Antiperspirants, body sprays', shop: shopId, parent: personalCareCategory._id, createdBy: user._id },
      { name: 'Shaving', description: 'Razors, shaving cream, aftershave', shop: shopId, parent: personalCareCategory._id, createdBy: user._id },
      { name: 'Skincare', description: 'Moisturizers, cleansers, treatments', shop: shopId, parent: personalCareCategory._id, createdBy: user._id },
      { name: 'Feminine Care', description: 'Sanitary products, intimate care', shop: shopId, parent: personalCareCategory._id, createdBy: user._id },
      { name: 'First Aid', description: 'Plasters, antiseptic, pain relief', shop: shopId, parent: personalCareCategory._id, createdBy: user._id },
      { name: 'Sun Care', description: 'Sunscreen, after-sun, tanning products', shop: shopId, parent: personalCareCategory._id, createdBy: user._id }
    ];
    await Category.insertMany(personalCareSubcategories);
    console.log('Created personal care & hygiene subcategories');

    // HOUSEHOLD ESSENTIALS
    const householdCategory = createdMainCategories.find(cat => cat.name === 'Household Essentials');
    const householdSubcategories = [
      { name: 'Cleaning Products', description: 'Surface cleaners, bleach, disinfectants', shop: shopId, parent: householdCategory._id, createdBy: user._id },
      { name: 'Laundry', description: 'Washing powder, fabric softener, stain removers', shop: shopId, parent: householdCategory._id, createdBy: user._id },
      { name: 'Paper Products', description: 'Toilet paper, kitchen roll, tissues', shop: shopId, parent: householdCategory._id, createdBy: user._id },
      { name: 'Bin Bags & Storage', description: 'Refuse bags, food bags, storage containers', shop: shopId, parent: householdCategory._id, createdBy: user._id },
      { name: 'Air Fresheners', description: 'Sprays, plug-ins, candles', shop: shopId, parent: householdCategory._id, createdBy: user._id },
      { name: 'Kitchen Accessories', description: 'Foil, cling film, baking paper', shop: shopId, parent: householdCategory._id, createdBy: user._id },
      { name: 'Light Bulbs', description: 'LED, energy saving, specialty bulbs', shop: shopId, parent: householdCategory._id, createdBy: user._id }
    ];
    await Category.insertMany(householdSubcategories);
    console.log('Created household essentials subcategories');

    // FRESH PRODUCTS
    const freshCategory = createdMainCategories.find(cat => cat.name === 'Fresh Products');
    const freshSubcategories = [
      { name: 'Fruits', description: 'Apples, bananas, citrus, seasonal fruits', shop: shopId, parent: freshCategory._id, createdBy: user._id },
      { name: 'Vegetables', description: 'Potatoes, onions, fresh vegetables', shop: shopId, parent: freshCategory._id, createdBy: user._id },
      { name: 'Dairy', description: 'Milk, cheese, yogurt, butter', shop: shopId, parent: freshCategory._id, createdBy: user._id },
      { name: 'Eggs', description: 'Free range, organic, standard eggs', shop: shopId, parent: freshCategory._id, createdBy: user._id },
      { name: 'Fresh Meat', description: 'Chicken, beef, pork, lamb', shop: shopId, parent: freshCategory._id, createdBy: user._id },
      { name: 'Fish & Seafood', description: 'Fresh fish, smoked fish, seafood', shop: shopId, parent: freshCategory._id, createdBy: user._id },
      { name: 'Herbs & Salads', description: 'Fresh herbs, salad leaves, garnishes', shop: shopId, parent: freshCategory._id, createdBy: user._id }
    ];
    await Category.insertMany(freshSubcategories);
    console.log('Created fresh products subcategories');

    // BABY & CHILD CARE
    const babyCategory = createdMainCategories.find(cat => cat.name === 'Baby & Child Care');
    const babySubcategories = [
      { name: 'Baby Food', description: 'Formula, baby food jars, snacks', shop: shopId, parent: babyCategory._id, createdBy: user._id },
      { name: 'Diapers & Wipes', description: 'Disposable nappies, wet wipes', shop: shopId, parent: babyCategory._id, createdBy: user._id },
      { name: 'Baby Care', description: 'Baby shampoo, lotion, bath products', shop: shopId, parent: babyCategory._id, createdBy: user._id },
      { name: 'Feeding Accessories', description: 'Bottles, teats, sippy cups', shop: shopId, parent: babyCategory._id, createdBy: user._id },
      { name: 'Toys & Games', description: 'Small toys, puzzles, activity books', shop: shopId, parent: babyCategory._id, createdBy: user._id }
    ];
    await Category.insertMany(babySubcategories);
    console.log('Created baby & child care subcategories');

    // PET CARE
    const petCategory = createdMainCategories.find(cat => cat.name === 'Pet Care');
    const petSubcategories = [
      { name: 'Dog Food', description: 'Dry food, wet food, treats', shop: shopId, parent: petCategory._id, createdBy: user._id },
      { name: 'Cat Food', description: 'Cat food, litter, treats', shop: shopId, parent: petCategory._id, createdBy: user._id },
      { name: 'Pet Accessories', description: 'Leads, bowls, toys', shop: shopId, parent: petCategory._id, createdBy: user._id },
      { name: 'Pet Healthcare', description: 'Flea treatments, vitamins, grooming', shop: shopId, parent: petCategory._id, createdBy: user._id }
    ];
    await Category.insertMany(petSubcategories);
    console.log('Created pet care subcategories');

    // ELECTRONICS & ACCESSORIES
    const electronicsCategory = createdMainCategories.find(cat => cat.name === 'Electronics & Accessories');
    const electronicsSubcategories = [
      { name: 'Batteries', description: 'AA, AAA, rechargeable, specialty', shop: shopId, parent: electronicsCategory._id, createdBy: user._id },
      { name: 'Phone Accessories', description: 'Chargers, cases, screen protectors', shop: shopId, parent: electronicsCategory._id, createdBy: user._id },
      { name: 'Audio', description: 'Headphones, earbuds, speakers', shop: shopId, parent: electronicsCategory._id, createdBy: user._id },
      { name: 'Memory & Storage', description: 'SD cards, USB drives, power banks', shop: shopId, parent: electronicsCategory._id, createdBy: user._id },
      { name: 'Cables & Adapters', description: 'USB cables, adapters, extensions', shop: shopId, parent: electronicsCategory._id, createdBy: user._id }
    ];
    await Category.insertMany(electronicsSubcategories);
    console.log('Created electronics & accessories subcategories');

    // STATIONERY & OFFICE
    const stationeryCategory = createdMainCategories.find(cat => cat.name === 'Stationery & Office');
    const stationerySubcategories = [
      { name: 'Writing Supplies', description: 'Pens, pencils, markers, highlighters', shop: shopId, parent: stationeryCategory._id, createdBy: user._id },
      { name: 'Paper Products', description: 'Notebooks, notepads, envelopes', shop: shopId, parent: stationeryCategory._id, createdBy: user._id },
      { name: 'Office Supplies', description: 'Staplers, tape, clips, folders', shop: shopId, parent: stationeryCategory._id, createdBy: user._id },
      { name: 'School Supplies', description: 'Rulers, erasers, glue, scissors', shop: shopId, parent: stationeryCategory._id, createdBy: user._id }
    ];
    await Category.insertMany(stationerySubcategories);
    console.log('Created stationery & office subcategories');

    // SEASONAL & SPECIAL ITEMS
    const seasonalCategory = createdMainCategories.find(cat => cat.name === 'Seasonal & Special Items');
    const seasonalSubcategories = [
      { name: 'Christmas Items', description: 'Decorations, gifts, seasonal foods', shop: shopId, parent: seasonalCategory._id, createdBy: user._id },
      { name: 'Halloween', description: 'Costumes, decorations, sweets', shop: shopId, parent: seasonalCategory._id, createdBy: user._id },
      { name: 'Easter', description: 'Chocolate eggs, decorations', shop: shopId, parent: seasonalCategory._id, createdBy: user._id },
      { name: 'Summer Items', description: 'BBQ supplies, cooling products', shop: shopId, parent: seasonalCategory._id, createdBy: user._id },
      { name: 'Gift Cards', description: 'Various gift vouchers and cards', shop: shopId, parent: seasonalCategory._id, createdBy: user._id },
      { name: 'Party Supplies', description: 'Balloons, candles, party accessories', shop: shopId, parent: seasonalCategory._id, createdBy: user._id }
    ];
    await Category.insertMany(seasonalSubcategories);
    console.log('Created seasonal & special items subcategories');

    // AUTOMOTIVE
    const automotiveCategory = createdMainCategories.find(cat => cat.name === 'Automotive');
    const automotiveSubcategories = [
      { name: 'Car Care', description: 'Car wash, wax, interior cleaners', shop: shopId, parent: automotiveCategory._id, createdBy: user._id },
      { name: 'Motor Oil & Fluids', description: 'Engine oil, antifreeze, brake fluid', shop: shopId, parent: automotiveCategory._id, createdBy: user._id },
      { name: 'Car Accessories', description: 'Air fresheners, phone mounts, tools', shop: shopId, parent: automotiveCategory._id, createdBy: user._id },
      { name: 'Emergency Supplies', description: 'Jump leads, warning triangles, first aid', shop: shopId, parent: automotiveCategory._id, createdBy: user._id }
    ];
    await Category.insertMany(automotiveSubcategories);
    console.log('Created automotive subcategories');

    // MAGAZINES & ENTERTAINMENT
    const magazineCategory = createdMainCategories.find(cat => cat.name === 'Magazines & Entertainment');
    const magazineSubcategories = [
      { name: 'Newspapers', description: 'Daily papers, local news', shop: shopId, parent: magazineCategory._id, createdBy: user._id },
      { name: 'Magazines', description: 'Lifestyle, sports, hobby magazines', shop: shopId, parent: magazineCategory._id, createdBy: user._id },
      { name: 'Lottery & Scratchcards', description: 'National lottery, instant win games', shop: shopId, parent: magazineCategory._id, createdBy: user._id },
      { name: 'Books', description: 'Paperbacks, crossword books, puzzles', shop: shopId, parent: magazineCategory._id, createdBy: user._id },
      { name: 'Travel Essentials', description: 'Maps, travel guides, phone top-ups', shop: shopId, parent: magazineCategory._id, createdBy: user._id }
    ];
    await Category.insertMany(magazineSubcategories);
    console.log('Created magazines & entertainment subcategories');

    // Count total categories created
    const totalCategories = await Category.countDocuments({ shop: shopId });
    console.log(`\n✅ Comprehensive category system created successfully!`);
    console.log(`📊 Total categories: ${totalCategories}`);
    console.log(`📂 Main categories: ${createdMainCategories.length}`);
    console.log(`📁 Subcategories: ${totalCategories - createdMainCategories.length}`);
    console.log(`\nYour off-license store now has complete coverage for:`);
    console.log(`🍺 All alcoholic beverages (beer, wine, spirits, RTDs)`);
    console.log(`🚬 Tobacco and smoking products`);
    console.log(`🥤 Non-alcoholic drinks`);
    console.log(`🛒 Complete grocery range`);
    console.log(`🍿 Snacks and confectionery`);
  } catch (error) {
    console.error('Error creating categories:', error);
  } finally {
    await mongoose.connection.close();
    console.log('Database connection closed');
  }
}

createCategoriesForUtsav();

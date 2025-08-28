const express = require('express');
const router = express.Router();
const { Parser } = require('json2csv');
const PDFDocument = require('pdfkit');
const Product = require('../models/Product');
const ActivityLog = require('../models/ActivityLog');
const { authenticateToken, requireRole } = require('../middleware/auth');

// Helper function to generate CSV
const generateCSV = (data, fields) => {
  const parser = new Parser({ fields });
  return parser.parse(data);
};

// Helper function to generate PDF
const generatePDF = (data, title, headers, res) => {
  const doc = new PDFDocument({ margin: 50 });
  
  // Set response headers
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${title.replace(/\s+/g, '_').toLowerCase()}.pdf"`);
  
  // Pipe PDF to response
  doc.pipe(res);
  
  // Add title
  doc.fontSize(20).text(title, 50, 50);
  doc.fontSize(12).text(`Generated on: ${new Date().toLocaleString()}`, 50, 80);
  
  // Add table headers
  let yPosition = 120;
  const columnWidth = (doc.page.width - 100) / headers.length;
  
  doc.fontSize(10);
  headers.forEach((header, index) => {
    doc.text(header, 50 + (index * columnWidth), yPosition, {
      width: columnWidth,
      align: 'left'
    });
  });
  
  yPosition += 20;
  doc.moveTo(50, yPosition).lineTo(doc.page.width - 50, yPosition).stroke();
  yPosition += 10;
  
  // Add data rows
  data.forEach((row) => {
    if (yPosition > doc.page.height - 100) {
      doc.addPage();
      yPosition = 50;
    }
    
    Object.values(row).forEach((value, index) => {
      const text = value !== null && value !== undefined ? value.toString() : '';
      doc.text(text.substring(0, 30), 50 + (index * columnWidth), yPosition, {
        width: columnWidth - 5,
        align: 'left'
      });
    });
    yPosition += 15;
  });
  
  doc.end();
};

// GET /api/reports/products - Export products report
router.get('/products', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const { format = 'csv', category, includeExpired = 'true', includeLowStock = 'true' } = req.query;

    // Build filter
    const filter = {};
    if (category) filter.category = category;

    const products = await Product.find(filter)
      .populate('createdBy', 'username fullName')
      .populate('updatedBy', 'username fullName')
      .sort({ name: 1 });

    // Filter products based on criteria
    let filteredProducts = products;
    
    if (includeExpired === 'false') {
      filteredProducts = filteredProducts.filter(product => !product.isExpired);
    }
    
    if (includeLowStock === 'false') {
      filteredProducts = filteredProducts.filter(product => !product.isLowStock);
    }

    const reportData = filteredProducts.map(product => ({
      name: product.name,
      category: product.category,
      price: product.price,
      quantity: product.quantity,
      qrCode: product.qrCode,
      expirationDate: product.expirationDate.toISOString().split('T')[0],
      lowStockThreshold: product.lowStockThreshold,
      stockValue: (product.price * product.quantity).toFixed(2),
      status: product.isExpired ? 'Expired' : product.isLowStock ? 'Low Stock' : 'Normal',
      createdBy: product.createdBy?.fullName || 'N/A',
      createdAt: product.createdAt.toISOString().split('T')[0]
    }));

    // Log the export activity
    await new ActivityLog({
      userId: req.user.id,
      action: 'EXPORT_REPORT',
      details: `Exported products report (${format.toUpperCase()}) - ${reportData.length} products`
    }).save();

    if (format === 'pdf') {
      const headers = ['Name', 'Category', 'Price', 'Quantity', 'QR Code', 'Expiry', 'Status'];
      const pdfData = reportData.map(item => ({
        name: item.name,
        category: item.category,
        price: `$${item.price}`,
        quantity: item.quantity,
        qrCode: item.qrCode,
        expiry: item.expirationDate,
        status: item.status
      }));
      
      generatePDF(pdfData, 'Products Report', headers, res);
    } else {
      // Default to CSV
      const fields = [
        'name', 'category', 'price', 'quantity', 'qrCode', 'expirationDate',
        'lowStockThreshold', 'stockValue', 'status', 'createdBy', 'createdAt'
      ];
      
      const csv = generateCSV(reportData, fields);
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="products_report.csv"');
      res.send(csv);
    }
  } catch (error) {
    res.status(500).json({ message: 'Error generating products report', error: error.message });
  }
});

// GET /api/reports/sales - Export sales report
router.get('/sales', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const { format = 'csv', startDate, endDate, category } = req.query;

    // Set date range
    const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // Default: 30 days ago
    const end = endDate ? new Date(endDate) : new Date(); // Default: now

    // Build aggregation pipeline
    const matchStage = {
      action: { $in: ['REDUCE_STOCK', 'BULK_REDUCTION'] },
      reversed: false,
      createdAt: { $gte: start, $lte: end }
    };

    const salesData = await ActivityLog.aggregate([
      { $match: matchStage },
      {
        $lookup: {
          from: 'products',
          localField: 'productId',
          foreignField: '_id',
          as: 'product'
        }
      },
      { $unwind: '$product' },
      {
        $match: category ? { 'product.category': category } : {}
      },
      {
        $lookup: {
          from: 'users',
          localField: 'userId',
          foreignField: '_id',
          as: 'user'
        }
      },
      { $unwind: '$user' },
      {
        $project: {
          date: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          time: { $dateToString: { format: '%H:%M:%S', date: '$createdAt' } },
          productName: '$product.name',
          category: '$product.category',
          qrCode: '$product.qrCode',
          quantitySold: { $abs: '$change' },
          unitPrice: '$product.price',
          totalValue: { $multiply: [{ $abs: '$change' }, '$product.price'] },
          soldBy: '$user.fullName',
          action: '$action'
        }
      },
      { $sort: { createdAt: -1 } }
    ]);

    const reportData = salesData.map(sale => ({
      date: sale.date,
      time: sale.time,
      productName: sale.productName,
      category: sale.category,
      qrCode: sale.qrCode,
      quantitySold: sale.quantitySold,
      unitPrice: sale.unitPrice.toFixed(2),
      totalValue: sale.totalValue.toFixed(2),
      soldBy: sale.soldBy,
      transactionType: sale.action === 'BULK_REDUCTION' ? 'Bulk Sale' : 'Single Sale'
    }));

    // Calculate summary
    const summary = {
      totalTransactions: reportData.length,
      totalQuantitySold: reportData.reduce((sum, item) => sum + item.quantitySold, 0),
      totalSalesValue: reportData.reduce((sum, item) => sum + parseFloat(item.totalValue), 0).toFixed(2),
      dateRange: `${start.toISOString().split('T')[0]} to ${end.toISOString().split('T')[0]}`
    };

    // Log the export activity
    await new ActivityLog({
      userId: req.user.id,
      action: 'EXPORT_REPORT',
      details: `Exported sales report (${format.toUpperCase()}) - ${reportData.length} transactions, $${summary.totalSalesValue} total value`
    }).save();

    if (format === 'pdf') {
      const headers = ['Date', 'Product', 'Category', 'Qty Sold', 'Unit Price', 'Total', 'Sold By'];
      const pdfData = reportData.map(item => ({
        date: item.date,
        product: item.productName.substring(0, 20),
        category: item.category,
        qty: item.quantitySold,
        price: `$${item.unitPrice}`,
        total: `$${item.totalValue}`,
        soldBy: item.soldBy.substring(0, 15)
      }));
      
      generatePDF(pdfData, `Sales Report (${summary.dateRange})`, headers, res);
    } else {
      // Add summary at the top for CSV
      const csvData = [
        {
          date: 'SUMMARY',
          time: '',
          productName: `Total Transactions: ${summary.totalTransactions}`,
          category: `Total Quantity: ${summary.totalQuantitySold}`,
          qrCode: `Total Value: $${summary.totalSalesValue}`,
          quantitySold: `Date Range: ${summary.dateRange}`,
          unitPrice: '',
          totalValue: '',
          soldBy: '',
          transactionType: ''
        },
        {
          date: '',
          time: '',
          productName: '',
          category: '',
          qrCode: '',
          quantitySold: '',
          unitPrice: '',
          totalValue: '',
          soldBy: '',
          transactionType: ''
        },
        ...reportData
      ];

      const fields = [
        'date', 'time', 'productName', 'category', 'qrCode', 'quantitySold',
        'unitPrice', 'totalValue', 'soldBy', 'transactionType'
      ];
      
      const csv = generateCSV(csvData, fields);
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="sales_report.csv"');
      res.send(csv);
    }
  } catch (error) {
    res.status(500).json({ message: 'Error generating sales report', error: error.message });
  }
});

// GET /api/reports/expiry - Export expiry report
router.get('/expiry', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const { format = 'csv', includeExpired = 'true', daysAhead = 30 } = req.query;

    const now = new Date();
    const futureDate = new Date(now.getTime() + (parseInt(daysAhead) * 24 * 60 * 60 * 1000));

    // Build filter for products expiring within the specified timeframe
    const filter = {
      expirationDate: { $lte: futureDate }
    };

    if (includeExpired === 'false') {
      filter.expirationDate.$gte = now;
    }

    const products = await Product.find(filter)
      .populate('createdBy', 'username fullName')
      .sort({ expirationDate: 1 });

    const reportData = products.map(product => {
      const daysUntilExpiry = Math.ceil((product.expirationDate - now) / (1000 * 60 * 60 * 24));
      
      return {
        name: product.name,
        category: product.category,
        qrCode: product.qrCode,
        expirationDate: product.expirationDate.toISOString().split('T')[0],
        daysUntilExpiry: daysUntilExpiry,
        quantity: product.quantity,
        unitPrice: product.price.toFixed(2),
        totalValue: (product.price * product.quantity).toFixed(2),
        status: daysUntilExpiry < 0 ? 'Expired' : daysUntilExpiry <= 7 ? 'Critical' : 'Warning',
        createdBy: product.createdBy?.fullName || 'N/A'
      };
    });

    // Calculate summary
    const summary = {
      totalProducts: reportData.length,
      expiredProducts: reportData.filter(item => item.status === 'Expired').length,
      criticalProducts: reportData.filter(item => item.status === 'Critical').length,
      totalValue: reportData.reduce((sum, item) => sum + parseFloat(item.totalValue), 0).toFixed(2)
    };

    // Log the export activity
    await new ActivityLog({
      userId: req.user.id,
      action: 'EXPORT_REPORT',
      details: `Exported expiry report (${format.toUpperCase()}) - ${reportData.length} products, ${summary.expiredProducts} expired`
    }).save();

    if (format === 'pdf') {
      const headers = ['Product', 'Category', 'Expiry Date', 'Days Until', 'Quantity', 'Value', 'Status'];
      const pdfData = reportData.map(item => ({
        product: item.name.substring(0, 25),
        category: item.category,
        expiry: item.expirationDate,
        days: item.daysUntilExpiry,
        quantity: item.quantity,
        value: `$${item.totalValue}`,
        status: item.status
      }));
      
      generatePDF(pdfData, 'Product Expiry Report', headers, res);
    } else {
      // Add summary at the top for CSV
      const csvData = [
        {
          name: 'SUMMARY',
          category: `Total Products: ${summary.totalProducts}`,
          qrCode: `Expired: ${summary.expiredProducts}`,
          expirationDate: `Critical (≤7 days): ${summary.criticalProducts}`,
          daysUntilExpiry: `Total Value: $${summary.totalValue}`,
          quantity: '',
          unitPrice: '',
          totalValue: '',
          status: '',
          createdBy: ''
        },
        {
          name: '',
          category: '',
          qrCode: '',
          expirationDate: '',
          daysUntilExpiry: '',
          quantity: '',
          unitPrice: '',
          totalValue: '',
          status: '',
          createdBy: ''
        },
        ...reportData
      ];

      const fields = [
        'name', 'category', 'qrCode', 'expirationDate', 'daysUntilExpiry',
        'quantity', 'unitPrice', 'totalValue', 'status', 'createdBy'
      ];
      
      const csv = generateCSV(csvData, fields);
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="expiry_report.csv"');
      res.send(csv);
    }
  } catch (error) {
    res.status(500).json({ message: 'Error generating expiry report', error: error.message });
  }
});

// GET /api/reports/stock-valuation - Export stock valuation report
router.get('/stock-valuation', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const { format = 'csv', category, includeZeroStock = 'false' } = req.query;

    const filter = {};
    if (category) filter.category = category;
    if (includeZeroStock === 'false') filter.quantity = { $gt: 0 };

    const products = await Product.find(filter)
      .populate('createdBy', 'username fullName')
      .sort({ category: 1, name: 1 });

    const reportData = products.map(product => ({
      name: product.name,
      category: product.category,
      qrCode: product.qrCode,
      quantity: product.quantity,
      unitPrice: product.price.toFixed(2),
      totalValue: (product.price * product.quantity).toFixed(2),
      lowStockThreshold: product.lowStockThreshold,
      status: product.quantity === 0 ? 'Out of Stock' : product.isLowStock ? 'Low Stock' : 'In Stock',
      expirationDate: product.expirationDate.toISOString().split('T')[0],
      createdBy: product.createdBy?.fullName || 'N/A'
    }));

    // Calculate summary by category
    const categoryTotals = reportData.reduce((acc, item) => {
      if (!acc[item.category]) {
        acc[item.category] = {
          products: 0,
          totalQuantity: 0,
          totalValue: 0
        };
      }
      acc[item.category].products += 1;
      acc[item.category].totalQuantity += item.quantity;
      acc[item.category].totalValue += parseFloat(item.totalValue);
      return acc;
    }, {});

    const overallTotal = Object.values(categoryTotals).reduce((sum, cat) => sum + cat.totalValue, 0);

    // Log the export activity
    await new ActivityLog({
      userId: req.user.id,
      action: 'EXPORT_REPORT',
      details: `Exported stock valuation report (${format.toUpperCase()}) - ${reportData.length} products, $${overallTotal.toFixed(2)} total value`
    }).save();

    if (format === 'pdf') {
      const headers = ['Product', 'Category', 'Quantity', 'Unit Price', 'Total Value', 'Status'];
      const pdfData = reportData.map(item => ({
        product: item.name.substring(0, 25),
        category: item.category,
        quantity: item.quantity,
        price: `$${item.unitPrice}`,
        value: `$${item.totalValue}`,
        status: item.status
      }));
      
      generatePDF(pdfData, 'Stock Valuation Report', headers, res);
    } else {
      // Add category summaries and overall total
      const csvData = [
        {
          name: 'STOCK VALUATION SUMMARY',
          category: '',
          qrCode: '',
          quantity: '',
          unitPrice: '',
          totalValue: '',
          lowStockThreshold: '',
          status: '',
          expirationDate: '',
          createdBy: ''
        }
      ];

      // Add category summaries
      Object.entries(categoryTotals).forEach(([category, totals]) => {
        csvData.push({
          name: `${category} Category`,
          category: `${totals.products} products`,
          qrCode: `${totals.totalQuantity} total qty`,
          quantity: `$${totals.totalValue.toFixed(2)} total value`,
          unitPrice: '',
          totalValue: '',
          lowStockThreshold: '',
          status: '',
          expirationDate: '',
          createdBy: ''
        });
      });

      csvData.push({
        name: 'OVERALL TOTAL',
        category: `${reportData.length} products`,
        qrCode: `${reportData.reduce((sum, item) => sum + item.quantity, 0)} total qty`,
        quantity: `$${overallTotal.toFixed(2)} total value`,
        unitPrice: '',
        totalValue: '',
        lowStockThreshold: '',
        status: '',
        expirationDate: '',
        createdBy: ''
      });

      csvData.push({
        name: '',
        category: '',
        qrCode: '',
        quantity: '',
        unitPrice: '',
        totalValue: '',
        lowStockThreshold: '',
        status: '',
        expirationDate: '',
        createdBy: ''
      });

      csvData.push(...reportData);

      const fields = [
        'name', 'category', 'qrCode', 'quantity', 'unitPrice', 'totalValue',
        'lowStockThreshold', 'status', 'expirationDate', 'createdBy'
      ];
      
      const csv = generateCSV(csvData, fields);
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="stock_valuation_report.csv"');
      res.send(csv);
    }
  } catch (error) {
    res.status(500).json({ message: 'Error generating stock valuation report', error: error.message });
  }
});

module.exports = router;

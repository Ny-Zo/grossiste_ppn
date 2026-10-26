const cors = require('cors');
const express = require('express');
const helmet = require('helmet');
const env = require('./config/env');
const { errorHandler, notFound } = require('./middleware/errorHandler');

const app = express();

app.disable('x-powered-by');
app.use(helmet());
app.use(cors({ origin: env.CORS_ORIGIN.split(',').map((origin) => origin.trim()) }));
app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'grossiste-ppn-api' });
});

app.use('/api/auth', require('./modules/auth'));
app.use('/api/users', require('./modules/users'));
app.use('/api/devices', require('./modules/devices'));
app.use('/api/products', require('./modules/products'));
app.use('/api/suppliers', require('./modules/suppliers'));
app.use('/api/purchases', require('./modules/purchases'));
app.use('/api/stock', require('./modules/stock'));
app.use('/api/customers', require('./modules/customers'));
app.use('/api/sales', require('./modules/sales'));
app.use('/api/cash', require('./modules/cash'));
app.use('/api/expenses', require('./modules/expenses'));
app.use('/api/accounting', require('./modules/accounting'));
app.use('/api/dashboard', require('./modules/dashboard'));
app.use('/api/sync', require('./modules/sync'));

app.use(notFound);
app.use(errorHandler);

module.exports = app;
const { ZodError } = require('zod');

const notFound = (req, res) => {
  res.status(404).json({ error: `Route introuvable: ${req.method} ${req.originalUrl}` });
};

const errorHandler = (error, req, res, next) => {
  if (res.headersSent) return next(error);

  if (error instanceof ZodError) {
    return res.status(400).json({
      error: 'Données invalides.',
      details: error.issues.map(({ path, message }) => ({ field: path.join('.'), message }))
    });
  }

  if (error.code === '23505') {
    return res.status(409).json({ error: 'Cette valeur existe déjà.' });
  }

  const status = Number.isInteger(error.status) ? error.status : 500;
  if (status >= 500) console.error(error);
  return res.status(status).json({
    error: status >= 500 && process.env.NODE_ENV === 'production'
      ? 'Erreur interne du serveur.'
      : error.message || 'Erreur interne du serveur.'
  });
};

module.exports = { notFound, errorHandler };
const validate = (schema, target = 'body') => (req, res, next) => {
  const result = schema.safeParse(req[target]);
  if (!result.success) return next(result.error);
  req.validated = req.validated || {};
  req.validated[target] = result.data;
  return next();
};

module.exports = { validate };
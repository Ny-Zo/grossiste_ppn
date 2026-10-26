const allowedRoles = new Set(['admin', 'gerant', 'caissier', 'magasinier']);

const requireRoles = (...roles) => {
  const invalidRole = roles.find((role) => !allowedRoles.has(role));
  if (invalidRole) throw new Error(`Rôle inconnu: ${invalidRole}`);

  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Authentification requise.' });
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Accès non autorisé.' });
    }
    return next();
  };
};

module.exports = { requireRoles };
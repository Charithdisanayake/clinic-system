// Every route that touches clients or appointments MUST use this.
// This is the single choke point for the public/private boundary --
// see README "Security notes" for why that matters more than performance here.
function requireAuth(req, res, next) {
  if (!req.session || !req.session.doctorId) {
    return res.status(401).json({ error: 'Not logged in.' });
  }
  next();
}

module.exports = { requireAuth };

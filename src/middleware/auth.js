const User = require("../models/User");

module.exports = async function (req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Basic "))
    return res.status(401).json({ message: "Unauthorized" });

  const base64Credentials = authHeader.split(" ")[1];
  const credentials = Buffer.from(base64Credentials, "base64").toString("ascii");
  const [username, password] = credentials.split(":");

  const user = await User.findOne({ username });
  if (!user) return res.status(401).json({ message: "Invalid credentials" });

  const valid = await user.comparePassword(password);
  if (!valid) return res.status(401).json({ message: "Invalid credentials" });

  req.user = user;
  next();
};
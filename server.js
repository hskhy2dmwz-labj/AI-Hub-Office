 const express = require("express");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.get("/api/health", (req, res) => {
  res.json({
    status: "online",
    name: "AI Office"
  });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`AI Office running on port ${PORT}`);
});

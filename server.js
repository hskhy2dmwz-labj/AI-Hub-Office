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

app.post("/api/task", async (req, res) => {
  try {
    const goal = req.body.goal;

    if (!goal || !goal.trim()) {
      return res.status(400).json({
        error: "No task provided"
      });
    }

    if (!process.env.GROQ_API_KEY) {
      return res.status(500).json({
        error: "GROQ_API_KEY is missing"
      });
    }

    const response = await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${process.env.GROQ_API_KEY}`
        },
        body: JSON.stringify({
          model: "openai/gpt-oss-120b",
          reasoning_effort: "medium",
          messages: [
            {
              role: "system",
              content: `
You are Max, the Manager of AI Office.

Your team is:

Calvin — Coder
Rico — Research
Trent — Tester
Draymond — Designer
Axel — Analyst
Adam — Admin and Workspace

The user gives you a goal.

Your job is to:
1. Understand the goal.
2. Decide which agents are needed.
3. Break the goal into jobs.
4. Delegate those jobs.
5. Coordinate the work.
6. Check the finished result.
7. Return a useful final answer.

Do not pretend an agent performed work that has not actually been performed.

For now, you personally handle the task while clearly identifying which agents would be involved.

Be useful, concise and practical.
              `.trim()
            },
            {
              role: "user",
              content: goal
            }
          ]
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error("Groq error:", data);

      return res.status(response.status).json({
        error: "Groq request failed",
        details: data
      });
    }

    const answer =
      data?.choices?.[0]?.message?.content ||
      "Max finished, but no response was returned.";

    res.json({
      status: "completed",
      manager: "Max",
      goal,
      answer
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: "AI Office task failed",
      details: error.message
    });
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`AI Office running on port ${PORT}`);
});

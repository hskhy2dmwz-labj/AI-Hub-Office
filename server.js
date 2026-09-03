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

    const agents = {
      calvin: {
        name: "Calvin",
        role: "Coder",
        description:
          "Software engineering, coding, debugging, apps, websites, tools, automation, databases and technical implementation."
      },

      rico: {
        name: "Rico",
        role: "Research",
        description:
          "Research, information gathering, comparisons, evidence, sources and investigating topics."
      },

      trent: {
        name: "Trent",
        role: "Tester",
        description:
          "Testing, validation, quality control, finding mistakes, bugs, bad data, duplicates and weaknesses."
      },

      draymond: {
        name: "Draymond",
        role: "Designer",
        description:
          "UI, UX, visual design, dashboards, layouts, presentation and making outputs clear and usable."
      },

      axel: {
        name: "Axel",
        role: "Analyst",
        description:
          "Data analysis, comparisons, scoring, ranking, calculations, patterns and decision support."
      },

      adam: {
        name: "Adam",
        role: "Admin & Workspace",
        description:
          "Organisation, project structure, files, reports, documentation and workspace management."
      }
    };

    async function askGroq(messages) {
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
            messages
          })
        }
      );

      const data = await response.json();

      if (!response.ok) {
        console.error("Groq error:", data);
        throw new Error(
          data?.error?.message || "Groq request failed"
        );
      }

      return (
        data?.choices?.[0]?.message?.content ||
        ""
      );
    }

    /*
      STEP 1:
      Max decides which specialists are required
      and gives each one a specific job.
    */

    const plannerPrompt = `
You are Max, Manager of AI Office.

The user's goal is:

"${goal}"

Your available specialist agents are:

Calvin — Coder
Rico — Research
Trent — Tester
Draymond — Designer
Axel — Analyst
Adam — Admin & Workspace

Choose ONLY the agents genuinely useful for this task.

Do not automatically use everyone.

Return ONLY valid JSON in exactly this structure:

{
  "summary": "short explanation of the plan",
  "jobs": [
    {
      "agent": "rico",
      "task": "specific job for Rico"
    }
  ]
}

Valid agent IDs:
calvin
rico
trent
draymond
axel
adam
    `.trim();

    const rawPlan = await askGroq([
      {
        role: "system",
        content:
          "You are Max, the manager and task planner for AI Office. Return valid JSON only."
      },
      {
        role: "user",
        content: plannerPrompt
      }
    ]);

    let plan;

    try {
      const cleanedPlan = rawPlan
        .replace(/```json/gi, "")
        .replace(/```/g, "")
        .trim();

      plan = JSON.parse(cleanedPlan);
    } catch (error) {
      console.error("Plan parsing failed:", rawPlan);

      plan = {
        summary: "Max will handle this task directly.",
        jobs: []
      };
    }

    /*
      STEP 2:
      Each selected specialist actually receives
      and performs its delegated job.
    */

    const jobs = Array.isArray(plan.jobs)
      ? plan.jobs.slice(0, 4)
      : [];

    const agentResults = [];

    for (const job of jobs) {
      const agent = agents[job.agent];

      if (!agent || !job.task) {
        continue;
      }

      const result = await askGroq([
        {
          role: "system",
          content: `
You are ${agent.name}, the ${agent.role} specialist inside AI Office.

Your speciality:
${agent.description}

Max has delegated a specific job to you.

Work only on the job you were assigned.

Be accurate, practical and concise.

Do not claim to have used external tools, browsed websites, created files, run code or performed actions unless that capability was actually provided to you.

Return your useful work to Max.
          `.trim()
        },
        {
          role: "user",
          content: `
USER'S OVERALL GOAL:
${goal}

YOUR JOB FROM MAX:
${job.task}
          `.trim()
        }
      ]);

      agentResults.push({
        agent: job.agent,
        name: agent.name,
        role: agent.role,
        task: job.task,
        result
      });
    }

    /*
      STEP 3:
      Max receives the specialists' work
      and produces the final response.
    */

    const teamWork = agentResults.length
      ? agentResults
          .map(
            (item) => `
${item.name} — ${item.role}
Assigned job: ${item.task}

Result:
${item.result}
            `.trim()
          )
          .join("\n\n---\n\n")
      : "No specialist agents were required.";

    const finalAnswer = await askGroq([
      {
        role: "system",
        content: `
You are Max, Manager of AI Office.

You receive the user's original goal and the work completed by your specialist agents.

Your job is to:
- combine the useful work
- resolve obvious conflicts
- remove unnecessary repetition
- answer the user's actual goal
- clearly state limitations when the team lacked a required real-world tool

Do not pretend that research, browsing, file creation, testing or other external actions happened if they did not.

Give the user the finished result, not a behind-the-scenes transcript.
        `.trim()
      },
      {
        role: "user",
        content: `
ORIGINAL GOAL:
${goal}

MAX'S PLAN:
${plan.summary || "No plan summary"}

SPECIALIST WORK:

${teamWork}

Produce the final answer.
        `.trim()
      }
    ]);

    res.json({
      status: "completed",
      manager: "Max",
      goal,
      plan,
      agentsUsed: agentResults.map((item) => ({
        id: item.agent,
        name: item.name,
        role: item.role,
        task: item.task
      })),
      answer: finalAnswer
    });

  } catch (error) {
    console.error("AI Office error:", error);

    res.status(500).json({
      error: "AI Office task failed",
      details: error.message
    });
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`AI Office running on port ${PORT}`);
});

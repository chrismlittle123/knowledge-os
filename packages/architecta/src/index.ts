/**
 * Architecta CLI
 *
 * The intelligent orchestrator for software development.
 * Modes:
 *   plan    - Generate and stress-test a plan
 *   review  - Review an implementation against a spec
 *   run     - Full loop: plan -> execute -> review -> iterate
 */

import * as fs from "fs";
import * as path from "path";
import * as readline from "readline";
import {
  createOrchestrator,
  type Orchestrator,
  type Plan,
  type Implementation,
} from "@architecta/core";

// CLI state
let orchestrator: Orchestrator;
let currentPlan: Plan | null = null;

async function main() {
  const args = process.argv.slice(2);
  const mode = args[0] || "interactive";
  const workDir = args[1] || process.cwd();

  orchestrator = createOrchestrator({ workDir });

  // Stream events to stdout
  orchestrator.onEvent((event) => {
    switch (event.type) {
      case "thinking":
        console.log(`\n[${event.message}]\n`);
        break;
      case "output":
        process.stdout.write(event.text);
        break;
      case "plan_ready":
        currentPlan = event.plan;
        break;
      case "review_ready":
        console.log("\n[Review complete]\n");
        break;
      case "error":
        console.error(`\nError: ${event.error}\n`);
        break;
    }
  });

  switch (mode) {
    case "plan":
      await runPlanMode(workDir);
      break;
    case "review":
      await runReviewMode(workDir, args[2]);
      break;
    case "interactive":
    default:
      await runInteractiveMode(workDir);
      break;
  }
}

/**
 * Interactive mode - the default CLI experience
 */
async function runInteractiveMode(workDir: string) {
  printBanner();
  console.log(`Working directory: ${workDir}\n`);
  console.log("Commands:");
  console.log("  [requirement]  - Start planning");
  console.log("  refine [text]  - Refine current plan");
  console.log("  review [impl]  - Review implementation against plan");
  console.log("  save           - Save current plan to file");
  console.log("  status         - Show workflow status");
  console.log("  reset          - Start over");
  console.log("  exit           - Quit");
  console.log("─".repeat(50) + "\n");

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const prompt = (q: string): Promise<string> =>
    new Promise((resolve) => rl.question(q, resolve));

  while (true) {
    const input = await prompt("You: ");
    const trimmed = input.trim();

    if (!trimmed) continue;

    // Parse command
    const [command, ...rest] = trimmed.split(" ");
    const args = rest.join(" ");

    try {
      switch (command.toLowerCase()) {
        case "exit":
        case "quit":
          console.log("\nGoodbye!");
          rl.close();
          process.exit(0);
          break; // Unreachable but satisfies linter

        case "save": {
          await handleSave(workDir);
          break;
        }

        case "status":
          console.log("\n" + orchestrator.getSummary() + "\n");
          break;

        case "reset":
          orchestrator.reset();
          currentPlan = null;
          console.log("\nWorkflow reset. Ready for new requirement.\n");
          break;

        case "refine":
          if (!currentPlan) {
            console.log("\nNo plan to refine. Describe what you want to build first.\n");
          } else {
            console.log("\nArchitecta: Refining plan...\n");
            currentPlan = await orchestrator.refinePlan(args);
            console.log("\n");
          }
          break;

        case "review":
          if (!currentPlan) {
            console.log("\nNo plan to review against. Create a plan first.\n");
          } else {
            await handleReview(args);
          }
          break;

        default:
          // Treat as a requirement
          console.log("\nArchitecta: Planning...\n");
          currentPlan = await orchestrator.plan(trimmed);
          console.log("\n");
          break;
      }
    } catch (error) {
      console.error("\nError:", error instanceof Error ? error.message : error);
      console.log("");
    }
  }
}

/**
 * Plan mode - single-shot planning
 */
async function runPlanMode(workDir: string) {
  printBanner();
  console.log(`Working directory: ${workDir}\n`);
  console.log("Enter your requirement (end with Ctrl+D):\n");

  const chunks: string[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk.toString());
  }
  const requirement = chunks.join("");

  if (!requirement.trim()) {
    console.log("No requirement provided.");
    process.exit(1);
  }

  console.log("\nArchitecta: Planning...\n");
  const plan = await orchestrator.plan(requirement);

  // Output just the plan
  console.log("\n\n--- PLAN ---\n");
  console.log(plan.raw);
}

/**
 * Review mode - review implementation against a spec file
 */
async function runReviewMode(workDir: string, specPath?: string) {
  if (!specPath) {
    console.error("Usage: architecta review <spec.md> [implementation]");
    process.exit(1);
  }

  printBanner();

  // Load spec
  const specContent = fs.readFileSync(specPath, "utf-8");
  console.log(`Loaded spec: ${specPath}\n`);

  // Create a plan from the spec
  console.log("Architecta: Analyzing spec...\n");
  currentPlan = await orchestrator.plan(
    `Review mode: Analyze this existing spec and prepare to review an implementation against it.\n\n${specContent}`
  );

  // Review local changes by default
  const implementation: Implementation = {
    type: "local",
    identifier: workDir,
  };

  console.log("\nArchitecta: Reviewing implementation...\n");
  const result = await orchestrator.review(implementation);

  // Output results
  console.log("\n\n--- REVIEW RESULT ---\n");
  console.log(`Confidence: ${result.confidence}%`);
  console.log(`Level: ${result.confidenceLevel}`);
  console.log(`Recommendation: ${result.recommendedAction.type}`);
  console.log(`\nSummary: ${result.summary}`);

  if (result.issues.length > 0) {
    console.log("\nIssues:");
    for (const issue of result.issues) {
      console.log(`  - ${issue}`);
    }
  }
}

/**
 * Handle save command
 */
async function handleSave(workDir: string) {
  if (!currentPlan) {
    console.log("\nNo plan to save yet.\n");
    return;
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const planPath = path.join(workDir, `plan-${timestamp}.md`);
  fs.writeFileSync(planPath, currentPlan.raw);
  console.log(`\nPlan saved to: ${planPath}\n`);
}

/**
 * Handle review command
 */
async function handleReview(args: string) {
  // Parse implementation type
  let implementation: Implementation;

  if (args.startsWith("pr:")) {
    implementation = { type: "pr", identifier: args.slice(3) };
  } else if (args.startsWith("branch:")) {
    implementation = { type: "branch", identifier: args.slice(7) };
  } else if (args) {
    implementation = { type: "local", identifier: args };
  } else {
    implementation = { type: "local", identifier: "." };
  }

  console.log("\nArchitecta: Reviewing implementation...\n");
  const result = await orchestrator.review(implementation);

  // Show routing decision
  const routing = orchestrator.route(result);
  console.log("\n--- Routing Decision ---");
  console.log(`Action: ${routing.action}`);
  console.log(`Reason: ${routing.reason}\n`);
}

/**
 * Print banner
 */
function printBanner() {
  console.log("╔════════════════════════════════════════╗");
  console.log("║           ARCHITECTA                   ║");
  console.log("║     Intelligent Orchestrator           ║");
  console.log("╚════════════════════════════════════════╝");
  console.log("");
}

main().catch(console.error);

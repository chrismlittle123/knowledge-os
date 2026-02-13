# Intent and Execution — The Convergence of Computation

That's the right question and I want to resist the temptation to give you a tidy answer, because I think the honest picture is both simpler and stranger than the taxonomy I just laid out.

**I think we're converging toward a world where there are really only two things: intent and execution.** The entire apparatus in between — programming languages, frameworks, paradigms, the seven-category taxonomy I just gave you — is intermediation that exists because of historical limitations in our ability to go directly from one to the other.

Today, a human has intent ("I want to optimise my delivery routes subject to these constraints"). Translating that intent into execution currently requires choosing a paradigm (this is a mixed-integer programming problem), selecting a tool (Gurobi), writing code to formulate the problem, debugging, testing, deploying. The human has to know that this is an optimisation problem. They have to know Gurobi exists. They have to know how to formulate constraints. Each of these is a learned skill that took years to acquire and exists only because the machine can't infer it from the intent alone.

The convergence point is a system where you express intent — in natural language, in examples, in formal constraints, in whatever medium is most natural for the domain — and the system **automatically selects the right computational substrate**, formulates the problem appropriately, executes it, and returns results with appropriate uncertainty quantification and explanation. Under the hood, it might dispatch to a solver for the optimisation component, a neural network for demand prediction, a Bayesian model for uncertainty, and compiled machine code for the transaction processing. But the human never needs to know that. The routing is itself a learned capability.

In this framing, the seven paradigms don't disappear — they become **implementation details hidden behind an intelligent dispatch layer.** Much as a modern CPU has wildly heterogeneous execution units internally (integer ALU, floating point unit, vector unit, branch predictor, cache hierarchy) but presents a clean abstraction to the programmer, the future computational stack would have heterogeneous computational substrates internally but present a clean abstraction to the human: *say what you want, get what you need.*

**If I had to sketch the architecture we're converging toward, it would be three layers:**

At the top, a **natural language / formal specification interface** — this is how humans express intent. It might be conversational, it might be a formal spec, it might be a demonstration, it might be a dataset of examples. The key property is that it's *human-native* — expressed in whatever representation is most natural for the human, not for the machine.

In the middle, what you might call an **orchestration intelligence** — a learned system (almost certainly a large neural network or successor architecture) that understands the structure of the problem, decomposes it, selects appropriate computational substrates, manages data flow between them, handles error cases, and presents results. This is the layer that knows "this sub-problem is an optimisation, this sub-problem is perception, this sub-problem needs Bayesian treatment." This layer is itself opaque — it's learned, not programmed.

At the bottom, a **heterogeneous execution layer** — compiled machine code, neural network weights, solvers, simulators, whatever is optimal for each sub-problem. All opaque. All binary. Potentially running on heterogeneous hardware (CPUs, GPUs, TPUs, quantum processors, neuromorphic chips, FPGAs) with the orchestration layer handling placement.

**This is, essentially, what a very good engineering team does today — but with the human expertise replaced by learned capability at the orchestration layer.**

And if you squint, this is also roughly what the human brain does. You don't consciously decide "I'll use my visual cortex for this and my hippocampus for that and my prefrontal cortex for planning." The brain has heterogeneous specialised subsystems and a learned routing/orchestration capacity that dispatches problems to the appropriate substrate without conscious awareness. You just *think*, and the right machinery engages.

**So what are we converging to?** I think the answer is: **a single interface (intent) backed by a single orchestration intelligence that dispatches to a plurality of execution substrates that no human ever inspects.**

The plurality at the bottom doesn't collapse — trees remain better than neural networks for tabular data, solvers remain better for constrained optimisation, compiled code remains better for exact arithmetic. But the plurality becomes *invisible*. The human-facing surface area of computation shrinks to: express what you want, verify that you got it.

Which means the skill that remains valuable is the one we've been exercising in this conversation — **knowing what to ask for, and knowing whether the answer is right.** Specification and verification. Everything in between becomes infrastructure.

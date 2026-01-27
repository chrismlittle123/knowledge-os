# KnowledgeOS: Component to Role Mapping

## The Framework

Each component of KnowledgeOS maps to a distinct organizational role:

| Component | Role | Function |
|-----------|------|----------|
| **Captura** | Data Engineer | Ingestion, transformation, enrichment |
| **Sapien** | Knowledge Engineer | Structuring data into queryable knowledge |
| **Architecta** | Product Engineer | Turning knowledge into specs/blueprints |
| **Fabrica** | Software Engineer | Building artefacts from specs |
| **Lumina** | Product Manager | Illuminating outcomes, guiding what to build next |
| **Opera** | Systems Engineer | Observing, orchestrating, optimizing the whole system |

## The Loop

```
PM measures outcomes
        ↓
Data Engineer ingests
        ↓
Knowledge Engineer structures
        ↓
Product Engineer specs
        ↓
Software Engineer builds
        ↓
PM measures outcomes
        ↓
      ...
```

## Role Definitions

### Data Engineer (Captura)
Owns the data layer. Connects to sources, transforms and normalizes incoming data, enables exploration, routes data requests.

### Knowledge Engineer (Sapien)
Owns the knowledge layer. Structures and indexes data, maintains knowledge graph relationships, answers queries, corrects outdated knowledge.

### Product Engineer (Architecta)
Owns the spec layer. Applies intelligence and judgment to produce blueprints — decides *what* gets built and *why*.

### Software Engineer (Fabrica)
Owns the execution layer. Transforms specifications into artefacts — code, documents, reports, dashboards. Pure implementation.

### Product Manager (Lumina)
Owns the outcomes layer. The guiding light that illuminates impact, reveals expectation mismatches, and enlightens us on what to build next.

### Systems Engineer (Opera)
Owns the orchestration layer. Monitors all component health and throughput, identifies bottlenecks, allocates resources dynamically, flags anomalies. The all-seeing eye.

## Why This Works

- **Product Engineer** and **Product Manager** bookend the build phase — one defines, one evaluates
- **Software Engineer** is pure execution — no decisions about *what*, only *how*
- **Knowledge Engineer** bridges raw data and actionable intelligence
- **Data Engineer** ensures clean, accessible inputs to the whole system
- **Systems Engineer** keeps the entire loop healthy and optimized

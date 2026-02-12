import * as gcp from "@pulumi/gcp";
import * as pulumi from "@pulumi/pulumi";

// =============================================================================
// Configuration
// =============================================================================

const gcpConfig = new pulumi.Config("gcp");
const config = new pulumi.Config();

const region = gcpConfig.require("region");
const project = gcpConfig.require("project");

// Service configuration
const serviceName = config.get("serviceName") || "fabrica";
const repositoryId = config.get("repositoryId") || "fabrica";
const imageName = config.get("imageName") || "control-plane";

// Resource limits
const cpu = config.get("cpu") || "1";
const memory = config.get("memory") || "1Gi";
const minInstances = config.getNumber("minInstances") ?? 0;
const maxInstances = config.getNumber("maxInstances") ?? 3;
const concurrency = config.getNumber("concurrency") ?? 80;

// Secrets that need to be injected (must exist in Secret Manager)
const secretMappings = config.getObject<Record<string, string>>("secrets") || {
  ANTHROPIC_API_KEY: "fabrica-anthropic-api-key",
  GITHUB_TOKEN: "fabrica-github-token",
};

const environment = pulumi.getStack();
const containerName = `${serviceName}-${environment}`;

// =============================================================================
// Artifact Registry
// =============================================================================

const artifactRegistry = new gcp.artifactregistry.Repository(
  "fabrica-repo",
  {
    repositoryId: repositoryId,
    location: region,
    format: "DOCKER",
    description: `Docker images for ${serviceName}`,
  },
  {
    protect: true, // Prevent accidental deletion
  }
);

// =============================================================================
// Secrets (create if they don't exist)
// =============================================================================

// Create secrets in Secret Manager (values set manually via CLI)
const secrets: Record<string, gcp.secretmanager.Secret> = {};

for (const [envVar, secretId] of Object.entries(secretMappings)) {
  secrets[envVar] = new gcp.secretmanager.Secret(secretId, {
    secretId: secretId,
    replication: {
      auto: {},
    },
  });
}

// =============================================================================
// Service Account & IAM
// =============================================================================

const serviceAccount = new gcp.serviceaccount.Account("fabrica-sa", {
  accountId: containerName.substring(0, 28),
  displayName: `Service account for ${containerName}`,
});

// Grant service account access to each secret
Object.entries(secrets).forEach(([envVar, secret], index) => {
  new gcp.secretmanager.SecretIamMember(`secret-access-${index}`, {
    secretId: secret.secretId,
    role: "roles/secretmanager.secretAccessor",
    member: pulumi.interpolate`serviceAccount:${serviceAccount.email}`,
  });
});

// =============================================================================
// Cloud Run Service
// =============================================================================

// Build secret environment variables with proper secretKeyRef
const secretEnvs = Object.entries(secretMappings).map(([envVar, secretId]) => ({
  name: envVar,
  valueSource: {
    secretKeyRef: {
      secret: secretId,
      version: "latest",
    },
  },
}));

const service = new gcp.cloudrunv2.Service("fabrica", {
  name: containerName,
  location: region,
  ingress: "INGRESS_TRAFFIC_ALL",
  deletionProtection: false,
  template: {
    serviceAccount: serviceAccount.email,
    maxInstanceRequestConcurrency: concurrency,
    scaling: {
      minInstanceCount: minInstances,
      maxInstanceCount: maxInstances,
    },
    containers: [
      {
        image: `${region}-docker.pkg.dev/${project}/${repositoryId}/${imageName}:latest`,
        ports: { containerPort: 8080 },
        resources: {
          limits: { cpu, memory },
          cpuIdle: true, // Scale to zero when idle
        },
        envs: [
          { name: "NODE_ENV", value: "production" },
          ...secretEnvs,
        ],
      },
    ],
  },
  traffics: [
    {
      type: "TRAFFIC_TARGET_ALLOCATION_TYPE_LATEST",
      percent: 100,
    },
  ],
});

// Allow unauthenticated access
new gcp.cloudrunv2.ServiceIamMember("fabrica-invoker", {
  name: service.name,
  location: region,
  role: "roles/run.invoker",
  member: "allUsers",
});

// =============================================================================
// Exports
// =============================================================================

export const serviceUrl = service.uri;
export const serviceAccountEmail = serviceAccount.email;
export const artifactRegistryUrl = pulumi.interpolate`${region}-docker.pkg.dev/${project}/${artifactRegistry.repositoryId}`;

// Instructions for setting secrets
export const secretSetupCommands = Object.entries(secretMappings).map(
  ([envVar, secretId]) =>
    `echo -n "YOUR_VALUE" | gcloud secrets versions add ${secretId} --data-file=-`
);

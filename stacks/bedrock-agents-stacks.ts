import { StackContext, Function, Bucket, Stack } from "sst/constructs";
import { BedrockAgent, BedrockKnowledgeBase } from "bedrock-agents-cdk";
import * as iam from "aws-cdk-lib/aws-iam";
import * as secretsmanager from "aws-cdk-lib/aws-secretsmanager";
import { SecretValue } from "aws-cdk-lib";

const CUSTOM_ID = "poc";

function getPyBundlePath(name: string) {
  return `py-bundles/${name}-py-bundle`;
}

function createKnowledgeBase(stack: Stack) {
  const kbDocumentsBucket = new Bucket(
    stack,
    `bedrock-kb-${CUSTOM_ID}-documents`
  );

  const apiKeyPineconeSecret = new secretsmanager.Secret(
    stack,
    "api-key-pinecone-secret",
    {
      secretObjectValue: {
        apiKey: SecretValue.unsafePlainText(process.env.PINECONE_API_KEY ?? ""),
      },
    }
  );

  const bedrockKbRole = new iam.Role(stack, `bedrock-kb-role-${CUSTOM_ID}`, {
    roleName: `AmazonBedrockExecutionRoleForKnowledgeBase_bkb-${CUSTOM_ID}-${stack.stage}`,
    description: "IAM role to create a Bedrock Knowledge Base",
    assumedBy: new iam.ServicePrincipal("bedrock.amazonaws.com", {
      conditions: {
        ["StringEquals"]: {
          "aws:SourceAccount": stack.account,
        },
        ["ArnLike"]: {
          "aws:SourceArn": `arn:aws:bedrock:us-east-1:${stack.account}:knowledge-base/*`,
        },
      },
    }),
    managedPolicies: [
      new iam.ManagedPolicy(stack, `bedrock-kb-${CUSTOM_ID}-invoke`, {
        statements: [
          new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: ["bedrock:InvokeModel"],
            resources: [
              "arn:aws:bedrock:us-east-1::foundation-model/amazon.titan-embed-text-v1",
            ],
          }),
        ],
      }),
      new iam.ManagedPolicy(
        stack,
        `bedrock-kb-${CUSTOM_ID}-s3-managed-policy`,
        {
          statements: [
            new iam.PolicyStatement({
              sid: "S3ListBucketStatement",
              effect: iam.Effect.ALLOW,
              actions: ["s3:ListBucket"],
              resources: [kbDocumentsBucket.bucketArn],
              conditions: {
                ["StringEquals"]: {
                  "aws:ResourceAccount": stack.account,
                },
              },
            }),
            new iam.PolicyStatement({
              sid: "S3GetObjectStatement",
              effect: iam.Effect.ALLOW,
              actions: ["s3:GetObject"],
              resources: [`${kbDocumentsBucket.bucketArn}/*`],
              conditions: {
                ["StringEquals"]: {
                  "aws:ResourceAccount": stack.account,
                },
              },
            }),
          ],
        }
      ),
      new iam.ManagedPolicy(stack, `bedrock-kb-${CUSTOM_ID}-secret-manager`, {
        statements: [
          new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: ["secretsmanager:GetSecretValue"],
            resources: [apiKeyPineconeSecret.secretArn],
          }),
        ],
      }),
    ],
  });

  const bedrockKbName = `bedrock-kb-${CUSTOM_ID}-${stack.stage}`;
  const bedrockKb = new BedrockKnowledgeBase(stack, `bedrock-kb-${CUSTOM_ID}`, {
    name: bedrockKbName,
    roleArn: bedrockKbRole.roleArn,
    storageConfiguration: {
      pineconeConfiguration: {
        connectionString: process.env.PINECONE_CONNECTION_STRING ?? "",
        credentialsSecretArn: apiKeyPineconeSecret.secretArn,
        fieldMapping: {
          metadataField: "metadata",
          textField: "text",
        },
      },
      type: "PINECONE",
    },
    dataSource: {
      dataSourceConfiguration: {
        s3Configuration: {
          bucketArn: kbDocumentsBucket.bucketArn,
        },
      },
    },
  });

  const promptFunction = new Function(stack, `bedrock-prompt-${CUSTOM_ID}`, {
    runtime: "python3.12",
    handler: "packages/functions/src/prompt/lambda.handler",
    python: {
      noDocker: true,
    },
    copyFiles: [{ from: getPyBundlePath("prompt"), to: "./" }],
    url: true,
    timeout: "1 minute",
  });
  promptFunction.addToRolePolicy(
    new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        "bedrock:RetrieveAndGenerate",
        "bedrock:Retrieve",
        "bedrock:InvokeModel",
      ],
      resources: ["*"],
    })
  );

  const syncKnowledgeBaseFunction = new Function(
    stack,
    `sync-kb-${CUSTOM_ID}`,
    {
      runtime: "python3.12",
      handler: "packages/functions/src/sync-kb/lambda.handler",
      python: {
        noDocker: true,
      },
      copyFiles: [{ from: getPyBundlePath("sync-kb"), to: "./" }],
      environment: {
        KNOWLEDGE_BASE_ID: bedrockKb.knowledgeBaseId,
        DATA_SOURCE_ID: bedrockKb.dataSourceId,
      },
    }
  );
  syncKnowledgeBaseFunction.addToRolePolicy(
    new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        "bedrock:StartIngestionJob",
        "bedrock:AssociateThirdPartyKnowledgeBase",
      ],
      resources: ["*"],
    })
  );

  kbDocumentsBucket.addNotifications(stack, {
    syncKnowledgeBase: {
      function: syncKnowledgeBaseFunction,
      events: ["object_created", "object_removed"],
    },
  });

  return { promptFunction, bedrockKbName } as const;
}

function createAgent(stack: Stack, bedrockKbName: string) {
  const agentResourceRoleArn = new iam.Role(
    stack,
    `bedrock-agent-role-${CUSTOM_ID}`,
    {
      assumedBy: new iam.ServicePrincipal("bedrock.amazonaws.com"),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName("AdministratorAccess"),
      ],
    }
  ).roleArn;

  new BedrockAgent(stack, `bedrock-agent-${CUSTOM_ID}`, {
    agentName: `bedrock-agent-${stack.stage}`,
    instruction:
      "You are an assitant that answers any question from potencial or existing customers. Answer politely and with clarity.",
    foundationModel: "anthropic.claude-v2:1",
    agentResourceRoleArn: agentResourceRoleArn,
    actionGroups: [
      {
        actionGroupName: "action-group-test",
        actionGroupExecutor: "arn-lambda-test",
        s3BucketName: "s3-open-api-schema",
        s3ObjectKey: "open-api-schema",
      },
    ],
    knowledgeBaseAssociations: [
      {
        knowledgeBaseName: bedrockKbName,
        instruction: "This is general information",
      },
    ],
  });
}

export function BedrockAgentsStack({ stack }: StackContext) {
  const { bedrockKbName, promptFunction } = createKnowledgeBase(stack);
  createAgent(stack, bedrockKbName);

  stack.addOutputs({
    promptUrl: promptFunction.url,
  });
}
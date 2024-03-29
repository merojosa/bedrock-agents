import { SSTConfig } from "sst";
import { BedrockAgentsStack } from "./stacks/bedrock-agents-stacks";

export default {
  config(_input) {
    return {
      name: "bedrock-agent-lambda",
      region: "us-east-1",
    };
  },
  stacks(app) {
    app.stack(BedrockAgentsStack);
  },
} satisfies SSTConfig;

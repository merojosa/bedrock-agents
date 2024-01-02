# Amazon Bedrock architecture with Knowledge Base and Lambda using SST

This is a proof of concept that uses Amazon Bedrock to create a chatbot.

It uses: 
- [SST](https://sst.dev/) to deploy everything to AWS.
- [Pinecone](https://www.pinecone.io/) as vector database to use the free tier and avoid charges (you can use OpenSearch or a different vector database).
- [Lambda functions](https://aws.amazon.com/lambda/) in Python via [boto3](https://boto3.amazonaws.com/v1/documentation/api/latest/index.html) to communicate to Amazon Bedrock.

## Architecture

<img src="https://raw.githubusercontent.com/merojosa/knowledge-base-lambda/main/assets/architecture.png" />


## Get started

Setup your IAM credentials: [https://docs.sst.dev/advanced/iam-credentials](https://docs.sst.dev/advanced/iam-credentials)

Create a `.env` in the root of the project with the Pinecone crendentials:

```
PINECONE_API_KEY=your_api_key
PINECONE_CONNECTION_STRING=your_host
```

Execute the following commands with pnpm:

```
pnpm install
pnpm bundle-prompt
pnpm bundle-sync-kb
pnpm sst deploy --stage dev
```

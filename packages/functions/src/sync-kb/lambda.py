import boto3
import os


def handler(event, context):
    print("Starting syncing...")

    bedrock_client = boto3.client(
        service_name="bedrock-agent",
        region_name="us-east-1",
    )

    response = bedrock_client.start_ingestion_job(
        knowledgeBaseId=os.environ['KNOWLEDGE_BASE_ID'],
        dataSourceId=os.environ['DATA_SOURCE_ID'],
    )

    return {
        "statusCode": 200,
        "headers": {
            "Content-Type": "application/json",
        },
        "body": {
            "ingestionJobId": response["ingestionJob"]["ingestionJobId"]
        },
    }

import boto3
import json


def handler(event, context):
    print("Prompting...")
    bedrock_client = boto3.client(
        service_name="bedrock-agent-runtime",
        region_name="us-east-1",
    )

    body = json.loads(event['body'])
    input = body.get('input')
    agent_id = body.get("agentId")
    agent_alias_id = body.get("agentAliasId")
    session_id = body.get("sessionId")

    print(input)

    if (session_id is None):
        response = bedrock_client.invoke_agent(
            inputText=input,
            endSession=False,
            enableTrace=False,
            agentId=agent_id,
            agentAliasId=agent_alias_id,
            sessionId="00"
        )
    else:
        response = bedrock_client.retrieve_and_generate(
            inputText=input,
            endSession=False,
            enableTrace=False,
            agentId=agent_id,
            agentAliasId=agent_alias_id,
            sessionId=session_id,
        )

    print(response)

    return {
        "statusCode": 200,
        "headers": {
            "Content-Type": "application/json",
        },
        "body": {
            "sessionId": response["sessionId"],
        },
    }
